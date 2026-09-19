import { useCallback, useEffect, useState } from "react";
import { ApiProvider, useApi } from "./context/AppContext.jsx";
import MobileContainer from "./components/layout/MobileContainer.jsx";
import Header from "./components/layout/Header.jsx";
import BottomNavigation from "./components/layout/BottomNavigation.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import FixedExpensesPage from "./pages/FixedExpensesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import PaywallModal from "./components/paywall/PaywallModal.jsx";
import OnboardingOverlay from "./components/onboarding/OnboardingOverlay.jsx";

const TAB_TO_PAGE = {
  dashboard: DashboardPage,
  analytics: AnalyticsPage,
  fixed: FixedExpensesPage,
  profile: ProfilePage,
};

function AppShell() {
  const { dashboard, refreshAll } = useApi();
  const [tab, setTab] = useState("dashboard");
  const [paywallOpen, setPaywallOpen] = useState(false);

  const openPaywall = useCallback(() => setPaywallOpen(true), []);
  const closePaywall = useCallback(() => setPaywallOpen(false), []);
  // §34.2: онбординг стартует с главного экрана — спотлайты ищут питомца и кнопку расхода там
  const requireDashboard = useCallback(() => setTab("dashboard"), []);
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
      {/* Unified padding system (секция 11.1): px-5 py-4 на всех экранах */}
      <main className="px-5 py-4 pb-28">
        {/* §35.3: монеты на главной ведут в профиль, где лежит магазин кастомизации */}
        <Page openPaywall={openPaywall} onNavigate={setTab} />
      </main>
      {/* Заблокированные вкладки ведут на экран с frosted-превью и CTA, а не сразу в пейволл */}
      <BottomNavigation active={tab} onChange={setTab} hasPaidAccess={Boolean(dashboard?.has_paid_access)} />
      <OnboardingOverlay onRequireDashboard={requireDashboard} />
      <PaywallModal open={paywallOpen} onClose={closePaywall} onUnlocked={refreshAll} />
    </MobileContainer>
  );
}

export default function App() {
  return (
    <ApiProvider>
      <AppShell />
    </ApiProvider>
  );
}
