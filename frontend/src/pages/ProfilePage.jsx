import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins, Languages } from "lucide-react";
import { useApi, useCurrency } from "../context/AppContext.jsx";
import { formatCurrency, currencyLabel } from "../utils/format.js";
import { SUPPORTED_LANGUAGES, changeLanguage, currentLanguage } from "../i18n/index.js";

export default function ProfilePage() {
  const { profile, dashboard, refreshProfile, refreshDashboard } = useApi();
  const { currency, options: currencyOptions, changeCurrency } = useCurrency();
  const { t, i18n } = useTranslation();
  const [income, setIncome] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return <p className="text-[11px] text-neutral-400 tracking-wider mt-6">{t("profile.loading")}</p>;
  }

  const incomeValue = income ?? String(profile.monthly_income ?? 0);
  const coins = Number(dashboard?.coins || 0);

  const saveIncome = async () => {
    const parsed = parseFloat(incomeValue.replace(/\s/g, "").replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0 || parsed === Number(profile.monthly_income)) return;
    setSaving(true);
    try {
      await api.updateProfile({ monthly_income: parsed });
      setIncome(null);
      await Promise.all([refreshProfile(), refreshDashboard()]);
    } finally {
      setSaving(false);
    }
  };

  const setCurrency = async (code) => {
    await changeCurrency(code).catch(() => {});
    await refreshDashboard();
  };

  const setLanguage = async (code) => {
    await changeLanguage(code);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white tracking-tight mb-4">{t("profile.title")}</h2>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
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
              {t("profile.limitShort", { amount: formatCurrency(profile.daily_limit, currency) })}
            </span>
          </div>
          <input
            value={incomeValue}
            onChange={(e) => setIncome(e.target.value.replace(/[^\d\s.,]/g, ""))}
            onBlur={saveIncome}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
            inputMode="decimal"
            className="w-full h-11 bg-white/[0.06] border border-white/10 rounded-xl px-4 text-sm text-white font-mono focus:outline-none focus:border-white/25"
          />
          {saving ? <p className="text-[11px] text-neutral-500 tracking-wider mt-2">{t("profile.saving")}</p> : null}
        </div>

        <div className="px-4 py-3.5 border-b border-white/5">
          <p className="text-sm text-neutral-400 mb-3">{t("profile.currency")}</p>
          <div className="bg-white/[0.06] p-1 rounded-xl flex gap-1">
            {currencyOptions.map(({ code }) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={`flex-1 h-9 rounded-lg text-[11px] transition-all ${
                  currency === code ? "bg-white/20 text-white font-medium shadow-sm" : "text-neutral-400 hover:text-white"
                }`}
              >
                {currencyLabel(code)}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3.5 border-b border-white/5">
          <p className="text-sm text-neutral-400 mb-3 flex items-center gap-2">
            <Languages size={15} strokeWidth={1.5} className="text-white/60" />
            {t("profile.language")}
          </p>
          <div className="bg-white/[0.06] p-1 rounded-xl flex gap-1">
            {SUPPORTED_LANGUAGES.map(({ code, short }) => {
              const active = currentLanguage() === code || i18n.language === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`flex-1 h-9 rounded-lg text-[11px] transition-all ${
                    active ? "bg-white/20 text-white font-medium shadow-sm" : "text-neutral-400"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3.5 border-b border-white/5 flex items-center gap-3">
          <Coins size={18} strokeWidth={1.5} className="text-[#FFD60A] shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">{t("profile.coinsTitle")}</p>
            <p className="text-[11px] text-neutral-500 tracking-wider">{t("profile.coinsSub")}</p>
          </div>
          <span className="font-mono text-sm font-bold text-white tabular-nums">{coins}</span>
        </div>
      </div>
    </div>
  );
}
