import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function StatusBadge({ status = "normal" }) {
  const { t } = useTranslation();
  const over = status === "over_limit";

  return (
    <div
      className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
        over ? "text-[#FF453A]" : "text-[#30D158]"
      }`}
    >
      {over ? <AlertTriangle size={13} strokeWidth={1.5} /> : <CheckCircle2 size={13} strokeWidth={1.5} />}
      {over ? t("header.over") : t("header.normal")}
    </div>
  );
}
