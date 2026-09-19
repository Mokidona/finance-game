import { motion } from "framer-motion";
import { useHaptics } from "../../hooks/useHaptics.js";

const VARIANTS = {
  primary: "bg-white text-black font-semibold",
  mint: "bg-[#30D158] text-black font-semibold shadow-[0_4px_25px_rgba(48,209,88,0.25)]",
  glass: "bg-white/10 text-white border border-white/10 hover:bg-white/15",
  danger: "bg-[#FF453A]/10 text-[#FF453A] border border-[#FF453A]/20",
};

const SPRING = { type: "spring", stiffness: 400, damping: 28 };

export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled = false,
  haptic = "light",
}) {
  const { triggerHaptic } = useHaptics();

  return (
    <motion.button
      type={type}
      onClick={(event) => {
        if (disabled) return;
        if (haptic) triggerHaptic(haptic);
        onClick?.(event);
      }}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={SPRING}
      className={`h-12 rounded-full text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
