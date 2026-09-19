from __future__ import annotations

import asyncio
import logging
import os

import httpx

from .telegram_auth import get_bot_token

logger = logging.getLogger(__name__)


async def _bot_api(token: str, method: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(f"https://api.telegram.org/bot{token}/{method}", json=payload)
    try:
        return response.json()
    except ValueError:
        return {"ok": False, "description": f"HTTP {response.status_code}"}


async def start_polling():
    token = get_bot_token()
    if not token:
        logger.info("Polling пропущен: BOT_TOKEN не задан")
        return

    logger.info("Запуск polling бота...")
    # Удаляем активный вебхук, чтобы polling работал
    await _bot_api(token, "deleteWebhook", {})
    offset = 0
    domain = os.environ.get("DOMAIN", "2mln.freeddns.org")

    while True:
        try:
            result = await _bot_api(token, "getUpdates", {"offset": offset, "timeout": 30, "allowed_updates": ["message"]})
            if not result.get("ok"):
                logger.warning("getUpdates error: %s", result.get("description"))
                await asyncio.sleep(5)
                continue

            updates = result.get("result", [])
            for update in updates:
                offset = update.get("update_id", offset) + 1
                message = update.get("message", {})
                text = message.get("text", "")
                chat_id = message.get("chat", {}).get("id")

                if text and text.startswith("/start") and chat_id is not None:
                    await _bot_api(
                        token,
                        "sendMessage",
                        {
                            "chat_id": chat_id,
                            "text": "👋 Привет, Хранитель Казны!\n\nОткрывай приложение и следи за бюджетом вместе с питомцем. Не дай ему уйти в нокаут!",
                            "reply_markup": {
                                "inline_keyboard": [
                                    [{"text": "🚀 Открыть приложение", "web_app": {"url": f"https://{domain}"}}]
                                ]
                            },
                        },
                    )
                    logger.info("Отправлено приветствие /start для chat_id=%s", chat_id)

        except Exception as e:
            logger.error("Polling error: %s", e)

        await asyncio.sleep(1)
