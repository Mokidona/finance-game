import { getCategoryMeta } from "../../utils/icons.js";

export default function ExpenseCategoryPill({ category, className = "" }) {
  const { label } = getCategoryMeta(category);
  return (
    <span className={`inline-flex items-center text-sm text-[#8E8E93] ${className}`}>{label}</span>
  );
}
