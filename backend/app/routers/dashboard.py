from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from ..deps import CurrentUser, Session
from ..schemas import DashboardResponse
from ..services import budget

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(session: Session, user: CurrentUser) -> DashboardResponse:
    today = date.today()
    data = await budget.build_dashboard(session, user, today)
    return DashboardResponse(**data)
