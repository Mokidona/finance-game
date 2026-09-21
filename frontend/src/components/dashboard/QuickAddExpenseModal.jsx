import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import { useApi } from "../../context/AppContext.jsx";
import { api } from "../../api/client.js";
import { CATEGORY_META, categoryLabelKey } from "../../utils/icons.js";

const CATEGORIES = ["food", "transport", "entertainment", "other"];

export default function QuickAddExpenseModal({ open, onClose, onSaved, currency = "KZT" }) {
  const { t } = useTranslation();
  const { profile } = useApi();
  const activeCurrency = profile?.currency || currency;
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("food");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setCategory("food");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const save = async () => {
    const value = Number(amount);
    if (!value || value <= 0) {
      setError(t("expense.amountRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createTransaction({
        amount: value,
        category,
        comment: null,
        kind: "necessity",
        impulse_acknowledged: true,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e?.message || t("expense.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">{t("expense.title")}</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 -mr-2 flex items-center justify-center text-neutral-400"
          aria-label={t("common.close")}
        >
          <X size={20} strokeWidth={1.5} />
        </button>
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

      <div className="grid grid-cols-4 gap-2 my-4">
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_META[cat].Icon;
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
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

      {error ? (
        <p className="text-xs text-[#FF453A] text-center mb-3">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full h-13 bg-white text-black font-semibold text-base rounded-2xl flex items-center justify-center active:scale-[0.97] transition-all disabled:opacity-50"
      >
        {t("expense.save")}
      </button>
    </Modal>
  );
}
