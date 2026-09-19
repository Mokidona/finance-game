import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../utils/format.js";

// Умный статус дня: микро-копирайт зависит от времени суток и остатка лимита.
// §32.1: риск/перерасход определяем по HP питомца (единственный источник истины),
// а не по старому «запасу прочности».
// §35.2: все реплики вынесены в словарь (`day.*`).
export default function DayStatus({ dashboard, hpPercent }) {
  const { t } = useTranslation();
  if (!dashboard) return null;

  const hp = Number.isFinite(hpPercent) ? hpPercent : 100;
  const over = hp <= 0;
  const critical = hp > 0 && hp <= 50;
  const remaining = dashboard.daily_limit_current ?? 0;
  const hour = new Date().getHours();
  const currency = dashboard.currency ?? "KZT";

  let title;
  if (over) {
    title = t("day.over");
  } else if (critical) {
    title = t("day.critical", { hp });
  } else if (hour >= 23 || hour < 5) {
    title = t("day.closedLate", { amount: formatCurrency(Math.max(0, remaining), currency) });
  } else if (hp <= 70) {
    title = t("day.low");
  } else if (hour < 12) {
    title = t("day.morning");
  } else if (hour < 17) {
    title = t("day.noon");
  } else {
    title = t("day.evening");
  }

  return <p className="mt-3 text-sm text-neutral-400 text-center">{title}</p>;
}
