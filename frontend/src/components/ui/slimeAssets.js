// Единый манифест спрайтов слизней (CraftPix «Slime» pack).
//
// ПОЧЕМУ ТАК: раньше пути к листам собирались строкой по шаблону
// `/assets/sprites/slime${id}/${id}_${anim}_with_shadow.png` — с маленькой «s»,
// а файлы на диске называются с большой («Slime1_...»). Vite на несуществующий
// путь отдаёт SPA-fallback: HTTP 200 + text/html, <img> не может декодировать
// HTML → onerror → маскот не отображался вообще. Теперь имя файла берётся из
// этого модуля ОДИН раз, а `scripts/verify-sprites.mjs` сверяет его с диском
// (точный регистр) и геометрией PNG на каждой сборке.
//
// ГЕОМЕТРИЯ ЛИСТА (проверено по пикселям): кадр = 64×64, сетка N×4, где
// 4 строки — варианты направления (используем row 0 — лицевой ракурс),
// N — число кадров в анимации (зависит от анимации и слизня).
export const SHEET_CELL = 64;
export const SHEET_ROWS = 4;
const BASE = "/assets/sprites";

// Кадры в анимации (frames) НЕ хардкодим: компонент читает naturalWidth
// загруженного листа (frames = width / SHEET_CELL), поэтому таблица не может
// разойтись с ассетом. Здесь только тайминги.
// holdFrame — 0-based номер кадра, на котором одноразовая анимация замирает.
// ПОЧЕМУ: у одноразовых анимаций CSS-прокрутка `steps(N, end)` + fill-mode `both`
// в конце подставляет значение `to` = -(N) ячеек, то есть клетку ЗА последней —
// персонаж полностью исчезал (нашлось на состоянии «Нокаут» из §33: кольцо
// красное, аура есть, а питомца нет). Поэтому для них идём N-1 шагами и
// остановка происходит на реальном кадре.
// У death это кадр 6: тело слизня уже распласталось, но ещё различимо (кадры
// 7–9 «растворяются» в лужу и в окне 38×30 читаются как пустое место).
export const ANIMATIONS = {
  idle: { file: "Idle", frameMs: 150, loop: true },
  walk: { file: "Walk", frameMs: 150, loop: true },
  run: { file: "Run", frameMs: 100, loop: true },
  attack: { file: "Attack", frameMs: 90, loop: false },
  hurt: { file: "Hurt", frameMs: 110, loop: false, holdFrame: 3 },
  death: { file: "Death", frameMs: 150, loop: false, holdFrame: 6 },
};

// Эмоция → анимация. Меняется одной строкой, если нужен другой набор.
export const EMOTION_ANIM = {
  NORMAL: "idle",
  WARNING: "walk",
  DEFEATED: "death",
};

// `view` — окно кадрирования внутри 64×64 кадра: объединение bbox
// непрозрачных пикселей по всем кадрам «характерных» анимаций (idle/walk/run/
// hurt/death), row 0. Искусство занимает всего ~37×30 px внутри кадра, поэтому
// без кадрирования слизень выглядит крошкой. Attack сознательно не входит в
// объединение (в этом паку кадры атаки раздуваются на всю ячейку) — если
// когда-то понадобится состояние атаки, расширьте окно до x:1..64, y:7..42.
//
// ВАЖНО: ширина/высота окна и масштаб — чётные числа. Кольцо — 220px, и
// нечётная сторона окна даёт при центрировании смещение 54.5px: браузер
// пересэмплирует спрайт и пиксель-арт размывается. Чётные стороны держат окно
// на целых пикселях. (Проверено в headless Chrome: нечётная 37→111px даёт
// полупиксельное смешивание, чётная 38→114px — попиксельное совпадение.)
//
// Пересчитать после подмены арта:
//   .venv/bin/python - <<'PY'
//   from PIL import Image
//   im = Image.open("frontend/public/assets/sprites/slime1/Slime1_Idle_with_shadow.png")
//   # bbox = объединение im.crop((i*64, 0, i*64+64, 64)).getchannel("A").getbbox()
//   PY
// (37×30 → расширено до 38×30, 39×36 → 40×36 — запас внутри кадра 64×64 есть)
export const SLIMES = {
  1: { dir: "slime1", prefix: "Slime1", view: { x: 13, y: 12, w: 38, h: 30 } },
  2: { dir: "slime2", prefix: "Slime2", view: { x: 13, y: 6, w: 40, h: 36 } },
  3: { dir: "slime3", prefix: "Slime3", view: { x: 12, y: 0, w: 42, h: 42 } },
};

export const DEFAULT_SLIME_ID = 1;

export function getSlime(slimeId) {
  return SLIMES[slimeId] || SLIMES[DEFAULT_SLIME_ID];
}

export function getAnimation(anim) {
  return ANIMATIONS[anim] || ANIMATIONS.idle;
}

/** URL листа спрайтов с ТОЧНЫМ регистром, как на диске. */
export function sheetUrl(slimeId, anim) {
  const slime = getSlime(slimeId);
  const { file } = getAnimation(anim);
  return `${BASE}/${slime.dir}/${slime.prefix}_${file}_with_shadow.png`;
}
