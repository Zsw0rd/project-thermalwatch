from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ConfidenceLabel = Literal["low", "nominal", "high", "unknown"]
EventCategory = Literal["industrial", "vegetation", "agricultural", "unknown"]
Severity = Literal["critical", "high", "medium", "low"]


class SourceAttribution(BaseModel):
    provider: str
    product: str
    source_url: str
    acquired_at: datetime
    retrieved_at: datetime


class FacilityContext(BaseModel):
    osm_id: str
    name: str
    facility_type: str
    distance_m: float = Field(ge=0)
    operator: str | None = None
    source: Literal["OpenStreetMap"] = "OpenStreetMap"


class NormalizedThermalEvent(BaseModel):
    id: str
    source: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    acquired_at: datetime
    satellite: str
    instrument: str = "VIIRS"
    confidence: ConfidenceLabel
    frp_mw: float = Field(ge=0)
    brightness_i4_k: float | None = None
    brightness_i5_k: float | None = None
    brightness_delta_k: float | None = None
    scan_km: float | None = None
    track_km: float | None = None
    day_night: Literal["D", "N", "U"] = "U"
    cluster_id: str
    cluster_detection_count: int = Field(ge=1)
    cluster_sensor_count: int = Field(ge=1)
    recurrence_score: float = Field(ge=0, le=1)
    category: EventCategory
    classification: str
    classification_confidence: float = Field(ge=0, le=1)
    severity: Severity
    explanation: list[str]
    context_status: str
    nearest_facility: FacilityContext | None = None
    source_attribution: SourceAttribution
    raw_payload: dict[str, str] = Field(exclude=True)


class EventCollection(BaseModel):
    mode: Literal["operational", "demo"]
    generated_at: datetime
    source_updated_at: datetime
    geographic_scope: str
    scope_limitations: list[str]
    total: int
    returned: int
    events: list[NormalizedThermalEvent]


class AnalyticsSummary(BaseModel):
    generated_at: datetime
    total_events: int
    high_confidence_events: int
    nighttime_events: int
    multi_sensor_clusters: int
    mean_frp_mw: float
    max_frp_mw: float
    sensor_counts: dict[str, int]
    confidence_counts: dict[str, int]
    source_updated_at: datetime


class RefreshResponse(BaseModel):
    refreshed_at: datetime
    files: list[str]
    normalized_events: int
    message: str


class PersistenceResponse(BaseModel):
    persisted_at: datetime
    thermal_events: int
    thermal_clusters: int
    industrial_facilities: int
    message: str


class AlertPreview(BaseModel):
    id: str
    event_id: str
    cluster_id: str
    alert_type: Literal[
        "industrial_context_high_frp",
        "multi_sensor_high_frp",
        "high_frp_thermal_anomaly",
    ]
    severity: Severity
    title: str
    reason: str
    review_status: Literal["requires_analyst_review"] = "requires_analyst_review"
    acquired_at: datetime
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    frp_mw: float = Field(ge=0)
    evidence: list[str]
    source_attribution: SourceAttribution


class AlertCollection(BaseModel):
    generated_at: datetime
    total: int
    methodology: str
    alerts: list[AlertPreview]
