from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import AsyncSessionLocal
from .models import User


async def get_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(request: Request, session: AsyncSession) -> User:
    """Простая аутентификация: ищем пользователя по telegram_id из заголовка или создаем демо."""
    raw = request.headers.get("X-Telegram-Init-Data", "")
    telegram_id = None
    if raw:
        # Простая проверка: если заголовок содержит id, извлекаем его
        import re
        match = re.search(r"user=\{[^}]*\"id\":(\d+)", raw)
        if match:
            telegram_id = int(match.group(1))

    if telegram_id is None:
        # Демо-пользователь для разработки
        telegram_id = 123456789

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
        await session.commit()
        await session.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
