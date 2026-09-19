// §31/§33: здоровье питомца-тамагочи (HP) — чистая логика, без React.
//
//   HP = min(100, round(Доступно на сегодня / Дневной лимит × 100))
//   HP > 50      → normal   (Сыт и счастлив, зелёная аура, 5–3 ❤)
//   1..50        → warning  (Голоден / тревога, жёлтая аура, 2–1 ❤)
//   0            → defeated (Нокаут, красная аура, 0 ❤, grayscale)
//
// Доступно на сегодня = daily_limit_current (лимит + перенос − траты дня),
// дневной лимит = daily_limit_base. Т.е. «здоровье» — это доля неистраченного
// лимита; перенос из прошлых дней может держать питомца живым даже в красном
// кольце (кольцо считает progress_percentage от базового лимита — это отдельная
// метрика и мы её не трогаем).
export const PET_MAX_HEARTS = 5;
export const PET_WARNING_HP = 50;

// §33.1: сердечки больше не «по 20% за штуку» — матрица состояний требует
// happy = 5–3 ❤ и warning = 2–1 ❤, поэтому ступени подобраны так, чтобы при
// HP 51–100 было 3–5 сердец, а при 1–50 — одно-два.
const HEART_TIERS = [
  { min: 90, hearts: 5 },
  { min: 75, hearts: 4 },
  { min: 51, hearts: 3 },
  { min: 25, hearts: 2 },
  { min: 1, hearts: 1 },
];

// Совместимость с формулой §31 (шаг одного сердца в процентах).
export const PET_HEART_STEP = 100 / PET_MAX_HEARTS;

// Палитра статусов: цвет свечения под питомцем (§31.3 glowMap) и цвет сердец (§31.2)
export const PET_STATUS_STYLE = {
  normal: {
    label: "Здоров",
    mood: "Сыт и счастлив",
    color: "#34C759",
    glow: "rgba(52, 199, 89, 0.25)",
    heartsColor: "text-[#34C759]",
    fainted: false,
  },
  warning: {
    label: "Уязвим",
    mood: "Голоден и тревожится",
    color: "#FF9F0A",
    glow: "rgba(255, 159, 10, 0.25)",
    heartsColor: "text-[#FF9F0A]",
    fainted: false,
  },
  defeated: {
    label: "Нокаут",
    mood: "Финансовый нокаут",
    color: "#FF453A",
    glow: "rgba(255, 69, 58, 0.25)",
    heartsColor: "text-[#FF453A]",
    fainted: true,
  },
};

// §33.3: реплика питомца по тапу. Тексты — из ТЗ, без эмодзи (§8.1).
export const PET_TAP_MESSAGE = {
  normal: "Всё под контролем! Сила Казны растет.",
  warning: "Осторожно! Лимит почти исчерпан.",
  defeated: "Я в нокауте... Ждем обновления лимита в 00:00 или пополни бюджет.",
};

/** HP в процентах, 0..100 (целое). */
export function petHpPercent(availableBudget, dailyLimit) {
  const available = Number(availableBudget) || 0;
  const limit = Number(dailyLimit) || 0;
  if (limit <= 0) {
    // Лимит не задан (например, доход не введён): считаем питомца живым, пока
    // есть хоть что-то доступное, иначе он «повержен» — без деления на ноль.
    return available > 0 ? 100 : 0;
  }
  if (available <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((available / limit) * 100)));
}

/** Статус питомца по HP (§33.2: hp === 0 → defeated, hp <= 50 → warning). */
export function petStatus(hpPercent) {
  if (hpPercent <= 0) return "defeated";
  if (hpPercent <= PET_WARNING_HP) return "warning";
  return "normal";
}

/** Сколько сердечек заполнено (матрица §33.1). */
export function petHearts(hpPercent) {
  const hp = Math.max(0, Math.min(100, Math.round(Number(hpPercent) || 0)));
  if (hp <= 0) return 0;
  const tier = HEART_TIERS.find((row) => hp >= row.min);
  return tier ? tier.hearts : 1;
}

/** Всё состояние питомца одним объектом. */
export function computePetHealth({ availableBudget, dailyLimit } = {}) {
  const hpPercent = petHpPercent(availableBudget, dailyLimit);
  const status = petStatus(hpPercent);
  return {
    hpPercent,
    status,
    hearts: petHearts(hpPercent),
    maxHearts: PET_MAX_HEARTS,
    ...PET_STATUS_STYLE[status],
  };
}

/** §33.4: питомец в нокауте → финансовый карантин (пауза обязательна для всех трат). */
export function petIsFainted(health) {
  return Boolean(health?.fainted) || health?.hpPercent <= 0;
}

/** Статус → эмоция спрайта-маскота (§28: NORMAL/WARNING/DEFEATED). */
export function petEmotion(status) {
  return String(status || "normal").toUpperCase();
}
