from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import PendingTransaction, Transaction
from ..schemas import TransactionCreate, TransactionCreateOut, TransactionOut
from ..services import budget

router = APIRouter(tags=["transactions"])

# 15.3.2: легаси-пауза «Защиты от Сожалений». С §32.2 основной сценарий —
# 5-секундный осознанный таймер на клиенте (impulse_acknowledged=true),
# серверный часовой hold остается только для запросов без этого флага.
TIME_LOCK_HOURS = 1


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


@router.post("/transactions", response_model=TransactionCreateOut)
async def create_transaction(
    payload: TransactionCreate, session: Session, user: CurrentUser
) -> TransactionCreateOut:
    """Создает расход.

    32.2: импульсная покупка проходит 5-секундную паузу у клиента и приходит с
    `impulse_acknowledged=true` — сохраняем сразу. Без флага (старые клиенты)
    импульс выше порога по-прежнему уходит в легаси Time Lock.
    """
    amount = budget.money(payload.amount)
    threshold = budget.money(user.danger_threshold or 0)
    is_impulse = payload.kind == "impulse"
    over_threshold = threshold > 0 and amount >= threshold
    if is_impulse and over_threshold and not payload.impulse_acknowledged:
        pending = PendingTransaction(
            user_id=user.id,
            amount=amount,
            category=payload.category,
            comment=payload.comment,
            created_at=budget.now_local(),
            unlock_at=datetime.now() + timedelta(hours=TIME_LOCK_HOURS),
        )
        session.add(pending)
        await session.commit()
        await session.refresh(pending)
        return TransactionCreateOut(pending=True, pending_transaction=pending)

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
    return TransactionCreateOut(pending=False, transaction=tx)


# §34.1: IMMUTABLE LEDGER — внесенный расход нельзя ни удалить, ни изменить.
#
# Раньше здесь было удаление; теперь маршрут оставлен намеренно и ВСЕГДА отвечает
# 403 с правилом. Почему не убрать совсем: 405 от FastAPI не объясняет клиенту
# (в т.ч. устаревшей сборке в WebView Telegram), что произошло, а 403 несёт текст
# правила и одинаково понятен и фронтенду, и внешним клиентам.
#
# Исправление ошибки в сумме — не правка записи, а новый документ: изменить
# месячный доход в профиле (тогда пересчитается дневной лимит) или внести
# корректировку отдельной записью. Само правило подсказывает UI.
IMMUTABLE_DETAIL = (
    "Записи в Казне неизменяемы. Это защищает твою дисциплину от самообмана."
)


@router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: int) -> None:
    raise HTTPException(status_code=403, detail=IMMUTABLE_DETAIL)
