import { useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useApi } from "../context/AppContext.jsx";
import ExpenseCategoryPill from "../components/expenses/ExpenseCategoryPill.jsx";
import { formatMoney } from "../utils/format.js";

export default function AnalyticsPage() {
  const { dashboard, analytics, refreshAnalytics } = useApi();
  const currency = dashboard?.currency ?? "KZT";

  // Данные грузим всегда: замок показывает РЕАЛЬНЫЕ цифры пользователя под блюром
  useEffect(() => {
    refreshAnalytics().catch(() => {});
  }, [refreshAnalytics]);

  if (!analytics) {
    return <p className="text-[11px] text-neutral-400 tracking-wider mt-6">Загружаем аналитику...</p>;
  }

  const maxSpent = Math.max(...analytics.daily_series.map((p) => p.spent), 1);

  const content = (
    <div>
      {/* Единая framed header-карта с главной цифрой месяца */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-6">
        <p className="text-[10px] font-semibold text-neutral-400 tracking-wider uppercase mb-1">
          Осталось на месяц
        </p>
        <p
          className={`text-3xl font-bold tracking-tight font-mono ${
            analytics.remaining_budget > 0 ? "text-[#34C759]" : "text-[#FF453A]"
          }`}
        >
          {formatMoney(analytics.remaining_budget, currency)}
        </p>
        <p className="text-xs text-neutral-400 mt-2 border-t border-white/5 pt-2">
          Потрачено {formatMoney(analytics.month_total_spent, currency)} • Ср/день{" "}
          {formatMoney(analytics.avg_daily_spent, currency)}
        </p>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp size={16} strokeWidth={1.5} className="text-neutral-400" />
          Расходы по дням
        </h3>
        <span className="text-[11px] text-neutral-500 tracking-wider">
          лимит {formatMoney(analytics.daily_limit, currency)}
        </span>
      </div>
      <div>
        <div className="flex items-end gap-1 h-28">
          {analytics.daily_series.map((point, index) => {
            const height = Math.max(4, Math.round((point.spent / maxSpent) * 100));
            const over = point.limit != null && point.spent > point.limit;
            return (
              <div key={point.date} className="flex-1 flex flex-col justify-end h-full">
                <motion.div
                  className={`w-full rounded-t-lg ${
                    over
                      ? "bg-gradient-to-t from-[#FF453A] to-[#FF9F0A] shadow-[0_0_12px_rgba(255,69,58,0.3)]"
                      : "bg-white/[0.12]"
                  }`}
                  style={{ height: `${height}%`, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 22,
                    delay: index * 0.02,
                  }}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-neutral-500 tracking-wider text-center">
          {analytics.daily_series.length} дн. · красный — превышение лимита
        </p>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-semibold text-white">По категориям</h3>
      {analytics.category_breakdown.length === 0 ? (
        <p className="text-[11px] text-neutral-500 tracking-wider">Пока нет данных за этот месяц.</p>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          {analytics.category_breakdown.map((row, rowIndex) => (
            <div
              key={row.category}
              className={`px-4 py-3.5 ${rowIndex < analytics.category_breakdown.length - 1 ? "border-b border-white/5" : ""}`}
            >
              <div className="flex justify-between items-center mb-2">
                <ExpenseCategoryPill category={row.category} />
                <span className="text-sm font-semibold text-white font-mono">
                  {formatMoney(row.total, currency)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/30"
                  style={{ width: `${Math.min(100, row.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return content;
}
