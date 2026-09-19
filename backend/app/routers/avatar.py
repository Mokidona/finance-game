from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import PendingTransaction
from ..schemas import (
    AvatarStatusResponse,
    EquipSkinRequest,
    EquipSkinResponse,
    ImpulseCancelRequest,
    PendingCreate,
    PendingOut,
    PendingResolveResponse,
    SavedCapitalResponse,
    SkinsResponse,
)
from ..services import shop as shop_service
from ..services import skins as skins_service

router = APIRouter(tags=["avatar"])

TIME_LOCK_HOURS = 1


def build_avatar_status(user, progress_percentage: float, over_limit: bool) -> dict:
    """14.1/15.1: эмоция Хранителя по состоянию дня."""
    if over_limit:
        emotion = "DEFEATED"
        glow_color = "#FF453A"
    elif progress_percentage > 80:
        emotion = "WARNING"
        glow_color = "#FF9F0A"
    else:
        emotion = "NORMAL"
        glow_color = "#34C759"
    return {
        "emotion": emotion,
        "glow_color": glow_color,
        "glitch_effect": over_limit,
    }


@router.get("/avatar", response_model=AvatarStatusResponse)
async def get_avatar_status(session: Session, user: CurrentUser) -> AvatarStatusResponse:
    from ..services.budget import compute_streak, get_spent_on_date
    from datetime import date

    today = date.today()
    base = user.daily_limit
    spent = await get_spent_on_date(session, user.id, today)
    pct = float(spent / base * 100) if base and base > 0 else 0.0
    streak = await compute_streak(session, user, today)
    purchased = await shop_service.purchased_skin_ids(session, user.id)

    return AvatarStatusResponse(
        user_id=user.id,
        active_skin_id=user.active_skin_id,
        streak_days=streak,
        is_premium=bool(user.has_paid_access),
        avatar_status=build_avatar_status(user, pct, spent > base),
        unlocked_skins=skins_service.unlocked_skin_ids(
            streak, bool(user.has_paid_access), purchased
        ),
        saved_capital=float(user.saved_capital or 0),
    )


@router.get("/avatar/skins", response_model=SkinsResponse)
async def list_skins(session: Session, user: CurrentUser) -> SkinsResponse:
    from ..services.budget import compute_streak
    from datetime import date

    streak = await compute_streak(session, user, date.today())
    purchased = await shop_service.purchased_skin_ids(session, user.id)
    unlocked = skins_service.unlocked_skin_ids(streak, bool(user.has_paid_access), purchased)
    return SkinsResponse(
        active_skin_id=user.active_skin_id,
        unlocked=unlocked,
        skins=[
            {
                **skin,
                "unlocked": skin["id"] in unlocked,
                "lock_reason": (
                    None
                    if skin["id"] in unlocked
                    else (
                        "Нужен премиум-доступ"
                        if skin["premium_only"]
                        else (
                            # §35.3: второй путь — монеты за дисциплину
                            f"Нужен стрик {skin['streak_required']} дней"
                            + (
                                f" или {int(skin['price_coins'])} монет"
                                if skins_service.is_purchasable(skin)
                                else ""
                            )
                        )
                    )
                ),
            }
            for skin in skins_service.SKINS
        ],
    )


@router.post("/avatar/skins/equip", response_model=EquipSkinResponse)
async def equip_skin(
    payload: EquipSkinRequest, session: Session, user: CurrentUser
) -> EquipSkinResponse:
    from ..services.budget import compute_streak
    from datetime import date

    skin = skins_service.find_skin(payload.skin_id)
    if skin is None:
        raise HTTPException(status_code=404, detail="Скин не найден")

    streak = await compute_streak(session, user, date.today())
    purchased = await shop_service.purchased_skin_ids(session, user.id)
    unlocked = skins_service.unlocked_skin_ids(streak, bool(user.has_paid_access), purchased)
    if payload.skin_id not in unlocked:
        raise HTTPException(status_code=403, detail="Скин еще заблокирован")

    user.active_skin_id = payload.skin_id
    await session.commit()
    return EquipSkinResponse(success=True, active_skin_id=user.active_skin_id)


# ---------- Time Lock: система защиты от сожалений (15.3.2) ----------


@router.post("/pending-transactions", response_model=PendingOut)
async def create_pending(
    payload: PendingCreate, session: Session, user: CurrentUser
) -> PendingOut:
    """Импульсная покупка выше опасного порога → заморозка на 1 час."""
    pending = PendingTransaction(
        user_id=user.id,
        amount=payload.amount,
        category=payload.category,
        comment=payload.comment,
        unlock_at=datetime.now() + timedelta(hours=TIME_LOCK_HOURS),
    )
    session.add(pending)
    await session.commit()
    await session.refresh(pending)
    return PendingOut.model_validate(pending)


@router.get("/pending-transactions", response_model=list[PendingOut])
async def list_pending(session: Session, user: CurrentUser) -> list[PendingOut]:
    rows = (
        await session.execute(
            select(PendingTransaction)
            .where(PendingTransaction.user_id == user.id)
            .order_by(PendingTransaction.created_at.desc())
        )
    ).scalars().all()
    return [PendingOut.model_validate(row) for row in rows]


@router.post("/pending-transactions/{pending_id}/confirm", response_model=PendingResolveResponse)
async def confirm_pending(
    pending_id: int, session: Session, user: CurrentUser
) -> PendingResolveResponse:
    """Подтверждение после часа паузы: транзакция уходит в расходы."""
    pending = (
        await session.execute(
            select(PendingTransaction).where(
                PendingTransaction.id == pending_id, PendingTransaction.user_id == user.id
            )
        )
    ).scalars().first()
    if pending is None:
        raise HTTPException(status_code=404, detail="Покупка не найдена")
    if datetime.now() < pending.unlock_at:
        raise HTTPException(status_code=425, detail="Пауза еще не закончилась")

    from ..models import Transaction
    from datetime import date

    session.add(
        Transaction(
            user_id=user.id,
            amount=pending.amount,
            category=pending.category,
            comment=pending.comment,
            date_key=date.today(),
        )
    )
    await session.delete(pending)
    await session.commit()
    return PendingResolveResponse(action="confirmed", saved_capital=float(user.saved_capital or 0))


@router.post("/impulse-guard/cancel", response_model=SavedCapitalResponse)
async def impulse_guard_cancelled(
    payload: ImpulseCancelRequest, session: Session, user: CurrentUser
) -> SavedCapitalResponse:
    """32.2: пользователь передумал на 5-секундной паузе — сумма не списывается, а
    падает в «Сэкономленный Капитал» (как и при отмене легаси Time Lock).
    """
    from ..services.budget import money

    if payload.amount > 0:
        user.saved_capital = money((user.saved_capital or 0) + money(payload.amount))
        await session.commit()
    return SavedCapitalResponse(saved_capital=float(user.saved_capital or 0))


@router.post("/pending-transactions/{pending_id}/cancel", response_model=PendingResolveResponse)
async def cancel_pending(
    pending_id: int, session: Session, user: CurrentUser
) -> PendingResolveResponse:
    """Отмена паузы: сумма зачисляется в «Сэкономленный Капитал» (буст опыта)."""
    pending = (
        await session.execute(
            select(PendingTransaction).where(
                PendingTransaction.id == pending_id, PendingTransaction.user_id == user.id
            )
        )
    ).scalars().first()
    if pending is None:
        raise HTTPException(status_code=404, detail="Покупка не найдена")

    from ..services.budget import money

    user.saved_capital = money((user.saved_capital or 0) + pending.amount)
    await session.delete(pending)
    await session.commit()
    return PendingResolveResponse(
        action="cancelled", saved_capital=float(user.saved_capital or 0)
    )
