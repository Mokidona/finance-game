"""Разовое создание владельца бюджета (прод: вместо демо-сида).

Запуск изнутри контейнера бэкенда:

    docker compose exec backend python -m app.create_user --name "Имя" --income 250000

Или локально из папки backend/:

    python -m app.create_user --name "Имя" --income 250000

Необязательные флаги:
    --db PATH     путь к SQLite-файлу (по умолчанию $DB_PATH или ./budget.db)
    --premium     сразу выдать премиум-доступ (has_paid_access=true)
"""

from __future__ import annotations

import argparse
import asyncio
import os
from decimal import Decimal, InvalidOperation

from .database import init_db
from .models import User
from .services import budget


def _parse_income(raw: str) -> Decimal:
    try:
        value = Decimal(raw.replace(" ", "").replace(",", "."))
    except InvalidOperation as exc:
        raise SystemExit(f"Некорректный доход: {raw!r}") from exc
    if value < 0:
        raise SystemExit("Доход не может быть отрицательным")
    return budget.money(value)


async def create_user(name: str, income: Decimal, premium: bool) -> None:
    # Импорт внутри функции: database.py читает DB_PATH при импорте, поэтому
    # env нужно установить до него (иначе флаг --db молча игнорируется).
    from .database import AsyncSessionLocal, init_db
    from sqlalchemy import select

    await init_db()

    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(User).order_by(User.id))).scalars().first()
        if existing is not None:
            raise SystemExit(
                f"Пользователь уже существует (id={existing.id}, имя={existing.first_name!r}). "
                "Приложение однопользовательское — отредактируйте профиль в UI или БД напрямую."
            )

        user = User(
            first_name=name,
            currency="KZT",
            monthly_income=income,
            has_paid_access=premium,
        )
        session.add(user)
        await budget.sync_fixed_expenses_total(session, user)
        await budget.recompute_daily_limit(session, user)
        await session.commit()
        await session.refresh(user)

        print(f"Создан пользователь id={user.id}: {user.first_name}")
        print(f"  доход: {user.monthly_income} {user.currency}")
        print(f"  фикс. расходы: {user.fixed_expenses_total}")
        print(f"  дневной лимит: {user.daily_limit}")
        print(f"  премиум: {user.has_paid_access}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Создать владельца бюджета")
    parser.add_argument("--name", required=True, help="Имя владельца (первый запуск)")
    parser.add_argument("--income", required=True, type=str, help="Месячный доход, напр. 250000")
    parser.add_argument("--premium", action="store_true", help="Сразу выдать премиум-доступ")
    parser.add_argument("--db", default=None, help="Путь к SQLite-файлу (иначе $DB_PATH или ./budget.db)")
    args = parser.parse_args()

    if args.db:
        os.environ["DB_PATH"] = args.db

    try:
        asyncio.run(create_user(args.name, _parse_income(args.income), args.premium))
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 — CLI, печатаем внятную ошибку
        raise SystemExit(f"Ошибка: {exc}") from exc


if __name__ == "__main__":
    main()
