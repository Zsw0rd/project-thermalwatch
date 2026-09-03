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
    firms_archive_dir: Path = Path("data/archive/firms")
    india_boundary_file: Path = Path("data/samples/india_adm0_geoboundary.geojson")
    firms_request_timeout_seconds: int = 30
    india_bbox: tuple[float, float, float, float] = (68.0, 6.0, 98.0, 38.0)
    clustering_epsilon_m: float = 750.0
    clustering_min_samples: int = 2
    cluster_review_file: Path = Path("data/cache/cluster_review_audit.json")
    model_benchmark_report_file: Path = Path("data/samples/model_benchmark_report.json")
    model_min_reviewed_samples: int = 60
    model_min_samples_per_class: int = 10
    model_min_spatial_groups_per_class: int = 3
    firms_refresh_interval_minutes: int = 360
    ingestion_audit_file: Path = Path("data/cache/ingestion_run_audit.json")

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
