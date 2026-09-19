from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------- Dashboard ----------
class DashboardInsight(BaseModel):
    id: str
    icon: str
    text: str


class TodayTransaction(BaseModel):
    id: int
    amount: float
    category: str
    comment: str | None = None
    created_at: datetime


class DashboardResponse(BaseModel):
    user_id: int
    user_name: str
    currency: str
    status: Literal["normal", "over_limit"]
    daily_limit_base: float
    daily_limit_current: float
    spent_today: float
    progress_percentage: float
    has_paid_access: bool
    streak_days: int = 0
    # §33: монеты за закрытые дни с HP > 50% (производная метрика, не в БД)
    coins: int = 0
    total_saved_kzt: float = 0.0
    frozen_total: float = 0.0
    active_skin_id: str = "skin_cadet"
    pending_transactions_count: int = 0
    insights: list[DashboardInsight]
    today_transactions: list[TodayTransaction]


# ---------- Transactions ----------
class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    category: Literal["food", "transport", "entertainment", "other"] = "other"
    comment: str | None = Field(default=None, max_length=200)
    # 14.2: «обязательный» / «импульсивная покупка» — из селектора в модалке
    kind: Literal["necessity", "impulse"] | None = None
    # 32.2: клиент уже отсидел 5-секундную паузу (Fast Impulse Check) — сохраняем сразу,
    # без серверного часового Time Lock.
    impulse_acknowledged: bool = False


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    category: str
    comment: str | None = None
    created_at: datetime
    date_key: date


# ---------- Fixed expenses ----------
class FixedExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    due_day: int = Field(ge=1, le=31)


class FixedExpenseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    amount: float | None = Field(default=None, gt=0)
    due_day: int | None = Field(default=None, ge=1, le=31)
    is_active: bool | None = None


class FixedExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    amount: float
    due_day: int
    is_active: bool


# ---------- Analytics ----------
class AnalyticsSeriesPoint(BaseModel):
    date: str
    spent: float
    limit: float | None = None


class AnalyticsCategoryRow(BaseModel):
    category: str
    total: float
    percentage: float


class SafePurchaseRequest(BaseModel):
    amount: float = Field(gt=0)


class SafePurchaseResponse(BaseModel):
    """32.1: единственный источник истины о состоянии — HP питомца, без «запаса прочности»."""

    currency: str
    affordable: bool
    hp_now: int
    hp_after: int
    hp_loss: int
    remaining_after_purchase: float
    message: str


# ---------- Debts (замороженные деньги, секция 12.3) ----------
class DebtCreate(BaseModel):
    amount: float = Field(gt=0)
    debtor_name: str = Field(min_length=1, max_length=100)
    due_date: date | None = None


class DebtOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    debtor_name: str
    amount: float
    given_date: date
    due_date: date | None
    is_returned: bool


class AnalyticsResponse(BaseModel):
    currency: str
    month_total_spent: float
    free_money_total: float
    remaining_budget: float
    avg_daily_spent: float
    projected_month_spent: float
    days_in_month: int
    days_left: int
    daily_limit: float
    daily_series: list[AnalyticsSeriesPoint]
    category_breakdown: list[AnalyticsCategoryRow]


# ---------- Profile ----------
class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    first_name: str | None
    telegram_id: int | None
    currency: str
    monthly_income: float
    fixed_expenses_total: float
    daily_limit: float
    has_paid_access: bool
    active_skin_id: str = "skin_cadet"
    danger_threshold: float | None = None
    saved_capital: float = 0.0


# ---------- §35.3: магазин монет ----------
class ShopItemOut(BaseModel):
    id: str
    name: str
    description: str
    price_coins: int = 0
    streak_required: int = 0
    premium_only: bool = False
    purchased: bool = False
    owned: bool = False
    equipped: bool = False
    purchasable: bool = False


class ShopResponse(BaseModel):
    balance: int
    earned: int
    spent: int
    streak_days: int
    items: list[ShopItemOut]


class ShopPurchaseRequest(BaseModel):
    skin_id: str


class ShopPurchaseResponse(BaseModel):
    success: bool
    balance: int
    item: ShopItemOut


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    currency: Literal["KZT", "RUB", "USD", "EUR"] | None = None
    monthly_income: float | None = Field(default=None, ge=0)
    danger_threshold: float | None = Field(default=None, ge=0)


# ---------- Avatar & Skins (секция 15) ----------
class AvatarStatus(BaseModel):
    emotion: Literal["NORMAL", "WARNING", "DEFEATED"]
    glow_color: str
    glitch_effect: bool


class AvatarStatusResponse(BaseModel):
    user_id: int
    active_skin_id: str
    streak_days: int
    is_premium: bool
    avatar_status: AvatarStatus
    unlocked_skins: list[str]
    saved_capital: float


class SkinOut(BaseModel):
    id: str
    name: str
    description: str
    streak_required: int
    premium_only: bool
    unlocked: bool
    lock_reason: str | None = None


class SkinsResponse(BaseModel):
    active_skin_id: str
    unlocked: list[str]
    skins: list[SkinOut]


class EquipSkinRequest(BaseModel):
    skin_id: str


class EquipSkinResponse(BaseModel):
    success: bool
    active_skin_id: str


class PendingCreate(BaseModel):
    amount: float = Field(gt=0)
    category: Literal["food", "transport", "entertainment", "other"] = "other"
    comment: str | None = Field(default=None, max_length=200)


class PendingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: float
    category: str
    comment: str | None = None
    created_at: datetime
    unlock_at: datetime


class PendingResolveResponse(BaseModel):
    action: Literal["confirmed", "cancelled"]
    saved_capital: float


class ImpulseCancelRequest(BaseModel):
    """32.2: пользователь отменил покупку на 5-секундной паузе."""

    amount: float = Field(ge=0)


class SavedCapitalResponse(BaseModel):
    saved_capital: float


class TransactionCreateOut(BaseModel):
    """POST /transactions: либо обычная транзакция, либо pending (Time Lock)."""

    pending: bool
    transaction: TransactionOut | None = None
    pending_transaction: PendingOut | None = None


# ---------- Paywall ----------
class UnlockRequest(BaseModel):
    # Основной провайдер — Telegram Stars (XTR). Резервные (kaspi/yookassa) — пока не подключены.
    payment_provider: str = "telegram_stars"


class UnlockResponse(BaseModel):
    success: bool
    # Ссылка инвойса Telegram Stars: фронт открывает её через WebApp.openInvoice().
    invoice_link: str | None = None
    # Совместимость со старым полем (redirect-провайдеры).
    redirect_url: str | None = None
