import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronRight, Coins, HeartPulse, Hourglass, Languages, Vibrate } from "lucide-react";
import { useApi, useCurrency } from "../context/AppContext.jsx";
import { useHaptics } from "../hooks/useHaptics.js";
import ToggleSwitch from "../components/ui/ToggleSwitch.jsx";
import CoinShopSheet from "../components/shop/CoinShopSheet.jsx";
import { usePetSettings } from "../utils/petSettings.js";
import { computePetHealth, petIsFainted } from "../utils/petHealth.js";
import { api } from "../api/client.js";
import { formatCurrency, currencyLabel } from "../utils/format.js";
import { SUPPORTED_LANGUAGES, changeLanguage, currentLanguage } from "../i18n/index.js";

const SPRING = { type: "spring", stiffness: 400, damping: 28 };
const CARD = "bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden";

export default function ProfilePage({ openPaywall }) {
  const { profile, dashboard, refreshProfile, refreshDashboard } = useApi();
  const { currency, options: currencyOptions, changeCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [income, setIncome] = useState(null);
  const [saving, setSaving] = useState(false);
  const [wishAmount, setWishAmount] = useState("");
  const [wishResult, setWishResult] = useState(null);
  const [wishChecking, setWishChecking] = useState(false);
  const [threshold, setThreshold] = useState(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSetting] = usePetSettings();
  const { triggerHaptic } = useHaptics();

  if (!profile) {
    return (
      <p className="text-[11px] text-neutral-400 tracking-wider mt-6">{t("profile.loading")}</p>
    );
  }

  const incomeValue = income ?? String(profile.monthly_income ?? 0);
  // §33.4: пока питомец в нокауте, карантин принудительно держит паузу включённой
  // и блокирует тумблер до 00:00 — отключить её из профиля нельзя.
  const quarantine = Boolean(dashboard) &&
    petIsFainted(
      computePetHealth({
        availableBudget: dashboard.daily_limit_current,
        dailyLimit: dashboard.daily_limit_base,
      })
    );
  const coins = Number(dashboard?.coins || 0);

  const saveIncome = async () => {
    const parsed = parseFloat(incomeValue.replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0 || parsed === Number(profile.monthly_income)) return;
    setSaving(true);
    try {
      await api.updateProfile({ monthly_income: parsed });
      setIncome(null);
      await Promise.all([refreshProfile(), refreshDashboard()]);
      triggerHaptic("success");
    } finally {
      setSaving(false);
    }
  };

  // §35.1: смена валюты идёт через общий хук (профиль = глобальный стейт валюты)
  const setCurrency = async (code) => {
    triggerHaptic("light");
    await changeCurrency(code).catch(() => {});
    await refreshDashboard();
  };

  const setLanguage = async (code) => {
    triggerHaptic("light");
    await changeLanguage(code);
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  // 15.3.2: порог «опасной покупки» для Time Lock (0 — выключено)
  const thresholdValue = threshold ?? String(profile.danger_threshold ?? 0);
  const saveThreshold = async () => {
    const parsed = parseFloat(thresholdValue.replace(/\s/g, "").replace(",", ".")) || 0;
    if (parsed < 0 || parsed === Number(profile.danger_threshold ?? 0)) return;
    try {
      await api.updateProfile({ danger_threshold: parsed });
      setThreshold(null);
      await refreshProfile();
      triggerHaptic("success");
    } catch {
      triggerHaptic("error");
    }
  };



  // Премиум: детектор безопасной покупки
  const checkWish = async () => {
    const parsed = parseFloat(wishAmount.replace(/\s/g, "").replace(",", "."));
    if (!parsed || parsed <= 0) return;
    setWishChecking(true);
    setWishResult(null);
    try {
      const result = await api.safePurchase(parsed);
      setWishResult(result);
      triggerHaptic(result.affordable ? "success" : "warning");
    } catch {
      triggerHaptic("error");
      setWishResult({ message: t("profile.safeFailed"), affordable: false });
    } finally {
      setWishChecking(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white tracking-tight mb-4">{t("profile.title")}</h2>

      {toast ? (
        <div className="mb-4 p-3 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/25 text-xs text-[#34C759] text-center">
          {toast}
        </div>
      ) : null}

      {/* Единый нативный Grouped List: имя, доход, валюта (и статус премиума) */}
      <div className={CARD}>
        <div className="px-4 py-3.5 flex items-center justify-between">
          <span className="text-sm text-neutral-400">{t("profile.name")}</span>
          <span className="text-sm font-medium text-white">
            {profile.first_name || t("profile.defaultName")}
          </span>
        </div>
        <div className="border-b border-white/5" />

        <div className="px-4 py-3.5 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-neutral-400">{t("profile.income")}</span>
            <span className="text-[11px] text-neutral-500 tracking-wider">
              {t("profile.limitShort", {
                amount: formatCurrency(profile.daily_limit, currency),
              })}
            </span>
          </div>
          <input
            value={incomeValue}
            onChange={(event) => setIncome(event.target.value.replace(/[^\d\s.,]/g, ""))}
            onBlur={saveIncome}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.target.blur();
            }}
            inputMode="decimal"
            className="w-full h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25"
          />
          {saving ? (
            <p className="text-[11px] text-neutral-500 tracking-wider mt-2">
              {t("profile.saving")}
            </p>
          ) : null}
        </div>

        {/* §35.1: валюта — четыре кода с символами */}
        <div className="px-4 py-3.5 border-b border-white/5">
          <p className="text-sm text-neutral-400 mb-3">{t("profile.currency")}</p>
          <div className="bg-white/[0.06] p-1 rounded-xl flex gap-1">
            {currencyOptions.map(({ code }) => (
              <motion.button
                key={code}
                type="button"
                whileTap={{ scale: 0.95 }}
                transition={SPRING}
                onClick={() => setCurrency(code)}
                className={`flex-1 h-9 rounded-lg text-[11px] transition-all ${
                  currency === code
                    ? "bg-white/20 text-white font-medium shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {currencyLabel(code)}
              </motion.button>
            ))}
          </div>
        </div>

        {/* §35.2: язык интерфейса (RU / KK / EN) */}
        <div className="px-4 py-3.5 border-b border-white/5">
          <p className="text-sm text-neutral-400 mb-3 flex items-center gap-2">
            <Languages size={15} strokeWidth={1.5} className="text-white/60" />
            {t("profile.language")}
          </p>
          <div className="bg-white/[0.06] p-1 rounded-xl flex gap-1">
            {SUPPORTED_LANGUAGES.map(({ code, short, label }) => {
              const active = currentLanguage() === code || i18n.language === code;
              return (
                <motion.button
                  key={code}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING}
                  onClick={() => setLanguage(code)}
                  title={label}
                  className={`flex-1 h-9 rounded-lg text-[11px] transition-all ${
                    active ? "bg-white/20 text-white font-medium shadow-sm" : "text-neutral-400"
                  }`}
                >
                  {short}
                </motion.button>
              );
            })}
          </div>
        </div>

        {profile.has_paid_access ? (
          <div className="px-4 py-3.5 flex items-center gap-3">
            <CheckCircle2 size={18} strokeWidth={1.5} className="text-[#30D158]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{t("profile.premiumActive")}</p>
              <p className="text-[11px] text-neutral-500 tracking-wider">
                {t("profile.premiumAll")}
              </p>
            </div>
          </div>
        ) : null}
      </div>



      {/* 32.4: «Геймификация и фичи» — 5-секундный таймер и вибрация при уроне */}
      <p className="mt-5 mb-2 px-1 text-[10px] font-semibold text-neutral-400 tracking-wider uppercase">
        {t("profile.gamification")}
      </p>
      <div className={CARD}>
        <div className="px-4 py-3.5 border-b border-white/5 flex items-center gap-3">
          <Hourglass size={18} strokeWidth={1.5} className="text-white/70 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{t("profile.pauseTitle")}</p>
            <p className="text-[11px] text-neutral-500 tracking-wider">
              {quarantine ? t("profile.pauseQuarantine") : t("profile.pauseSub")}
            </p>
          </div>
          <ToggleSwitch
            checked={quarantine || settings.impulsePauseEnabled !== false}
            disabled={quarantine}
            onChange={(next) => setSetting("impulsePauseEnabled", next)}
            label={`${t("profile.pauseTitle")} (5 сек)`}
          />
        </div>

        <div className="px-4 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <HeartPulse size={18} strokeWidth={1.5} className="text-white/70 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{t("profile.thresholdTitle")}</p>
              <p className="text-[11px] text-neutral-500 tracking-wider">
                {t("profile.thresholdSub")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={thresholdValue}
              onChange={(event) => setThreshold(event.target.value.replace(/[^\d\s.,]/g, ""))}
              onBlur={saveThreshold}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.target.blur();
              }}
              inputMode="decimal"
              placeholder="5 000"
              className="flex-1 min-w-0 h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25 placeholder:text-neutral-500"
            />
            <span className="text-sm text-neutral-400 shrink-0">{currency}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">
            {t("profile.thresholdFoot")}
          </p>
        </div>

        <div className="px-4 py-3.5 border-b border-white/5 flex items-center gap-3">
          <Coins size={18} strokeWidth={1.5} className="text-white/70 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{t("profile.coinsTitle")}</p>
            <p className="text-[11px] text-neutral-500 tracking-wider">{t("profile.coinsSub")}</p>
          </div>
          <span className="font-mono text-sm font-bold text-white tabular-nums">{coins}</span>
        </div>

        {/* §35.3: вход в магазин кастомизации */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            setShopOpen(true);
          }}
          className="w-full px-4 py-3.5 border-b border-white/5 flex items-center gap-3 text-left active:bg-white/[0.03] transition-colors"
        >
          <Coins size={18} strokeWidth={1.5} className="text-[#FFD60A] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{t("profile.shopTitle")}</p>
            <p className="text-[11px] text-neutral-500 tracking-wider">{t("profile.shopSub")}</p>
          </div>
          <span className="font-mono text-sm font-bold text-white tabular-nums">{coins}</span>
          <ChevronRight size={16} strokeWidth={1.5} className="text-neutral-600 shrink-0" />
        </button>

        <div className="px-4 py-3.5 flex items-center gap-3">
          <Vibrate size={18} strokeWidth={1.5} className="text-white/70 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{t("profile.vibrateTitle")}</p>
            <p className="text-[11px] text-neutral-500 tracking-wider">{t("profile.vibrateSub")}</p>
          </div>
          <ToggleSwitch
            checked={settings.vibrateOnDamage !== false}
            onChange={(next) => setSetting("vibrateOnDamage", next)}
            label={t("profile.vibrateTitle")}
          />
        </div>
      </div>

      {/* 16.3 Card 3: Сэкономлено на отмене импульсов */}
      <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
        <span className="text-sm text-white/90">{t("profile.savedTitle")}</span>
        <span className="text-emerald-400 font-bold text-lg font-mono">
          {formatCurrency(profile.saved_capital || 0, currency)}
        </span>
      </div>

      {/* Safe Purchase Detector: премиум-фича */}
      {profile.has_paid_access ? (
        <div className={`mt-4 p-4 ${CARD}`}>
          <p className="text-sm font-medium text-white mb-1">{t("profile.safeTitle")}</p>
          <p className="text-[11px] text-neutral-400 tracking-wider mb-3">{t("profile.safeSub")}</p>
          <div className="flex-row items-center gap-3 flex mb-3">
            <input
              value={wishAmount}
              onChange={(event) => setWishAmount(event.target.value.replace(/[^\d\s.,]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") checkWish();
              }}
              inputMode="decimal"
              placeholder="35 000"
              className="flex-1 min-w-0 h-12 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25 placeholder:text-neutral-500"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={SPRING}
              onClick={() => {
                triggerHaptic("light");
                checkWish();
              }}
              disabled={wishChecking}
              className="bg-white text-black font-semibold px-5 rounded-xl h-12 flex items-center justify-center shrink-0 disabled:opacity-50"
            >
              {wishChecking ? t("profile.checking") : t("profile.check")}
            </motion.button>
          </div>
          {wishResult ? (
            <p
              className={`text-xs leading-relaxed ${
                wishResult.affordable ? "text-[#30D158]" : "text-[#FF453A]"
              }`}
            >
              {wishResult.message}
            </p>
          ) : null}
        </div>
      ) : (
        /* Paywall CTA: стеклянная карточка внизу */
        <div className="mt-6 bg-white/[0.04] border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-sm font-medium text-white mb-1">{t("profile.premiumCta")}</p>
          <p className="text-[11px] text-neutral-400 tracking-wider mb-4">
            {t("profile.premiumCtaSub")}
          </p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            onClick={() => {
              triggerHaptic("heavy");
              openPaywall?.();
            }}
            className="w-full h-12 rounded-2xl bg-[#30D158] text-black text-sm font-bold flex items-center justify-center shadow-[0_4px_25px_rgba(52,199,89,0.3)]"
          >
            {t("profile.activate", { price: formatCurrency(990, currency) })}
          </motion.button>
        </div>
      )}

      {/* §35.3: магазин кастомизации за монеты */}
      <CoinShopSheet
        open={shopOpen}
        currency={currency}
        onClose={() => setShopOpen(false)}
        onToast={showToast}
        onChanged={async () => {
          await Promise.all([refreshProfile(), refreshDashboard()]);
        }}
      />
    </div>
  );
}
