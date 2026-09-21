import { useTranslation } from "react-i18next";
import { useHaptics } from "../../hooks/useHaptics.js";

export default function Header({ userName, status, onAvatarClick }) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  return (
    <header className="flex justify-between items-center px-5 pt-4">
      <button
        type="button"
        onClick={() => {
          triggerHaptic("light");
          onAvatarClick?.();
        }}
        className="min-h-[44px] flex items-center active:opacity-70 transition-opacity"
      >
        <span className="font-medium text-sm text-white">{userName || t("header.user")}</span>
      </button>
    </header>
  );
}
