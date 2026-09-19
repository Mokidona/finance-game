import { motion } from "framer-motion";
import { useHaptics } from "../../hooks/useHaptics.js";

const SPRING = { type: "spring", stiffness: 500, damping: 32 };

/**
 * iOS-тумблер (Sections 7.2 / 32.4): 51×31, knob 27, акцент #30D158 при включении.
 *
 * @param {boolean} checked
 * @param {(next: boolean) => void} onChange
 * @param {string} label — для aria-label
 */
export default function ToggleSwitch({ checked, onChange, label, disabled = false }) {
  const { triggerHaptic } = useHaptics();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        triggerHaptic("light");
        onChange?.(!checked);
      }}
      className={`relative shrink-0 w-[51px] h-[31px] rounded-full transition-colors duration-200 disabled:opacity-40 ${
        checked ? "bg-[#30D158]" : "bg-white/[0.16]"
      }`}
    >
      <motion.span
        className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
        animate={{ x: checked ? 20 : 0 }}
        transition={SPRING}
      />
    </button>
  );
}
