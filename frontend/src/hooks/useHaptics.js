import { useCallback } from "react";

export function useHaptics() {
  const triggerHaptic = useCallback((type) => {
    // Простая заглушка для вибрации (если поддерживается устройством)
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [15, 10, 15],
        warning: [20, 10, 20],
        error: [30, 10, 30],
      };
      navigator.vibrate(patterns[type] || 10);
    }
  }, []);

  return { triggerHaptic };
}
