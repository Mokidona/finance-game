import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Check, Coins, Crown, Lock, Sparkles, X } from "lucide-react";
import { api } from "../../api/client.js";
import { useHaptics } from "../../hooks/useHaptics.js";

const SPRING = { type: "spring", damping: 30, stiffness: 300 };

/**
 * §35.3: магазин кастомизации за монеты дисциплины.
 *
 * Один скин — два пути: стрик дней (бесплатно, §15.2) или монеты (быстрее, §33).
 * Премиум-скины за монеты не продаются — платный вход остаётся платным.
 * Баланс и «куплено/надето» приходят с бэкенда (`GET /shop`), покупка — `POST /shop/purchase`.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {(message: string) => void} onToast — показать сообщение на экране профиля
 * @param {(payload: object) => void} onChanged — перечитать профиль/дашборд после покупки
 * @param {string} currency — используется только для валюты, монеты отдельны
 */
export default function CoinShopSheet({ open, onClose, onToast, onChanged, currency = "KZT" }) {
  const { triggerHaptic } = useHaptics();
  const { t } = useTranslation();
  const [shop, setShop] = useState(null);
  const [busy, setBusy] = useState(null); // skin_id в процессе
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const data = await api.getShop();
    setShop(data);
    return data;
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    load().catch((e) => setError(e?.message || t("shop.failed")));
    return undefined;
  }, [open, load, t]);

  const buy = async (item) => {
    setBusy(item.id);
    setError(null);
    try {
      const res = await api.purchaseSkin(item.id);
      await load();
      triggerHaptic("success");
      onToast?.(t("shop.bought"));
      onChanged?.(res);
    } catch (e) {
      triggerHaptic("error");
      setError(e?.message || t("shop.failed"));
    } finally {
      setBusy(null);
    }
  };

  const equip = async (item) => {
    setBusy(item.id);
    setError(null);
    try {
      await api.equipSkin(item.id);
      await load();
      triggerHaptic("success");
      onToast?.(t("shop.equipped_toast"));
      onChanged?.({ equipped: item.id });
    } catch (e) {
      triggerHaptic("error");
      setError(e?.message || t("shop.failed"));
    } finally {
      setBusy(null);
    }
  };

  const items = shop?.items ?? [];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[390px] rounded-t-3xl bg-white/[0.04] backdrop-blur-2xl border-t-[rgba(255,255,255,0.18)] border-x-[rgba(255,255,255,0.08)] border-b-[rgba(255,255,255,0.05)] border-x border-b p-6"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{t("shop.title")}</h2>
                <p className="text-[11px] text-neutral-500 leading-snug mt-1 max-w-[240px]">
                  {t("shop.subtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("shop.close")}
                className="w-11 h-11 -mr-2 -mt-1 flex items-center justify-center text-neutral-400"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Баланс: заработано − потрачено */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-neutral-400">
                <Coins size={14} strokeWidth={1.5} className="text-[#FFD60A]" />
                {t("shop.balance")}
              </span>
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-lg font-bold text-white tabular-nums">
                  {shop?.balance ?? 0}
                </span>
                <span className="text-[10px] text-neutral-500 tabular-nums">
                  {t("shop.earned")} {shop?.earned ?? 0} · {t("shop.spent")} {shop?.spent ?? 0}
                </span>
              </span>
            </div>

            <div className="flex flex-col gap-2 max-h-[46vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-6">{t("shop.empty")}</p>
              ) : null}

              {items.map((item) => {
                const missing = Math.max(0, item.price_coins - (shop?.balance ?? 0));
                const canBuy = item.purchasable && !item.owned && missing === 0;
                const requirement = item.premium_only
                  ? t("shop.premiumOnly")
                  : item.price_coins > 0 && item.streak_required > 0
                    ? t("shop.byStreakOrCoins", { days: item.streak_required, price: item.price_coins })
                    : item.price_coins > 0
                      ? t("shop.buy", { price: item.price_coins })
                      : t("shop.free");

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 flex items-start gap-3 ${
                      item.equipped ? "border-[#34C759]/40 bg-[#34C759]/[0.06]" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
                      {item.premium_only ? (
                        <Crown size={18} strokeWidth={1.5} className="text-[#FFD60A]" />
                      ) : item.owned ? (
                        <Sparkles size={18} strokeWidth={1.5} className="text-[#34C759]" />
                      ) : (
                        <Lock size={18} strokeWidth={1.5} className="text-neutral-500" />
                      )}
                    </span>

                    <div className="flex-1 min-w-0">
                      {/* §35.2: названия и описания скинов берём из словаря по id,
                          а текст с бэкенда оставляем фоллбэком (новый скин в каталоге
                          покажется, даже если перевод ещё не добавлен) */}
                      <p className="text-sm font-medium text-white truncate">
                        {t(`skins.${item.id}.name`, { defaultValue: item.name })}
                      </p>
                      <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">
                        {t(`skins.${item.id}.description`, { defaultValue: item.description })}
                      </p>
                      <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1.5">
                        {requirement}
                      </p>

                      {/* Действие отдельной строкой: длинная кнопка («Не хватает 130 монет»)
                          в один ряд с текстом сжимала колонку до ~60px и рвала описание */}
                      <div className="mt-2.5 flex items-center justify-end gap-2">
                        {item.equipped ? (
                          <span className="h-9 px-3 rounded-xl bg-[#34C759]/15 text-[#34C759] text-[11px] font-semibold flex items-center gap-1.5">
                            <Check size={13} strokeWidth={2} />
                            {t("shop.equipped")}
                          </span>
                        ) : item.owned ? (
                          <button
                            type="button"
                            disabled={busy === item.id}
                            onClick={() => equip(item)}
                            className="h-9 px-4 rounded-xl bg-white text-black text-[11px] font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
                          >
                            {t("shop.equip")}
                          </button>
                        ) : item.purchasable ? (
                          <button
                            type="button"
                            disabled={!canBuy || busy === item.id}
                            onClick={() => buy(item)}
                            className={`h-9 px-4 rounded-xl text-[11px] font-bold flex items-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50 ${
                              canBuy ? "bg-[#FFD60A] text-black" : "bg-white/10 text-neutral-400"
                            }`}
                          >
                            <Coins size={13} strokeWidth={1.75} />
                            {missing > 0
                              ? t("shop.missing", { missing })
                              : t("shop.buy", { price: item.price_coins })}
                          </button>
                        ) : (
                          <span className="h-9 px-3 rounded-xl bg-white/[0.06] text-neutral-500 text-[11px] font-medium flex items-center gap-1.5">
                            <Crown size={13} strokeWidth={1.5} className="text-[#FFD60A]" />
                            {t("shop.premiumOnly")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {error ? <p className="text-[11px] text-[#FF453A] mt-3 text-center">{error}</p> : null}

            <p className="text-[10px] text-neutral-500 mt-4 leading-relaxed">
              {t("dashboard.coinsHint")}
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
