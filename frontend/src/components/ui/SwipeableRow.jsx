import { useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { Check, Trash2 } from "lucide-react";
import { useHaptics } from "../../hooks/useHaptics.js";

const SPRING = { type: "spring", stiffness: 400, damping: 30 };
const ACTION_WIDTH = 80; // w-20 из ТЗ 12.2

// Нативный свайп-элемент (12.2 + 14.3.3):
//  - direction="left" (по умолчанию): красная зона удаления
//  - direction="right": мятная зона положительного действия (например «Вернул»)
export default function SwipeableRow({
  children,
  onDelete,
  onRightAction,
  direction = "left",
  className = "",
}) {
  const { triggerHaptic } = useHaptics();
  const x = useMotionValue(0);
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  // Цветная зона показывается только во время свайпа. Иначе композитный слой
  // строки (drag transform) на скруглённых углах просвечивал фон — красная
  // полоска и красные дуги в правом краю строки в покое (баг из §32).
  const [revealed, setRevealed] = useState(false);

  const hasRight = typeof onRightAction === "function" && direction === "right";

  const runAction = () => {
    triggerHaptic("warning");
    setRemoving(true);
    setTimeout(() => {
      (hasRight ? onRightAction : onDelete)?.();
      setRemoved(true);
    }, 220);
  };

  const handleDragEnd = (_event, info) => {
    const halfScreen = window.innerWidth / 2;
    const draggedFar = Math.abs(x.get()) >= halfScreen;

    if (direction === "right") {
      if (x.get() > ACTION_WIDTH / 2 || (draggedFar && x.get() > 0)) {
        runAction();
        return;
      }
      const openedRight = x.get() > ACTION_WIDTH / 4;
      x.set(openedRight ? ACTION_WIDTH : 0);
      setRevealed(openedRight);
      return;
    }

    if (x.get() < -ACTION_WIDTH / 2) {
      if (draggedFar) {
        runAction();
        return;
      }
      triggerHaptic("light");
      x.set(-ACTION_WIDTH);
      setRevealed(true);
    } else {
      x.set(0);
      setRevealed(false);
    }
  };

  if (removed) return null;

  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      animate={removing ? { height: 0, opacity: 0, marginBottom: 0 } : { height: "auto" }}
      transition={SPRING}
    >
      <div className={`absolute inset-0 transition-opacity duration-150 ${revealed ? "opacity-100" : "opacity-0"}`}>
        {direction === "right" ? (
          /* Мятная зона действия (14.3.3): возврат денег на щит аватара */
          <button
            type="button"
            onClick={runAction}
            className="absolute inset-y-0 left-0 w-20 bg-[#30D158] flex items-center justify-center rounded-l-2xl"
            aria-label="Вернул"
            tabIndex={revealed ? 0 : -1}
          >
            <Check size={22} strokeWidth={1.75} className="text-black" />
          </button>
        ) : (
          /* Красная зона удаления (bg-red-500, w-20): тап или полный свайп удаляют */
          <button
            type="button"
            onClick={runAction}
            className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-r-2xl"
            aria-label="Удалить"
            tabIndex={revealed ? 0 : -1}
          >
            <Trash2 size={20} strokeWidth={1.5} className="text-white" />
          </button>
        )}
      </div>

      <motion.div
        className="relative bg-black"
        drag="x"
        dragDirectionLock
        style={{ x }}
        dragConstraints={direction === "right" ? { left: 0, right: ACTION_WIDTH + 40 } : { left: -ACTION_WIDTH - 40, right: 0 }}
        dragElastic={0.15}
        dragMomentum={false}
        onDragStart={() => setRevealed(true)}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
