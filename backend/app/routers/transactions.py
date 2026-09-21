from __future__ import annotations

from datetime import date
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import Transaction
from ..schemas import TransactionCreate, TransactionOut
from ..services import budget

router = APIRouter(tags=["transactions"])


@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    session: Session,
    user: CurrentUser,
    day: date | None = Query(default=None, description="Фильтр по дате YYYY-MM-DD"),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[TransactionOut]:
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == user.id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    if day is not None:
        stmt = stmt.where(Transaction.date_key == day)
    rows = (await session.execute(stmt)).scalars().all()
    return [TransactionOut.model_validate(t) for t in rows]


@router.post("/transactions", response_model=TransactionOut)
async def create_transaction(
    payload: TransactionCreate, session: Session, user: CurrentUser
) -> TransactionOut:
    amount = budget.money(payload.amount)
    now = budget.now_local()
    tx = Transaction(
        user_id=user.id,
        amount=amount,
        category=payload.category,
        comment=payload.comment,
        created_at=now,
        date_key=now.date(),
    )
    session.add(tx)
    await session.commit()
    await session.refresh(tx)
    return TransactionOut.model_validate(tx)


# §34.1: IMMUTABLE LEDGER — внесенный расход нельзя удалить.
IMMUTABLE_DETAIL = (
    "Записи в Казне неизменяемы. Это защищает твою дисциплину от самообмана."
)


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int) -> None:
    raise HTTPException(status_code=403, detail=IMMUTABLE_DETAIL)
