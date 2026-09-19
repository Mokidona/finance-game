import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Coins, HeartCrack, Hourglass, Plus, X } from "lucide-react";
import { useHaptics } from "../hooks/useHaptics.js";
import { useApi } from "../context/AppContext.jsx";
import { formatCurrency } from "../utils/format.js";
import ProgressRing from "../components/dashboard/ProgressRing.jsx";
import DayStatus from "../components/dashboard/DayStatus.jsx";
import TamagotchiPet from "../components/dashboard/TamagotchiPet.jsx";
import PetHealthBar from "../components/dashboard/PetHealthBar.jsx";
import { computePetHealth, petEmotion, petIsFainted } from "../utils/petHealth.js";
import { slimeIdForSkin } from "../utils/skins.js";
import FrozenSavingsCard from "../components/dashboard/FrozenSavingsCard.jsx";
import DebtsSheet from "../components/dashboard/DebtsSheet.jsx";
import QuickAddExpenseModal from "../components/dashboard/QuickAddExpenseModal.jsx";
import TransactionItem from "../components/expenses/TransactionItem.jsx";
import TimeLockModal from "../components/dashboard/TimeLockModal.jsx";
import { api } from "../api/client.js";

export default function DashboardPage({ onNavigate }) {
  const { dashboard, loading, refreshDashboard } = useApi();
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [debtsOpen, setDebtsOpen] = useState(false);
  const [pendingLock, setPendingLock] = useState(null);
  const [flash, setFlash] = useState(null);
  const [faintNoticeClosed, setFaintNoticeClosed] = useState(false);
  const [ledgerNotice, setLedgerNotice] = useState(false);


  if (loading && !dashboard) {
    return <p className="text-[11px] text-neutral-400 tracking-wider mt-6">{t("common.loading")}</p>;
  }
  if (!dashboard) return null;

  const currency = dashboard.currency || "KZT";
  const limit = Number(dashboard.daily_limit_current || 0);
  const spent = Number(dashboard.spent_today || 0);
  // % потрачено от БАЗОВОГО лимита (бэкенд), а не от тающего текущего —
  // иначе ratio взрывается к вечеру. Кольцо/винетку считаем по нему,
  // а жизнь питомца (§31) — по HP от остатка лимита.
  const pct = Math.max(0, Math.min(Number(dashboard.progress_percentage || 0), 100));
  const dailyLimitBase = Number(dashboard.daily_limit_base || 0);
  const health = computePetHealth({ availableBudget: limit, dailyLimit: dailyLimitBase });
  const emotion = petEmotion(health.status);
  // §32.1: единственный источник истины о состоянии — HP питомца
  const overLimit = health.hpPercent <= 0;
  // §33.4: пока питомец в нокауте — финансовый карантин: пауза обязательна
  // для всех трат до 00:00, тумблер в профиле заблокирован.
  const quarantine = petIsFainted(health);
  const coins = Number(dashboard.coins || 0);



  const handleModalSaved = async (result) => {
    if (result?.type === "cancelled") {
      setFlash(t("dashboard.cancelledFlash"));
      triggerHaptic("success");
      setTimeout(() => setFlash(null), 2600);
    }
    await refreshDashboard();
  };

  const openPendingLock = async () => {
    triggerHaptic("medium");
    try {
      const res = await api.getPendingTransactions();
      const active = (res || []).find((p) => !p.confirmed);
      if (active) setPendingLock(active);
    } catch {
      triggerHaptic("error");
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* 17.1 State 3: алая виньетка по краям экрана, когда у питомца 0 HP (§32.1) */}
      {overLimit ? (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 120% 90% at 50% 40%, rgba(0,0,0,0) 55%, rgba(255,69,58,0.16) 100%)",
          }}
        />
      ) : null}


      {/* §33.4: компактное уведомление о нокауте + условия восстановления */}
      {quarantine && !faintNoticeClosed ? (
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#FF453A]/10 border border-[#FF453A]/25 mb-4">
          <HeartCrack size={16} strokeWidth={1.5} className="text-[#FF453A] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-[#FF453A] leading-snug">
              {t("dashboard.faintedTitle")}
            </p>
            <p className="text-[11px] text-neutral-400 leading-snug mt-1">
              {t("dashboard.faintedBody")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFaintNoticeClosed(true)}
            className="w-8 h-8 -mr-1 flex items-center justify-center text-neutral-500 shrink-0"
            aria-label={t("dashboard.hideNotice")}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      ) : null}

      {/* 15.3.2: баннер активного Time Lock */}
      {dashboard.pending_transactions_count > 0 && !pendingLock ? (
        <button
          type="button"
          onClick={openPendingLock}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 mb-4 text-left"
        >
          <Hourglass size={16} strokeWidth={1.5} className="text-amber-300 shrink-0" />
          <span className="text-xs text-amber-200 leading-snug">
            {t("dashboard.timeLockBanner")}
          </span>
        </button>
      ) : null}

      {flash ? (
        <div className="mb-4 p-3 rounded-2xl bg-[#34C759]/10 border border-[#34C759]/25 text-xs text-[#34C759] text-center">
          {flash}
        </div>
      ) : null}

      {/* Питомец внутри одного тонкого кольца (§32.4: без двойных массивных колец) */}
      <div className="flex justify-center pt-1">
        <ProgressRing percentage={pct} over={overLimit}>
          {/* §35.3: надетый в магазине скин сразу меняет маскота */}
          <TamagotchiPet
            availableBudget={limit}
            dailyLimit={dailyLimitBase}
            size={120}
            slimeId={slimeIdForSkin(dashboard.active_skin_id)}
          />
        </ProgressRing>
      </div>

      {/* §32.4: компактный блок — HP сразу под кольцом, сумма сгруппирована с подписью */}
      <div className="flex flex-col items-center mt-2">
        <div className="flex items-center gap-2">
          <PetHealthBar health={health} />
          {/* §33.1 + §35.3: монеты за закрытые дни; тап ведёт в магазин кастомизации */}
          <button
            type="button"
            title={t("dashboard.coinsHint")}
            aria-label={t("dashboard.coinsAria", { coins })}
            onClick={() => {
              triggerHaptic("light");
              onNavigate?.("profile");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 backdrop-blur-md active:bg-white/[0.08] transition-colors"
          >
            <Coins size={13} strokeWidth={1.5} className="text-[#FFD60A]" />
            <span className="font-mono text-xs font-bold text-white tabular-nums">{coins}</span>
          </button>
        </div>
        <p className="mt-2.5 text-[10px] font-semibold text-neutral-400 tracking-wider uppercase">
          {t("dashboard.available")}
        </p>
        <p className="text-4xl font-bold text-white tracking-tight font-mono mt-0.5">
          {formatCurrency(limit, currency)}
        </p>
        <DayStatus dashboard={dashboard} hpPercent={health.hpPercent} />
      </div>

      <FrozenSavingsCard dashboard={dashboard} currency={currency} onFrozenClick={() => setDebtsOpen(true)} />

      <button
        type="button"
        // §34.2: на эту кнопку указывает спотлайт третьего шага онбординга
        data-onboarding="add-expense"
        onClick={() => {
          triggerHaptic("medium");
          setModalOpen(true);
        }}
        className="w-full h-13 bg-white text-black font-semibold text-base rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,255,255,0.12)] active:scale-[0.97] transition-all mt-4"
      >
        <Plus size={18} strokeWidth={1.5} />
        {t("dashboard.addExpense")}
      </button>

      <div className="mt-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-white">{t("dashboard.todayExpenses")}</h3>
          <span className="text-xs text-neutral-400">
            {t("dashboard.todayTotal", { amount: formatCurrency(spent, currency) })}
          </span>
        </div>
        {(dashboard.today_transactions || []).length === 0 ? (
          <p className="text-xs text-neutral-500 py-4 text-center">{t("dashboard.emptyDay")}</p>
        ) : (
          dashboard.today_transactions.map((t) => (
            <TransactionItem
              key={t.id}
              transaction={t}
              currency={currency}
              // §34.1: удалить/изменить расход нельзя — только показать правило
              onLockedTap={() => {
                triggerHaptic("warning");
                setLedgerNotice(true);
                setTimeout(() => setLedgerNotice(false), 3200);
              }}
            />
          ))
        )}
      </div>

      <QuickAddExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleModalSaved}
        currentLimit={limit}
        dailyLimitBase={dailyLimitBase}
        fainted={quarantine}
        hasPremium={Boolean(dashboard.has_paid_access)}
        currency={currency}
      />

      {/* §34.1: тултип неизменяемости — при тапе на любую запись расхода */}
      {ledgerNotice ? (
        <div className="fixed bottom-24 left-0 right-0 z-40 px-5 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-[390px] rounded-2xl border border-white/10 bg-black/85 px-4 py-3 text-[11px] leading-snug text-neutral-300 text-center backdrop-blur-md"
          >
            {t("dashboard.immutable")}
          </motion.div>
        </div>
      ) : null}

      <DebtsSheet open={debtsOpen} onClose={() => setDebtsOpen(false)} currency={currency} onChanged={refreshDashboard} />

      <TimeLockModal
        pending={pendingLock}
        currency={currency}
        onClose={() => setPendingLock(null)}
        onCancelled={async (res) => {
          setPendingLock(null);
          setFlash(
            t("dashboard.cancelledFlashAmount", {
              amount: formatCurrency(res?.saved_capital ?? 0, currency),
            })
          );
          triggerHaptic("success");
          setTimeout(() => setFlash(null), 3000);
          await refreshDashboard();
        }}
        onConfirmed={async () => {
          setPendingLock(null);
          await refreshDashboard();
        }}
      />
    </div>
  );
}
