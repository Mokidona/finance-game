import IconWrapper from "../ui/IconWrapper.jsx";
import { GLASS } from "../ui/surfaces.js";
import { getIcon } from "../../utils/icons.js";

export default function InsightCard({ insight }) {
  const Icon = getIcon(insight.icon);
  const isFlame = insight.icon === "Flame";
  return (
    <div className={`p-4 rounded-2xl flex items-start gap-3 ${GLASS}`}>
      <IconWrapper
        icon={Icon}
        size={18}
        className={`w-10 h-10 rounded-xl border ${
          isFlame
            ? "bg-white/[0.08] border-[#F59E0B]/30 text-[#F59E0B]"
            : "bg-white/[0.08] border-white/10 text-[#8E8E93]"
        }`}
      />
      <p className="text-xs text-[#8E8E93] leading-relaxed">{insight.text}</p>
    </div>
  );
}
