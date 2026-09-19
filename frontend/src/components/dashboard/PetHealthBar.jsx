import { Heart, HeartCrack } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * §31.2: шкала здоровья питомца — 5 сердечек + процент.
 * Цвет сердец задаётся статусом (status indicator — исключение из монохромного
 * правила §8.1), пустые сердца — приглушённый серый / разбитое сердце при крахе.
 *
 * @param {ReturnType<import("../../utils/petHealth.js").computePetHealth>} health
 */
export default function PetHealthBar({ health, className = "" }) {
  const { t } = useTranslation();
  if (!health) return null;
  const { hpPercent, hearts, maxHearts, status } = health;
  // §35.2: подпись статуса — из словаря по ключу статуса
  const label = t(`status.${status}`);
  const defeated = status === "defeated";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={hpPercent}
      aria-label={t("pet.healthAria", { hp: hpPercent, label })}
      title={t("pet.healthAria", { hp: hpPercent, label })}
      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur-md ${className}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {t("pet.hp")}
      </span>

      <span className="flex items-center gap-[3px]">
        {Array.from({ length: maxHearts }, (_, index) => {
          const full = index < hearts;
          if (full) {
            return (
              <Heart
                key={index}
                size={13}
                strokeWidth={1.5}
                className={`${health.heartsColor} fill-current transition-all duration-300`}
              />
            );
          }
          return defeated ? (
            <HeartCrack
              key={index}
              size={13}
              strokeWidth={1.5}
              className="text-[#FF453A]/60 transition-all duration-300"
            />
          ) : (
            <Heart key={index} size={13} strokeWidth={1.5} className="text-neutral-700 transition-all duration-300" />
          );
        })}
      </span>

      <span className="font-mono text-xs font-bold text-white tabular-nums">{hpPercent}%</span>
    </div>
  );
}
