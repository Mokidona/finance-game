import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HeartCrack } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import { useHaptics } from "../../hooks/useHaptics.js";
import { formatCurrency } from "../../utils/format.js";
import { computePetHealth } from "../../utils/petHealth.js";

// §32.2.3: Fast Impulse Check — компактный bottom sheet с 5-секундным таймером
// (вместо часового Time Lock). Кнопка «Да, потратить» разблокируется после паузы.
export const IMPULSE_PAUSE_SECONDS = 5;

export default function ImpulseGuardModal({
  open,
  amount = 0,
  category,
  quarantine = false,
  currency = "KZT",
  availableBudget,
  dailyLimit,
  onConfirm,
  onCancel,
}) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState(IMPULSE_PAUSE_SECONDS);

  useEffect(() => {
    if (!open) {
      setTimeLeft(IMPULSE_PAUSE_SECONDS);
      return undefined;
    }
    setTimeLeft(IMPULSE_PAUSE_SECONDS);
    return undefined;
  }, [open, amount]);

  useEffect(() => {
    if (!open || timeLeft <= 0) return undefined;
    const timer = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, timeLeft]);

  useEffect(() => {
    if (open && timeLeft === 0) triggerHaptic("light");
  }, [open, timeLeft, triggerHaptic]);

  if (!open) return null;

  const hpNow = computePetHealth({ availableBudget, dailyLimit }).hpPercent;
  const hpAfter = computePetHealth({
    availableBudget: (Number(availableBudget) || 0) - (Number(amount) || 0),
    dailyLimit,
  }).hpPercent;
  const waiting = timeLeft > 0;

  return (
    <Modal open={open} onClose={onCancel}>
      <div className="text-center">
        <HeartCrack size={30} strokeWidth={1.5} className="text-[#FF453A] mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">
          {quarantine ? t("guard.titleQuarantine") : t("guard.title")}
        </h3>
        <p className="text-xs text-neutral-400 leading-relaxed mb-4">
          {quarantine
            ? t("guard.bodyQuarantine", { amount: formatCurrency(amount, currency) })
            : t("guard.body", { amount: formatCurrency(amount, currency) })}
        </p>

        <div className="flex items-center justify-center gap-3 mb-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
          {quarantine ? (
            <>
              <span className="font-mono text-sm font-bold text-[#FF453A]">{hpNow}%</span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                {t("guard.overLimit")}
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-sm font-bold text-white">{hpNow}%</span>
              <span className="text-neutral-500 text-xs">→</span>
              <span
                className={`font-mono text-sm font-bold ${hpAfter <= 0 ? "text-[#FF453A]" : hpAfter <= 50 ? "text-[#FF9F0A]" : "text-[#34C759]"}`}
              >
                {hpAfter}%
              </span>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 ml-1">
                {t("guard.hpLabel")}
              </span>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onCancel?.();
            }}
            className="flex-1 h-12 rounded-xl bg-white/10 text-white font-medium text-sm active:bg-white/[0.16] transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={waiting}
            onClick={() => {
              triggerHaptic("warning");
              onConfirm?.(category);
            }}
            className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all ${
              waiting
                ? "bg-[#FF453A]/20 text-[#FF453A]/70 cursor-not-allowed"
                : "bg-[#FF453A] text-white active:scale-[0.97]"
            }`}
          >
            {waiting ? t("guard.wait", { seconds: timeLeft }) : t("guard.confirm")}
          </button>
        </div>

        <p className="text-[10px] text-neutral-500 mt-3 leading-relaxed">
          {quarantine ? t("guard.quarantineFootnote") : t("guard.footnote")}
        </p>
      </div>
    </Modal>
  );
}
