from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta
from decimal import ROUND_FLOOR, ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FixedExpense, Transaction, User


TWO_PLACES = Decimal("0.01")


def money(value: Decimal | float | int | str | None) -> Decimal:
    """Квантуем деньги до копеек (2 знака), чтобы избежать float-погрешностей."""
    if value is None:
        return Decimal("0.00")
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def now_local() -> datetime:
    return datetime.now()


def days_in_month(d: date) -> int:
    return calendar.monthrange(d.year, d.month)[1]


async def sync_fixed_expenses_total(session: AsyncSession, user: User) -> Decimal:
    """Пересчитывает сумму активных фиксированных расходов пользователя."""
    total = (
        await session.execute(
            select(func.coalesce(func.sum(FixedExpense.amount), 0)).where(
                FixedExpense.user_id == user.id,
                FixedExpense.is_active.is_(True),
            )
        )
    ).scalar_one()
    user.fixed_expenses_total = money(total)
    return user.fixed_expenses_total


def compute_daily_limit(user: User, today: date | None = None) -> Decimal:
    """Free_Money = income - fixed_expenses; daily_limit = Free_Money / дней в месяце."""
    today = today or date.today()
    free_money = money(user.monthly_income) - money(user.fixed_expenses_total)
    if free_money <= 0:
        return Decimal("0.00")
    return (free_money / days_in_month(today)).quantize(TWO_PLACES, rounding=ROUND_FLOOR)


async def recompute_daily_limit(session: AsyncSession, user: User) -> Decimal:
    """Пересчитывает лимит с учетом фиксированных расходов."""
    user.daily_limit = compute_daily_limit(user)
    return user.daily_limit


async def get_spent_on_date(session: AsyncSession, user_id: int, day: date) -> Decimal:
    total = (
        await session.execute(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.date_key == day,
            )
        )
    ).scalar_one()
    return money(total)


async def compute_carry_over(session: AsyncSession, user: User, day: date) -> Decimal:
    """Перенос на начало указанного дня: раз цепочка carry_next = base + carry_prev - spent_prev.

    Дни без записи в day_balances считаются «не открытыми» (расходов нет),
    но базовый лимит по ним все равно переносится вперед.
    """
    month_start = day.replace(day=1)
    balances = (
        await session.execute(
            select(DayBalance)
            .where(
                DayBalance.user_id == user.id,
                DayBalance.date_key >= month_start,
                DayBalance.date_key < day,
            )
            .order_by(DayBalance.date_key)
        )
    ).scalars().all()
    by_date = {b.date_key: b for b in balances}

    base_limit = money(user.daily_limit)
    carry = Decimal("0.00")
    cursor = month_start
    while cursor < day:
        balance = by_date.get(cursor)
        if balance is not None:
            carry = base_limit + money(balance.carried_over) - money(balance.spent_amount)
        else:
            carry = base_limit + carry
        cursor += timedelta(days=1)
    return money(carry)


async def compute_streak(session: AsyncSession, user: User, today: date) -> int:
    """Сколько дней подряд (по вчера) пользователь укладывался в базовый лимит.

    §33.4: если питомец уже в нокауте (доступного на сегодня <= 0), серия рвётся
    сразу, не дожидаясь следующего дня — «Заморозка прогресса» из ТЗ.
    """
    month_start = today.replace(day=1)
    rows = (
        await session.execute(
            select(Transaction.date_key, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user.id,
                Transaction.date_key >= month_start,
                Transaction.date_key < today,
            )
            .group_by(Transaction.date_key)
        )
    ).all()
    spent_by_day = {d: money(total) for d, total in rows}
    base_limit = money(user.daily_limit)
    if base_limit <= 0:
        return 0

    # rows сгруппированы только по прошедшим дням — сегодня считаем отдельно
    spent_today = await get_spent_on_date(session, user.id, today)
    carry = await compute_carry_over(session, user, today)
    if money(base_limit + carry - spent_today) <= 0:
        return 0

    streak = 0
    cursor = today - timedelta(days=1)
    while cursor >= month_start:
        spent = spent_by_day.get(cursor)
        if spent is not None and spent > base_limit:
            break
        streak += 1
        cursor -= timedelta(days=1)
    return streak


# §33.1: игровой стимул — монеты за закрытые дни, прожитые с HP > 50%
# (потрачено строго меньше половины базового лимита). Монеты не хранятся в БД —
# это производная метрика дисциплины, поэтому схему users менять не нужно (в
# проекте нет миграций, init_db делает только create_all).
COINS_PER_GOOD_DAY = 10
COINS_GOOD_DAY_SHARE = Decimal("0.5")


async def compute_coins(session: AsyncSession, user: User, today: date) -> int:
    """10 монет за каждый завершившийся день дисциплины (HP > 50%), с первого дня учёта.

    §35.3: монеты — это кошелёк, а не месячный счётчик. Пока окно было текущим
    месяцем, максимум в месяц (31 день × 10 = 310) не покрывал ни один платный
    скин (150/500/1500), и магазин был мёртвым: единственный доступный по цене
    скин открывался стриком бесплатно. Теперь дни накапливаются от первой
    записи пользователя — дисциплина на длинной дистанции конвертируется в коины.
    """
    base_limit = money(user.daily_limit)
    if base_limit <= 0:
        return 0
    first_day = (
        await session.execute(
            select(func.min(Transaction.date_key)).where(Transaction.user_id == user.id)
        )
    ).scalar_one_or_none()
    if first_day is None:
        return 0
    if not isinstance(first_day, date):
        first_day = date.fromisoformat(str(first_day))

    rows = (
        await session.execute(
            select(Transaction.date_key, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user.id,
                Transaction.date_key >= first_day,
                Transaction.date_key < today,
            )
            .group_by(Transaction.date_key)
        )
    ).all()
    spent_by_day = {d: money(total) for d, total in rows}
    healthy_ceiling = money(base_limit * COINS_GOOD_DAY_SHARE)
    good_days = 0
    cursor = first_day
    while cursor < today:
        if spent_by_day.get(cursor, Decimal("0.00")) < healthy_ceiling:
            good_days += 1
        cursor += timedelta(days=1)
    return good_days * COINS_PER_GOOD_DAY


async def compute_total_saved(session: AsyncSession, user: User, today: date) -> Decimal:
    """Мотивационная метрика: сколько лимита недоиспользовано в завершившихся днях месяца.

    Для каждого прошедшего дня месяца: max(0, base_limit - spent).
    Дни без расходов дают полный base_limit в плюс. Переносы (carry) не учитываются,
    чтобы не задваивать «экономию».
    """
    base_limit = money(user.daily_limit)
    if base_limit <= 0:
        return Decimal("0.00")
    month_start = today.replace(day=1)
    rows = (
        await session.execute(
            select(Transaction.date_key, func.sum(Transaction.amount))
            .where(
                Transaction.user_id == user.id,
                Transaction.date_key >= month_start,
                Transaction.date_key < today,
            )
            .group_by(Transaction.date_key)
        )
    ).all()
    spent_by_day = {d: money(total) for d, total in rows}
    total = Decimal("0.00")
    cursor = month_start
    while cursor < today:
        spent = spent_by_day.get(cursor, Decimal("0.00"))
        total += max(Decimal("0.00"), money(base_limit - spent))
        cursor += timedelta(days=1)
    return money(total)


async def get_month_spent(session: AsyncSession, user_id: int, today: date) -> Decimal:
    """Сумма расходов с начала месяца по сегодня включительно."""
    month_start = today.replace(day=1)
    return money(
        (
            await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user_id,
                    Transaction.date_key >= month_start,
                )
            )
        ).scalar_one()
    )


async def build_insights(
    session: AsyncSession,
    user: User,
    today: date,
    spent_today: Decimal,
    current_limit: Decimal,
) -> list[dict]:
    """Генерирует инсайт-карточки для главного экрана."""
    insights: list[dict] = []
    base_limit = money(user.daily_limit)

    # 1. Бытовой шок: доля мелких трат (еда/транспорт) в базовом лимите.
    small = money(
        (
            await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user.id,
                    Transaction.date_key == today,
                    Transaction.category.in_(["food", "transport"]),
                )
            )
        ).scalar_one()
    )
    if base_limit > 0 and small > 0:
        share = int((small / base_limit * 100).quantize(Decimal("1"), rounding=ROUND_FLOOR))
        if share >= 20:
            insights.append(
                {
                    "id": "coffee_shock",
                    "icon": "Coffee",
                    "text": f"Кофе и такси сегодня заберут {share}% от дневного лимита.",
                }
            )

    # 2. (32.1) «Запас прочности» удален: единственный источник истины о состоянии —
    # HP питомца, который считается на клиенте из дневного лимита и остатка.

    # 3. Ачивка: серия дней в пределах лимита.
    streak = await compute_streak(session, user, today)
    if streak >= 2:
        insights.append(
            {
                "id": "streak",
                "icon": "Flame",
                "text": f"Удерживаешь лимит {streak}-й день подряд.",
            }
        )

    # 4. Замороженные деньги: влияние долгов на дневной лимит.
    frozen = await get_frozen_total(session, user.id)
    if frozen > 0:
        per_day = (frozen / days_in_month(today)).quantize(TWO_PLACES, rounding=ROUND_FLOOR)
        insights.append(
            {
                "id": "frozen_money",
                "icon": "Snowflake",
                "text": f"Долги заморозили {frozen} {user.currency} — минус {per_day} {user.currency} к лимиту в день.",
            }
        )

    # 5. Умное напоминание: долг возвращают завтра.
    tomorrow = today + timedelta(days=1)
    due_tomorrow = (
        await session.execute(
            select(Debt).where(
                Debt.user_id == user.id,
                Debt.is_returned.is_(False),
                Debt.due_date == tomorrow,
            )
        )
    ).scalars().first()
    if due_tomorrow is not None:
        insights.append(
            {
                "id": f"debt_reminder_{due_tomorrow.id}",
                "icon": "Bell",
                "text": f"{due_tomorrow.debtor_name} должен вернуть {money(due_tomorrow.amount)} {user.currency} завтра. Напомнить ему?",
            }
        )

    return insights


async def build_dashboard(session: AsyncSession, user: User, today: date) -> dict:
    """Собирает полный payload для GET /dashboard."""
    base_limit = money(user.daily_limit)
    carry = await compute_carry_over(session, user, today)
    spent_today = await get_spent_on_date(session, user.id, today)
    current_limit = money(base_limit + carry - spent_today)

    over_limit = current_limit < 0
    progress = 0.0
    if base_limit > 0:
        progress = float((spent_today / base_limit * 100).quantize(Decimal("0.1")))
    progress = max(0.0, min(progress, 100.0))

    txs = (
        await session.execute(
            select(Transaction)
            .where(Transaction.user_id == user.id, Transaction.date_key == today)
            .order_by(Transaction.created_at.desc())
        )
    ).scalars().all()

    insights = await build_insights(session, user, today, spent_today, current_limit)
    streak_days = await compute_streak(session, user, today)
    total_saved = await compute_total_saved(session, user, today)
    # §35.3: в дашборде показываем ДОСТУПНЫЕ монеты (заработано − куплено в магазине)
    from . import shop as shop_service

    coins = await shop_service.coins_available(
        session, user.id, await compute_coins(session, user, today)
    )
    frozen_total = await get_frozen_total(session, user.id)

    # 15.3.2: активные Time Lock-покупки (для баннера на дашборде, если остались
    # легаси-записи). Новые импульсы (32.2) проходят 5-секундную паузу на клиенте.
    from ..models import PendingTransaction

    pending_count = (
        await session.execute(
            select(func.count())
            .select_from(PendingTransaction)
            .where(PendingTransaction.user_id == user.id)
        )
    ).scalar_one()

    return {
        "user_id": user.id,
        "user_name": user.first_name or "Пользователь",
        "currency": user.currency,
        "status": "over_limit" if over_limit else "normal",
        "daily_limit_base": float(base_limit),
        "daily_limit_current": float(current_limit),
        "spent_today": float(spent_today),
        "progress_percentage": progress,
        "has_paid_access": bool(user.has_paid_access),
        "streak_days": streak_days,
        "coins": int(coins),
        "total_saved_kzt": float(total_saved),
        "frozen_total": float(frozen_total),
        "active_skin_id": user.active_skin_id,
        "pending_transactions_count": int(pending_count or 0),
        "insights": insights,
        "today_transactions": [
            {
                "id": t.id,
                "amount": float(money(t.amount)),
                "category": t.category,
                "comment": t.comment,
                "created_at": t.created_at,
            }
            for t in txs
        ],
    }


async def build_analytics(session: AsyncSession, user: User, today: date) -> dict:
    """Собирает payload для GET /analytics: серия по дням + разбивка по категориям."""
    month_start = today.replace(day=1)
    dim = days_in_month(today)
    days_left = dim - today.day + 1

    month_spent = money(
        (
            await session.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    Transaction.user_id == user.id,
                    Transaction.date_key >= month_start,
                )
            )
        ).scalar_one()
    )

    free_money = money(user.monthly_income) - money(user.fixed_expenses_total)
    base_limit = money(user.daily_limit)

    daily_rows = (
        await session.execute(
            select(Transaction.date_key, func.sum(Transaction.amount))
            .where(Transaction.user_id == user.id, Transaction.date_key >= month_start)
            .group_by(Transaction.date_key)
        )
    ).all()
    spent_by_day = {d: money(total) for d, total in daily_rows}

    # Серия «потрачено / выделено» с учетом цепочки переносов.
    series: list[dict] = []
    carry = Decimal("0.00")
    cursor = month_start
    while cursor <= today:
        day_spent = spent_by_day.get(cursor, Decimal("0.00"))
        allocated = money(base_limit + carry)
        series.append(
            {
                "date": cursor.isoformat(),
                "spent": float(day_spent),
                "limit": float(allocated),
            }
        )
        carry = money(base_limit + carry - day_spent)
        cursor += timedelta(days=1)

    cat_rows = (
        await session.execute(
            select(Transaction.category, func.sum(Transaction.amount))
            .where(Transaction.user_id == user.id, Transaction.date_key >= month_start)
            .group_by(Transaction.category)
            .order_by(func.sum(Transaction.amount).desc())
        )
    ).all()
    breakdown = []
    for category, total in cat_rows:
        total_q = money(total)
        pct = float((total_q / month_spent * 100).quantize(Decimal("0.1"))) if month_spent > 0 else 0.0
        breakdown.append({"category": category, "total": float(total_q), "percentage": pct})

    avg_daily = money(month_spent / today.day) if today.day > 0 else Decimal("0.00")
    projected = money(avg_daily * dim)

    return {
        "currency": user.currency,
        "month_total_spent": float(month_spent),
        "free_money_total": float(free_money),
        "remaining_budget": float(money(free_money - month_spent)),
        "avg_daily_spent": float(avg_daily),
        "projected_month_spent": float(projected),
        "days_in_month": dim,
        "days_left": days_left,
        "daily_limit": float(base_limit),
        "daily_series": series,
        "category_breakdown": breakdown,
    }
