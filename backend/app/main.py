from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .polling import start_polling
from .routers import (
    analytics,
    avatar,
    dashboard,
    debts,
    fixed_expenses,
    paywall,
    profile,
    shop,
    transactions,
)



@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    # Запускаем polling бота вместо webhook
    await start_polling()
    yield


app = FastAPI(title="Budget Mini App API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(fixed_expenses.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(paywall.router, prefix="/api/v1")
app.include_router(debts.router, prefix="/api/v1")
app.include_router(avatar.router, prefix="/api/v1")
app.include_router(shop.router, prefix="/api/v1")


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
