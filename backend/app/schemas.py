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
    coins: int = 0
    active_skin_id: str = "skin_cadet"
    insights: list[DashboardInsight]
    today_transactions: list[TodayTransaction]


# ---------- Transactions ----------
class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    category: Literal["food", "transport", "entertainment", "other"] = "other"
    comment: str | None = Field(default=None, max_length=200)


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


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    currency: Literal["KZT", "RUB", "USD", "EUR"] | None = None
    monthly_income: float | None = Field(default=None, ge=0)
    danger_threshold: float | None = Field(default=None, ge=0)


# ---------- Avatar & Skins ----------
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
