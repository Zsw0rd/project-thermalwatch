from __future__ import annotations

import json
import math
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime

from app.config import Settings, get_settings
from app.schemas.events import (
    ClusterReviewRecord,
    ModelBenchmarkEnvelope,
    ModelTrainingReadiness,
    NormalizedThermalEvent,
)
from app.services.cluster_review import cluster_review_collection
from app.services.temporal import build_cluster_summaries

FEATURE_VERSION = "cluster_tabular_features_v1"
TARGET_CLASSES = ("industrial", "vegetation", "agricultural", "unknown")
FEATURE_NAMES = (
    "log_detection_count",
    "sensor_support",
    "active_day_ratio",
    "observation_window_ratio_90d",
    "detections_per_active_day",
    "day_detection_ratio",
    "night_detection_ratio",
    "log_mean_frp_mw",
    "log_median_frp_mw",
    "log_max_frp_mw",
    "log_latest_frp_mw",
    "log_frp_mad_mw",
    "robust_anomaly_score",
    "anomaly_score_available",
    "anomaly_elevated",
    "persistence_score",
    "cluster_radius_over_epsilon",
    "facility_present",
    "facility_distance_log_ratio_25km",
    "facility_refinery",
    "facility_flare",
    "facility_power_plant",
    "facility_quarry",
    "facility_steelmaking",
    "land_cover_vegetation",
    "land_cover_cropland",
    "land_cover_built_up",
    "land_cover_barren",
    "land_cover_water",
    "land_cover_snow_ice",
    "land_cover_unclassified",
    "brightness_i4_scaled",
    "brightness_delta_scaled",
    "brightness_i4_available",
    "confidence_score",
    "representative_day",
    "representative_night",
    "month_sin",
    "month_cos",
    "utc_hour_sin",
    "utc_hour_cos",
)

REVIEW_TO_TARGET = {
    "likely_industrial": "industrial",
    "likely_vegetation": "vegetation",
    "likely_agricultural": "agricultural",
    "likely_other": "unknown",
}


@dataclass(frozen=True, slots=True)
class TrainingSample:
    cluster_id: str
    spatial_group: str
    weak_label: str
    reviewed_label: str | None
    features: tuple[float, ...]


def _clip(value: float, lower: float, upper: float) -> float:
    return min(upper, max(lower, value))


def _spatial_group(latitude: float, longitude: float, size_degrees: float = 2.0) -> str:
    latitude_index = math.floor((latitude + 90) / size_degrees)
    longitude_index = math.floor((longitude + 180) / size_degrees)
    return f"block-{latitude_index:03d}-{longitude_index:03d}"


def _latest_reviews(
    reviews: list[ClusterReviewRecord],
) -> dict[str, ClusterReviewRecord]:
    latest: dict[str, ClusterReviewRecord] = {}
    for review in sorted(reviews, key=lambda item: item.reviewed_at, reverse=True):
        latest.setdefault(review.cluster_id, review)
    return latest


def build_training_samples(
    events: list[NormalizedThermalEvent],
    reviews: list[ClusterReviewRecord],
) -> list[TrainingSample]:
    representatives = {event.id: event for event in events}
    latest_reviews = _latest_reviews(reviews)
    samples: list[TrainingSample] = []
    for cluster in build_cluster_summaries(events):
        representative = representatives[cluster.representative_event_id]
        facility = cluster.nearest_facility
        facility_type = facility.facility_type if facility else ""
        land_cover_group = (
            representative.land_cover.group if representative.land_cover else "unclassified"
        )
        brightness_i4 = representative.brightness_i4_k
        brightness_delta = representative.brightness_delta_k
        confidence_score = {
            "high": 1.0,
            "nominal": 0.7,
            "low": 0.35,
            "unknown": 0.0,
        }[representative.confidence]
        anomaly_score = representative.anomaly_score
        acquired_at = representative.acquired_at
        review = latest_reviews.get(cluster.cluster_id)
        reviewed_label = REVIEW_TO_TARGET.get(review.analyst_label) if review else None
        features = (
            math.log1p(cluster.detection_count),
            _clip(cluster.sensor_count / 3, 0, 1),
            cluster.active_days / max(1, cluster.observation_window_days),
            _clip(cluster.observation_window_days / 90, 0, 1),
            math.log1p(cluster.detection_count / max(1, cluster.active_days)),
            cluster.day_detection_ratio,
            cluster.night_detection_ratio,
            math.log1p(cluster.mean_frp_mw),
            math.log1p(cluster.median_frp_mw),
            math.log1p(cluster.max_frp_mw),
            math.log1p(cluster.latest_frp_mw),
            math.log1p(cluster.frp_mad_mw),
            _clip((anomaly_score or 0) / 10, -1, 1),
            float(anomaly_score is not None),
            float(cluster.anomaly_status == "elevated"),
            cluster.persistence_score,
            _clip(cluster.cluster_radius_m / cluster.cluster_epsilon_m, 0, 4),
            float(facility is not None),
            (
                math.log1p(min(facility.distance_m, 25_000)) / math.log1p(25_000)
                if facility
                else 1.0
            ),
            float(facility_type == "refinery"),
            float(facility_type == "flare"),
            float(facility_type.startswith("power_plant")),
            float(facility_type == "quarry"),
            float(facility_type == "steelmaking"),
            float(land_cover_group == "vegetation"),
            float(land_cover_group == "cropland"),
            float(land_cover_group == "built_up"),
            float(land_cover_group == "barren"),
            float(land_cover_group == "water"),
            float(land_cover_group == "snow_ice"),
            float(land_cover_group == "unclassified"),
            _clip(((brightness_i4 or 250) - 250) / 150, -1, 2),
            _clip((brightness_delta or 0) / 100, -2, 2),
            float(brightness_i4 is not None),
            confidence_score,
            float(representative.day_night == "D"),
            float(representative.day_night == "N"),
            math.sin(2 * math.pi * acquired_at.month / 12),
            math.cos(2 * math.pi * acquired_at.month / 12),
            math.sin(2 * math.pi * acquired_at.hour / 24),
            math.cos(2 * math.pi * acquired_at.hour / 24),
        )
        if len(features) != len(FEATURE_NAMES):
            raise RuntimeError("Feature contract length mismatch")
        samples.append(
            TrainingSample(
                cluster_id=cluster.cluster_id,
                spatial_group=_spatial_group(
                    cluster.centroid_latitude,
                    cluster.centroid_longitude,
                ),
                weak_label=cluster.category,
                reviewed_label=reviewed_label,
                features=features,
            )
        )
    return samples


def model_training_readiness(
    events: list[NormalizedThermalEvent],
    settings: Settings | None = None,
) -> ModelTrainingReadiness:
    settings = settings or get_settings()
    review_collection = cluster_review_collection(settings)
    samples = build_training_samples(events, review_collection.reviews)
    latest_reviews = _latest_reviews(review_collection.reviews)
    eligible = [sample for sample in samples if sample.reviewed_label is not None]
    reviewed_counts = Counter(sample.reviewed_label for sample in eligible)
    weak_counts = Counter(sample.weak_label for sample in samples)
    reviewed_groups_by_class: dict[str, set[str]] = {
        label: set() for label in TARGET_CLASSES
    }
    for sample in eligible:
        if sample.reviewed_label:
            reviewed_groups_by_class[sample.reviewed_label].add(sample.spatial_group)

    blockers: list[str] = []
    if len(eligible) < settings.model_min_reviewed_samples:
        blockers.append(
            f"Need {settings.model_min_reviewed_samples} eligible reviewed clusters; "
            f"currently {len(eligible)}."
        )
    for label in TARGET_CLASSES:
        label_count = reviewed_counts[label]
        if label_count < settings.model_min_samples_per_class:
            blockers.append(
                f"Class {label} needs {settings.model_min_samples_per_class} reviewed samples; "
                f"currently {label_count}."
            )
        group_count = len(reviewed_groups_by_class[label])
        if group_count < settings.model_min_spatial_groups_per_class:
            blockers.append(
                f"Class {label} needs coverage in "
                f"{settings.model_min_spatial_groups_per_class} spatial groups; "
                f"currently {group_count}."
            )

    ready = not blockers
    return ModelTrainingReadiness(
        generated_at=datetime.now(UTC),
        status=(
            "ready_for_reviewed_training"
            if ready
            else "blocked_insufficient_reviewed_labels"
        ),
        current_operational_model="rules_temporal_metric_v3",
        current_feature_version=FEATURE_VERSION,
        reviewed_records=review_collection.total,
        reviewed_clusters=len(latest_reviews),
        eligible_reviewed_samples=len(eligible),
        excluded_or_uncertain_reviews=sum(
            review.analyst_label not in REVIEW_TO_TARGET
            for review in latest_reviews.values()
        ),
        weak_label_samples=len(samples),
        reviewed_label_counts={label: reviewed_counts[label] for label in TARGET_CLASSES},
        weak_label_counts={label: weak_counts[label] for label in TARGET_CLASSES},
        reviewed_spatial_groups=len({sample.spatial_group for sample in eligible}),
        weak_label_spatial_groups=len({sample.spatial_group for sample in samples}),
        required_reviewed_samples=settings.model_min_reviewed_samples,
        required_samples_per_class=settings.model_min_samples_per_class,
        required_spatial_groups_per_class=settings.model_min_spatial_groups_per_class,
        required_classes=list(TARGET_CLASSES),
        feature_count=len(FEATURE_NAMES),
        feature_names=list(FEATURE_NAMES),
        candidate_models=["Logistic Regression", "Random Forest", "XGBoost"],
        label_policy=(
            "Only the latest eligible analyst label per cluster can train a reviewed model. "
            "Weak labels may run development benchmarks but never count as ground truth."
        ),
        split_policy=(
            "Hold out complete two-degree spatial blocks with a fixed seed; no block may "
            "appear in both training and test partitions."
        ),
        blockers=blockers,
        recommended_next_action=(
            "Run the reviewed-label training pipeline."
            if ready
            else "Collect balanced analyst labels across distinct spatial blocks in Validate."
        ),
    )


def load_model_benchmark(
    settings: Settings | None = None,
) -> ModelBenchmarkEnvelope:
    settings = settings or get_settings()
    path = settings.model_benchmark_report_file
    if not path.exists():
        return ModelBenchmarkEnvelope(
            available=False,
            status="not_run",
            message="No benchmark report is bundled; run the reproducible training command.",
        )
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return ModelBenchmarkEnvelope(
            available=False,
            status="not_run",
            message="The benchmark report is unreadable and is not used operationally.",
        )
    if not isinstance(payload, dict):
        return ModelBenchmarkEnvelope(
            available=False,
            status="not_run",
            message="The benchmark report has an invalid shape.",
        )
    label_provenance = payload.get("label_provenance")
    status = "reviewed_evaluation" if label_provenance == "analyst_reviewed" else "development_only"
    return ModelBenchmarkEnvelope(
        available=True,
        status=status,
        message=(
            "Reviewed-label evaluation report."
            if status == "reviewed_evaluation"
            else "Development-only weak-label agreement report; not a validation accuracy claim."
        ),
        report=payload,
    )
