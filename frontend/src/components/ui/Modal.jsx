import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHaptics } from "../../hooks/useHaptics.js";

const SPRING = { type: "spring", damping: 30, stiffness: 300 };

export default function Modal({ open, onClose, children }) {
  const { triggerHaptic } = useHaptics();

  useEffect(() => {
    if (open) triggerHaptic("medium");
  }, [open, triggerHaptic]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[390px] rounded-t-3xl bg-white/[0.04] backdrop-blur-2xl border-t-[rgba(255,255,255,0.18)] border-x-[rgba(255,255,255,0.08)] border-b-[rgba(255,255,255,0.05)] border-x border-b p-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
