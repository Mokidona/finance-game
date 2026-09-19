import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import ru from "./locales/ru.json";
import kk from "./locales/kk.json";
import en from "./locales/en.json";

// §35.2: локализация на три языка. Библиотека — react-i18next (запрос из ТЗ);
// next-intl не подходит: он для Next.js, а здесь Vite + React SPA.
//
// Определение языка: 1) ручной выбор пользователя (localStorage), 2) язык
// Telegram WebApp (`initDataUnsafe.user.language_code` — в мини-аппе это
// правильный источник), 3) язык браузера, 4) RU по умолчанию.
export const SUPPORTED_LANGUAGES = [
  { code: "ru", short: "RU", label: "Русский" },
  { code: "kk", short: "KK", label: "Қазақша" },
  { code: "en", short: "EN", label: "English" },
];

export const DEFAULT_LANGUAGE = "ru";
const STORAGE_KEY = "budget.lang.v1";

function normalize(code) {
  const value = String(code || "").toLowerCase();
  if (value.startsWith("kk") || value.startsWith("kz")) return "kk";
  if (value.startsWith("en")) return "en";
  if (value.startsWith("ru")) return "ru";
  return null;
}

function detectLanguage() {
  try {
    const saved = normalize(window.localStorage?.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    /* приватный режим */
  }
  const telegram = window?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
  return (
    normalize(telegram) ||
    normalize(typeof navigator !== "undefined" ? navigator.language : null) ||
    DEFAULT_LANGUAGE
  );
}

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    kk: { translation: kk },
    en: { translation: en },
  },
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false },
  returnNull: false,
});

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") document.documentElement.lang = lng;
});

/** Ручной выбор языка (селектор в профиле): меняет язык и запоминает выбор. */
export function changeLanguage(code) {
  const next = normalize(code) || DEFAULT_LANGUAGE;
  try {
    window.localStorage?.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  return i18n.changeLanguage(next);
}

export function currentLanguage() {
  return normalize(i18n.language) || DEFAULT_LANGUAGE;
}

if (typeof document !== "undefined") document.documentElement.lang = currentLanguage();

export default i18n;
