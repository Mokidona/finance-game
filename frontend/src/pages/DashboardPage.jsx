import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useApi } from "../context/AppContext.jsx";
import { formatCurrency } from "../utils/format.js";
import QuickAddExpenseModal from "../components/dashboard/QuickAddExpenseModal.jsx";
import TransactionItem from "../components/expenses/TransactionItem.jsx";

export default function DashboardPage() {
  const { dashboard, loading, refreshDashboard } = useApi();
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  if (loading && !dashboard) {
    return <p className="text-[11px] text-neutral-400 tracking-wider mt-6">{t("common.loading")}</p>;
  }
  if (!dashboard) return null;

  const currency = dashboard.currency || "KZT";
  const limit = Number(dashboard.daily_limit_current || 0);
  const spent = Number(dashboard.spent_today || 0);
  const baseLimit = Number(dashboard.daily_limit_base || 0);

  return (
    <div className="min-h-full">
      {/* Простая карточка с цифрами */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-5">
        <p className="text-[10px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
          {t("dashboard.available")}
        </p>
        <p className="text-4xl font-bold text-white tracking-tight font-mono">
          {formatCurrency(limit, currency)}
        </p>
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
          <div>
            <p className="text-[10px] text-neutral-400">Базовый лимит</p>
            <p className="text-sm font-medium text-white">{formatCurrency(baseLimit, currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-neutral-400">Потрачено сегодня</p>
            <p className="text-sm font-medium text-white">{formatCurrency(spent, currency)}</p>
          </div>
        </div>
      </div>

      {/* Кнопка добавить */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full h-13 bg-white text-black font-semibold text-base rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all"
      >
        <Plus size={18} strokeWidth={1.5} />
        {t("dashboard.addExpense")}
      </button>

      {/* Список трат */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-white">{t("dashboard.todayExpenses")}</h3>
          <span className="text-xs text-neutral-400">
            {t("dashboard.todayTotal", { amount: formatCurrency(spent, currency) })}
          </span>
        </div>
        {(dashboard.today_transactions || []).length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">{t("dashboard.emptyDay")}</p>
        ) : (
          dashboard.today_transactions.map((t) => (
            <TransactionItem key={t.id} transaction={t} currency={currency} />
          ))
        )}
      </div>

      <QuickAddExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); refreshDashboard(); }}
        currency={currency}
      />
    </div>
  );
}
