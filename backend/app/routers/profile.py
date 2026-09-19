from __future__ import annotations

from fastapi import APIRouter

from ..deps import CurrentUser, Session
from ..schemas import ProfileOut, ProfileUpdate
from ..services import budget

router = APIRouter(tags=["profile"])


@router.get("/profile", response_model=ProfileOut)
async def get_profile(session: Session, user: CurrentUser) -> ProfileOut:
    return ProfileOut.model_validate(user)


@router.patch("/profile", response_model=ProfileOut)
async def update_profile(
    payload: ProfileUpdate, session: Session, user: CurrentUser
) -> ProfileOut:
    if payload.first_name is not None:
        user.first_name = payload.first_name
    if payload.currency is not None:
        user.currency = payload.currency
    if payload.monthly_income is not None:
        user.monthly_income = budget.money(payload.monthly_income)
    if payload.danger_threshold is not None:
        user.danger_threshold = budget.money(payload.danger_threshold) or None
    await budget.sync_fixed_expenses_total(session, user)
    await budget.recompute_daily_limit(session, user)
    await session.commit()
    await session.refresh(user)
    return ProfileOut.model_validate(user)
