export default function ProgressBar({ percentage = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(percentage) || 0));
  const over = pct >= 100;
  return (
    <div
      className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.7)]"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${
          over ? "bg-[#FF453A]" : "bg-[#30D158]"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
