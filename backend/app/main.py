from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.api.events import router as events_router
from app.config import get_settings

settings = get_settings()


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    environment: str
    data_mode: Literal["snapshot", "live"]


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Database and ingestion workers will be initialized here as their phases land.
    yield


app = FastAPI(
    title=settings.app_name,
    description="Explainable industrial-fire and persistent-thermal-source intelligence.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.api_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(events_router)


@app.get("/api/v1/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="aegisfire-api",
        environment=settings.app_env,
        data_mode="snapshot" if settings.demo_mode else "live",
    )


@app.get("/api/v1", tags=["system"])
async def api_root() -> dict[str, str]:
    return {
        "name": settings.app_name,
        "status": "ready",
        "docs": "/docs",
    }
