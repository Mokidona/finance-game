from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import Session
from ..models import User
from ..schemas import ProfileUpdate

router = APIRouter(tags=["auth"])


@router.post("/auth/register")
async def register(
    payload: ProfileUpdate, session: Session
) -> dict:
    """Простая регистрация. Для полноценной авторизации с паролем требуется bcrypt."""
    # Упрощённый вариант: ищем пользователя по email или создаём нового
    existing = (
        await session.execute(select(User).where(User.email == payload.email))
    ).scalars().first()
    if existing is None:
        user = User(
            email=payload.email,
            first_name=payload.first_name or "Пользователь",
            currency="KZT",
            monthly_income=payload.monthly_income or 0,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return {"id": user.id, "email": user.email, "name": user.first_name}
    return {"id": existing.id, "email": existing.email, "name": existing.first_name}


@router.post("/auth/login")
async def login(payload: ProfileUpdate, session: Session) -> dict:
    user = (
        await session.execute(select(User).where(User.email == payload.email))
    ).scalars().first()
    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return {"id": user.id, "token": str(user.id), "name": user.first_name}
