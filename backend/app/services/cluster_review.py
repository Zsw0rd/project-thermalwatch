from __future__ import annotations

import hashlib
import json
import tempfile
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

from pydantic import ValidationError

from app.config import Settings, get_settings
from app.schemas.events import (
    ClusterReviewCollection,
    ClusterReviewRecord,
    ClusterReviewUpdate,
    NormalizedThermalEvent,
    ThermalClusterSummary,
)

_review_lock = Lock()


def _read_records(path: Path) -> list[ClusterReviewRecord]:
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return []
    if not isinstance(payload, list):
        return []
    records: list[ClusterReviewRecord] = []
    for item in payload:
        try:
            records.append(ClusterReviewRecord.model_validate(item))
        except ValidationError:
            continue
    return records


def _write_records(path: Path, records: list[ClusterReviewRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        delete=False,
        suffix=".json",
    ) as temporary:
        json.dump(
            [record.model_dump(mode="json") for record in records],
            temporary,
            ensure_ascii=False,
            indent=2,
        )
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)


def cluster_review_collection(
    settings: Settings | None = None,
) -> ClusterReviewCollection:
    settings = settings or get_settings()
    with _review_lock:
        reviews = _read_records(settings.cluster_review_file)
    reviews.sort(key=lambda review: review.reviewed_at, reverse=True)
    return ClusterReviewCollection(
        generated_at=datetime.now(UTC),
        total=len(reviews),
        unique_reviewed_clusters=len({review.cluster_id for review in reviews}),
        label_counts=dict(Counter(review.analyst_label for review in reviews)),
        methodology=(
            "Append-only analyst context labels snapshot the evidence visible at review time. "
            "They form a local validation set and never assert incident confirmation."
        ),
        reviews=reviews,
    )


def create_cluster_review(
    cluster: ThermalClusterSummary,
    representative: NormalizedThermalEvent,
    update: ClusterReviewUpdate,
    settings: Settings | None = None,
) -> ClusterReviewRecord:
    settings = settings or get_settings()
    reviewed_at = datetime.now(UTC)
    fingerprint = (
        f"{cluster.cluster_id}|{reviewed_at.isoformat()}|{update.reviewed_by}|{update.label}"
    )
    nearest_facility: dict[str, Any] | None = None
    if cluster.nearest_facility:
        nearest_facility = cluster.nearest_facility.model_dump(mode="json")
    land_cover: dict[str, Any] | None = None
    if representative.land_cover:
        land_cover = representative.land_cover.model_dump(mode="json")
    record = ClusterReviewRecord(
        review_id=hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:24],
        cluster_id=cluster.cluster_id,
        representative_event_id=cluster.representative_event_id,
        proposed_category=cluster.category,
        proposed_classification=cluster.classification,
        analyst_label=update.label,
        note=update.note.strip() if update.note and update.note.strip() else None,
        reviewed_by=update.reviewed_by,
        reviewed_at=reviewed_at,
        evidence_snapshot={
            "centroid": [cluster.centroid_longitude, cluster.centroid_latitude],
            "detection_count": cluster.detection_count,
            "sensor_count": cluster.sensor_count,
            "active_days": cluster.active_days,
            "observation_window_days": cluster.observation_window_days,
            "cluster_method": cluster.cluster_method,
            "cluster_radius_m": cluster.cluster_radius_m,
            "cluster_epsilon_m": cluster.cluster_epsilon_m,
            "density_role_counts": cluster.density_role_counts,
            "persistence_score": cluster.persistence_score,
            "persistence_label": cluster.persistence_label,
            "anomaly_status": cluster.anomaly_status,
            "median_frp_mw": cluster.median_frp_mw,
            "max_frp_mw": cluster.max_frp_mw,
            "nearest_facility": nearest_facility,
            "land_cover": land_cover,
            "source_attribution": representative.source_attribution.model_dump(mode="json"),
            "temporal_history": [
                point.model_dump(mode="json") for point in cluster.temporal_history
            ],
        },
        model_version=representative.model_version,
        feature_version=representative.feature_version,
    )
    with _review_lock:
        records = _read_records(settings.cluster_review_file)
        records.append(record)
        _write_records(settings.cluster_review_file, records)
    return record
