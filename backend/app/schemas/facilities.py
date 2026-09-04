from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class IndustrialFacility(BaseModel):
    osm_id: str
    osm_type: str
    name: str
    facility_type: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    operator: str | None = None
    tags: dict[str, str]


class FacilityCollection(BaseModel):
    generated_at: datetime
    source: str
    total: int
    facilities: list[IndustrialFacility]


class FacilityRefreshResponse(BaseModel):
    refreshed_at: datetime
    facilities: int
    cache_file: str
    message: str


class FacilityThermalDay(BaseModel):
    date: str
    detection_count: int = Field(ge=1)
    mean_frp_mw: float = Field(ge=0)
    max_frp_mw: float = Field(ge=0)


class FacilityMonitorSummary(BaseModel):
    monitor_id: str
    facility: IndustrialFacility
    representative_event_id: str
    observed_detections: int = Field(ge=1)
    cluster_count: int = Field(ge=1)
    sensor_count: int = Field(ge=1)
    active_days: int = Field(ge=1)
    observation_window_days: int = Field(ge=1)
    first_seen: datetime
    last_seen: datetime
    median_frp_mw: float = Field(ge=0)
    maximum_frp_mw: float = Field(ge=0)
    latest_frp_mw: float = Field(ge=0)
    persistence_score: float = Field(ge=0, le=1)
    anomaly_status: Literal[
        "elevated",
        "within_observed_range",
        "insufficient_baseline",
    ]
    operating_status: Literal[
        "elevated_observed_frp",
        "persistent_observed_heat",
        "recent_thermal_activity",
        "insufficient_history",
    ]
    alert_count: int = Field(ge=0)
    history: list[FacilityThermalDay]
    evidence: list[str]
    caveat: str


class FacilityMonitorCollection(BaseModel):
    generated_at: datetime
    observation_window_days: int = Field(ge=1)
    total: int = Field(ge=0)
    returned: int = Field(ge=0)
    source: str
    methodology: str
    monitors: list[FacilityMonitorSummary]
