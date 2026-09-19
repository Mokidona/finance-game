import { useEffect, useRef, useState } from "react";
import {
  SHEET_CELL,
  SHEET_ROWS,
  EMOTION_ANIM,
  DEFAULT_SLIME_ID,
  getAnimation,
  getSlime,
  sheetUrl,
} from "./slimeAssets.js";

// Анимация — целиком на CSS: окно фиксированного размера + слой с листом
// спрайтов, который внутри окна «прокручивается» через steps(N) на один кадр
// за шаг. Никаких setInterval/requestAnimationFrame, никакого канваса и никаких
// base64-кадров: браузер (в т.ч. WebView Telegram) делает это на композиторе.
const FADE_MS = 380;
const injectedKeyframes = new Set();
// src → число кадров. Запоминаем на уровне модуля, чтобы при смене состояния
// слой рисовался сразу (без мигания серым placeholder'ом на время decode).
const sheetFramesCache = new Map();

// @keyframes генерируем под конкретную пару (кадров × масштаб): шаг сетки
// должен быть целым числом пикселей, иначе пиксель-арт «плывёт».
function ensureScrollKeyframes(name, distancePx) {
  if (injectedKeyframes.has(name) || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-slime-keyframes", name);
  style.textContent =
    `@keyframes ${name}{from{transform:translate3d(0,0,0)}` +
    `to{transform:translate3d(${-distancePx}px,0,0)}}`;
  document.head.appendChild(style);
  injectedKeyframes.add(name);
}

function SlimeLayer({ slimeId, anim, scale, row }) {
  const { view } = getSlime(slimeId);
  const def = getAnimation(anim);
  const src = sheetUrl(slimeId, anim);
  const [frames, setFrames] = useState(() => sheetFramesCache.get(src) || 0);
  const [failed, setFailed] = useState(false);

  // Кадров в листе не хардкодим — читаем из ширины файла, поэтому манифест
  // физически не может разойтись с ассетом (у слизней разное число кадров).
  useEffect(() => {
    let alive = true;
    setFrames(sheetFramesCache.get(src) || 0);
    setFailed(false);
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      if (img.naturalWidth % SHEET_CELL !== 0) {
        console.warn(
          `[SlimeSprite] ширина листа ${img.naturalWidth}px не кратна сетке ${SHEET_CELL}px: ${src}`,
        );
      }
      const count = Math.max(1, Math.round(img.naturalWidth / SHEET_CELL));
      sheetFramesCache.set(src, count);
      setFrames(count);
    };
    img.onerror = () => {
      if (!alive) return;
      setFailed(true);
      console.error(
        `[SlimeSprite] лист спрайтов не загрузился: ${src}. ` +
          "Проверьте имя файла и регистр: npm run check:sprites",
      );
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  const windowW = view.w * scale;
  const windowH = view.h * scale;

  if (failed || !frames) {
    return (
      <div
        style={{
          width: windowW,
          height: windowH,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
        }}
      />
    );
  }

  // Одноразовая анимация: играем кадры 0..holdFrame и ЗАМИРАЕМ на holdFrame.
  // Шагов на один меньше числа показанных кадров — иначе fill-mode `both`
  // оставляет пустую клетку за листом (питомец исчезал в «нокауте»).
  const lastFrame = def.loop
    ? frames
    : Math.min(Math.max(def.holdFrame ?? frames - 1, 0), frames - 1) + 1;
  const steps = def.loop ? frames : Math.max(1, lastFrame - 1);

  const sheetW = frames * SHEET_CELL * scale;
  const sheetH = SHEET_ROWS * SHEET_CELL * scale;
  const distance = steps * SHEET_CELL * scale;
  const animName = `slime-scroll-${slimeId}-${anim}-${frames}-${steps}-${scale}`;
  ensureScrollKeyframes(animName, distance);

  return (
    <div
      style={{
        position: "relative",
        width: windowW,
        height: windowH,
        overflow: "hidden",
        imageRendering: "pixelated",
        // Собственный композитный слой: окно садится на целый пиксель даже
        // если родитель центрирует его с дробным смещением.
        transform: "translateZ(0)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -view.x * scale,
          top: -(row * SHEET_CELL + view.y) * scale,
          width: sheetW,
          height: sheetH,
          backgroundImage: `url(${src})`,
          backgroundSize: `${sheetW}px ${sheetH}px`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          willChange: "transform",
          animation: `${animName} ${steps * def.frameMs}ms steps(${steps}, end) ${
            def.loop ? "infinite" : "1"
          } both`,
        }}
      />
    </div>
  );
}

/**
 * Маскот-слизень для герой-кольца.
 *
 * @param {"NORMAL"|"WARNING"|"DEFEATED"} emotion — статус дня (NORMAL/WARNING/DEFEATED)
 * @param {1|2|3} slimeId — какой из трёх слизней пака
 * @param {number} size — желаемая максимальная сторона окна маскота, px
 * @param {0|1|2|3} row — строка листа (направление), row 0 — лицевой ракурс
 */
export default function SlimeSprite({
  emotion = "NORMAL",
  slimeId = DEFAULT_SLIME_ID,
  size = 120,
  row = 0,
}) {
  const anim = EMOTION_ANIM[String(emotion).toUpperCase()] || EMOTION_ANIM.NORMAL;
  const { view } = getSlime(slimeId);
  const span = Math.max(view.w, view.h);
  // Целый масштаб (1 исходный пиксель = scale×scale экранных) — без размытия.
  const scale = Math.max(1, Math.floor(size / span));

  const currentRef = useRef({ key: `${slimeId}-${anim}`, slimeId, anim });
  const [layer, setLayer] = useState(currentRef.current);
  const [previous, setPrevious] = useState(null);

  useEffect(() => {
    const next = { key: `${slimeId}-${anim}`, slimeId, anim };
    if (next.key === currentRef.current.key) return;
    currentRef.current = next;
    setPrevious(layer);
    setLayer(next);
  }, [slimeId, anim, layer]);

  useEffect(() => {
    if (!previous) return;
    const t = setTimeout(() => setPrevious(null), FADE_MS);
    return () => clearTimeout(t);
  }, [previous]);

  return (
    <div
      aria-hidden="true"
      className="relative flex items-center justify-center"
      style={{ width: view.w * scale, height: view.h * scale }}
    >
      {/* Ключи на обёртках обязательны: без них появление/исчезновение соседа
          сдвигает позицию в children и React перемонтирует текущий слой —
          анимация кадров сбрасывалась бы на первый кадр. */}
      <div key="previous" className="absolute inset-0 flex items-center justify-center">
        {previous ? (
          <div className="slime-fade-out">
            <SlimeLayer
              key={previous.key}
              slimeId={previous.slimeId}
              anim={previous.anim}
              scale={scale}
              row={row}
            />
          </div>
        ) : null}
      </div>
      <div key="current" className="flex items-center justify-center">
        {/* key на fade-обёртке — чтобы кроссфейд переигрывался при смене состояния */}
        <div key={layer.key} className="slime-fade-in">
          <SlimeLayer
            key={layer.key}
            slimeId={layer.slimeId}
            anim={layer.anim}
            scale={scale}
            row={row}
          />
        </div>
      </div>
    </div>
  );
}
