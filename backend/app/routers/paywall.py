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

# Цена премиума в звездах Telegram (XTR). Меняется через .env без правки кода:
# Telegram удерживает свою комиссию, подбирается эмпирически.
STARS_PRICE = int(os.environ.get("PREMIUM_STARS_PRICE", "50"))

PREMIUM_TITLE = os.environ.get("PREMIUM_TITLE", "Premium доступ")
PREMIUM_DESCRIPTION = (
    "Прогноз лимитов на 30 дней, фиксированные расходы, "
    "детектор безопасных покупок и экспорт статистики."
)

# Резервные провайдеры (Kaspi/ЮKassa) — заглушки до подключения вебхуков провайдеров.
PAYMENT_LINKS: dict[str, str] = {
    "kaspi": "https://pay.kaspi.kz/pay/TODO_REPLACE_WITH_REAL_PAYMENT_LINK",
    "yookassa": "https://yoomoney.ru/checkout/TODO_REPLACE_WITH_REAL_PAYMENT_LINK",
}


async def _bot_api(token: str, method: str, payload: dict) -> dict:
    """Вызов Bot API. Возвращает {'ok': bool, ...} без бросков по HTTP-ошибкам."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(f"https://api.telegram.org/bot{token}/{method}", json=payload)
    try:
        return response.json()
    except ValueError:
        return {"ok": False, "description": f"HTTP {response.status_code}"}


@router.post("/paywall/unlock", response_model=UnlockResponse)
async def unlock(payload: UnlockRequest, session: Session, user: CurrentUser) -> UnlockResponse:
    """Возвращает ссылку на оплату премиума.

    Основной провайдер — Telegram Stars (invoice link + openInvoice на фронте).
    Подтверждение приходит вебхуком (см. ниже) и выставляет has_paid_access.
    """
    if payload.payment_provider in ("", "telegram_stars"):
        token = get_bot_token()
        if token is None:
            raise HTTPException(
                status_code=503,
                detail="Оплата через Telegram Stars недоступна: BOT_TOKEN не настроен на сервере.",
            )

        # payload платежа: чтобы вебхук мог понять, за что платили (id пользователя + домен).
        # Telegram ограничивает 128 байтами — поэтому короткий формат.
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

    # Резервные провайдеры — только если в .env подставлены реальные ссылки.
    redirect_url = PAYMENT_LINKS.get(payload.payment_provider)
    if redirect_url is None or "TODO" in redirect_url:
        raise HTTPException(status_code=400, detail="Провайдер оплаты пока не подключен")
    return UnlockResponse(success=True, redirect_url=redirect_url)


@router.get("/paywall/stars-price")
async def stars_price() -> dict:
    """Цена премиума в звездах — фронт показывает ее на кнопке до старта оплаты."""
    return {"stars_price": STARS_PRICE, "currency": "XTR"}


@router.post("/paywall/webhook")
async def paywall_webhook(
    request: Request,
    session: Session,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    """Приемник обновлений бота (регистрируется как Telegram webhook).

    Подтверждает pre-checkout и активирует премиум после successful_payment (XTR).
    Защита: заголовок X-Telegram-Bot-Api-Secret-Token, который Telegram присылает,
    если setWebhook вызван с secret_token (см. maybe_setup_webhook).
    """
    secret = os.environ.get("WEBHOOK_SECRET", "").strip()
    if not secret or not hmac.compare_digest(secret, x_telegram_bot_api_secret_token or ""):
        raise HTTPException(status_code=403, detail="Bad webhook secret")

    update = await request.json()

    # Telegram требует ответ на pre_checkout_query за 10 секунд, иначе платеж отменится.
    pre = update.get("pre_checkout_query")
    if pre:
        token = get_bot_token()
        if token:
            await _bot_api(
                token,
                "answerPreCheckoutQuery",
                {"pre_checkout_query_id": pre.get("id"), "ok": True},
            )
        return {"ok": True}

    message = update.get("message") or {}
    payment = message.get("successful_payment")
    if payment and payment.get("currency") == "XTR":
        from_user = message.get("from") or {}
        telegram_id = from_user.get("id")
        user = (
            await session.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalars().first()
        if user is not None:
            user.has_paid_access = True
            user.premium_source = "telegram_stars"
            await session.commit()
            logger.info(
                "Premium activated via Telegram Stars: user_id=%s tg=%s charge=%s",
                user.id,
                telegram_id,
                payment.get("telegram_payment_charge_id", "-"),
            )

    # Telegram ждет 200 OK в любом случае, иначе будет ретраить апдейт.
    return {"ok": True}


async def maybe_setup_webhook() -> None:
    """Разово при старте: регистрируем webhook бота на этот сервис.

    Нужны все три переменные: BOT_TOKEN, WEBHOOK_SECRET и PUBLIC_DOMAIN
    (compose подставляет ${DOMAIN}). При неполной конфигурации — тихо пропускаем:
    приложение работает и без бота, просто Stars-оплата недоступна.
    """
    token = get_bot_token()
    secret = os.environ.get("WEBHOOK_SECRET", "").strip()
    domain = os.environ.get("PUBLIC_DOMAIN", "").strip().rstrip("/")
    if not (token and secret and domain):
        logger.info("Webhook не настроен: BOT_TOKEN/WEBHOOK_SECRET/PUBLIC_DOMAIN не заданы")
        return

    webhook_url = f"{domain}/api/v1/paywall/webhook"
    result = await _bot_api(
        token,
        "setWebhook",
        {
            "url": webhook_url,
            "secret_token": secret,
            "allowed_updates": ["message", "pre_checkout_query"],
        },
    )
    if result.get("ok"):
        logger.info("Telegram webhook установлен: %s", webhook_url)
    else:
        logger.warning("setWebhook failed: %s", result.get("description"))
