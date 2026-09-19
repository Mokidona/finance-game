from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import Debt
from ..schemas import DebtCreate, DebtOut
from ..services import budget

router = APIRouter(tags=["debts"])


@router.get("/debts", response_model=list[DebtOut])
async def list_debts(
    session: Session, user: CurrentUser, include_returned: bool = False
) -> list[DebtOut]:
    """Активные (невозвращенные) долги — «замороженные деньги»."""
    query = select(Debt).where(Debt.user_id == user.id).order_by(Debt.created_at.desc())
    if not include_returned:
        query = query.where(Debt.is_returned.is_(False))
    rows = (await session.execute(query)).scalars().all()
    return [DebtOut.model_validate(row) for row in rows]


@router.post("/debts", response_model=DebtOut)
async def create_debt(payload: DebtCreate, session: Session, user: CurrentUser) -> DebtOut:
    """Выдача долга: сумма мгновенно уходит в «замороженный баланс» и
    уменьшает дневной лимит (это не расход)."""
    debt = Debt(
        user_id=user.id,
        debtor_name=payload.debtor_name.strip(),
        amount=budget.money(payload.amount),
        due_date=payload.due_date,
    )
    session.add(debt)
    await session.flush()
    await budget.recompute_daily_limit(session, user)
    await session.commit()
    await session.refresh(debt)
    return DebtOut.model_validate(debt)


@router.post("/debts/{debt_id}/return", response_model=DebtOut)
async def return_debt(debt_id: int, session: Session, user: CurrentUser) -> DebtOut:
    """Отметка «Вернул»: размораживает деньги БЕЗ создания нового дохода."""
    debt = (
        await session.execute(
            select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
        )
    ).scalars().first()
    if debt is None:
        raise HTTPException(status_code=404, detail="Долг не найден")
    if debt.is_returned:
        raise HTTPException(status_code=400, detail="Долг уже возвращен")

    debt.is_returned = True
    debt.returned_at = datetime.now()
    await budget.recompute_daily_limit(session, user)
    await session.commit()
    await session.refresh(debt)
    return DebtOut.model_validate(debt)


@router.delete("/debts/{debt_id}", status_code=204)
async def delete_debt(debt_id: int, session: Session, user: CurrentUser) -> None:
    debt = (
        await session.execute(
            select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id)
        )
    ).scalars().first()
    if debt is None:
        raise HTTPException(status_code=404, detail="Долг не найден")
    await session.delete(debt)
    await budget.recompute_daily_limit(session, user)
    await session.commit()
