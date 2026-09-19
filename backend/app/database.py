from __future__ import annotations

import os
import warnings
from pathlib import Path

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# SQLAlchemy предупреждает, что SQLite не поддерживает Decimal нативно.
# Мы сами квантуем деньги через services.budget.money(), поэтому предупреждение отключаем.
warnings.filterwarnings("ignore", message=".*support Decimal objects natively.*")

BACKEND_DIR = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("DB_PATH", BACKEND_DIR / "budget.db")).resolve()

engine = create_async_engine(f"sqlite+aiosqlite:///{DB_PATH}", echo=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record):
    """WAL-режим и таймаут блокировки для каждой лежащей в основе связи."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


class Base(DeclarativeBase):
    pass


AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    """Создает таблицы при старте приложения."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Легкая миграция для существующих баз: create_all не добавляет колонки
        # в уже созданные таблицы. Идемпотентно — на пустой базе колонка уже есть.
        from sqlalchemy import inspect as sa_inspect

        def _ensure_columns(sync_conn) -> None:
            inspector = sa_inspect(sync_conn)
            user_columns = {c["name"] for c in inspector.get_columns("users")}
            if "premium_source" not in user_columns:
                sync_conn.exec_driver_sql(
                    "ALTER TABLE users ADD COLUMN premium_source VARCHAR(32)"
                )

        await conn.run_sync(_ensure_columns)
        await conn.execute(text("PRAGMA journal_mode=WAL"))
