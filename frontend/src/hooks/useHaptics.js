import { useCallback } from "react";

const VIBRATION_PATTERNS = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 30, 20],
  warning: [30, 50, 30],
  error: [50, 100, 50],
};

export function useHaptics() {
  const triggerHaptic = useCallback((type) => {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;

    if (tg?.HapticFeedback) {
      if (["light", "medium", "heavy"].includes(type)) {
        tg.HapticFeedback.impactOccurred(type);
      } else {
        tg.HapticFeedback.notificationOccurred(type);
      }
      return;
    }

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      // Запасной фоллбек для обычного мобильного браузера
      navigator.vibrate(VIBRATION_PATTERNS[type] || 15);
    }
  }, []);

  return { triggerHaptic };
}
