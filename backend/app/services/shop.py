"""§35.3: магазин монет — доступ к покупкам кастомизации.

Монеты не хранятся в БД: `budget.compute_coins` считает их производно от
дисциплины (10 за каждый закрытый день с HP > 50 %), а здесь лежат только траты.
Баланс = заработано − куплено.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import CoinPurchase


async def coins_spent(session: AsyncSession, user_id: int) -> int:
    """Сколько монет пользователь уже потратил в магазине."""
    total = (
        await session.execute(
            select(func.coalesce(func.sum(CoinPurchase.price), 0)).where(
                CoinPurchase.user_id == user_id
            )
        )
    ).scalar_one()
    return int(total or 0)


async def purchased_skin_ids(session: AsyncSession, user_id: int) -> set[str]:
    """Купленные скины — их нужно добавить к «разблокированным» (скины §15.2 + покупки)."""
    rows = (
        await session.execute(select(CoinPurchase.skin_id).where(CoinPurchase.user_id == user_id))
    ).scalars().all()
    return set(rows)


async def coins_available(session: AsyncSession, user_id: int, earned: int) -> int:
    """Баланс, которым можно распоряжаться прямо сейчас."""
    spent = await coins_spent(session, user_id)
    return max(0, int(earned) - spent)
