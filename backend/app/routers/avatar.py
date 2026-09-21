from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import User
from ..schemas import (
    AvatarStatusResponse,
    EquipSkinRequest,
    EquipSkinResponse,
    SkinsResponse,
)
from ..services import skins as skins_service

router = APIRouter(tags=["avatar"])


def build_avatar_status(user, progress_percentage: float, over_limit: bool) -> dict:
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

    today = date.today()
    base = user.daily_limit
    spent = await get_spent_on_date(session, user.id, today)
    pct = float(spent / base * 100) if base and base > 0 else 0.0
    streak = await compute_streak(session, user, today)

    return AvatarStatusResponse(
        user_id=user.id,
        active_skin_id=user.active_skin_id,
        streak_days=streak,
        is_premium=bool(user.has_paid_access),
        avatar_status=build_avatar_status(user, pct, spent > base),
        unlocked_skins=skins_service.unlocked_skin_ids(
            streak, bool(user.has_paid_access), set()
        ),
        saved_capital=float(user.saved_capital or 0),
    )


@router.get("/avatar/skins", response_model=SkinsResponse)
async def list_skins(session: Session, user: CurrentUser) -> SkinsResponse:
    from ..services.budget import compute_streak

    streak = await compute_streak(session, user, date.today())
    unlocked = skins_service.unlocked_skin_ids(streak, bool(user.has_paid_access), set())
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
                        else f"Нужен стрик {skin['streak_required']} дней"
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

    skin = skins_service.find_skin(payload.skin_id)
    if skin is None:
        raise HTTPException(status_code=404, detail="Скин не найден")

    streak = await compute_streak(session, user, date.today())
    unlocked = skins_service.unlocked_skin_ids(streak, bool(user.has_paid_access), set())
    if payload.skin_id not in unlocked:
        raise HTTPException(status_code=403, detail="Скин еще заблокирован")

    user.active_skin_id = payload.skin_id
    await session.commit()
    return EquipSkinResponse(success=True, active_skin_id=user.active_skin_id)
