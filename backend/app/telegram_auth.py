"""Авторизация Telegram Mini App: проверка подписи initData (алгоритм Telegram).

Frontend при каждом запросе кладёт `window.Telegram.WebApp.initData` в заголовок
`X-Telegram-Init-Data`. Бэкенд проверяет HMAC-SHA256 подпись (ключ = HMAC(key="WebAppData",
bot_token)), находит/создаёт пользователя по telegram_id. Подделка невозможна без
BOT_TOKEN, поэтому «заходить и пользоваться» могут только реальные владельцы Telegram.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Окно жизни initData: Telegram перегенерирует её на каждый запуск Mini App,
# но WebView может закешировать страницу — свежесть подписи ограничиваем явно.
MAX_AGE_SECONDS = 24 * 3600


@dataclass(frozen=True)
class TelegramUser:
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    language_code: str | None = None


def _parse_init_data(raw: str) -> tuple[dict[str, str], str | None]:
    """Парсит initData (urlencoded key=value) в dict + hash."""
    from urllib.parse import parse_qsl

    received_hash: str | None = None
    data: dict[str, str] = {}
    for key, value in parse_qsl(raw, keep_blank_values=True):
        if key == "hash":
            received_hash = value
        else:
            data[key] = value
    return data, received_hash


def verify_init_data(raw: str, bot_token: str) -> TelegramUser | None:
    """Возвращает TelegramUser, если подпись валидна и свежа, иначе None.

    Алгоритм (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
    secret_key = HMAC_SHA256(key="WebAppData", message=bot_token)
    hash = HMAC_SHA256(key=secret_key, message=<data_check_string>)
    data_check_string = "\\n".join(f"{k}={v}" for k, v in sorted(pairs, key=lambda p: p[0]))
    """
    if not raw or not bot_token:
        return None

    data, received_hash = _parse_init_data(raw)
    if not received_hash:
        return None

    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(data.items(), key=lambda item: item[0])
    )
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calculated = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated, received_hash):
        return None

    auth_date_raw = data.get("auth_date")
    if auth_date_raw and not auth_date_raw.isdigit():
        return None
    if auth_date_raw and time.time() - int(auth_date_raw) > MAX_AGE_SECONDS:
        return None

    user_raw = data.get("user")
    if not user_raw:
        return None
    try:
        payload = json.loads(user_raw)
        tg_id = int(payload["id"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None

    return TelegramUser(
        id=tg_id,
        first_name=payload.get("first_name"),
        last_name=payload.get("last_name"),
        username=payload.get("username"),
        language_code=payload.get("language_code"),
    )


def get_bot_token() -> str | None:
    """BOT_TOKEN из окружения; без него Mini App API недоступно (503 с подсказкой)."""
    token = os.environ.get("BOT_TOKEN", "").strip()
    return token or None
