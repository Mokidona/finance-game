import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoryLabelKey } from "../../utils/icons.js";
import { formatCurrency, formatTime } from "../../utils/format.js";

const SPRING = { type: "spring", stiffness: 400, damping: 28 };

/**
 * §34.1: строка расхода — только для чтения. Свайп-удаление и кнопка «Удалить»
 * убраны: расход нельзя ни удалить, ни отредактировать (Immutable Ledger).
 * Тап показывает правило; исправить баланс можно доходом или корректировкой.
 *
 * @param {object} transaction
 * @param {string} currency
 * @param {() => void} onLockedTap — показать тултип «Записи в Казне неизменяемы»
 */
export default function TransactionItem({ transaction, currency = "KZT", onLockedTap }) {
  const { t } = useTranslation();
  const label = t(`category.${categoryLabelKey(transaction.category)}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="mb-2"
    >
      <button
        type="button"
        onClick={() => onLockedTap?.(transaction)}
        className="w-full text-left bg-black py-3.5 px-4 flex justify-between items-center border-b border-white/5 active:bg-white/[0.03] transition-colors"
      >
        <div>
          <p className="text-sm text-white font-medium">{transaction.comment || label}</p>
          <p className="text-[11px] text-neutral-400 tracking-wider mt-0.5 flex items-center gap-1.5">
            <Lock size={10} strokeWidth={2} className="text-neutral-600 shrink-0" />
            {label} · {formatTime(transaction.created_at)}
          </p>
        </div>
        <span className="text-sm font-semibold text-white font-mono">
          - {formatCurrency(transaction.amount, currency)}
        </span>
      </button>
    </motion.div>
  );
}
