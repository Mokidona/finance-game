import { useCallback, useEffect, useState } from "react";
import { ApiProvider, useApi } from "./context/AppContext.jsx";
import MobileContainer from "./components/layout/MobileContainer.jsx";
import Header from "./components/layout/Header.jsx";
import BottomNavigation from "./components/layout/BottomNavigation.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import FixedExpensesPage from "./pages/FixedExpensesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { api } from "./api/client.js";

const TAB_TO_PAGE = {
  dashboard: DashboardPage,
  analytics: AnalyticsPage,
  fixed: FixedExpensesPage,
  profile: ProfilePage,
};

function AuthForm({ onAuth }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let data;
      try {
        data = await api.login({ email });
      } catch {
        data = await api.register({ email, first_name: "Пользователь" });
      }
      const userId = data.id || data.user_id || 1;
      localStorage.setItem("ft_token", JSON.stringify(userId));
      onAuth(userId);
    } catch (err) {
      setError(err.message || "Ошибка авторизации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xs mx-auto mt-20 px-6">
      <h1 className="text-2xl font-bold text-white mb-6 text-center">Finance Tracker</h1>
      <form onSubmit={handle} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-white/20"
          required
        />
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !email}
          className="w-full h-12 bg-white text-black font-semibold rounded-xl active:scale-[0.97] transition-all disabled:opacity-40"
        >
          {loading ? "Вход..." : "Войти / Зарегистрироваться"}
        </button>
      </form>
      <p className="text-[10px] text-neutral-500 text-center mt-6">PWA — добавьте на рабочий стол для удобного доступа</p>
    </div>
  );
}

function AppShell() {
  const { dashboard, refreshAll } = useApi();
  const [tab, setTab] = useState("dashboard");
  const Page = TAB_TO_PAGE[tab] ?? DashboardPage;

  useEffect(() => {
    refreshAll().catch(() => {});
  }, [refreshAll]);

  return (
    <MobileContainer>
      <Header
        userName={dashboard?.user_name}
        status={dashboard?.status}
        onAvatarClick={() => setTab("profile")}
      />
      <main className="px-5 py-4 pb-28">
        <Page onNavigate={setTab} />
      </main>
      <BottomNavigation active={tab} onChange={setTab} hasPaidAccess={Boolean(dashboard?.has_paid_access)} />
    </MobileContainer>
  );
}

export default function App() {
  const [token, setToken] = useState(() => {
    try {
      const t = JSON.parse(localStorage.getItem("ft_token") || "null");
      return t ? String(t) : null;
    } catch {
      return null;
    }
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-[#000000] text-white">
        <AuthForm onAuth={(id) => { localStorage.setItem("ft_token", JSON.stringify(id)); setToken(String(id)); window.location.reload(); }} />
      </div>
    );
  }

  return (
    <ApiProvider>
      <AppShell />
    </ApiProvider>
  );
}
