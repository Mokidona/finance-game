const BASE = "/api/v1";

function getToken() {
  try {
    return JSON.parse(localStorage.getItem("ft_token") || "null");
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  // Упрощённые долги
  getDebts: (includeReturned = false) =>
    request(`/debts${includeReturned ? "?include_returned=true" : ""}`),
  createDebt: (payload) =>
    request("/debts", { method: "POST", body: JSON.stringify(payload) }),
  returnDebt: (id) => request(`/debts/${id}/return`, { method: "POST" }),
  deleteDebt: (id) => request(`/debts/${id}`, { method: "DELETE" }),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
};
