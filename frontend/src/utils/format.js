// §35.1: мультивалютность. Код валюты хранится в профиле (users.currency), символ
// подставляется при рендере — сумма в стейте всегда одна и та же, а вид меняется.
export const CURRENCIES = [
  { code: "KZT", symbol: "₸" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "RUB", symbol: "₽" },
];

export function currencySymbol(code = "KZT") {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** «KZT (₸)» для переключателя валют. */
export function currencyLabel(code) {
  return `${code} (${currencySymbol(code)})`;
}

export function formatAmount(value) {
  const num = Number(value) || 0;
  const rounded = Math.round(num);
  const sign = rounded < 0 ? "-" : "";
  const digits = Math.abs(rounded).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

/** Деньги в формате «21 200 ₸» — единственный способ рендерить суммы в UI (§35.1.3). */
export function formatCurrency(value, currency = "KZT") {
  return `${formatAmount(value)} ${currencySymbol(currency)}`;
}

/** @deprecated оставлено как алиас, чтобы не переписывать все экраны сразу. */
export const formatMoney = formatCurrency;

// «25 сен» для дат возврата долгов
export function formatDateShort(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

export function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
