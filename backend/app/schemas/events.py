from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ConfidenceLabel = Literal["low", "nominal", "high", "unknown"]
EventCategory = Literal["industrial", "vegetation", "agricultural", "unknown"]
Severity = Literal["critical", "high", "medium", "low"]
LandCoverGroup = Literal[
    "vegetation",
    "cropland",
    "built_up",
    "barren",
    "water",
    "snow_ice",
    "unclassified",
]
AlertReviewStatus = Literal[
    "requires_analyst_review",
    "acknowledged",
    "investigating",
    "closed",
]


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


class TemporalHistoryPoint(BaseModel):
    date: str
    detection_count: int = Field(ge=1)
    mean_frp_mw: float = Field(ge=0)
    max_frp_mw: float = Field(ge=0)


class LandCoverContext(BaseModel):
    provider: Literal["NASA EOSDIS GIBS"] = "NASA EOSDIS GIBS"
    product: Literal["MCD12Q1.061 MODIS IGBP annual land cover"] = (
        "MCD12Q1.061 MODIS IGBP annual land cover"
    )
    observation_date: str
    igbp_values: list[int]
    class_label: str
    group: LandCoverGroup
    rgb: tuple[int, int, int]
    native_resolution_m: int = 500
    sampling_method: str
    source_url: str


class AdministrativeAreaContext(BaseModel):
    provider: Literal["geoBoundaries"] = "geoBoundaries"
    dataset: Literal["gbOpen"] = "gbOpen"
    country_name: Literal["India"] = "India"
    iso3: Literal["IND"] = "IND"
    boundary_level: Literal["ADM0"] = "ADM0"
    boundary_id: str
    shape_id: str
    boundary_year: int
    license: str
    containment_method: str
    source_url: str


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
    cluster_method: Literal["metric_dbscan_haversine_v1"] = "metric_dbscan_haversine_v1"
    cluster_role: Literal["core", "border", "noise"]
    cluster_radius_m: float = Field(ge=0)
    cluster_epsilon_m: float = Field(gt=0)
    cluster_min_samples: int = Field(ge=1)
    cluster_detection_count: int = Field(ge=1)
    cluster_sensor_count: int = Field(ge=1)
    recurrence_score: float = Field(ge=0, le=1)
    observation_window_days: int = Field(ge=1)
    active_days: int = Field(ge=1)
    first_seen: datetime
    last_seen: datetime
    baseline_frp_mw: float = Field(ge=0)
    frp_mad_mw: float = Field(ge=0)
    anomaly_score: float | None = None
    anomaly_status: Literal["elevated", "within_observed_range", "insufficient_baseline"]
    temporal_history: list[TemporalHistoryPoint]
    category: EventCategory
    classification: str
    classification_confidence: float = Field(ge=0, le=1)
    severity: Severity
    explanation: list[str]
    context_status: str
    nearest_facility: FacilityContext | None = None
    land_cover: LandCoverContext | None = None
    administrative_area: AdministrativeAreaContext | None = None
    source_attribution: SourceAttribution
    model_version: str = "rules_temporal_metric_v3"
    feature_version: str = "firms_osm_modis_igbp_india_adm0_metric_dbscan_v4"
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
    archived_files: list[str] = Field(default_factory=list)
    normalized_events: int
    message: str


class HistoricalReadiness(BaseModel):
    generated_at: datetime
    observation_window_start: datetime | None
    observation_window_end: datetime | None
    observed_calendar_days: int = Field(ge=0)
    calendar_span_days: int = Field(ge=0)
    unique_events: int = Field(ge=0)
    unique_cells: int = Field(ge=0)
    archive_snapshot_files: int = Field(ge=0)
    bundled_seed_files: int = Field(ge=0)
    target_30_days: int = 30
    target_90_days: int = 90
    readiness_30_percent: float = Field(ge=0, le=100)
    readiness_90_percent: float = Field(ge=0, le=100)
    status: Literal[
        "insufficient_history",
        "thirty_day_candidate",
        "ninety_day_ready",
    ]
    methodology: str
    caveats: list[str]


class ArchiveResponse(BaseModel):
    archived_at: datetime
    archived_files: list[str]
    history: HistoricalReadiness


class LandCoverRefreshResponse(BaseModel):
    refreshed_at: datetime
    observation_date: str
    sampled_cells: int = Field(ge=0)
    tile_count: int = Field(ge=0)
    cache_file: str
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
        "elevated_industrial_baseline",
        "persistent_unknown_source",
        "industrial_context_high_frp",
        "multi_sensor_high_frp",
        "high_frp_thermal_anomaly",
    ]
    severity: Severity
    title: str
    reason: str
    review_status: AlertReviewStatus = "requires_analyst_review"
    review_note: str | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
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


class AlertReviewUpdate(BaseModel):
    status: AlertReviewStatus
    note: str | None = Field(default=None, max_length=500)
    reviewed_by: str = Field(default="local_analyst", min_length=1, max_length=100)


class PlaybackFrame(BaseModel):
    date: str
    detection_count: int = Field(ge=0)
    cluster_count: int = Field(ge=0)
    new_cluster_count: int = Field(ge=0)
    active_persistent_cells: int = Field(ge=0)
    high_frp_count: int = Field(ge=0)
    mean_frp_mw: float = Field(ge=0)
    event_ids: list[str]


class PlaybackCollection(BaseModel):
    generated_at: datetime
    observation_window_start: datetime
    observation_window_end: datetime
    total_events: int = Field(ge=0)
    methodology: str
    caveats: list[str]
    frames: list[PlaybackFrame]


class ThermalClusterSummary(BaseModel):
    cluster_id: str
    representative_event_id: str
    centroid_latitude: float = Field(ge=-90, le=90)
    centroid_longitude: float = Field(ge=-180, le=180)
    cluster_method: Literal["metric_dbscan_haversine_v1"] = "metric_dbscan_haversine_v1"
    cluster_radius_m: float = Field(ge=0)
    cluster_epsilon_m: float = Field(gt=0)
    cluster_min_samples: int = Field(ge=1)
    density_role_counts: dict[str, int]
    detection_count: int = Field(ge=1)
    sensor_count: int = Field(ge=1)
    active_days: int = Field(ge=1)
    observation_window_days: int = Field(ge=1)
    first_seen: datetime
    last_seen: datetime
    day_detection_ratio: float = Field(ge=0, le=1)
    night_detection_ratio: float = Field(ge=0, le=1)
    mean_frp_mw: float = Field(ge=0)
    median_frp_mw: float = Field(ge=0)
    max_frp_mw: float = Field(ge=0)
    frp_mad_mw: float = Field(ge=0)
    latest_frp_mw: float = Field(ge=0)
    anomaly_score: float | None = None
    anomaly_status: Literal["elevated", "within_observed_range", "insufficient_baseline"]
    persistence_score: float = Field(ge=0, le=1)
    persistence_label: Literal[
        "persistent_candidate",
        "recurring_candidate",
        "insufficient_history",
    ]
    classification: str
    category: EventCategory
    nearest_facility: FacilityContext | None = None
    temporal_history: list[TemporalHistoryPoint]
    evidence: list[str]
    data_quality: Literal["seven_day_observation", "snapshot_only"]


class ThermalClusterCollection(BaseModel):
    generated_at: datetime
    observation_window_start: datetime
    observation_window_end: datetime
    observation_window_days: int = Field(ge=1)
    total: int
    returned: int
    methodology: str
    caveats: list[str]
    clusters: list[ThermalClusterSummary]


class DailyAnalyticsPoint(BaseModel):
    date: str
    detections: int = Field(ge=0)
    mean_frp_mw: float = Field(ge=0)
    industrial_context_events: int = Field(ge=0)


class AnalyticsDashboard(BaseModel):
    generated_at: datetime
    observation_window_start: datetime
    observation_window_end: datetime
    observation_window_days: int = Field(ge=1)
    total_events: int
    total_clusters: int
    persistent_candidates: int
    recurring_candidates: int
    elevated_clusters: int
    unmapped_persistent_candidates: int
    category_counts: dict[str, int]
    severity_counts: dict[str, int]
    daily_activity: list[DailyAnalyticsPoint]
    top_persistent_sources: list[ThermalClusterSummary]
    methodology: str


class ClusteringDiagnostics(BaseModel):
    generated_at: datetime
    algorithm: Literal["DBSCAN"] = "DBSCAN"
    implementation: Literal["metric_dbscan_haversine_v1"] = "metric_dbscan_haversine_v1"
    distance_metric: Literal["Haversine great-circle distance"] = "Haversine great-circle distance"
    epsilon_m: float = Field(gt=0)
    min_samples: int = Field(ge=1)
    total_events: int = Field(ge=0)
    total_clusters: int = Field(ge=0)
    clustered_events: int = Field(ge=0)
    noise_events: int = Field(ge=0)
    core_events: int = Field(ge=0)
    border_events: int = Field(ge=0)
    multi_event_clusters: int = Field(ge=0)
    singleton_clusters: int = Field(ge=0)
    median_cluster_radius_m: float = Field(ge=0)
    p95_cluster_radius_m: float = Field(ge=0)
    maximum_cluster_radius_m: float = Field(ge=0)
    legacy_rounded_grid_cells: int = Field(ge=0)
    cluster_count_delta_vs_legacy: int
    methodology: str
    caveats: list[str]


ClusterReviewLabel = Literal[
    "likely_industrial",
    "likely_vegetation",
    "likely_agricultural",
    "likely_other",
    "uncertain",
    "exclude_data_quality",
]


class ClusterReviewUpdate(BaseModel):
    label: ClusterReviewLabel
    note: str | None = Field(default=None, max_length=1000)
    reviewed_by: str = Field(default="local_analyst", min_length=1, max_length=100)


class ClusterReviewRecord(BaseModel):
    review_id: str
    cluster_id: str
    representative_event_id: str
    proposed_category: EventCategory
    proposed_classification: str
    analyst_label: ClusterReviewLabel
    note: str | None = None
    reviewed_by: str
    reviewed_at: datetime
    evidence_snapshot: dict[str, object]
    model_version: str
    feature_version: str
    incident_confirmation: Literal[False] = False


class ClusterReviewCollection(BaseModel):
    generated_at: datetime
    total: int = Field(ge=0)
    unique_reviewed_clusters: int = Field(ge=0)
    label_counts: dict[str, int]
    methodology: str
    reviews: list[ClusterReviewRecord]


class ModelTrainingReadiness(BaseModel):
    generated_at: datetime
    status: Literal[
        "blocked_insufficient_reviewed_labels",
        "ready_for_reviewed_training",
    ]
    current_operational_model: str
    current_feature_version: str
    reviewed_records: int = Field(ge=0)
    reviewed_clusters: int = Field(ge=0)
    eligible_reviewed_samples: int = Field(ge=0)
    excluded_or_uncertain_reviews: int = Field(ge=0)
    weak_label_samples: int = Field(ge=0)
    reviewed_label_counts: dict[str, int]
    weak_label_counts: dict[str, int]
    reviewed_spatial_groups: int = Field(ge=0)
    weak_label_spatial_groups: int = Field(ge=0)
    required_reviewed_samples: int = Field(ge=1)
    required_samples_per_class: int = Field(ge=1)
    required_spatial_groups_per_class: int = Field(ge=2)
    required_classes: list[str]
    feature_count: int = Field(ge=1)
    feature_names: list[str]
    candidate_models: list[str]
    label_policy: str
    split_policy: str
    blockers: list[str]
    recommended_next_action: str


class ModelBenchmarkEnvelope(BaseModel):
    available: bool
    status: Literal["not_run", "development_only", "reviewed_evaluation"]
    message: str
    report: dict[str, object] | None = None


class EvidenceGraphNode(BaseModel):
    node_id: str
    kind: Literal[
        "observation",
        "temporal",
        "spatial",
        "context",
        "classification",
        "limitation",
    ]
    label: str
    value: str
    source: str
    source_url: str | None = None
    direction: Literal["supports", "limits", "neutral"]


class EvidenceGraphEdge(BaseModel):
    source_node_id: str
    target_node_id: str
    relation: Literal["supports", "limits", "contextualizes"]


class EventEvidenceGraph(BaseModel):
    generated_at: datetime
    event_id: str
    cluster_id: str
    classification_node_id: str
    classification: str
    category: EventCategory
    confidence: float = Field(ge=0, le=1)
    model_version: str
    feature_version: str
    nodes: list[EvidenceGraphNode]
    edges: list[EvidenceGraphEdge]
    interpretation_boundary: str


class ClusteringSensitivityVariant(BaseModel):
    epsilon_m: float = Field(gt=0)
    min_samples: int = Field(ge=1)
    is_operational_setting: bool
    total_clusters: int = Field(ge=0)
    multi_event_clusters: int = Field(ge=0)
    largest_cluster_events: int = Field(ge=0)
    core_events: int = Field(ge=0)
    border_events: int = Field(ge=0)
    noise_events: int = Field(ge=0)
    noise_percent: float = Field(ge=0, le=100)
    median_supported_radius_m: float = Field(ge=0)
    p95_supported_radius_m: float = Field(ge=0)
    maximum_supported_radius_m: float = Field(ge=0)
    co_membership_jaccard_vs_operational: float = Field(ge=0, le=1)


class ClusteringSensitivityReport(BaseModel):
    generated_at: datetime
    event_count: int = Field(ge=0)
    operational_epsilon_m: float = Field(gt=0)
    operational_min_samples: int = Field(ge=1)
    variants: list[ClusteringSensitivityVariant]
    methodology: str
    caveats: list[str]


class ModelRegistryEntry(BaseModel):
    version: str
    family: str
    lifecycle: Literal["operational", "development_only", "evaluation_only"]
    serving: bool
    label_provenance: str
    feature_version: str
    artifact_file: str | None = None
    artifact_sha256: str | None = None
    device: str
    metric_name: str | None = None
    metric_value: float | None = Field(default=None, ge=0, le=1)
    promotion_status: str
    notes: list[str]


class ModelRegistry(BaseModel):
    generated_at: datetime
    operational_version: str
    rollback_target: str
    entries: list[ModelRegistryEntry]
    promotion_policy: list[str]


class ThermalSourceFingerprint(BaseModel):
    fingerprint_id: str
    cluster_id: str
    representative_event_id: str
    centroid_latitude: float = Field(ge=-90, le=90)
    centroid_longitude: float = Field(ge=-180, le=180)
    category: EventCategory
    classification: str
    source_context: Literal["mapped_industrial", "land_cover_context", "unresolved"]
    detection_count: int = Field(ge=1)
    sensor_count: int = Field(ge=1)
    active_days: int = Field(ge=1)
    observation_window_days: int = Field(ge=1)
    observation_dates: list[str]
    mean_gap_days: float | None = Field(default=None, ge=0)
    typical_utc_hours: list[int]
    day_detection_ratio: float = Field(ge=0, le=1)
    night_detection_ratio: float = Field(ge=0, le=1)
    median_frp_mw: float = Field(ge=0)
    p90_frp_mw: float = Field(ge=0)
    maximum_frp_mw: float = Field(ge=0)
    frp_mad_mw: float = Field(ge=0)
    spatial_radius_m: float = Field(ge=0)
    spatial_stability: float = Field(ge=0, le=1)
    recurrence_score: float = Field(ge=0, le=1)
    profile_completeness: float = Field(ge=0, le=1)
    baseline_maturity: Literal[
        "snapshot_only",
        "short_window",
        "thirty_day_candidate",
        "seasonal_candidate",
    ]
    nearest_facility_name: str | None = None
    nearest_facility_distance_m: float | None = Field(default=None, ge=0)
    land_cover_label: str | None = None
    discovery_priority: float = Field(ge=0, le=1)
    discovery_status: Literal[
        "priority_unknown",
        "watch_unknown",
        "contextualized_source",
    ]
    evidence: list[str]
    limitation: str


class ThermalSourceFingerprintCollection(BaseModel):
    generated_at: datetime
    total: int = Field(ge=0)
    returned: int = Field(ge=0)
    feature_version: str
    methodology: str
    fingerprints: list[ThermalSourceFingerprint]


class IngestionRunRecord(BaseModel):
    run_id: str
    trigger: Literal["manual_api", "scheduler", "archive_only"]
    status: Literal["succeeded", "failed"]
    started_at: datetime
    finished_at: datetime
    source_mode: Literal["authenticated_area_api", "public_firms_feeds", "local_archive"]
    files: list[str]
    archived_files: list[str]
    normalized_events: int = Field(ge=0)
    error_type: str | None = None


class IngestionRunCollection(BaseModel):
    generated_at: datetime
    total: int = Field(ge=0)
    runs: list[IngestionRunRecord]


class SourceFileHealth(BaseModel):
    name: str
    origin: Literal["cache", "bundled"]
    bytes: int = Field(ge=0)
    modified_at: datetime
    age_hours: float = Field(ge=0)
    status: Literal["fresh", "stale", "bundled_snapshot"]


class OperationalHealth(BaseModel):
    generated_at: datetime
    status: Literal["healthy", "demo_ready", "attention"]
    data_mode: Literal["live", "snapshot"]
    normalized_events: int = Field(ge=0)
    latest_observation_at: datetime | None
    observation_lag_hours: float | None = Field(default=None, ge=0)
    source_files: list[SourceFileHealth]
    observed_calendar_days: int = Field(ge=0)
    archive_snapshot_files: int = Field(ge=0)
    last_ingestion_run: IngestionRunRecord | None
    refresh_interval_minutes: int = Field(ge=1)
    scheduler_command: str
    issues: list[str]
