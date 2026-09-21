import { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useApi } from "../context/AppContext.jsx";
import { api } from "../api/client.js";
import { formatMoney } from "../utils/format.js";

export default function FixedExpensesPage() {
  const { dashboard, fixedExpenses, refreshFixedExpenses, refreshDashboard } = useApi();
  const currency = dashboard?.currency ?? "KZT";

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    refreshFixedExpenses().catch(() => {});
  }, [refreshFixedExpenses]);

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
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          className="w-11 h-11 flex items-center justify-center text-white"
          aria-label="Добавить расход"
        >
          <Plus size={22} strokeWidth={1.25} />
        </button>
      </div>

      <p className="text-[11px] text-neutral-400 tracking-wider mb-4">
        Обязательных в месяц:{" "}
        <span className="text-white font-semibold font-mono">{formatMoney(total, currency)}</span>
      </p>

      {formOpen ? (
        <div className="p-4 mb-4 flex flex-col gap-3 bg-white/[0.03] border border-white/10 rounded-2xl">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название (Аренда, Интернет)"
            className="w-full h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-white/25 placeholder:text-[#636366]"
          />
          <div className="flex gap-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              inputMode="decimal"
              placeholder="Сумма"
              className="flex-1 h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25 placeholder:text-[#636366]"
            />
            <input
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="День"
              className="w-24 h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25 placeholder:text-[#636366]"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="h-11 rounded-full bg-white/10 text-white border border-white/10 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Сохраняем..." : "Добавить расход"}
          </button>
        </div>
      ) : null}

      {fixedExpenses.length === 0 ? (
        <p className="text-[11px] text-neutral-500 tracking-wider">
          Пока ничего нет. Добавьте аренду или подписки.
        </p>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          {fixedExpenses.map((item, index) => (
            <div
              key={item.id}
              className={`px-4 py-3.5 flex justify-between items-center bg-black ${
                index < fixedExpenses.length - 1 ? "border-b border-white/5" : ""
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
          ))}
        </div>
      )}
    </div>
  );
}
