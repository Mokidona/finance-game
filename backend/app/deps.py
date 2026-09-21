from __future__ import annotations

import hashlib
import hmac
import json
import os
from collections.abc import AsyncIterator
from typing import Annotated
from urllib.parse import parse_qsl

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .database import AsyncSessionLocal
from .models import User


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]

# Демо-пользователь для разработки: вне Telegram заголовка initData нет.
DEMO_TELEGRAM_ID = 123456789


def _extract_telegram_user(raw: str, bot_token: str) -> dict | None:
    """Разбирает подписанную Telegram initData и возвращает объект user.

    initData — это URL-закодированная строка запроса вида
    `query_id=...&user=%7B%22id%22%3A123%7D&auth_date=...&hash=...`,
    поэтому парсим через parse_qsl (regex по «сырой» строке не работает).

    При заданном BOT_TOKEN проверяем HMAC-SHA256 по официальному алгоритму:
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    Без токена (локальная разработка) принимаем данные без проверки подписи.
    """
    try:
        pairs = dict(parse_qsl(raw, keep_blank_values=True))
    except ValueError:
        return None

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    if bot_token:
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        calculated = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(calculated, received_hash):
            return None

    try:
        user = json.loads(pairs.get("user", "{}"))
    except json.JSONDecodeError:
        return None
    return user if isinstance(user, dict) else None


async def get_current_user(request: Request, session: Session) -> User:
    """Аутентификация: пользователь по telegram_id из подписанной Telegram initData."""
    raw = request.headers.get("X-Telegram-Init-Data", "")
    bot_token = os.environ.get("BOT_TOKEN", "")

    telegram_id: int | None = None
    if raw:
        user_data = _extract_telegram_user(raw, bot_token)
        if user_data is None:
            # Подпись не сошлась или данные побиты. С рабочим BOT_TOKEN это
            # подделка — 401 вместо молчаливой подмены пользователя.
            if bot_token:
                raise HTTPException(status_code=401, detail="Недействительная Telegram-подпись")
        else:
            try:
                telegram_id = int(user_data.get("id"))
            except (TypeError, ValueError):
                telegram_id = None

    if telegram_id is None:
        telegram_id = DEMO_TELEGRAM_ID

    user = (
        await session.execute(select(User).where(User.telegram_id == telegram_id))
    ).scalars().first()
    if user is None:
        user = User(
            telegram_id=telegram_id,
            first_name="Пользователь",
            currency="KZT",
        )
        session.add(user)
        try:
            await session.commit()
        except IntegrityError:
            # Гонка при первом заходе: несколько параллельных запросов создают
            # одного пользователя (telegram_id уникален) — побеждает вставивший
            # первым, остальные просто читают его запись.
            await session.rollback()
            user = (
                await session.execute(select(User).where(User.telegram_id == telegram_id))
            ).scalars().first()
            if user is None:
                raise
        else:
            await session.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
