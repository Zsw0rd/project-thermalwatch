from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    app_name: str = "AegisFire API"
    app_env: str = "development"
    demo_mode: bool = True
    database_url: str = "postgresql+psycopg://aegisfire:aegisfire@localhost:5432/aegisfire"
    api_cors_origins: list[str] = ["http://localhost:3000"]
    firms_map_key: str | None = None
    firms_source: str = "VIIRS_NOAA20_NRT"
    firms_day_range: int = 1
    firms_sample_dir: Path = Path("data/samples")
    firms_cache_dir: Path = Path("data/cache")
    firms_request_timeout_seconds: int = 30
    india_bbox: tuple[float, float, float, float] = (68.0, 6.0, 98.0, 38.0)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("api_cors_origins", mode="before")
    @classmethod
    def normalize_cors_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.lstrip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
