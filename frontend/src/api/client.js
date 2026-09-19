const BASE = "/api/v1";

// Подписанная Telegram initData: бэкенд проверяет HMAC по BOT_TOKEN и по ней
// определяет пользователя. Вне Telegram (dev-браузер) заголовка просто нет —
// API ответит 401 с подсказкой открыть приложение через Telegram.
function telegramInitData() {
  if (typeof window === "undefined") return null;
  const raw = window.Telegram?.WebApp?.initData;
  return raw ? raw : null;
}

async function request(path, options = {}) {
  const initData = telegramInitData();
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
    },
    ...options,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail ?? JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  getDashboard: () => request("/dashboard"),
  getAnalytics: () => request("/analytics"),
  getProfile: () => request("/profile"),
  updateProfile: (payload) => request("/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  getFixedExpenses: () => request("/fixed-expenses"),
  createFixedExpense: (payload) =>
    request("/fixed-expenses", { method: "POST", body: JSON.stringify(payload) }),
  updateFixedExpense: (id, payload) =>
    request(`/fixed-expenses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFixedExpense: (id) => request(`/fixed-expenses/${id}`, { method: "DELETE" }),
  createTransaction: (payload) =>
    request("/transactions", { method: "POST", body: JSON.stringify(payload) }),
  // §34.1: удаления расходов больше нет — бэкенд отвечает 403 на DELETE
  // /transactions/{id} («Записи в Казне неизменяемы»).
  // Премиум: детектор безопасной покупки (на сколько дней сместится запас прочности)
  safePurchase: (amount) =>
    request("/analytics/safe-purchase", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),
  // Долги («замороженные деньги», секция 12.3)
  getDebts: (includeReturned = false) =>
    request(`/debts${includeReturned ? "?include_returned=true" : ""}`),
  createDebt: (payload) =>
    request("/debts", { method: "POST", body: JSON.stringify(payload) }),
  returnDebt: (id) => request(`/debts/${id}/return`, { method: "POST" }),
  deleteDebt: (id) => request(`/debts/${id}`, { method: "DELETE" }),
  // Создает инвойс Telegram Stars и возвращает { success, invoice_link }.
  // Премиум активируется вебхуком бота на бэкенде после successful_payment (XTR).
  createPayment: (provider = "telegram_stars") =>
    request("/paywall/unlock", {
      method: "POST",
      body: JSON.stringify({ payment_provider: provider }),
    }),
  // Цена премиума в звездах — чтобы показать ее на кнопке до начала оплаты.
  getStarsPrice: () => request("/paywall/stars-price").then((d) => d.stars_price),
  // ---------- §35.3: магазин монет ----------
  getShop: () => request("/shop"),
  purchaseSkin: (skinId) =>
    request("/shop/purchase", { method: "POST", body: JSON.stringify({ skin_id: skinId }) }),

  // ---------- Avatar & Skins (секция 15) ----------
  getAvatarStatus: () => request("/avatar"),
  getAvatarSkins: () => request("/avatar/skins"),
  equipSkin: (skinId) =>
    request("/avatar/skins/equip", {
      method: "POST",
      body: JSON.stringify({ skin_id: skinId }),
    }),
  // ---------- 32.2: осознанный таймер при импульсе ----------
  // Пользователь отменил покупку на 5-секундной паузе → сумма в Сэкономленный Капитал
  creditCancelledImpulse: (amount) =>
    request("/impulse-guard/cancel", { method: "POST", body: JSON.stringify({ amount }) }),

  // ---------- Time Lock (15.3.2, легаси) ----------
  getPendingTransactions: () => request("/pending-transactions"),
  confirmPendingTransaction: (id) =>
    request(`/pending-transactions/${id}/confirm`, { method: "POST" }),
  cancelPendingTransaction: (id) =>
    request(`/pending-transactions/${id}/cancel`, { method: "POST" }),
};
