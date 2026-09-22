from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import (
    analytics,
    auth,
    dashboard,
    fixed_expenses,
    profile,
    transactions,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
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
app.include_router(auth.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok"}
