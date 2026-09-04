from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from datetime import UTC, datetime
from itertools import pairwise

from app.schemas.events import (
    EventCategory,
    NormalizedThermalEvent,
    ThermalSourceFingerprint,
    ThermalSourceFingerprintCollection,
)
from app.services.temporal import build_cluster_summaries

FINGERPRINT_FEATURE_VERSION = "thermal_source_fingerprint_v1"
DISCOVERY_PRIORITY_THRESHOLD = 0.65


def _percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * fraction
    lower = int(position)
    upper = min(len(ordered) - 1, lower + 1)
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def build_source_fingerprints(
    events: list[NormalizedThermalEvent],
) -> list[ThermalSourceFingerprint]:
    members_by_cluster: dict[str, list[NormalizedThermalEvent]] = defaultdict(list)
    for event in events:
        members_by_cluster[event.cluster_id].append(event)
    summaries = build_cluster_summaries(events)
    fingerprints: list[ThermalSourceFingerprint] = []
    for cluster in summaries:
        members = members_by_cluster[cluster.cluster_id]
        representative = next(
            event for event in members if event.id == cluster.representative_event_id
        )
        dates = sorted({event.acquired_at.date() for event in members})
        gaps = [
            (right - left).days
            for left, right in pairwise(dates)
        ]
        hours = Counter(event.acquired_at.hour for event in members)
        typical_hours = [hour for hour, _ in hours.most_common(3)]
        frps = [event.frp_mw for event in members]
        spatial_stability = max(0.0, min(1.0, 1 - cluster.cluster_radius_m / 1_500))
        profile_completeness = min(
            1.0,
            0.55 * min(1.0, cluster.active_days / 30)
            + 0.20 * min(1.0, cluster.sensor_count / 3)
            + 0.25 * min(1.0, cluster.detection_count / 20),
        )
        if cluster.observation_window_days >= 90:
            maturity = "seasonal_candidate"
        elif cluster.observation_window_days >= 30:
            maturity = "thirty_day_candidate"
        elif cluster.observation_window_days >= 5:
            maturity = "short_window"
        else:
            maturity = "snapshot_only"
        if cluster.category == "industrial":
            source_context = "mapped_industrial"
        elif cluster.category in {"vegetation", "agricultural"}:
            source_context = "land_cover_context"
        else:
            source_context = "unresolved"
        discovery_priority = (
            min(
                1.0,
                0.40 * cluster.persistence_score
                + 0.20 * min(1.0, cluster.active_days / 8)
                + 0.15 * min(1.0, cluster.sensor_count / 3)
                + 0.15 * spatial_stability
                + 0.10 * min(1.0, cluster.max_frp_mw / 50),
            )
            if cluster.category == "unknown"
            else 0.0
        )
        discovery_status = (
            "priority_unknown"
            if cluster.category == "unknown"
            and discovery_priority >= DISCOVERY_PRIORITY_THRESHOLD
            else "watch_unknown"
            if cluster.category == "unknown"
            else "contextualized_source"
        )
        fingerprint_material = "|".join(
            [FINGERPRINT_FEATURE_VERSION, *sorted(event.id for event in members)]
        )
        evidence = [
            f"Observed on {cluster.active_days}/{cluster.observation_window_days} UTC dates",
            f"{cluster.detection_count} detections across {cluster.sensor_count} VIIRS feeds",
            f"Median / P90 / maximum FRP: {cluster.median_frp_mw:.2f} / {_percentile(frps, 0.9):.2f} / {cluster.max_frp_mw:.2f} MW",
            f"Spatial radius {cluster.cluster_radius_m:.0f} m; engineered stability {spatial_stability:.2f}",
        ]
        if cluster.nearest_facility:
            evidence.append(
                f"Nearest mapped facility: {cluster.nearest_facility.name} at {cluster.nearest_facility.distance_m:.0f} m"
            )
        else:
            evidence.append("No supported OSM facility was found within 25 km")
        if representative.land_cover:
            evidence.append(
                f"Annual MODIS IGBP context: {representative.land_cover.class_label}"
            )
        fingerprints.append(
            ThermalSourceFingerprint(
                fingerprint_id=f"FP-{hashlib.sha256(fingerprint_material.encode()).hexdigest()[:12].upper()}",
                cluster_id=cluster.cluster_id,
                representative_event_id=cluster.representative_event_id,
                centroid_latitude=cluster.centroid_latitude,
                centroid_longitude=cluster.centroid_longitude,
                category=cluster.category,
                classification=cluster.classification,
                source_context=source_context,
                detection_count=cluster.detection_count,
                sensor_count=cluster.sensor_count,
                active_days=cluster.active_days,
                observation_window_days=cluster.observation_window_days,
                observation_dates=[date.isoformat() for date in dates],
                mean_gap_days=(round(float(sum(gaps) / len(gaps)), 2) if gaps else None),
                typical_utc_hours=typical_hours,
                day_detection_ratio=cluster.day_detection_ratio,
                night_detection_ratio=cluster.night_detection_ratio,
                median_frp_mw=cluster.median_frp_mw,
                p90_frp_mw=round(_percentile(frps, 0.9), 2),
                maximum_frp_mw=cluster.max_frp_mw,
                frp_mad_mw=cluster.frp_mad_mw,
                spatial_radius_m=cluster.cluster_radius_m,
                spatial_stability=round(spatial_stability, 3),
                recurrence_score=cluster.persistence_score,
                profile_completeness=round(profile_completeness, 3),
                baseline_maturity=maturity,
                nearest_facility_name=(
                    cluster.nearest_facility.name if cluster.nearest_facility else None
                ),
                nearest_facility_distance_m=(
                    cluster.nearest_facility.distance_m
                    if cluster.nearest_facility
                    else None
                ),
                land_cover_label=(
                    representative.land_cover.class_label
                    if representative.land_cover
                    else None
                ),
                discovery_priority=round(discovery_priority, 3),
                discovery_status=discovery_status,
                evidence=evidence,
                limitation=(
                    "Fingerprint values summarize the retained observation window only. "
                    "They do not identify a physical source or confirm an incident."
                ),
            )
        )
    return sorted(
        fingerprints,
        key=lambda fingerprint: (
            fingerprint.discovery_status != "priority_unknown",
            fingerprint.discovery_status != "watch_unknown",
            -fingerprint.discovery_priority,
            -fingerprint.recurrence_score,
        ),
    )


def source_fingerprint_collection(
    events: list[NormalizedThermalEvent],
    *,
    category: EventCategory | None = None,
    discoveries_only: bool = False,
    limit: int = 100,
) -> ThermalSourceFingerprintCollection:
    fingerprints = build_source_fingerprints(events)
    if category:
        fingerprints = [item for item in fingerprints if item.category == category]
    if discoveries_only:
        fingerprints = [item for item in fingerprints if item.source_context == "unresolved"]
    return ThermalSourceFingerprintCollection(
        generated_at=datetime.now(UTC),
        total=len(fingerprints),
        returned=min(limit, len(fingerprints)),
        feature_version=FINGERPRINT_FEATURE_VERSION,
        methodology=(
            "Observed-window fingerprint combines FRP distribution, UTC timing, recurrence, "
            "sensor support, spatial stability, OSM context, and annual MODIS context. "
            "Unknown-source priority is an explainable review score, not a source identity."
        ),
        fingerprints=fingerprints[:limit],
    )
