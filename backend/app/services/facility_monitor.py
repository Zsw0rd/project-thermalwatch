from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import UTC, datetime
from statistics import median

from app.schemas.events import NormalizedThermalEvent
from app.schemas.facilities import (
    FacilityMonitorCollection,
    FacilityMonitorSummary,
    FacilityThermalDay,
    IndustrialFacility,
)
from app.services.firms import alert_previews


def _monitor_id(osm_id: str) -> str:
    return f"FM-{hashlib.sha256(osm_id.encode('utf-8')).hexdigest()[:12].upper()}"


def build_facility_monitors(
    events: list[NormalizedThermalEvent],
    facilities: list[IndustrialFacility],
) -> list[FacilityMonitorSummary]:
    facility_by_id = {facility.osm_id: facility for facility in facilities}
    grouped: dict[str, list[NormalizedThermalEvent]] = defaultdict(list)
    for event in events:
        if event.category == "industrial" and event.nearest_facility:
            grouped[event.nearest_facility.osm_id].append(event)

    alerted_clusters = {alert.cluster_id for alert in alert_previews(events).alerts}
    monitors: list[FacilityMonitorSummary] = []
    for osm_id, members in grouped.items():
        facility = facility_by_id.get(osm_id)
        if facility is None:
            continue
        latest_time = max(event.acquired_at for event in members)
        latest = max(
            (event for event in members if event.acquired_at == latest_time),
            key=lambda event: event.frp_mw,
        )
        dates = {event.acquired_at.date() for event in members}
        frps = [event.frp_mw for event in members]
        clusters = {event.cluster_id for event in members}
        score = max(event.recurrence_score for event in members)
        if any(event.anomaly_status == "elevated" for event in members):
            anomaly_status = "elevated"
            operating_status = "elevated_observed_frp"
        elif len(dates) >= 4 and score >= 0.65:
            anomaly_status = "within_observed_range"
            operating_status = "persistent_observed_heat"
        elif len(dates) >= 2:
            anomaly_status = "insufficient_baseline"
            operating_status = "recent_thermal_activity"
        else:
            anomaly_status = "insufficient_baseline"
            operating_status = "insufficient_history"

        daily: dict[str, list[float]] = defaultdict(list)
        for event in members:
            daily[event.acquired_at.date().isoformat()].append(event.frp_mw)
        history = [
            FacilityThermalDay(
                date=date,
                detection_count=len(values),
                mean_frp_mw=round(sum(values) / len(values), 2),
                max_frp_mw=round(max(values), 2),
            )
            for date, values in sorted(daily.items())
        ]
        monitor_alerts = len(clusters & alerted_clusters)
        monitors.append(
            FacilityMonitorSummary(
                monitor_id=_monitor_id(osm_id),
                facility=facility,
                representative_event_id=latest.id,
                observed_detections=len(members),
                cluster_count=len(clusters),
                sensor_count=len({event.source for event in members}),
                active_days=len(dates),
                observation_window_days=max(
                    event.observation_window_days for event in members
                ),
                first_seen=min(event.acquired_at for event in members),
                last_seen=latest_time,
                median_frp_mw=round(float(median(frps)), 2),
                maximum_frp_mw=round(max(frps), 2),
                latest_frp_mw=round(latest.frp_mw, 2),
                persistence_score=score,
                anomaly_status=anomaly_status,
                operating_status=operating_status,
                alert_count=monitor_alerts,
                history=history,
                evidence=[
                    f"{len(members)} FIRMS observations across {len(dates)} active date(s)",
                    f"{len(clusters)} approximate thermal cell(s) linked by nearest OSM context",
                    f"Median observed FRP {median(frps):.2f} MW; maximum {max(frps):.2f} MW",
                    f"{len({event.source for event in members})} VIIRS source(s)",
                ],
                caveat=(
                    "Facility association uses nearest mapped OSM context within conservative "
                    "thresholds; it does not establish ownership, causation, or an incident."
                ),
            )
        )

    status_priority = {
        "elevated_observed_frp": 0,
        "persistent_observed_heat": 1,
        "recent_thermal_activity": 2,
        "insufficient_history": 3,
    }
    return sorted(
        monitors,
        key=lambda monitor: (
            status_priority[monitor.operating_status],
            -monitor.alert_count,
            -monitor.persistence_score,
            -monitor.maximum_frp_mw,
        ),
    )


def facility_monitor_collection(
    events: list[NormalizedThermalEvent],
    facilities: list[IndustrialFacility],
    *,
    limit: int = 100,
) -> FacilityMonitorCollection:
    monitors = build_facility_monitors(events, facilities)
    window_days = max(
        (event.observation_window_days for event in events),
        default=1,
    )
    return FacilityMonitorCollection(
        generated_at=datetime.now(UTC),
        observation_window_days=window_days,
        total=len(monitors),
        returned=min(limit, len(monitors)),
        source="NASA FIRMS observations with OpenStreetMap nearest-facility context",
        methodology=(
            "Facilities are ranked from attributed FIRMS observations that meet the existing "
            "conservative industrial-context distance rule. Status describes observed evidence."
        ),
        monitors=monitors[:limit],
    )
