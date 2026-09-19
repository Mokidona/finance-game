import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Hourglass } from "lucide-react";
import { useHaptics } from "../../hooks/useHaptics.js";
import { api } from "../../api/client.js";
import { formatMoney } from "../../utils/format.js";

// 15.3.2: «Защита от Сожалений» — заморозка хотелки выше порога на 1 час.
// Персонаж в медитативной позе + отсчет до разблокировки подтверждения.

const SPRING = { type: "spring", stiffness: 400, damping: 28 };

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function TimeLockModal({ pending, onClose, onCancelled, onConfirmed, currency = "KZT" }) {
  const { triggerHaptic } = useHaptics();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!pending) return null;
  const unlockAt = new Date(pending.unlock_at).getTime();
  const remaining = Math.max(0, unlockAt - now);
  const ready = remaining <= 0;
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);

  const cancel = async () => {
    triggerHaptic("success");
    setBusy(true);
    try {
      const res = await api.cancelPendingTransaction(pending.id);
      onCancelled?.(res);
    } catch {
      triggerHaptic("error");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!ready || busy) return;
    triggerHaptic("medium");
    setBusy(true);
    try {
      await api.confirmPendingTransaction(pending.id);
      triggerHaptic("warning");
      onConfirmed?.();
    } catch {
      triggerHaptic("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-[360px] rounded-3xl border-t border-white/20 border-x border-white/10 border-b border-white/5 bg-[#16181E]/95 backdrop-blur-2xl p-6 text-center"
        initial={{ scale: 0.94, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        transition={SPRING}
      >
        {/* Медитирующий Хранитель: упрощенный силуэт в позе лотоса */}
        <div className="relative mx-auto mb-4 w-24 h-24 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(52,199,88,0.14) 0%, transparent 70%)",
              filter: "blur(10px)",
            }}
          />
          <svg viewBox="0 0 100 100" className="w-24 h-24">
            <g fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="50" cy="34" r="10" />
              <path d="M50 46 L50 68" />
              <path d="M50 54 Q38 58 34 68 M50 54 Q62 58 66 68" />
              {/* Поза лотоса */}
              <path d="M32 72 Q50 62 68 72" />
              <path d="M36 76 Q50 84 64 76" />
            </g>
          </svg>
        </div>

        <h2 className="text-lg font-bold text-white mb-1">Покупка на паузе</h2>
        <p className="text-xs text-neutral-400 leading-relaxed mb-4">
          Если через{" "}
          <span className="text-white font-semibold">
            {ready ? "0" : `${pad(h)}:${pad(m)}:${pad(s)}`}
          </span>{" "}
          ты всё еще захочешь это купить — нажмите подтвердить.{" "}
          <span className="text-[#34C759]">84% импульсивных покупок</span> отменяются на этом этапе.
        </p>

        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 mb-5">
          <p className="text-sm text-white font-semibold">
            {pending.category === "debt" ? "Долг" : "Хотелка"} ·{" "}
            {formatMoney(pending.amount, currency)}
          </p>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Сумма не списана. Лимит дня не тронут.
          </p>
        </div>

        {!ready ? (
          <button
            type="button"
            disabled
            className="w-full h-13 rounded-2xl bg-white/10 text-white/50 font-semibold text-base flex items-center justify-center gap-2"
          >
            <Hourglass size={16} strokeWidth={1.5} />
            Подтвердить {ready ? "" : `(${pad(m)}:${pad(s)})`}
          </button>
        ) : (
          <button
            type="button"
            onClick={confirm}
            className="w-full h-13 rounded-2xl bg-white text-black font-semibold text-base flex items-center justify-center active:scale-[0.97] transition-all"
          >
            Подтвердить покупку
          </button>
        )}
        <button
          type="button"
          onClick={cancel}
          className="w-full mt-2 text-xs text-neutral-500 hover:text-[#34C759] transition-colors py-2"
        >
          Отменить покупку → в Сэкономленный Капитал
        </button>
      </motion.div>
    </motion.div>
  );
}
