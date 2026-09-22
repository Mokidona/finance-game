from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    telegram_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="KZT", server_default="KZT")
    monthly_income: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    fixed_expenses_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    daily_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    has_paid_access: Mapped[bool] = mapped_column(Boolean, default=False)
    # Откуда премиум: 'telegram_stars' | 'manual' | NULL (нет). С-Star платежи
    # одноразовые и привязаны к telegram_id — колонка позволяет сверять платежи
    # Telegram при вебхуке и не активировать премиум «вслепую».
    premium_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    danger_threshold: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    saved_capital: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    fixed_expenses: Mapped[list["FixedExpense"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    day_balances: Mapped[list["DayBalance"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    debts: Mapped[list["Debt"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class FixedExpense(Base):
    __tablename__ = "fixed_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    due_day: Mapped[int] = mapped_column(Integer)  # 1..31
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="fixed_expenses")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    category: Mapped[str] = mapped_column(String(50))  # food | transport | entertainment | other
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    date_key: Mapped[date] = mapped_column(Date, index=True)  # YYYY-MM-DD

    user: Mapped["User"] = relationship(back_populates="transactions")


class DayBalance(Base):
    __tablename__ = "day_balances"
    __table_args__ = (UniqueConstraint("user_id", "date_key", name="uq_day_balances_user_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    date_key: Mapped[date] = mapped_column(Date, index=True)
    allocated_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    spent_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    carried_over: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)

    user: Mapped["User"] = relationship(back_populates="day_balances")


class Debt(Base):
    """Долг, который я выдал («деньги в долг»).

    Логика (секция 12.3): выдача долга — НЕ расход, но временно замораживает
    деньги и уменьшает доступный остаток на сегодня. Возврат размораживает
    сумму, не создавая нового дохода.
    """

    __tablename__ = "debts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    debtor_name: Mapped[str] = mapped_column(String(100))  # кому
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    given_date: Mapped[date] = mapped_column(Date, default=date.today)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # дата возврата (опц.)
    is_returned: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)

    user: Mapped["User"] = relationship(back_populates="debts")



