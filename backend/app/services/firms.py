from __future__ import annotations

import csv
import hashlib
import math
import shutil
import tempfile
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.config import Settings, get_settings
from app.schemas.events import (
    AlertCollection,
    AlertPreview,
    AnalyticsSummary,
    ConfidenceLabel,
    NormalizedThermalEvent,
    RefreshResponse,
    SourceAttribution,
)
from app.services.osm import build_facility_index, load_facilities, nearest_facility

PUBLIC_FEEDS: dict[str, tuple[str, str]] = {
    "J1_VIIRS_C2_South_Asia_24h.csv": (
        "VIIRS_NOAA20_NRT",
        (
            "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
            "noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv"
        ),
    ),
    "J2_VIIRS_C2_South_Asia_24h.csv": (
        "VIIRS_NOAA21_NRT",
        (
            "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
            "noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_24h.csv"
        ),
    ),
    "SUOMI_VIIRS_C2_South_Asia_24h.csv": (
        "VIIRS_SNPP_NRT",
        (
            "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
            "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv"
        ),
    ),
}

_events_cache: list[NormalizedThermalEvent] | None = None
_cache_signature: tuple[tuple[str, int, int], ...] | None = None
_cache_lock = Lock()


def _safe_float(value: str | None) -> float | None:
    if value is None or not value.strip():
        return None
    try:
        number = float(value)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def _confidence(value: str | None) -> ConfidenceLabel:
    normalized = (value or "").strip().lower()
    if normalized in {"l", "low"}:
        return "low"
    if normalized in {"n", "nominal"}:
        return "nominal"
    if normalized in {"h", "high"}:
        return "high"
    return "unknown"


def _parse_acquired_at(date_value: str, time_value: str) -> datetime:
    padded_time = time_value.strip().zfill(4)
    return datetime.strptime(f"{date_value.strip()} {padded_time}", "%Y-%m-%d %H%M").replace(
        tzinfo=UTC
    )


def _event_hash(source: str, satellite: str, acquired_at: datetime, lat: float, lon: float) -> str:
    fingerprint = f"{source}|{satellite}|{acquired_at.isoformat()}|{lat:.5f}|{lon:.5f}"
    return hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()


def _cluster_key(lat: float, lon: float) -> str:
    # A deterministic ~1 km grid is an MVP grouping heuristic, not DBSCAN.
    return f"{round(lat, 2):.2f}:{round(lon, 2):.2f}"


def _cluster_id(key: str) -> str:
    return f"TS-{hashlib.sha1(key.encode('utf-8')).hexdigest()[:10].upper()}"


def _severity(frp: float, confidence: ConfidenceLabel) -> str:
    if frp >= 50 and confidence == "high":
        return "critical"
    if frp >= 20:
        return "high"
    if frp >= 8:
        return "medium"
    return "low"


def alert_previews(events: list[NormalizedThermalEvent]) -> AlertCollection:
    """Create a deterministic review queue; alerts are not incident confirmations."""
    clusters: dict[str, list[NormalizedThermalEvent]] = defaultdict(list)
    for event in events:
        clusters[event.cluster_id].append(event)

    alerts: list[AlertPreview] = []
    for cluster_id, members in clusters.items():
        representative = max(members, key=lambda event: event.frp_mw)
        industrial_member = next(
            (event for event in members if event.category == "industrial"),
            None,
        )
        max_frp = representative.frp_mw
        sensor_count = max(event.cluster_sensor_count for event in members)

        if industrial_member is not None and max_frp >= 20:
            alert_type = "industrial_context_high_frp"
            title = "High-FRP anomaly near mapped industrial context"
            reason = (
                "Thermal intensity exceeded the review threshold and at least one "
                "co-located detection is near a supported OSM industrial feature."
            )
        elif sensor_count >= 2 and max_frp >= 20:
            alert_type = "multi_sensor_high_frp"
            title = "High-FRP anomaly observed by multiple VIIRS sources"
            reason = (
                "Thermal intensity exceeded the review threshold and the grid cell "
                "contains observations from multiple VIIRS feeds."
            )
        elif max_frp >= 50:
            alert_type = "high_frp_thermal_anomaly"
            title = "Very high-FRP thermal anomaly"
            reason = "Thermal intensity exceeded the 50 MW review threshold."
        else:
            continue

        fingerprint = f"{cluster_id}|{alert_type}|{representative.acquired_at.isoformat()}"
        alerts.append(
            AlertPreview(
                id=hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:24],
                event_id=representative.id,
                cluster_id=cluster_id,
                alert_type=alert_type,
                severity="critical" if max_frp >= 50 else "high",
                title=title,
                reason=reason,
                acquired_at=representative.acquired_at,
                latitude=representative.latitude,
                longitude=representative.longitude,
                frp_mw=max_frp,
                evidence=[
                    f"Maximum cluster FRP: {max_frp:.2f} MW",
                    f"VIIRS sources in grid cell: {sensor_count}",
                    representative.classification,
                    "Alert is a deterministic triage rule, not an incident confirmation",
                ],
                source_attribution=representative.source_attribution,
            )
        )

    alerts.sort(key=lambda alert: (alert.severity != "critical", -alert.frp_mw))
    return AlertCollection(
        generated_at=datetime.now(UTC),
        total=len(alerts),
        methodology=(
            "One review item per ~1 km grid cell. Rules use FRP, multi-source "
            "co-observation, and conservative OSM proximity; no alert confirms a fire."
        ),
        alerts=alerts,
    )


def _active_files(settings: Settings) -> list[Path]:
    cache_files = sorted(settings.firms_cache_dir.glob("*.csv"))
    if cache_files:
        return cache_files
    return sorted(settings.firms_sample_dir.glob("*.csv"))


def _file_source(path: Path, settings: Settings) -> tuple[str, str]:
    if path.name in PUBLIC_FEEDS:
        return PUBLIC_FEEDS[path.name]
    if path.name.startswith("AREA_"):
        source = path.stem.removeprefix("AREA_")
        west, south, east, north = settings.india_bbox
        safe_key = "<MAP_KEY>"
        url = (
            "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
            f"{safe_key}/{quote(source)}/{west},{south},{east},{north}/{settings.firms_day_range}"
        )
        return source, url
    return "VIIRS_UNKNOWN", "local-firms-csv"


def _signature(files: list[Path]) -> tuple[tuple[str, int, int], ...]:
    return tuple(
        (str(path.resolve()), path.stat().st_mtime_ns, path.stat().st_size) for path in files
    )


def _read_raw_events(settings: Settings) -> list[dict[str, object]]:
    west, south, east, north = settings.india_bbox
    rows: list[dict[str, object]] = []

    for path in _active_files(settings):
        source, source_url = _file_source(path, settings)
        retrieved_at = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            for raw in csv.DictReader(handle):
                lat = _safe_float(raw.get("latitude"))
                lon = _safe_float(raw.get("longitude"))
                frp = _safe_float(raw.get("frp"))
                if lat is None or lon is None or frp is None:
                    continue
                if not (west <= lon <= east and south <= lat <= north):
                    continue
                try:
                    acquired_at = _parse_acquired_at(
                        raw.get("acq_date", ""), raw.get("acq_time", "")
                    )
                except ValueError:
                    continue

                satellite = raw.get("satellite", "unknown").strip() or "unknown"
                brightness_i4 = _safe_float(raw.get("bright_ti4") or raw.get("brightness"))
                brightness_i5 = _safe_float(raw.get("bright_ti5") or raw.get("bright_t31"))
                event_id = _event_hash(source, satellite, acquired_at, lat, lon)
                rows.append(
                    {
                        "id": event_id,
                        "source": source,
                        "source_url": source_url,
                        "retrieved_at": retrieved_at,
                        "latitude": lat,
                        "longitude": lon,
                        "acquired_at": acquired_at,
                        "satellite": satellite,
                        "confidence": _confidence(raw.get("confidence")),
                        "frp_mw": max(frp, 0),
                        "brightness_i4_k": brightness_i4,
                        "brightness_i5_k": brightness_i5,
                        "brightness_delta_k": (
                            brightness_i4 - brightness_i5
                            if brightness_i4 is not None and brightness_i5 is not None
                            else None
                        ),
                        "scan_km": _safe_float(raw.get("scan")),
                        "track_km": _safe_float(raw.get("track")),
                        "day_night": raw.get("daynight", "U")
                        if raw.get("daynight") in {"D", "N"}
                        else "U",
                        "cluster_key": _cluster_key(lat, lon),
                        "raw_payload": {
                            str(key): str(value) for key, value in raw.items() if key is not None
                        },
                    }
                )

    # A UNIQUE constraint will enforce this in PostGIS; the in-memory repository mirrors it now.
    return list({str(row["id"]): row for row in rows}.values())


def _build_events(settings: Settings) -> list[NormalizedThermalEvent]:
    raw_events = _read_raw_events(settings)
    facilities = load_facilities(settings)
    facility_index = build_facility_index(facilities)
    clusters: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in raw_events:
        clusters[str(row["cluster_key"])].append(row)

    events: list[NormalizedThermalEvent] = []
    confidence_scores = {"high": 0.9, "nominal": 0.72, "low": 0.45, "unknown": 0.35}

    for row in raw_events:
        cluster = clusters[str(row["cluster_key"])]
        sensor_count = len({str(item["source"]) for item in cluster})
        detection_count = len(cluster)
        recurrence_score = min(
            1.0,
            min(detection_count - 1, 4) / 8 + min(sensor_count - 1, 2) / 4,
        )
        confidence = str(row["confidence"])
        base_confidence = confidence_scores.get(confidence, 0.35)
        facility_context = nearest_facility(
            float(row["latitude"]),
            float(row["longitude"]),
            facilities,
            facility_index=facility_index,
        )
        industrial_threshold_m = None
        if facility_context:
            industrial_threshold_m = (
                3_000
                if facility_context.facility_type in {"refinery", "flare", "steelmaking"}
                else 2_000
            )

        if (
            facility_context
            and industrial_threshold_m is not None
            and facility_context.distance_m <= industrial_threshold_m
        ):
            classification = "Thermal anomaly near mapped industrial facility"
            classification_confidence = min(0.94, base_confidence + 0.14)
            category = "industrial"
        elif sensor_count >= 2:
            classification = "Multi-sensor thermal anomaly"
            classification_confidence = min(0.95, base_confidence + 0.12)
            category = "unknown"
        elif detection_count >= 3:
            classification = "Repeated thermal anomaly (24 h)"
            classification_confidence = min(0.88, base_confidence + 0.08)
            category = "unknown"
        else:
            classification = "Unclassified thermal anomaly"
            classification_confidence = base_confidence
            category = "unknown"

        explanation = [
            f"NASA FIRMS confidence: {confidence}",
            f"FRP: {float(row['frp_mw']):.2f} MW",
            f"{detection_count} detection(s) in the same ~1 km grid cell",
            f"Observed by {sensor_count} VIIRS source(s) in this snapshot",
        ]
        if facility_context:
            explanation.append(
                f"Nearest mapped {facility_context.facility_type}: "
                f"{facility_context.name} at {facility_context.distance_m:.0f} m"
            )
        else:
            explanation.append("No supported OSM facility found within 25 km")
        explanation.append("Land-cover context has not yet been applied")

        events.append(
            NormalizedThermalEvent(
                id=str(row["id"]),
                source=str(row["source"]),
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                acquired_at=row["acquired_at"],
                satellite=str(row["satellite"]),
                confidence=row["confidence"],
                frp_mw=float(row["frp_mw"]),
                brightness_i4_k=row["brightness_i4_k"],
                brightness_i5_k=row["brightness_i5_k"],
                brightness_delta_k=row["brightness_delta_k"],
                scan_km=row["scan_km"],
                track_km=row["track_km"],
                day_night=row["day_night"],
                cluster_id=_cluster_id(str(row["cluster_key"])),
                cluster_detection_count=detection_count,
                cluster_sensor_count=sensor_count,
                recurrence_score=round(recurrence_score, 3),
                category=category,
                classification=classification,
                classification_confidence=round(classification_confidence, 3),
                severity=_severity(float(row["frp_mw"]), row["confidence"]),
                explanation=explanation,
                context_status=(
                    "FIRMS_AND_OSM_PROXIMITY_NO_LAND_COVER"
                    if facilities
                    else "FIRMS_ONLY_NO_OSM_OR_LAND_COVER"
                ),
                nearest_facility=facility_context,
                source_attribution=SourceAttribution(
                    provider="NASA FIRMS",
                    product=str(row["source"]),
                    source_url=str(row["source_url"]),
                    acquired_at=row["acquired_at"],
                    retrieved_at=row["retrieved_at"],
                ),
                raw_payload=row["raw_payload"],
            )
        )

    return sorted(events, key=lambda event: event.acquired_at, reverse=True)


def load_events(settings: Settings | None = None) -> list[NormalizedThermalEvent]:
    global _cache_signature, _events_cache
    settings = settings or get_settings()
    files = _active_files(settings)
    current_signature = _signature(files)
    with _cache_lock:
        if _events_cache is None or _cache_signature != current_signature:
            _events_cache = _build_events(settings)
            _cache_signature = current_signature
        return list(_events_cache)


def invalidate_event_cache() -> None:
    global _cache_signature, _events_cache
    with _cache_lock:
        _events_cache = None
        _cache_signature = None


def _download(url: str, destination: Path, timeout: int) -> None:
    request = Request(url, headers={"User-Agent": "ThermalWatch-AI/0.1 NASA-FIRMS-client"})
    destination.parent.mkdir(parents=True, exist_ok=True)
    with (
        urlopen(request, timeout=timeout) as response,
        tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary,
    ):
        shutil.copyfileobj(response, temporary)
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)


def refresh_source_files(settings: Settings | None = None) -> RefreshResponse:
    settings = settings or get_settings()
    settings.firms_cache_dir.mkdir(parents=True, exist_ok=True)
    downloaded: list[str] = []

    if settings.firms_map_key:
        west, south, east, north = settings.india_bbox
        source = settings.firms_source
        url = (
            "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
            f"{quote(settings.firms_map_key)}/{quote(source)}/"
            f"{west},{south},{east},{north}/{settings.firms_day_range}"
        )
        filename = f"AREA_{source}.csv"
        _download(url, settings.firms_cache_dir / filename, settings.firms_request_timeout_seconds)
        downloaded.append(filename)
    else:
        for filename, (_, url) in PUBLIC_FEEDS.items():
            _download(
                url,
                settings.firms_cache_dir / filename,
                settings.firms_request_timeout_seconds,
            )
            downloaded.append(filename)

    invalidate_event_cache()
    events = load_events(settings)
    refreshed_at = datetime.now(UTC)
    return RefreshResponse(
        refreshed_at=refreshed_at,
        files=downloaded,
        normalized_events=len(events),
        message=(
            "Refreshed from the authenticated FIRMS Area API."
            if settings.firms_map_key
            else "Refreshed from official public NASA FIRMS South Asia 24-hour feeds."
        ),
    )


def analytics_summary(events: list[NormalizedThermalEvent]) -> AnalyticsSummary:
    sensor_counts = Counter(event.source for event in events)
    confidence_counts = Counter(event.confidence for event in events)
    cluster_sensors: dict[str, set[str]] = defaultdict(set)
    for event in events:
        cluster_sensors[event.cluster_id].add(event.source)
    frps = [event.frp_mw for event in events]
    latest_source_time = max(
        (event.source_attribution.retrieved_at for event in events),
        default=datetime.now(UTC),
    )
    return AnalyticsSummary(
        generated_at=datetime.now(UTC),
        total_events=len(events),
        high_confidence_events=sum(event.confidence == "high" for event in events),
        nighttime_events=sum(event.day_night == "N" for event in events),
        multi_sensor_clusters=sum(len(sources) >= 2 for sources in cluster_sensors.values()),
        mean_frp_mw=round(sum(frps) / len(frps), 2) if frps else 0,
        max_frp_mw=round(max(frps), 2) if frps else 0,
        sensor_counts=dict(sensor_counts),
        confidence_counts=dict(confidence_counts),
        source_updated_at=latest_source_time,
    )
