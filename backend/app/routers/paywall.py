from __future__ import annotations

import hashlib
import hmac
import logging
import os

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from sqlalchemy import select

from ..deps import CurrentUser, Session
from ..models import User
from ..schemas import UnlockRequest, UnlockResponse
from ..telegram_auth import get_bot_token

router = APIRouter(tags=["paywall"])
logger = logging.getLogger(__name__)

STARS_PRICE = int(os.environ.get("PREMIUM_STARS_PRICE", "50"))
PREMIUM_TITLE = os.environ.get("PREMIUM_TITLE", "Premium доступ")
PREMIUM_DESCRIPTION = (
    "Прогноз лимитов на 30 дней, фиксированные расходы, "
    "детектор безопасных покупок и экспорт статистики."
)

PAYMENT_LINKS: dict[str, str] = {
    "kaspi": "https://pay.kaspi.kz/pay/TODO_REPLACE_WITH_REAL_PAYMENT_LINK",
    "yookassa": "https://yoomoney.ru/checkout/TODO_REPLACE_WITH_REAL_PAYMENT_LINK",
}


async def _bot_api(token: str, method: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(f"https://api.telegram.org/bot{token}/{method}", json=payload)
    try:
        return response.json()
    except ValueError:
        return {"ok": False, "description": f"HTTP {response.status_code}"}


@router.post("/paywall/unlock", response_model=UnlockResponse)
async def unlock(payload: UnlockRequest, session: Session, user: CurrentUser) -> UnlockResponse:
    if payload.payment_provider in ("", "telegram_stars"):
        token = get_bot_token()
        if token is None:
            raise HTTPException(
                status_code=503,
                detail="Оплата через Telegram Stars недоступна: BOT_TOKEN не настроен на сервере.",
            )
        invoice_payload = f"premium:{user.id}"
        result = await _bot_api(
            token,
            "createInvoiceLink",
            {
                "title": PREMIUM_TITLE[:32],
                "description": PREMIUM_DESCRIPTION[:255],
                "payload": invoice_payload,
                "currency": "XTR",
                "prices": [{"label": "Premium", "amount": STARS_PRICE}],
            },
        )
        if not result.get("ok"):
            description = result.get("description", "неизвестная ошибка Telegram API")
            logger.error("createInvoiceLink failed: %s", description)
            raise HTTPException(status_code=502, detail=f"Telegram API: {description}")
        invoice_link = result["result"]
        return UnlockResponse(success=True, invoice_link=invoice_link, redirect_url=invoice_link)
    redirect_url = PAYMENT_LINKS.get(payload.payment_provider)
    if redirect_url is None or "TODO" in redirect_url:
        raise HTTPException(status_code=400, detail="Провайдер оплаты пока не подключен")
    return UnlockResponse(success=True, redirect_url=redirect_url)


@router.get("/paywall/stars-price")
async def stars_price() -> dict:
    return {"stars_price": STARS_PRICE, "currency": "XTR"}
