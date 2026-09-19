import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Lock, Plus } from "lucide-react";
import SwipeableRow from "../components/ui/SwipeableRow.jsx";
import { useApi } from "../context/AppContext.jsx";
import { useHaptics } from "../hooks/useHaptics.js";
import { GROUPED_LIST, ROW_DIVIDER } from "../components/ui/surfaces.js";
import { api } from "../api/client.js";
import { formatMoney } from "../utils/format.js";

const SPRING = { type: "spring", stiffness: 400, damping: 28 };

export default function FixedExpensesPage({ openPaywall }) {
  const { dashboard, fixedExpenses, refreshFixedExpenses, refreshDashboard } = useApi();
  const currency = dashboard?.currency ?? "KZT";
  const hasPaidAccess = Boolean(dashboard?.has_paid_access);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [saving, setSaving] = useState(false);
  const { triggerHaptic } = useHaptics();

  useEffect(() => {
    refreshFixedExpenses().catch(() => {});
  }, [refreshFixedExpenses]);

  if (!hasPaidAccess) {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/40 mb-4">
          <CalendarDays size={28} strokeWidth={1.25} />
        </div>
        <h2 className="text-xl font-semibold text-white mb-1.5 tracking-tight">Фиксированные расходы</h2>
        <p className="text-sm text-[#8E8E93] leading-relaxed mb-6 max-w-[280px]">
          Аренда, коммуналка и подписки будут автоматически вычитаться из дневного лимита.
        </p>
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          transition={SPRING}
          onClick={() => {
            triggerHaptic("heavy");
            openPaywall?.();
          }}
          className="px-6 h-12 min-w-[44px] min-h-[44px] rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/15 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Lock size={16} strokeWidth={1.5} />
          Разблокировать за 990 KZT
        </motion.button>
      </div>
    );
  }

  const total = fixedExpenses
    .filter((item) => item.is_active)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const handleAdd = async () => {
    const numericAmount = parseFloat(amount.replace(",", "."));
    const day = parseInt(dueDay, 10);
    if (!title.trim() || !numericAmount || !(day >= 1 && day <= 31)) return;
    setSaving(true);
    try {
      await api.createFixedExpense({ title: title.trim(), amount: numericAmount, due_day: day });
      setTitle("");
      setAmount("");
      setDueDay("");
      setFormOpen(false);
      triggerHaptic("success");
      await Promise.all([refreshFixedExpenses(), refreshDashboard()]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await api.deleteFixedExpense(id).catch(() => {});
    await Promise.all([refreshFixedExpenses(), refreshDashboard()]);
  };

  return (
    <div>
      <div className="flex justify-between items-center mt-1 mb-4">
        <h2 className="text-xl font-semibold text-white tracking-tight">Фиксированные расходы</h2>
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          transition={SPRING}
          onClick={() => {
            triggerHaptic("light");
            setFormOpen((open) => !open);
          }}
          className="w-11 h-11 flex items-center justify-center text-white"
          aria-label="Добавить расход"
        >
          <Plus size={22} strokeWidth={1.25} />
        </motion.button>
      </div>

      <p className="text-[11px] text-neutral-400 tracking-wider mb-4">
        Обязательных в месяц:{" "}
        <span className="text-white font-semibold font-mono">{formatMoney(total, currency)}</span>
      </p>

      {formOpen ? (
        <div className={`p-4 mb-4 flex flex-col gap-3 ${GROUPED_LIST}`}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Название (Аренда, Интернет)"
            className="w-full h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-white/25 placeholder:text-[#636366]"
          />
          <div className="flex gap-3">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ""))}
              inputMode="decimal"
              placeholder="Сумма"
              className="flex-1 h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25 placeholder:text-[#636366]"
            />
            <input
              value={dueDay}
              onChange={(event) => setDueDay(event.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="День"
              className="w-24 h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25 placeholder:text-[#636366]"
            />
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={SPRING}
            onClick={() => {
              triggerHaptic("light");
              handleAdd();
            }}
            disabled={saving}
            className="h-11 rounded-full bg-white/10 text-white border border-white/10 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Добавить расход"}
          </motion.button>
        </div>
      ) : null}

      {fixedExpenses.length === 0 ? (
        <p className="text-[11px] text-neutral-500 tracking-wider">
          Пока ничего нет. Добавьте аренду или подписки.
        </p>
      ) : (
        <div className={GROUPED_LIST}>
          {fixedExpenses.map((item, index) => (
            <SwipeableRow key={item.id} onDelete={() => handleDelete(item.id)}>
              <div
                className={`px-4 py-3.5 flex justify-between items-center bg-black ${
                  index < fixedExpenses.length - 1 ? ROW_DIVIDER : ""
                }`}
              >
                <div>
                  <p className="text-sm text-white font-medium">{item.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white font-semibold font-mono">
                    {formatMoney(item.amount, currency)}
                  </p>
                  <p className="text-[11px] text-neutral-500 tracking-wider">
                    {item.due_day} число
                  </p>
                </div>
              </div>
            </SwipeableRow>
          ))}
        </div>
      )}
    </div>
  );
}
