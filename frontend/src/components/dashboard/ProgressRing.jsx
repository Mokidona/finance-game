import { motion } from "framer-motion";
import { useMemo } from "react";

// Твердый iOS donut-ринг из секции 11.2: 220px, strokeWidth 8,
// градиент изумруд → мята, недоиспользованный хвост — почти невидимый трек.
const SIZE = 220;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ProgressRing({ percentage = 0, over = false, children }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const dash = (pct / 100) * CIRCUMFERENCE;
  const gradientId = useMemo(() => `ring-grad-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      {/* Ambient center blur за цифрами: rgba(52,199,89,0.12) → transparent */}
      <div
        className="absolute inset-6 rounded-full pointer-events-none"
        style={{
          background: over
            ? "radial-gradient(circle, rgba(255,69,58,0.14) 0%, rgba(0,0,0,0) 70%)"
            : "radial-gradient(circle, rgba(52,199,89,0.12) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(20px)",
        }}
      />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={over ? "#FF453A" : "#34C759"} />
            <stop offset="100%" stopColor={over ? "#FF9F0A" : "#30D158"} />
          </linearGradient>
        </defs>
        {/* Незадействованный хвост: rgba(255,255,255,0.06) */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={over ? { filter: "drop-shadow(0 0 6px rgba(255,69,58,0.45))" } : undefined}
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{
            strokeDashoffset: CIRCUMFERENCE - dash,
            ...(over ? { opacity: [1, 0.55, 1] } : {}),
          }}
          transition={
            over
              ? {
                  strokeDashoffset: { type: "spring", stiffness: 60, damping: 18 },
                  opacity: { repeat: Infinity, duration: 1.6, ease: "easeInOut" },
                }
              : { type: "spring", stiffness: 60, damping: 18 }
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 z-10">
        {children}
      </div>
    </div>
  );
}
