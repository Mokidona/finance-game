from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import AsyncSessionLocal
from .models import User
from .telegram_auth import TelegramUser, get_bot_token, verify_init_data


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]


async def _authenticate(request: Request, session: AsyncSession) -> User:
    """Пользователь определяется по подписанному initData из Telegram Mini App.

    Фронт кладёт `window.Telegram.WebApp.initData` в заголовок X-Telegram-Init-Data.
    Подпись проверяется BOT_TOKEN'ом (HMAC по алгоритму Telegram), поэтому подделать
    чужой telegram_id нельзя. Первый запрос нового пользователя создает запись.
    """
    bot_token = get_bot_token()
    if bot_token is None:
        raise HTTPException(
            status_code=503,
            detail="BOT_TOKEN не настроен на сервере. Заполните его в .env и перезапустите.",
        )

    raw = request.headers.get("X-Telegram-Init-Data", "")
    tg_user: TelegramUser | None = verify_init_data(raw, bot_token)
    if tg_user is None:
        raise HTTPException(
            status_code=401,
            detail="Откройте приложение через Telegram Mini App",
        )

    user = (
        await session.execute(select(User).where(User.telegram_id == tg_user.id))
    ).scalars().first()
    if user is None:
        user = User(
            telegram_id=tg_user.id,
            first_name=tg_user.first_name or "Пользователь",
            currency="KZT",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


async def get_current_user(request: Request, session: Session) -> User:
    return await _authenticate(request, session)


CurrentUser = Annotated[User, Depends(get_current_user)]
