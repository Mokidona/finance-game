import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { CURRENCIES, currencySymbol } from "../utils/format.js";

const AppContext = createContext(null);

/** Три попытки с небольшой задержкой — переживаем перезапуск API в dev-режиме. */
async function withRetry(fn, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function ApiProvider({ children }) {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshDashboard = useCallback(async () => {
    const data = await api.getDashboard();
    setDashboard(data);
    return data;
  }, []);

  const refreshAnalytics = useCallback(async () => {
    const data = await api.getAnalytics();
    setAnalytics(data);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    const data = await api.getProfile();
    setProfile(data);
    return data;
  }, []);

  const refreshFixedExpenses = useCallback(async () => {
    const data = await api.getFixedExpenses();
    setFixedExpenses(data);
    return data;
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      // Повторяем по 3 раза: если бэкенд в этот момент перезапускается (dev),
      // один сетевой сбой раньше оставлял экран на «Загружаем профиль...» навсегда.
      await Promise.all([
        withRetry(refreshDashboard),
        withRetry(refreshProfile),
        withRetry(refreshFixedExpenses),
      ]);
    } catch (err) {
      setError(err.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [refreshDashboard, refreshProfile, refreshFixedExpenses]);

  const value = useMemo(
    () => ({
      dashboard,
      analytics,
      profile,
      fixedExpenses,
      loading,
      error,
      setAnalytics,
      refreshDashboard,
      refreshAnalytics,
      refreshProfile,
      refreshFixedExpenses,
      refreshAll,
    }),
    [
      dashboard,
      analytics,
      profile,
      fixedExpenses,
      loading,
      error,
      refreshDashboard,
      refreshAnalytics,
      refreshProfile,
      refreshFixedExpenses,
      refreshAll,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApi() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApi must be used within ApiProvider");
  return context;
}

/**
 * §35.1.3: глобальный стейт валюты.
 *
 * В ТЗ упомянут `useCurrencyStore` (zustand) — библиотеку состояния в проект не
 * добавляем: единственный источник правды уже есть в этом контексте (профиль с
 * сервера), второй стор быстро разошёлся бы с ним. Хук даёт тот же контракт:
 * текущая валюта, символ, список опций и смена валюты с записью в профиль.
 */
export function useCurrency() {
  const { profile, refreshProfile } = useApi();
  const currency = profile?.currency || "KZT";

  const changeCurrency = useCallback(
    async (code) => {
      const next = CURRENCIES.find((c) => c.code === code)?.code;
      if (!next || next === profile?.currency) return null;
      const updated = await api.updateProfile({ currency: next });
      await refreshProfile();
      return updated;
    },
    [profile?.currency, refreshProfile]
  );

  return {
    currency,
    symbol: currencySymbol(currency),
    options: CURRENCIES,
    changeCurrency,
  };
}
