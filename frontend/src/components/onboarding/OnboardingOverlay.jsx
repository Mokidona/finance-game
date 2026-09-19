import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, HeartCrack, Lock, MousePointerClick, Target } from "lucide-react";
import { useApi } from "../../context/AppContext.jsx";
import { api } from "../../api/client.js";
import { useHaptics } from "../../hooks/useHaptics.js";
import { useOnboarding } from "../../utils/onboarding.js";
import { computePetHealth } from "../../utils/petHealth.js";
import { CURRENCIES, formatCurrency, currencyLabel, currencySymbol } from "../../utils/format.js";

// §34.2: интерактивный онбординг из четырёх шагов. Эмодзи из ТЗ заменены на иконки
// lucide (правило §8.1), типографика и палитра — как в остальном приложении.
// §35: все тексты идут через i18n, а на шаге лимита сначала выбирается валюта.
//
// Особенность шага 3: онбординг НЕ рисует свою модалку расхода — пользователь
// пользуется настоящей кнопкой «Внести расход» и настоящим модальным окном.
// Поэтому оверлей здесь «пропускает» клики (pointer-events-none) и только
// подсвечивает кнопку рамкой; шаг завершается, когда в дашборде появляется
// новая запись расхода.
const PANEL =
  "w-full max-w-[350px] rounded-3xl border border-white/10 bg-neutral-950/90 p-5 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]";
const VEIL_SHADOW = "0 0 0 9999px rgba(0,0,0,0.78)";
const SPRING = { type: "spring", stiffness: 380, damping: 32 };
const TOTAL_STEPS = 4;

// Ищем цели по data-атрибутам: aria-label локализован, а онбординг должен
// находить питомца на любом языке (§35.2).
const PET_SELECTOR = '[data-onboarding="pet"]';
const ADD_BUTTON_SELECTOR = '[data-onboarding="add-expense"]';

/**
 * Прямоугольник элемента на странице (для спотлайта) с пересчётом на скролл/ресайз.
 *
 * ВАЖНО: принимает только строку-селектор. Первая версия брала массив селекторов и
 * создавала его литералом на каждом рендере — из-за этого эффект перезапускался,
 * setRect давал новую ссылку и React падал в «Maximum update depth exceeded».
 * Плюс сравниваем скруглённые значения: лишний setState не нужен, если ничего не сдвинулось.
 */
function useElementRect(selector, enabled, key) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!enabled || !selector) {
      setRect(null);
      return undefined;
    }
    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
      setRect((prev) =>
        prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
          ? prev
          : next
      );
    };
    measure();
    const timer = setTimeout(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const interval = setInterval(measure, 500);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [enabled, key, selector]);

  return rect;
}

export default function OnboardingOverlay({ onRequireDashboard, onFinished }) {
  const { dashboard, profile, refreshProfile, refreshDashboard } = useApi();
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const [state, actions] = useOnboarding();
  const [step, setStep] = useState(1);
  const [limitInput, setLimitInput] = useState("");
  // null = «не выбрано вручную» → подставляем валюту профиля (а не жёсткий KZT:
  // иначе сохранение лимита без тапа по чипу переключало валюту на KZT)
  const [pendingCurrency, setPendingCurrency] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [testAmount, setTestAmount] = useState(null);
  const [phase, setPhase] = useState("prompt"); // prompt | result (шаг 3)
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const open = !state.hasCompletedOnboarding && Boolean(dashboard) && Boolean(profile);
  const currency = profile?.currency || "KZT";

  const health = useMemo(
    () =>
      computePetHealth({
        availableBudget: dashboard?.daily_limit_current,
        dailyLimit: dashboard?.daily_limit_base,
      }),
    [dashboard?.daily_limit_current, dashboard?.daily_limit_base]
  );

  // Онбординг живёт на главном экране: спотлайты ищут питомца и кнопку расхода там.
  useEffect(() => {
    if (open) onRequireDashboard?.();
  }, [open, onRequireDashboard]);

  // Дефолты шага лимита: текущая валюта профиля и текущий дневной лимит (в ТЗ пример 5 000).
  useEffect(() => {
    if (!open) return;
    const current = Number(profile?.daily_limit || 0);
    setLimitInput((prev) => prev || String(current > 0 ? Math.round(current) : 5000));
  }, [open, profile?.daily_limit]);

  // Точка отсчёта для шага 3: сколько расходов было до тестовой покупки.
  useEffect(() => {
    if (step === 3 && phase === "prompt" && baseline === null && dashboard) {
      setBaseline((dashboard.today_transactions || []).length);
    }
  }, [step, phase, baseline, dashboard]);

  // Шаг 3: ловим появление новой записи расхода → показываем результат урона.
  useEffect(() => {
    if (step !== 3 || phase !== "prompt" || baseline === null) return;
    const list = dashboard?.today_transactions || [];
    if (list.length > baseline) {
      setTestAmount(Number(list[0]?.amount || 0));
      setPhase("result");
      triggerHaptic("warning");
    }
  }, [step, phase, baseline, dashboard?.today_transactions, triggerHaptic]);

  const petRect = useElementRect(PET_SELECTOR, open && step <= 2, step);
  const addButtonRect = useElementRect(ADD_BUTTON_SELECTOR, open && step === 3 && phase === "prompt", phase);

  const finish = useCallback(
    (why) => {
      triggerHaptic("success");
      actions.complete({ via: why });
      setWelcomeOpen(true);
      onFinished?.();
    },
    [actions, onFinished, triggerHaptic]
  );

  const saveLimit = async () => {
    const target = Number(String(limitInput).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(target) || target <= 0) {
      setError(t("onboarding.limitInvalid"));
      triggerHaptic("error");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // §35.1: валюта сохраняется в профиле до расчёта лимита
      if (selectedCurrency !== profile?.currency) {
        await api.updateProfile({ currency: selectedCurrency });
      }
      // Дневной лимит на бэкенде производный: (доход − фикс. расходы − заморожено) / дни
      // месяца. Считаем доход обратно от желаемого лимита, чтобы после PATCH лимит совпал ровно.
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const income =
        target * daysInMonth +
        Number(profile?.fixed_expenses_total || 0) +
        Number(dashboard?.frozen_total || 0);
      await api.updateProfile({ monthly_income: income });
      await Promise.all([refreshProfile(), refreshDashboard()]);
      setTestAmount(null);
      setPhase("prompt");
      setBaseline(null); // пересчитаем от свежего дашборда
      triggerHaptic("success");
      setStep(3);
    } catch (e) {
      setError(e?.message || t("onboarding.limitFailed"));
      triggerHaptic("error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  // Валюта, которую показываем на шаге лимита: ручной выбор или валюта профиля
  const selectedCurrency = pendingCurrency || profile?.currency || "KZT";
  const limitValue = Number(String(limitInput).replace(/\s/g, "").replace(",", ".")) || 0;
  // 20 % лимита — та же арифметика, что «1 000 из 5 000» в ТЗ, но для любого лимита.
  const suggestedTest = Math.max(1, Math.round(limitValue / 5));
  const damaged = Math.max(
    0,
    100 - (testAmount && limitValue > 0 ? Math.round((testAmount / limitValue) * 100) : 20)
  );

  const isBlanketStep = step === 1 || step === 2 || step === 4 || (step === 3 && phase === "result");

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none" role="dialog" aria-modal="true" aria-label={t("onboarding.aria")}>
      {/* Шаги с карточкой: клики наружу блокируем, чтобы тур нельзя было случайно «пролистать» */}
      {isBlanketStep ? <div className="absolute inset-0 pointer-events-auto" /> : null}

      {/* Спотлайт на питомце: тёмный оверлей рисуется тенью самого «окна» (шаги 1–2) */}
      {step <= 2 && petRect ? (
        <div
          className="absolute rounded-full border border-white/20 pointer-events-none transition-all duration-300"
          style={{
            left: Math.round(petRect.x - 10),
            top: Math.round(petRect.y - 10),
            width: Math.round(petRect.w + 20),
            height: Math.round(petRect.h + 20),
            boxShadow: VEIL_SHADOW,
          }}
        />
      ) : null}

      {/* Шаг 1: тап по самому питомцу — тоже «Танысу»/«Познакомиться»/«Meet me» */}
      {step === 1 && petRect ? (
        <button
          type="button"
          onClick={() => {
            triggerHaptic("light");
            setStep(2);
          }}
          aria-label={t("pet.ariaTapPet")}
          className="absolute pointer-events-auto rounded-full"
          style={{
            left: Math.round(petRect.x - 10),
            top: Math.round(petRect.y - 10),
            width: Math.round(petRect.w + 20),
            height: Math.round(petRect.h + 20),
          }}
        />
      ) : null}

      {/* Шаг 3 (prompt): без затемнения — пользователь работает с настоящей модалкой,
          кнопка «Внести расход» обведена зелёной рамкой */}
      {step === 3 && phase === "prompt" && addButtonRect ? (
        <div
          className="absolute rounded-2xl pointer-events-none border-2 border-[#34C759] transition-all duration-300"
          style={{
            left: Math.round(addButtonRect.x - 6),
            top: Math.round(addButtonRect.y - 6),
            width: Math.round(addButtonRect.w + 12),
            height: Math.round(addButtonRect.h + 12),
            boxShadow: "0 0 24px rgba(52,199,89,0.45)",
          }}
        />
      ) : null}

      {step === 3 && phase === "prompt" ? (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="absolute top-4 left-0 right-0 px-5 flex justify-center"
        >
          <div className={`${PANEL} pointer-events-auto`}>
            <div className="flex items-center gap-2 mb-2">
              <MousePointerClick size={16} strokeWidth={1.5} className="text-[#34C759]" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {t("onboarding.stepOf", { step: 3, total: TOTAL_STEPS })}
              </span>
            </div>
            <p className="text-sm font-semibold text-white mb-1">{t("onboarding.testTitle")}</p>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {t("onboarding.testBody", { amount: formatCurrency(suggestedTest, currency) })}
            </p>
            <button
              type="button"
              onClick={() => finish("skip")}
              className="mt-3 text-[11px] text-neutral-500 underline underline-offset-2"
            >
              {t("common.skip")}
            </button>
          </div>
        </motion.div>
      ) : null}

      {/* Карточки: шаги 1, 2, 4 и результат шага 3 */}
      {isBlanketStep ? (
        <div className="absolute inset-0 flex flex-col items-center justify-end px-5 pb-24">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={SPRING}
                className={`${PANEL} pointer-events-auto`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-[#34C759]/15 flex items-center justify-center">
                    <Target size={22} strokeWidth={1.5} className="text-[#34C759]" />
                  </span>
                  <h2 className="text-lg font-bold text-white">{t("onboarding.title")}</h2>
                  <p className="text-xs text-neutral-400 leading-relaxed">{t("onboarding.subtitle")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setStep(2);
                    }}
                    className="w-full h-12 rounded-2xl bg-[#34C759] text-black text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                  >
                    {t("onboarding.meet")}
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => finish("skip")}
                    className="text-[11px] text-neutral-500 underline underline-offset-2"
                  >
                    {t("common.skip")}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={SPRING}
                className={`${PANEL} pointer-events-auto`}
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center">
                    <Target size={22} strokeWidth={1.5} className="text-white/80" />
                  </span>

                  {/* §35.1.2: выбор валюты ДО ввода лимита */}
                  <div className="w-full">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
                      {t("onboarding.currencyTitle")}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {CURRENCIES.map(({ code }) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setPendingCurrency(code);
                          }}
                          className={`h-10 rounded-xl text-[11px] font-bold transition-colors ${
                            selectedCurrency === code
                              ? "bg-[#34C759] text-black"
                              : "bg-white/[0.06] text-neutral-400"
                          }`}
                        >
                          {currencyLabel(code)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <h2 className="text-lg font-bold text-white">{t("onboarding.limitTitle")}</h2>
                  <p className="text-xs text-neutral-400 leading-relaxed">{t("onboarding.limitSub")}</p>

                  <div className="w-full flex items-center gap-2">
                    <input
                      value={limitInput}
                      onChange={(event) => setLimitInput(event.target.value.replace(/[^\d\s.,]/g, ""))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveLimit();
                      }}
                      inputMode="decimal"
                      className="flex-1 min-w-0 h-12 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-center text-xl font-bold text-white font-mono focus:outline-none focus:border-[#34C759]/60"
                    />
                    <span className="text-sm text-neutral-400 shrink-0">
                      {currencySymbol(selectedCurrency)}
                    </span>
                  </div>
                  {error ? <p className="text-[11px] text-[#FF453A]">{error}</p> : null}
                  <button
                    type="button"
                    onClick={saveLimit}
                    disabled={saving}
                    className="w-full h-12 rounded-2xl bg-[#34C759] text-black text-sm font-bold flex items-center justify-center active:scale-[0.97] transition-transform disabled:opacity-50"
                  >
                    {saving ? t("onboarding.limitSaving") : t("onboarding.limitSave")}
                  </button>
                  <button
                    type="button"
                    onClick={() => finish("skip")}
                    className="text-[11px] text-neutral-500 underline underline-offset-2"
                  >
                    {t("common.skip")}
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 3 && phase === "result" ? (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={SPRING}
                className={`${PANEL} pointer-events-auto`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <HeartCrack size={16} strokeWidth={1.5} className="text-[#FF9F0A]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      {t("onboarding.stepOf", { step: 3, total: TOTAL_STEPS })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-snug">
                    {t("onboarding.damageTitle")}
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-neutral-400">100%</span>
                      <span className="text-[10px] text-neutral-500">
                        {t("onboarding.damageFrom", {
                          amount: formatCurrency(testAmount || suggestedTest, currency),
                          limit: formatCurrency(limitValue, currency),
                        })}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#FF9F0A]">{damaged}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF9F0A] to-[#FF453A]"
                        initial={{ width: "100%" }}
                        animate={{ width: `${damaged}%` }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-snug mt-2">
                      {t("onboarding.damageFoot", { hp: health.hpPercent })}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 flex gap-2.5">
                    <Lock size={14} strokeWidth={1.5} className="text-neutral-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-neutral-400 leading-snug">
                      <span className="text-neutral-300">{t("onboarding.ruleTitle")}: </span>
                      {t("onboarding.ruleBody")}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setStep(4);
                    }}
                    className="w-full h-12 rounded-2xl bg-[#34C759] text-black text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                  >
                    {t("common.next")}
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            ) : null}

            {step === 4 ? (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={SPRING}
                className={`${PANEL} pointer-events-auto`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-[#FF453A]/15 flex items-center justify-center">
                      <HeartCrack size={16} strokeWidth={1.5} className="text-[#FF453A]" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      {t("onboarding.pauseStep")}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 leading-relaxed">{t("onboarding.pauseBody")}</p>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">{t("onboarding.pauseRow")}</span>
                    <span className="font-mono text-xs font-bold text-[#FF453A]">
                      {t("onboarding.pauseValue")}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-snug">{t("onboarding.pauseFoot")}</p>
                  <button
                    type="button"
                    onClick={() => finish("completed")}
                    className="w-full h-12 rounded-2xl bg-[#34C759] text-black text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
                  >
                    {t("onboarding.start")}
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {/* Приветственное сообщение после «Старт» с ссылкой на Mini App */}
      <AnimatePresence>
        {welcomeOpen ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={SPRING}
            className="fixed inset-0 z-[70] flex items-center justify-center px-5"
            role="dialog"
            aria-modal="true"
            aria-label={t("welcome.aria")}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div
              className={`${PANEL} relative pointer-events-auto max-w-[340px] text-center`}
            >
              <div className="w-14 h-14 rounded-3xl bg-[#34C759]/15 flex items-center justify-center mx-auto mb-4">
                <Target size={28} strokeWidth={1.5} className="text-[#34C759]" />
              </div>
              <h2 className="text-xl font-extrabold text-white mb-2">{t("welcome.title")}</h2>
              <p className="text-sm text-neutral-300 leading-relaxed mb-4">{t("welcome.body")}</p>
              <button
                type="button"
                onClick={() => setWelcomeOpen(false)}
                className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-[#34C759] text-black text-sm font-bold active:scale-[0.97] transition-transform"
              >
                {t("welcome.openApp")}
                <ArrowRight size={16} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setWelcomeOpen(false)}
                className="mt-3 text-[11px] text-neutral-500 underline underline-offset-2"
              >
                {t("common.skip")}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
