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


class SafePurchaseRequest(BaseModel):
    amount: float = Field(gt=0)


class SafePurchaseResponse(BaseModel):
    currency: str
    affordable: bool
    hp_now: int
    hp_after: int
    hp_loss: int
    remaining_after_purchase: float
    message: str


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
    danger_threshold: float | None = None
    saved_capital: float = 0.0


class ProfileUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    currency: Literal["KZT", "RUB", "USD", "EUR"] | None = None
    monthly_income: float | None = Field(default=None, ge=0)
    danger_threshold: float | None = Field(default=None, ge=0)


class AuthRegisterRequest(BaseModel):
    email: str = Field(min_length=1, max_length=200)
    first_name: str | None = Field(default=None, max_length=100)
    monthly_income: float | None = Field(default=None, ge=0)


class AuthLoginRequest(BaseModel):
    email: str

