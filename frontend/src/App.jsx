import { useCallback, useEffect, useState } from "react";
import { ApiProvider, useApi } from "./context/AppContext.jsx";
import MobileContainer from "./components/layout/MobileContainer.jsx";
import Header from "./components/layout/Header.jsx";
import BottomNavigation from "./components/layout/BottomNavigation.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import AnalyticsPage from "./pages/AnalyticsPage.jsx";
import FixedExpensesPage from "./pages/FixedExpensesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

const TAB_TO_PAGE = {
  dashboard: DashboardPage,
  analytics: AnalyticsPage,
  fixed: FixedExpensesPage,
  profile: ProfilePage,
};

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
  return (
    <ApiProvider>
      <AppShell />
    </ApiProvider>
  );
}
