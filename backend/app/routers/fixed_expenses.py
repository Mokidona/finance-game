from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import FixedExpense
from ..schemas import FixedExpenseCreate, FixedExpenseOut, FixedExpenseUpdate
from ..services import budget

router = APIRouter(tags=["fixed-expenses"])


async def _sync_totals(session, user) -> None:
    """Пересчитывает fixed_expenses_total и daily_limit пользователя."""
    await budget.sync_fixed_expenses_total(session, user)
    await budget.recompute_daily_limit(session, user)
    await session.commit()


@router.get("/fixed-expenses", response_model=list[FixedExpenseOut])
async def list_fixed_expenses(session: Session, user: CurrentUser) -> list[FixedExpenseOut]:
    rows = (
        await session.execute(
            select(FixedExpense)
            .where(FixedExpense.user_id == user.id)
            .order_by(FixedExpense.due_day)
        )
    ).scalars().all()
    return [FixedExpenseOut.model_validate(e) for e in rows]


@router.post("/fixed-expenses", response_model=FixedExpenseOut, status_code=201)
async def create_fixed_expense(
    payload: FixedExpenseCreate, session: Session, user: CurrentUser
) -> FixedExpenseOut:
    item = FixedExpense(
        user_id=user.id,
        title=payload.title,
        amount=budget.money(payload.amount),
        due_day=payload.due_day,
    )
    session.add(item)
    await session.flush()
    await _sync_totals(session, user)
    await session.refresh(item)
    return FixedExpenseOut.model_validate(item)


@router.patch("/fixed-expenses/{item_id}", response_model=FixedExpenseOut)
async def update_fixed_expense(
    item_id: int, payload: FixedExpenseUpdate, session: Session, user: CurrentUser
) -> FixedExpenseOut:
    item = (
        await session.execute(
            select(FixedExpense).where(
                FixedExpense.id == item_id, FixedExpense.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Расход не найден")
    if payload.title is not None:
        item.title = payload.title
    if payload.amount is not None:
        item.amount = budget.money(payload.amount)
    if payload.due_day is not None:
        item.due_day = payload.due_day
    if payload.is_active is not None:
        item.is_active = payload.is_active
    await _sync_totals(session, user)
    await session.refresh(item)
    return FixedExpenseOut.model_validate(item)


@router.delete("/fixed-expenses/{item_id}", status_code=204)
async def delete_fixed_expense(item_id: int, session: Session, user: CurrentUser) -> None:
    item = (
        await session.execute(
            select(FixedExpense).where(
                FixedExpense.id == item_id, FixedExpense.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Расход не найден")
    await session.delete(item)
    await _sync_totals(session, user)
