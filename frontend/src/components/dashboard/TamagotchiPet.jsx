import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import SlimeSprite from "../ui/SlimeSprite.jsx";
import { useHaptics } from "../../hooks/useHaptics.js";
import { usePetSettings } from "../../utils/petSettings.js";
import { computePetHealth, petEmotion, petIsFainted } from "../../utils/petHealth.js";

const DAMAGE_MS = 500;
// §33.3: реплика должна успеть прочитаться (тексты из ТЗ длиннее двух секунд)
const TOOLTIP_MS = 4200;

// §33.3: частицы радости по тапу — фиксированные углы (без Math.random в рендере),
// чтобы анимация была одинаковой и не ломала SSR/StrictMode.
const PARTICLE_ANGLES = [-160, -120, -80, -40, -195, -25];

/**
 * §31/§33: питомец-тамагочи — спрайт-маскот со статусной аурой, вспышкой урона и
 * реакцией на тап. Кольцо — родитель (ProgressRing), поэтому здесь только визуал
 * питомца; шкала HP — отдельный PetHealthBar под кольцом.
 *
 * @param {number} availableBudget — «Доступно на сегодня» (daily_limit_current)
 * @param {number} dailyLimit — базовый дневной лимит (daily_limit_base)
 * @param {number} size — желаемая сторона окна спрайта, px
 * @param {number} slimeId — выбранный маскот (скин)
 */
export default function TamagotchiPet({ availableBudget, dailyLimit, size = 120, slimeId = 1 }) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const [settings] = usePetSettings();
  const health = computePetHealth({ availableBudget, dailyLimit });
  const fainted = petIsFainted(health);
  const [hitId, setHitId] = useState(0);
  const [tap, setTap] = useState(null); // { id, status, message }

  // Урон = бюджет УМЕНЬШИЛСЯ между рендерами (новая трата).
  // В ТЗ стояло условие `availableBudget < dailyLimit` — оно истинно всегда,
  // когда есть перенос, поэтому питомец «получал урон» на каждом рендере.
  const prevAvailable = useRef(null);
  useEffect(() => {
    const available = Number(availableBudget) || 0;
    const prev = prevAvailable.current;
    prevAvailable.current = available;
    if (prev === null || available >= prev) return;
    setHitId((id) => id + 1);
    // §32.4: тумблер «Вибрация при уроне питомцу»
    if (settings.vibrateOnDamage !== false) triggerHaptic("warning");
  }, [availableBudget, triggerHaptic, settings.vibrateOnDamage]);

  useEffect(() => {
    if (!hitId) return undefined;
    const timer = setTimeout(() => setHitId((id) => (id === hitId ? 0 : id)), DAMAGE_MS);
    return () => clearTimeout(timer);
  }, [hitId]);

  // Тряска целыми пикселями: пиксель-арт не должен размываться (см. §22, §25).
  const shaky = hitId > 0 || tap?.status === "warning";
  const joyful = tap?.status === "normal";

  // §33.3: тап — реплика питомца и реакция тела под его состояние
  // §35.2: сами реплики живут в словаре (`pet.tapNormal` / `tapWarning` / `tapDefeated`).
  const handleTap = () => {
    triggerHaptic(fainted ? "error" : health.status === "warning" ? "warning" : "heavy");
    const suffix = health.status.charAt(0).toUpperCase() + health.status.slice(1);
    setTap({ id: Date.now(), status: health.status, message: t(`pet.tap${suffix}`) });
  };

  useEffect(() => {
    if (!tap) return undefined;
    const timer = setTimeout(() => setTap((current) => (current?.id === tap.id ? null : current)), TOOLTIP_MS);
    return () => clearTimeout(timer);
  }, [tap]);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Аура настроения (§31.3 glowMap): красная при ударе и в нокауте, иначе — цвет статуса. */}
      <div
        className="absolute inset-2 rounded-full pointer-events-none transition-colors duration-500"
        style={{
          backgroundColor: shaky || fainted ? "rgba(255, 69, 58, 0.32)" : health.glow,
          filter: "blur(18px)",
        }}
      />

      {/* §33.3: частицы радости — 6 точек разлетаются от питомца при тапе в хорошем статусе. */}
      <AnimatePresence>
        {joyful
          ? PARTICLE_ANGLES.map((angle, index) => {
              const distance = size * 0.42;
              const rad = (angle * Math.PI) / 180;
              return (
                <motion.span
                  key={`${tap.id}-${index}`}
                  className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-[#34C759] pointer-events-none"
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{
                    x: Math.cos(rad) * distance,
                    y: Math.sin(rad) * distance - size * 0.12,
                    opacity: [0, 1, 0],
                    scale: 1,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.75, ease: "easeOut" }}
                />
              );
            })
          : null}
      </AnimatePresence>

      <motion.div
        role="button"
        data-onboarding="pet"
        tabIndex={0}
        aria-label={t("pet.aria", {
          label: t(`status.${health.status}`),
          hp: health.hpPercent,
        })}
        onClick={handleTap}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleTap();
          }
        }}
        animate={
          shaky
            ? { x: [0, -3, 3, -2, 2, 0], scale: [1, 0.96, 0.98, 0.97, 0.99, 1] }
            : joyful
              ? { x: 0, scale: [1, 1.05, 1] }
              : { x: 0, scale: 1 }
        }
        transition={{
          duration: shaky ? DAMAGE_MS / 1000 : 0.4,
          ease: "easeOut",
        }}
        className="relative z-10 cursor-pointer select-none"
        style={{ filter: fainted ? "grayscale(0.85) contrast(0.95)" : "none" }}
      >
        <SlimeSprite emotion={petEmotion(health.status)} slimeId={slimeId} size={size} />
      </motion.div>

      {/* Реплика питомца: всплывает над ним и уходит сама (§33.3) */}
      <AnimatePresence>
        {tap ? (
          <motion.div
            key={tap.id}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="absolute top-full mt-1 z-20 w-max max-w-[210px] rounded-2xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] leading-snug text-white backdrop-blur-md pointer-events-none"
          >
            {tap.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
