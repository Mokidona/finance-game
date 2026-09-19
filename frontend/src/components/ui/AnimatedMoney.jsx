import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { formatAmount } from "../../utils/format.js";

export default function AnimatedMoney({
  value = 0,
  currency = "KZT",
  className = "",
  currencyClassName = "text-[#636366]",
  gradient = false,
}) {
  const [display, setDisplay] = useState(Number(value) || 0);
  const displayedRef = useRef(Number(value) || 0);

  useEffect(() => {
    const to = Number(value) || 0;
    const from = displayedRef.current;
    if (Math.abs(to - from) < 0.5) {
      displayedRef.current = to;
      setDisplay(to);
      return undefined;
    }
    const controls = animate(from, to, {
      duration: 0.9,
      ease: [0.33, 1, 0.68, 1], // easeOutCubic
      onUpdate: (latest) => {
        displayedRef.current = latest;
        setDisplay(latest);
      },
    });
    return () => controls.stop();
  }, [value]);

  return (
    <span className={className}>
      <span
        className={
          gradient
            ? "bg-gradient-to-b from-white to-[#C7C7CC] bg-clip-text text-transparent"
            : ""
        }
      >
        {formatAmount(display)}
      </span>{" "}
      <span className={currencyClassName}>{currency}</span>
    </span>
  );
}
