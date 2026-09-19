import { Snowflake } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHaptics } from "../../hooks/useHaptics.js";
import { formatCurrency } from "../../utils/format.js";

// §32.1: «Запас прочности» удален целиком — состояние показывает HP питомца.
// Осталась одна метрика: «Заморожено» (долги мне), тап открывает шторку должников.
export default function FrozenSavingsCard({ dashboard, currency = "KZT", onFrozenClick }) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const frozen = dashboard?.frozen_total ?? 0;

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic("medium");
        onFrozenClick?.();
      }}
      className="mt-4 w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-left active:bg-white/[0.06] transition-colors flex items-center justify-between"
    >
      <span className="flex items-center gap-2">
        <Snowflake
          size={15}
          strokeWidth={1.5}
          className={frozen > 0 ? "text-[#30D158]" : "text-white/40"}
        />
        <span className="text-[10px] font-semibold text-neutral-400 tracking-wider uppercase">
          {t("dashboard.frozen")}
        </span>
      </span>
      <span className="text-xl font-bold text-white font-mono tracking-tight">
        {formatCurrency(frozen, currency)}
      </span>
    </button>
  );
}
