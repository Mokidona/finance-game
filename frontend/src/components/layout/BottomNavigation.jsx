import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useHaptics } from "../../hooks/useHaptics.js";
import { BarChart3, CalendarDays, LayoutDashboard, Lock, User } from "lucide-react";

// Подписи берём из словаря по ключу `nav.*` (§35.2)
const TABS = [
  { key: "dashboard", Icon: LayoutDashboard },
  { key: "analytics", Icon: BarChart3 },
  { key: "fixed", Icon: CalendarDays },
  { key: "profile", Icon: User },
];

const SPRING = { type: "spring", stiffness: 400, damping: 28 };

export default function BottomNavigation({ active, onChange, hasPaidAccess }) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-black/70 backdrop-blur-2xl border-t border-white/10 px-6 flex justify-around items-center z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(({ key, Icon }) => {
        const label = t(`nav.${key}`);
        const locked = key === "analytics" && !hasPaidAccess;
        const isActive = active === key;
        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.92 }}
            transition={SPRING}
            onClick={() => {
              triggerHaptic("light");
              onChange(key);
            }}
            className={`relative flex flex-col items-center pt-3 pb-2 min-w-[44px] min-h-[44px] transition-colors ${
              isActive ? "text-white" : "text-[#636366]"
            }`}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={isActive ? 1.5 : 1.25} />
              {locked ? (
                <Lock size={9} strokeWidth={1.5} className="absolute -top-0.5 -right-1.5" />
              ) : null}
            </div>
            <span className={`text-[10px] mt-1 ${isActive ? "font-medium" : "font-normal"}`}>
              {label}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}
