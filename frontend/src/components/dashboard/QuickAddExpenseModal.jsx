import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Snowflake, X } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import ImpulseGuardModal from "./ImpulseGuardModal.jsx";
import { useHaptics } from "../../hooks/useHaptics.js";
import { useApi } from "../../context/AppContext.jsx";
import { usePetSettings } from "../../utils/petSettings.js";
import { api } from "../../api/client.js";
import { CATEGORY_META, categoryLabelKey } from "../../utils/icons.js";

const CATEGORIES = ["food", "transport", "entertainment", "other"];
const SPRING = { type: "spring", stiffness: 400, damping: 28 };

// 12.1 + 14.2 + 32.2: нативная клавиатура, селектор импульса и 5-секундная
// осознанная пауза (Fast Impulse Check) для хотелок выше danger_threshold.
// Тумблер «Пауза перед бессмысленной тратой» в профиле отключает паузу целиком.

export default function QuickAddExpenseModal({
  open,
  onClose,
  onSaved,
  currentLimit,
  dailyLimitBase = 0,
  hasPremium = false,
  fainted = false,
  currency = "KZT",
}) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const { profile } = useApi();
  const [settings] = usePetSettings();
  const activeCurrency = profile?.currency || currency;
  const [tab, setTab] = useState("expense"); // expense | debt
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [kind, setKind] = useState("necessity"); // necessity | impulse
  const [comment, setComment] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [timeLock, setTimeLock] = useState(null); // легаси pending-транзакция
  const [guard, setGuard] = useState(null); // { amount } — 5-секундная пауза
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTab("expense");
      setAmount("");
      setCategory("food");
      setKind("necessity");
      setComment("");
      setDebtorName("");
      setDueDate("");
      setError(null);
      setTimeLock(null);
      setGuard(null);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [open]);

  // §32.2: пауза нужна для импульса выше порога (порог 0 = для любого импульса),
  // если тумблер «Пауза перед бессмысленной тратой (5 сек)» включен.
  // §33.4: в нокауте включается карантин — пауза обязательна для ВСЕХ трат
  // (не только импульсивных) и её нельзя отключить тумблером до 00:00.
  const quarantine = Boolean(fainted);
  const threshold = Number(profile?.danger_threshold ?? 0);
  const pauseDisabled = settings.impulsePauseEnabled === false;
  // Карантин сильнее и тумблера, и порога опасной покупки: «пауза на ВСЕ
  // категории трат» (проверено на demo-профиле с порогом 5 000 — иначе мелкая
  // трата в нокауте проскакивала бы без паузы).
  const expenseNeedsPause = (value) =>
    quarantine ||
    (kind === "impulse" && !pauseDisabled && (threshold <= 0 || value >= threshold));

  const save = async (options = {}) => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError(t("expense.amountRequired"));
      triggerHaptic("error");
      return;
    }
    if (tab === "debt" && !debtorName.trim()) {
      setError(t("expense.debtorRequired"));
      triggerHaptic("error");
      return;
    }
    if (tab === "expense" && !options.acknowledged && expenseNeedsPause(value)) {
      setError(null);
      setGuard({ amount: value });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (tab === "debt") {
        await api.createDebt({
          debtor_name: debtorName.trim(),
          amount: value,
          due_date: dueDate || null,
        });
        triggerHaptic("success");
        onSaved?.({ type: "debt" });
      } else {
        const res = await api.createTransaction({
          amount: value,
          category,
          comment: comment.trim() || null,
          kind,
          // §32.2: если 5-секундная пауза не показывалась (тумблер выключен или
          // сумма ниже порога), покупка осознанная — не уходит в легаси Time Lock.
          impulse_acknowledged: options.acknowledged === true || !expenseNeedsPause(value),
        });
        if (res && res.pending) {
          // 15.3.2: Time Lock — транзакция заморожена на час
          setTimeLock(res.pending_transaction);
          triggerHaptic("warning");
          return;
        }
        triggerHaptic(kind === "impulse" ? "warning" : "success");
        onSaved?.({ type: "expense" });
      }
      onClose();
    } catch (e) {
      setError(e?.message || t("expense.saveFailed"));
      triggerHaptic("error");
    } finally {
      setSaving(false);
    }
  };

  const handlePendingCancelled = () => {
    setTimeLock(null);
    triggerHaptic("success");
    onSaved?.({ type: "cancelled" });
    onClose();
  };

  const handlePendingConfirmed = () => {
    setTimeLock(null);
    onSaved?.({ type: "expense" });
    onClose();
  };

  // Пауза истекла и пользователь подтвердил — сохраняем помеченную транзакцию
  const confirmGuard = () => {
    setGuard(null);
    save({ acknowledged: true });
  };

  // Подсказка под формой: сработает ли пауза на текущую сумму
  let pauseHint = null;
  if (quarantine) {
    pauseHint = t("expense.quarantineHint");
  } else if (kind === "impulse") {
    pauseHint = expenseNeedsPause(Number(amount) || 0)
      ? t("expense.pauseHint")
      : pauseDisabled
        ? t("expense.pauseOffHint")
        : t("expense.belowThresholdHint");
  }

  // Отмена на паузе: деньги не списываются, сумма уходит в Сэкономленный Капитал
  const cancelGuard = async () => {
    const cancelled = guard;
    setGuard(null);
    if (cancelled?.amount > 0) {
      try {
        await api.creditCancelledImpulse(cancelled.amount);
      } catch {
        /* не критично: деньги и так не списаны */
      }
    }
    triggerHaptic("success");
    onSaved?.({ type: "cancelled", amount: cancelled?.amount });
    onClose();
  };

  return (
    <>
      <Modal open={open} onClose={onClose}>
        {/* Ручку-полоску рисует сам Modal — вторая здесь была багом (две серые линии) */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">{t("expense.title")}</h2>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              onClose();
            }}
            className="w-11 h-11 -mr-2 flex items-center justify-center text-neutral-400"
            aria-label={t("common.close")}
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* 12.3: таб [ Расход | Дал в долг ] */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.06] mb-4">
          {[
            { id: "expense", label: t("expense.tabExpense") },
            { id: "debt", label: t("expense.tabDebt") },
          ].map((item) => (
            <button                key={item.id}
              type="button"
              onClick={() => {
                triggerHaptic("light");
                setTab(item.id);
              }}
              className={`h-10 rounded-lg text-sm font-medium transition-all ${
                tab === item.id ? "bg-white/20 text-white shadow-sm" : "text-[#8E8E93]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex justify-center items-center py-3">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="text-5xl font-bold text-white bg-transparent text-center focus:outline-none w-full font-mono placeholder:text-neutral-600"
          />
          <span className="text-2xl text-neutral-400 ml-2 font-normal">{activeCurrency}</span>
        </div>

        {tab === "expense" ? (
          <>
            {/* 14.2: Обязательный / Импульсивная */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.06] my-4">
              {[
                { id: "necessity", label: t("expense.necessity") },
                { id: "impulse", label: t("expense.impulse") },
              ].map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    setKind(k.id);
                  }}
                  className={`h-9 rounded-lg text-xs font-medium transition-all ${
                    kind === k.id
                      ? k.id === "impulse"
                        ? "bg-[#FF453A]/15 text-[#FF453A]"
                        : "bg-white/20 text-white"
                      : "text-[#8E8E93]"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 my-4">
              {CATEGORIES.map((cat) => {
                const Icon = CATEGORY_META[cat].Icon;
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      triggerHaptic("light");
                      setCategory(cat);
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-h-[44px] ${
                      active
                        ? "border-[#34C759] bg-[#34C759]/10 text-[#34C759]"
                        : "border-white/5 bg-white/5 text-[#8E8E93]"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                    <span className="text-[10px] font-medium">
                      {t(`category.${categoryLabelKey(cat)}`)}
                    </span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("expense.commentPlaceholder")}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-white/30 mb-4"
            />

            {pauseHint ? (
              <p
                className={`text-[11px] text-center mb-3 px-2 leading-relaxed ${
                  quarantine ? "text-[#FF453A]" : "text-neutral-500"
                }`}
              >
                {pauseHint}
              </p>
            ) : null}
          </>
        ) : (
          <div className="my-4 flex flex-col gap-3">
            <input
              type="text"
              value={debtorName}
              onChange={(e) => setDebtorName(e.target.value)}
              placeholder={t("expense.debtorPlaceholder")}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-white/30"
            />
            <div className="flex items-center gap-2 text-[#8E8E93]">
              <Snowflake size={16} strokeWidth={1.5} className="shrink-0" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-white/30"
              />
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">{t("expense.debtHint")}</p>
          </div>
        )}

        {error ? (
          <p className="text-xs text-[#FF453A] text-center mb-3">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={() => save()}
          disabled={saving}
          className="w-full h-13 bg-white text-black font-semibold text-base rounded-2xl flex items-center justify-center active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {tab === "debt" ? t("expense.freeze") : t("expense.save")}
        </button>
      </Modal>

      <TimeLockModalLazy
        pending={timeLock}
        currency={activeCurrency}
        onClose={() => setTimeLock(null)}
        onCancelled={handlePendingCancelled}
        onConfirmed={handlePendingConfirmed}
      />

      {/* §32.2.3: компактный bottom sheet с 5-секундным таймером */}
      <ImpulseGuardModal
        open={Boolean(guard)}
        amount={guard?.amount ?? 0}
        quarantine={quarantine}
        currency={activeCurrency}
        availableBudget={currentLimit}
        dailyLimit={dailyLimitBase}
        onConfirm={confirmGuard}
        onCancel={cancelGuard}
      />
    </>
  );
}

function TimeLockModalLazy(props) {
  const [Comp, setComp] = useState(null);
  useEffect(() => {
    if (props.pending && !Comp) {
      import("./TimeLockModal.jsx").then((m) => setComp(() => m.default));
    }
  }, [props.pending, Comp]);
  if (!props.pending || !Comp) return null;
  return <Comp {...props} />;
}
