from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, HTTPException

from ..deps import CurrentUser, Session
from ..schemas import (
    AnalyticsResponse,
    SafePurchaseRequest,
    SafePurchaseResponse,
)
from ..services import budget

router = APIRouter(tags=["analytics"])


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(session: Session, user: CurrentUser) -> AnalyticsResponse:
    today = date.today()
    data = await budget.build_analytics(session, user, today)
    return AnalyticsResponse(**data)


@router.post("/analytics/safe-purchase", response_model=SafePurchaseResponse)
async def safe_purchase(
    payload: SafePurchaseRequest, session: Session, user: CurrentUser
) -> SafePurchaseResponse:
    """Премиум: детектор безопасной покупки.

    32.1: считаем в терминах HP питомца (единственная метрика состояния), а не
    «запаса прочности»: покупка снижает остаток лимита → HP может просесть.
    """
    if not user.has_paid_access:
        raise HTTPException(status_code=403, detail="Функция доступна в премиум-версии")

    today = date.today()
    base_limit = budget.money(user.daily_limit)
    month_spent = await budget.get_month_spent(session, user.id, today)
    free_money = budget.money(user.monthly_income) - budget.money(user.fixed_expenses_total)
    remaining = budget.money(free_money - month_spent)
    amount = budget.money(payload.amount)

    def to_hp(rest: Decimal) -> int:
        """HP питомца по §31/32.1: доля неистраченного дневного лимита, 0..100."""
        if base_limit <= 0:
            return 100 if rest > 0 else 0
        if rest <= 0:
            return 0
        return max(0, min(100, int((rest / base_limit * 100).quantize(Decimal("1")))))

    if base_limit <= 0:
        return SafePurchaseResponse(
            currency=user.currency,
            affordable=False,
            hp_now=0,
            hp_after=0,
            hp_loss=0,
            remaining_after_purchase=float(remaining - amount),
            message="Сначала укажи месячный доход в профиле — без лимита расчет невозможен.",
        )

    # HP считаем от дневного остатка: сегодня доступно + эффект покупки
    today = date.today()
    spent_today = await budget.get_spent_on_date(session, user.id, today)
    available_now = budget.money(
        base_limit + await budget.compute_carry_over(session, user, today) - spent_today
    )
    hp_now = to_hp(available_now)
    remaining_after = budget.money(remaining - amount)
    available_after = budget.money(available_now - amount)
    hp_after = to_hp(available_after)
    affordable = remaining_after > 0 and available_after > 0
    hp_loss = max(0, hp_now - hp_after)

    if available_after <= 0:
        message = (
            f"Покупка обнулит HP питомца ({hp_now}% → 0%) и уведет день в минус. "
            "Лучше отложить."
        )
    elif not affordable:
        message = "Эта покупка съест весь остаток месяца. Лучше отложить."
    elif hp_loss <= 0:
        message = f"Покупка безопасна: HP питомца останется на {hp_now}%."
    else:
        message = (
            f"HP питомца: {hp_now}% → {hp_after}% (−{hp_loss}). "
            f"Остаток после: {budget.money(remaining_after)} {user.currency}."
        )

    return SafePurchaseResponse(
        currency=user.currency,
        affordable=affordable,
        hp_now=hp_now,
        hp_after=hp_after,
        hp_loss=hp_loss,
        remaining_after_purchase=float(remaining_after),
        message=message,
    )
