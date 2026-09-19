"""Каталог скинов Хранителя (секция 15.2/15.3) — единый источник правды.

§35.3: здесь же цена в монетах для магазина. Два пути к одному скину:
дисциплина (стрик дней) — бесплатно, или монеты — быстрее (10 монет за каждый
закрытый день с HP > 50 %, см. §33). Цены подобраны так, чтобы стрик всё ещё
имел смысл: «Титановый Страж» = 7 дней стрика или 150 монет (≈15 хороших дней).
Скины с `premium_only` монетами не продаются — премиум остаётся платным входом.
"""

from __future__ import annotations

SKINS: list[dict] = [
    {
        "id": "skin_cadet",
        "name": "Кадет",
        "description": "Базовый кибер-костюм, шлем с открытым лицом. Стальная эстетика.",
        "streak_required": 0,
        "premium_only": False,
        "price_coins": 0,
    },
    {
        "id": "skin_titan_guardian",
        "name": "Титановый Страж",
        "description": "Плотная броня с неоновыми прожилками. Анимация щита при трате.",
        "streak_required": 7,
        "premium_only": False,
        "price_coins": 150,
    },
    {
        "id": "skin_ronin",
        "name": "Ронин Дисциплины",
        "description": "Кибер-самурайский шлем, маска, две катаны за спиной.",
        "streak_required": 30,
        "premium_only": False,
        "price_coins": 500,
    },
    {
        "id": "skin_architect",
        "name": "Архитектор Богатств",
        "description": "Золотой костюм с геометрической волновой аурой.",
        "streak_required": 90,
        "premium_only": False,
        "price_coins": 1500,
    },
    {
        "id": "skin_phantom_gold",
        "name": "Кибер-Призрак",
        "description": "Темное стекло, золотые внутренние узлы и золотая пыль целей.",
        "streak_required": 0,
        "premium_only": True,
        "price_coins": 0,
    },
]


def unlocked_skin_ids(
    streak_days: int, is_premium: bool, purchased: set[str] | list[str] | None = None
) -> list[str]:
    """Скины доступны тремя путями: базовый, стрик/премиум (§15.2) и покупка (§35.3)."""
    owned = set(purchased or ())
    unlocked = ["skin_cadet"]
    for skin in SKINS:
        if skin["id"] in owned:
            unlocked.append(skin["id"])
            continue
        if skin["premium_only"]:
            if is_premium:
                unlocked.append(skin["id"])
        elif skin["streak_required"] > 0 and streak_days >= skin["streak_required"]:
            unlocked.append(skin["id"])
    return unlocked


def find_skin(skin_id: str) -> dict | None:
    return next((s for s in SKINS if s["id"] == skin_id), None)


def is_purchasable(skin: dict) -> bool:
    """Можно ли купить скин за монеты (базовый и премиум — нельзя)."""
    return bool(skin) and not skin["premium_only"] and skin["price_coins"] > 0
