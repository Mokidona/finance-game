import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Snowflake, X } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import SwipeableRow from "../ui/SwipeableRow.jsx";
import { useHaptics } from "../../hooks/useHaptics.js";
import { api } from "../../api/client.js";
import { formatMoney, formatDateShort } from "../../utils/format.js";

const SPRING = { type: "spring", stiffness: 400, damping: 28 };

function daysUntil(dateString) {
  if (!dateString) return null;
  const due = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

// 14.3.2: строки должников с обратным отсчетом; свайп ВПРАВО = «Вернул»
// (деньги возвращаются на щит аватара — mint-анимация разморозки).
export default function DebtsSheet({ open, onClose, currency = "KZT", onChanged }) {
  const [debts, setDebts] = useState(null);
  const [flash, setFlash] = useState(null); // mint-флеш после разморозки
  const { triggerHaptic } = useHaptics();

  const loadDebts = useCallback(async () => {
    try {
      const data = await api.getDebts();
      setDebts(data);
    } catch {
      setDebts([]);
    }
  }, []);

  if (open && debts === null) {
    loadDebts();
  }

  const handleReturn = async (debt) => {
    try {
      await api.returnDebt(debt.id);
      triggerHaptic("success");
      setFlash({ amount: debt.amount });
      setDebts((list) => list.filter((d) => d.id !== debt.id));
      onChanged?.();
      setTimeout(() => setFlash(null), 2200);
    } catch {
      triggerHaptic("error");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Заморожено (долги)</h2>
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            onClose();
          }}
          className="w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-[#8E8E93] active:bg-white/10 transition-colors"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>
      <p className="text-[11px] text-neutral-400 tracking-wider mb-4 flex items-center gap-1.5">
        <Snowflake size={12} strokeWidth={1.5} />
        Свайп вправо по строке — «Вернул»: деньги размораживаются на щит.
      </p>

      {flash ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="mb-3 px-4 py-3 rounded-2xl bg-[#30D158]/10 border border-[#30D158]/25 text-center"
        >
          <p className="text-sm font-medium text-[#30D158] font-mono">
            +{formatMoney(flash.amount, currency)} вернулись на щит
          </p>
        </motion.div>
      ) : null}

      {debts === null ? (
        <p className="text-[11px] text-neutral-400 tracking-wider py-6 text-center">Загружаем...</p>
      ) : debts.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-white">Замороженных денег нет</p>
          <p className="text-xs text-neutral-500 mt-1">Все долги возвращены</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mb-2">
          {debts.map((debt) => {
            const left = daysUntil(debt.due_date);
            return (
              <SwipeableRow
                key={debt.id}
                direction="right"
                onRightAction={() => handleReturn(debt)}
              >
                <div className="bg-black border border-white/10 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {debt.debtor_name} — {formatMoney(debt.amount, currency)}
                    </p>
                    <p
                      className={`text-[11px] tracking-wider mt-0.5 ${
                        left !== null && left < 0
                          ? "text-[#FF453A]"
                          : left !== null && left <= 1
                            ? "text-amber-400"
                            : "text-neutral-500"
                      }`}
                    >
                      {debt.due_date
                        ? left < 0
                          ? `Просрочен с ${formatDateShort(debt.due_date)}`
                          : `До возврата: ${left === 0 ? "сегодня" : left === 1 ? "завтра" : `${left} дн.`}`
                        : "без срока"}
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    transition={SPRING}
                    onClick={() => {
                      triggerHaptic("medium");
                      handleReturn(debt);
                    }}
                    className="shrink-0 px-4 h-11 rounded-xl bg-white text-black text-xs font-semibold"
                  >
                    Вернул
                  </motion.button>
                </div>
              </SwipeableRow>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
