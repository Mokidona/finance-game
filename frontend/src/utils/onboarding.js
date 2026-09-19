import { useEffect, useState } from "react";

// §34.2: флаг онбординга. Хранится в localStorage (а не в БД), т.к. в проекте нет
// миграций — `init_db` делает только `create_all`, и новая колонка `has_completed_onboarding`
// у уже существующей demo-базы не появится без ручного ALTER. Онбординг — это
// прохождение на устройстве, поэтому локальный флаг семантически корректен.
// Когда появится серверный профиль по telegram_id — флаг легко переносится в `users`.
const STORAGE_KEY = "budget.onboarding.v1";

const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  if (typeof window === "undefined" || !window.localStorage) {
    cache = { hasCompletedOnboarding: false };
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = { hasCompletedOnboarding: Boolean(parsed?.hasCompletedOnboarding) };
  } catch {
    cache = { hasCompletedOnboarding: false };
  }
  return cache;
}

function write(next) {
  cache = next;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* приватный режим — работаем в памяти */
  }
  listeners.forEach((fn) => fn(next));
}

export function getOnboardingState() {
  return read();
}

export function completeOnboarding(meta = {}) {
  write({ hasCompletedOnboarding: true, completedAt: new Date().toISOString(), ...meta });
}

/** Для повторного прохождения тура (dev/поддержка). */
export function resetOnboarding() {
  cache = null;
  try {
    window.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(read()));
}

/** Хук: состояние онбординга + действия. */
export function useOnboarding() {
  const [state, setState] = useState(read);

  useEffect(() => {
    const onExternal = (next) => setState(next);
    listeners.add(onExternal);
    return () => listeners.delete(onExternal);
  }, []);

  return [
    state,
    {
      complete: completeOnboarding,
      reset: resetOnboarding,
    },
  ];
}
