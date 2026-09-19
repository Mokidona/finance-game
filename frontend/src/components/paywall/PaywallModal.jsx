import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Star, X } from "lucide-react";
import { useHaptics } from "../../hooks/useHaptics.js";
import { api } from "../../api/client.js";

const FEATURES = [
  "Календарь прогноза лимитов на 30 дней",
  "Учет фиксированных расходов и аренды",
  "Умный детектор безопасных покупок",
  "Экспорт статистики и ачивок",
];

function FeatureLockRow({ text }) {
  return <div className="text-sm font-normal text-white/90">{text}</div>;
}

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;

export default function PaywallModal({ open, onClose, onUnlocked }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);
  const [starsPrice, setStarsPrice] = useState(50);
  const pollTimer = useRef(null);
  const pollAttempts = useRef(0);
  const { triggerHaptic } = useHaptics();

  // Цена в звездах приходит с бэкенда (PREMIUM_STARS_PRICE из .env).
  useEffect(() => {
    if (!open) return;
    api.getStarsPrice().then(setStarsPrice).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) triggerHaptic("medium");
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [open, triggerHaptic]);

  const startPolling = () => {
    if (pollTimer.current) return;
    // Активация премиума приходит вебхуком бота на бэкенд — фронт дожидается,
    // опрашивая профиль. 20 попыток * 1.5 c = 30 c, обычно хватает с запасом.
    pollAttempts.current = 0;
    pollTimer.current = setInterval(async () => {
      pollAttempts.current += 1;
      try {
        const profile = await api.getProfile();
        if (profile?.has_paid_access) {
          stopPolling();
          triggerHaptic("success");
          onUnlocked?.();
          onClose?.();
        } else if (pollAttempts.current >= 20) {
          stopPolling();
          setError("Оплата получена, но статус еще обновляется. Откройте приложение заново.");
        }
      } catch {
        if (pollAttempts.current >= 20) {
          stopPolling();
          setError("Не удалось проверить статус оплаты. Откройте приложение заново.");
        }
      }
    }, 1500);
  };

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const handleUnlock = async () => {
    if (!tg?.openInvoice) {
      setError("Оплата доступна внутри Telegram. Откройте приложение через Telegram.");
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const { invoice_link: invoiceLink } = await api.createPayment("telegram_stars");
      if (!invoiceLink) throw new Error("Не удалось создать платеж, попробуйте еще раз");

      tg.openInvoice(invoiceLink, async (status) => {
        if (status === "paid") {
          triggerHaptic("success");
          startPolling();
        } else if (status === "failed") {
          triggerHaptic("error");
          setError("Платеж не прошел. Попробуйте еще раз.");
        }
        // status === "cancelled" — пользователь закрыл попап оплаты, ничего не делаем.
        setPaying(false);
      });
    } catch (err) {
      triggerHaptic("error");
      setError(err.message || "Не удалось создать платеж, попробуйте еще раз");
      setPaying(false);
    }
  };

  const formatPrice = (n) => n.toLocaleString("ru-RU");

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[400px] bg-white/[0.03] backdrop-blur-2xl border border-t-[rgba(255,255,255,0.18)] border-x-[rgba(255,255,255,0.08)] border-b-[rgba(255,255,255,0.05)] rounded-3xl p-6 relative overflow-hidden shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                onClose?.();
              }}
              className="absolute top-4 right-4 w-11 h-11 rounded-full flex items-center justify-center text-[#8E8E93] active:bg-white/10 transition-colors z-10"
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>

            <div className="relative">
              <h2 className="text-xl font-semibold text-white mb-1.5 tracking-tight">
                Разблокируй полный контроль
              </h2>
              <p className="text-[11px] text-[#8E8E93] leading-relaxed tracking-wider mb-6">
                Разовый доступ ко всем функциям без ежемесячных подписок.
              </p>

              <div className="flex flex-col gap-3.5 mb-6 pl-0.5">
                {FEATURES.map((feature) => (
                  <FeatureLockRow key={feature} text={feature} />
                ))}
              </div>

              <div className="py-4 mb-6 text-center border-y border-white/5">
                <div className="flex items-baseline justify-center gap-2">
                  <Star size={20} className="text-[#30D158] shrink-0 -translate-y-0.5" fill="currentColor" />
                  <span className="text-2xl font-bold text-white tracking-tight">
                    {formatPrice(starsPrice)}
                  </span>
                </div>
                <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#30D158]">
                  Навсегда • Telegram Stars
                </span>
              </div>

              {error ? <p className="text-xs text-[#FF453A] mb-3 text-center">{error}</p> : null}

              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onClick={() => {
                  triggerHaptic("heavy");
                  handleUnlock();
                }}
                disabled={paying}
                className="w-full h-14 rounded-2xl bg-[#30D158] text-black font-bold text-base flex items-center justify-center gap-2 shadow-[0_4px_25px_rgba(52,199,89,0.3)] disabled:opacity-60"
              >
                <Star size={16} fill="currentColor" />
                {paying ? "Открываем оплату..." : `Оплатить ${formatPrice(starsPrice)} ⭐`}
              </motion.button>

              <p className="text-[11px] text-center text-[#636366] flex items-center justify-center gap-1 mt-3 tracking-wider">
                <ShieldCheck size={12} />
                Безопасная оплата • Telegram
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
