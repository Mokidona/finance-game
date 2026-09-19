"""§35.3: магазин кастомизации за монеты дисциплины.

Покупка = запись в `coin_purchases` (уникальная пара user+skin). Баланс считается
на лету: `compute_coins` (заработано) − сумма покупок. Никаких «кошельков» и
фоновых начислений — если пользователь провёл месяц дисциплинированно, монеты
появятся сами при следующем запросе.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException
from sqlalchemy.exc import IntegrityError

from ..deps import CurrentUser, Session
from ..models import CoinPurchase
from ..schemas import ShopItemOut, ShopPurchaseRequest, ShopPurchaseResponse, ShopResponse
from ..services import budget, skins as skins_service, shop as shop_service

router = APIRouter(tags=["shop"])


async def build_shop_payload(session: Session, user) -> dict:
    earned = await budget.compute_coins(session, user, date.today())
    spent = await shop_service.coins_spent(session, user.id)
    purchased = await shop_service.purchased_skin_ids(session, user.id)
    streak = await budget.compute_streak(session, user, date.today())
    unlocked = set(
        skins_service.unlocked_skin_ids(streak, bool(user.has_paid_access), purchased)
    )
    items = [
        ShopItemOut(
            id=skin["id"],
            name=skin["name"],
            description=skin["description"],
            price_coins=int(skin["price_coins"]),
            streak_required=int(skin["streak_required"]),
            premium_only=bool(skin["premium_only"]),
            purchased=skin["id"] in purchased,
            owned=skin["id"] in unlocked,
            equipped=user.active_skin_id == skin["id"],
            purchasable=skins_service.is_purchasable(skin),
        )
        for skin in skins_service.SKINS
    ]
    return {
        "balance": max(0, earned - spent),
        "earned": earned,
        "spent": spent,
        "streak_days": streak,
        "items": items,
    }


@router.get("/shop", response_model=ShopResponse)
async def get_shop(session: Session, user: CurrentUser) -> ShopResponse:
    return ShopResponse(**await build_shop_payload(session, user))


@router.post("/shop/purchase", response_model=ShopPurchaseResponse)
async def purchase_skin(
    payload: ShopPurchaseRequest, session: Session, user: CurrentUser
) -> ShopPurchaseResponse:
    skin = skins_service.find_skin(payload.skin_id)
    if skin is None:
        raise HTTPException(status_code=404, detail="Скин не найден")
    if skin["premium_only"]:
        raise HTTPException(status_code=403, detail="Этот скин входит только в премиум-доступ")
    if not skins_service.is_purchasable(skin):
        raise HTTPException(status_code=400, detail="Этот скин доступен и так")

    purchased = await shop_service.purchased_skin_ids(session, user.id)
    if skin["id"] in purchased:
        raise HTTPException(status_code=409, detail="Скин уже куплен")

    # Стрик уже открыл скин бесплатно — не даём сжечь монеты зря (UI кнопку
    # покупки такому скину не показывает, но клиент мог остаться старым)
    streak = await budget.compute_streak(session, user, date.today())
    unlocked_by_streak = skins_service.unlocked_skin_ids(
        streak, bool(user.has_paid_access), set()
    )
    if skin["id"] in unlocked_by_streak:
        raise HTTPException(
            status_code=400, detail="Скин уже открыт стриком — монеты тратить не нужно"
        )

    earned = await budget.compute_coins(session, user, date.today())
    balance = max(0, earned - await shop_service.coins_spent(session, user.id))
    price = int(skin["price_coins"])
    if balance < price:
        raise HTTPException(
            status_code=400,
            detail=f"Недостаточно монет: нужно {price}, у тебя {balance}",
        )

    session.add(CoinPurchase(user_id=user.id, skin_id=skin["id"], price=price))
    try:
        await session.commit()
    except IntegrityError:
        # гонка двух одновременных покупок — уникальный ключ (user_id, skin_id)
        await session.rollback()
        raise HTTPException(status_code=409, detail="Скин уже куплен") from None

    # Купленный скин сразу надеваем — иначе пользователь не увидит, за что заплатил
    user.active_skin_id = skin["id"]
    await session.commit()
    await session.refresh(user)

    data = await build_shop_payload(session, user)
    item = next(i for i in data["items"] if i.id == skin["id"])
    return ShopPurchaseResponse(success=True, balance=data["balance"], item=item)
