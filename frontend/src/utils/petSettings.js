import { useEffect, useState } from "react";

// §32.4: настройки геймификации («Геймификация и фичи» в профиле).
//
// Почему localStorage, а не поля профиля: это UX-предпочтения устройства, а таблица
// users в SQLite расширяется только пересозданием (в проекте нет миграций, init_db
// делает лишь create_all) — добавлять колонки под два тумблера рискованно для уже
// существующей demo-базы. Синхронизация между компонентами — через подписку ниже.
const STORAGE_KEY = "budget.pet.settings.v1";

export const DEFAULT_PET_SETTINGS = {
  // «Пауза перед бессмысленной тратой (5 сек)» — выключено → импульс сохраняется сразу
  impulsePauseEnabled: true,
  // «Вибрация при уроне питомцу» — haptic-отклик на списание бюджета
  vibrateOnDamage: true,
};

const listeners = new Set();
let cache = null;

function read() {
  if (cache) return cache;
  if (typeof window === "undefined" || !window.localStorage) return { ...DEFAULT_PET_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = { ...DEFAULT_PET_SETTINGS, ...(raw ? JSON.parse(raw) : null) };
  } catch {
    cache = { ...DEFAULT_PET_SETTINGS };
  }
  return cache;
}

function write(next) {
  cache = next;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* приватный режим / storage отключён — работаем в памяти */
  }
  listeners.forEach((fn) => fn(next));
}

export function getPetSettings() {
  return read();
}

export function setPetSetting(key, value) {
  write({ ...read(), [key]: value });
}

/** Хук: текущие настройки + сеттер одного поля. */
export function usePetSettings() {
  const [settings, setSettings] = useState(read);

  useEffect(() => {
    const onExternal = (next) => setSettings(next);
    listeners.add(onExternal);
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) {
        cache = null;
        setSettings(read());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onExternal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return [
    settings,
    (key, value) => {
      setPetSetting(key, value);
    },
  ];
}
