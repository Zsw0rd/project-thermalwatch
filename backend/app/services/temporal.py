from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, datetime
from statistics import median

from app.schemas.events import (
    AnalyticsDashboard,
    DailyAnalyticsPoint,
    NormalizedThermalEvent,
    PlaybackCollection,
    PlaybackFrame,
    ThermalClusterCollection,
    ThermalClusterSummary,
)


def _window(events: list[NormalizedThermalEvent]) -> tuple[datetime, datetime, int]:
    start = min((event.acquired_at for event in events), default=datetime.now(UTC))
    end = max((event.acquired_at for event in events), default=start)
    return start, end, max(1, (end.date() - start.date()).days + 1)


def build_cluster_summaries(
    events: list[NormalizedThermalEvent],
) -> list[ThermalClusterSummary]:
    grouped: dict[str, list[NormalizedThermalEvent]] = defaultdict(list)
    for event in events:
        grouped[event.cluster_id].append(event)

    summaries: list[ThermalClusterSummary] = []
    for cluster_id, members in grouped.items():
        latest_at = max(event.acquired_at for event in members)
        latest = max(
            (event for event in members if event.acquired_at == latest_at),
            key=lambda event: event.frp_mw,
        )
        frps = [event.frp_mw for event in members]
        day_count = sum(event.day_night == "D" for event in members)
        night_count = sum(event.day_night == "N" for event in members)
        known_day_night = max(1, day_count + night_count)
        nearest = min(
            (event.nearest_facility for event in members if event.nearest_facility),
            key=lambda facility: facility.distance_m,
            default=None,
        )
        score = max(event.recurrence_score for event in members)
        active_days = max(event.active_days for event in members)
        window_days = max(event.observation_window_days for event in members)
        if window_days >= 5 and active_days >= 4 and score >= 0.65:
            persistence_label = "persistent_candidate"
        elif active_days >= 2:
            persistence_label = "recurring_candidate"
        else:
            persistence_label = "insufficient_history"

        evidence = [
            f"Observed on {active_days} of {window_days} days",
            f"{len(members)} detections from {len({event.source for event in members})} VIIRS source(s)",
            f"Median FRP {latest.baseline_frp_mw:.2f} MW; MAD {latest.frp_mad_mw:.2f} MW",
            "Persistence is an engineering score; candidate ranking does not constitute incident confirmation",
        ]
        if nearest:
            evidence.append(
                f"Nearest mapped {nearest.facility_type}: {nearest.name} at {nearest.distance_m:.0f} m"
            )
        else:
            evidence.append("No supported OSM facility found within 25 km")
        if latest.land_cover:
            evidence.append(
                "NASA MODIS IGBP land cover: "
                f"{latest.land_cover.class_label} ({latest.land_cover.observation_date}); "
                "annual context is not source confirmation"
            )

        summaries.append(
            ThermalClusterSummary(
                cluster_id=cluster_id,
                representative_event_id=latest.id,
                centroid_latitude=sum(event.latitude for event in members) / len(members),
                centroid_longitude=sum(event.longitude for event in members) / len(members),
                detection_count=len(members),
                sensor_count=len({event.source for event in members}),
                active_days=active_days,
                observation_window_days=window_days,
                first_seen=min(event.first_seen for event in members),
                last_seen=max(event.last_seen for event in members),
                day_detection_ratio=round(day_count / known_day_night, 3),
                night_detection_ratio=round(night_count / known_day_night, 3),
                mean_frp_mw=round(sum(frps) / len(frps), 2),
                median_frp_mw=round(float(median(frps)), 2),
                max_frp_mw=round(max(frps), 2),
                frp_mad_mw=latest.frp_mad_mw,
                latest_frp_mw=latest.frp_mw,
                anomaly_score=latest.anomaly_score,
                anomaly_status=latest.anomaly_status,
                persistence_score=score,
                persistence_label=persistence_label,
                classification=latest.classification,
                category=latest.category,
                nearest_facility=nearest,
                temporal_history=latest.temporal_history,
                evidence=evidence,
                data_quality=(
                    "seven_day_observation" if window_days >= 5 else "snapshot_only"
                ),
            )
        )

    return sorted(
        summaries,
        key=lambda cluster: (
            cluster.persistence_label != "persistent_candidate",
            -cluster.persistence_score,
            -cluster.max_frp_mw,
        ),
    )


def cluster_collection(
    events: list[NormalizedThermalEvent],
    *,
    limit: int = 100,
    persistence_label: str | None = None,
) -> ThermalClusterCollection:
    start, end, window_days = _window(events)
    summaries = build_cluster_summaries(events)
    if persistence_label:
        summaries = [
            cluster for cluster in summaries if cluster.persistence_label == persistence_label
        ]
    return ThermalClusterCollection(
        generated_at=datetime.now(UTC),
        observation_window_start=start,
        observation_window_end=end,
        observation_window_days=window_days,
        total=len(summaries),
        returned=min(limit, len(summaries)),
        methodology=(
            "Deterministic ~1 km cells scored from active-day frequency, detection density, "
            "spatial stability, and multi-sensor support. Elevated FRP uses a median/MAD rule."
        ),
        caveats=[
            "Seven days supports candidate ranking, not a learned long-term operating baseline.",
            "Cluster and anomaly labels are evidence-backed likelihoods, not incident confirmation.",
            "Annual MODIS IGBP land cover is contextual evidence, not source confirmation.",
        ],
        clusters=summaries[:limit],
    )


def analytics_dashboard(events: list[NormalizedThermalEvent]) -> AnalyticsDashboard:
    start, end, window_days = _window(events)
    clusters = build_cluster_summaries(events)
    categories = Counter(event.category for event in events)
    severities = Counter(event.severity for event in events)
    daily: dict[str, list[NormalizedThermalEvent]] = defaultdict(list)
    for event in events:
        daily[event.acquired_at.date().isoformat()].append(event)
    daily_activity = [
        DailyAnalyticsPoint(
            date=date,
            detections=len(members),
            mean_frp_mw=round(
                sum(event.frp_mw for event in members) / len(members),
                2,
            ),
            industrial_context_events=sum(event.category == "industrial" for event in members),
        )
        for date, members in sorted(daily.items())
    ]
    persistent = [
        cluster for cluster in clusters if cluster.persistence_label == "persistent_candidate"
    ]
    recurring = [
        cluster for cluster in clusters if cluster.persistence_label == "recurring_candidate"
    ]
    return AnalyticsDashboard(
        generated_at=datetime.now(UTC),
        observation_window_start=start,
        observation_window_end=end,
        observation_window_days=window_days,
        total_events=len(events),
        total_clusters=len(clusters),
        persistent_candidates=len(persistent),
        recurring_candidates=len(recurring),
        elevated_clusters=sum(cluster.anomaly_status == "elevated" for cluster in clusters),
        unmapped_persistent_candidates=sum(
            cluster.persistence_label == "persistent_candidate"
            and cluster.nearest_facility is None
            for cluster in clusters
        ),
        category_counts=dict(categories),
        severity_counts=dict(severities),
        daily_activity=daily_activity,
        top_persistent_sources=persistent[:12],
        methodology=(
            "Observed FIRMS/OSM seven-day evidence with deterministic persistence and robust "
            "median/MAD anomaly features; no trained ML or land-cover evidence is claimed."
        ),
    )


def playback_collection(events: list[NormalizedThermalEvent]) -> PlaybackCollection:
    start, end, _ = _window(events)
    daily: dict[str, list[NormalizedThermalEvent]] = defaultdict(list)
    first_date_by_cluster: dict[str, str] = {}
    for event in events:
        date = event.acquired_at.date().isoformat()
        daily[date].append(event)
        current = first_date_by_cluster.get(event.cluster_id)
        if current is None or date < current:
            first_date_by_cluster[event.cluster_id] = date

    observed_dates_by_cluster: dict[str, set[str]] = defaultdict(set)
    frames: list[PlaybackFrame] = []
    for date, members in sorted(daily.items()):
        for event in members:
            observed_dates_by_cluster[event.cluster_id].add(date)
        frames.append(
            PlaybackFrame(
                date=date,
                detection_count=len(members),
                cluster_count=len({event.cluster_id for event in members}),
                new_cluster_count=len(
                    {
                        event.cluster_id
                        for event in members
                        if first_date_by_cluster[event.cluster_id] == date
                    }
                ),
                active_persistent_cells=sum(
                    len(observed_dates) >= 4
                    for observed_dates in observed_dates_by_cluster.values()
                ),
                high_frp_count=sum(event.frp_mw >= 20 for event in members),
                mean_frp_mw=round(
                    sum(event.frp_mw for event in members) / len(members),
                    2,
                ),
                event_ids=[event.id for event in members],
            )
        )
    return PlaybackCollection(
        generated_at=datetime.now(UTC),
        observation_window_start=start,
        observation_window_end=end,
        total_events=len(events),
        methodology=(
            "Each frame contains FIRMS observations acquired on one UTC calendar date. "
            "Persistent-cell counts are calculated cumulatively using four observed dates."
        ),
        caveats=[
            "A seven-day rolling feed may touch eight partial UTC calendar dates.",
            "Playback shows observation timing, not fire spread or confirmed incident evolution.",
            "Approximate one-kilometre cell recurrence is an engineering heuristic.",
        ],
        frames=frames,
    )
