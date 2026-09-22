from __future__ import annotations

import os
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


async def get_current_user(request: Request, session: Session) -> User:
    """Простая авторизация: заголовок X-User-Id или Authorization: Bearer <id>."""
    user_id: int | None = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            user_id = int(auth_header.split()[1])
        except (IndexError, ValueError):
            pass
    if user_id is None:
        x_user = request.headers.get("X-User-Id", "")
        if x_user:
            try:
                user_id = int(x_user)
            except ValueError:
                pass
    if user_id is None:
        # Для разработки: создать демо-пользователя, если база пуста
        user_id = 1
    user = (
        await session.execute(select(User).where(User.id == user_id))
    ).scalars().first()
    if user is None:
        user = User(
            id=user_id,
            first_name="Пользователь",
            currency="KZT",
        )
        session.add(user)
        try:
            await session.commit()
            await session.refresh(user)
        except Exception:
            await session.rollback()
            user = (
                await session.execute(select(User).where(User.id == user_id))
            ).scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
