import {
  AlertTriangle,
  BarChart3,
  Car,
  CheckCircle2,
  Coffee,
  Flame,
  Gamepad2,
  MoreHorizontal,
  ShieldAlert,
  ShoppingBag,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";

export const CATEGORY_META = {
  food: { label: "Еда", Icon: Utensils },
  transport: { label: "Транспорт", Icon: Car },
  entertainment: { label: "Развлечения", Icon: Gamepad2 },
  other: { label: "Другое", Icon: MoreHorizontal },
};

export const INSIGHT_ICONS = {
  Coffee,
  ShieldAlert,
  Flame,
  Wallet,
  ShoppingBag,
  Zap,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
};

export function getIcon(name) {
  return INSIGHT_ICONS[name] ?? Wallet;
}

export function getCategoryMeta(category) {
  return CATEGORY_META[category] ?? CATEGORY_META.other;
}

// §35.2: подписи категорий живут в словаре (`category.*`), а не в коде — иначе
// при смене языка список трат остался бы на русском.
const CATEGORY_KEYS = { food: "food", transport: "transport", entertainment: "entertainment" };

export function categoryLabelKey(category) {
  return CATEGORY_KEYS[category] ?? "other";
}
