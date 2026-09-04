from __future__ import annotations

import csv
import hashlib
import math
import shutil
import tempfile
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from statistics import median
from threading import Lock
from urllib.parse import quote
from urllib.request import Request, urlopen

from app.config import Settings, get_settings
from app.schemas.events import (
    AlertCollection,
    AlertPreview,
    AnalyticsSummary,
    ConfidenceLabel,
    LandCoverContext,
    NormalizedThermalEvent,
    RefreshResponse,
    SourceAttribution,
    TemporalHistoryPoint,
)
from app.services.boundary import (
    administrative_area_context,
    contains_point,
    load_india_boundary,
)
from app.services.history_archive import archive_source_files
from app.services.land_cover import (
    land_cover_cell_key,
    land_cover_source_path,
    load_land_cover_contexts,
)
from app.services.osm import build_facility_index, load_facilities, nearest_facility
from app.services.spatial_clustering import (
    CLUSTER_METHOD,
    SpatialObservation,
    cluster_observations,
    haversine_m,
)

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
    "J1_VIIRS_C2_South_Asia_7d.csv": (
        "VIIRS_NOAA20_NRT",
        (
            "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
            "noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv"
        ),
    ),
    "J2_VIIRS_C2_South_Asia_7d.csv": (
        "VIIRS_NOAA21_NRT",
        (
            "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
            "noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_7d.csv"
        ),
    ),
    "SUOMI_VIIRS_C2_South_Asia_7d.csv": (
        "VIIRS_SNPP_NRT",
        (
            "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
            "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv"
        ),
    ),
}

PUBLIC_REFRESH_FILES = (
    "J1_VIIRS_C2_South_Asia_7d.csv",
    "J2_VIIRS_C2_South_Asia_7d.csv",
    "SUOMI_VIIRS_C2_South_Asia_7d.csv",
)

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

        elevated_industrial = next(
            (
                event
                for event in members
                if event.category == "industrial" and event.anomaly_status == "elevated"
            ),
            None,
        )
        persistent_unknown = next(
            (
                event
                for event in members
                if event.category == "unknown"
                and event.active_days >= 4
                and event.recurrence_score >= 0.72
                and event.nearest_facility is None
            ),
            None,
        )

        if elevated_industrial is not None:
            representative = elevated_industrial
            max_frp = representative.frp_mw
            alert_type = "elevated_industrial_baseline"
            title = "Industrial-context source above observed FRP baseline"
            reason = (
                "A thermal anomaly near mapped industrial context exceeded the robust "
                "seven-day median/MAD review threshold."
            )
        elif persistent_unknown is not None:
            representative = persistent_unknown
            max_frp = representative.frp_mw
            alert_type = "persistent_unknown_source"
            title = "Persistent thermal source without mapped industrial explanation"
            reason = (
                "A spatially stable thermal cell recurred on at least four observed days "
                "without a supported OSM facility match."
            )
        elif industrial_member is not None and max_frp >= 20:
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
                "Thermal intensity exceeded the review threshold and the metric cluster "
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
                    f"VIIRS sources in metric cluster: {sensor_count}",
                    f"Active days: {representative.active_days} / {representative.observation_window_days}",
                    f"Observed median FRP: {representative.baseline_frp_mw:.2f} MW",
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
            "One review item per 750 m Haversine DBSCAN cluster. Rules use FRP, short-window recurrence, "
            "robust median/MAD deviation, multi-source co-observation, and conservative "
            "OSM proximity; no alert confirms a fire."
        ),
        alerts=alerts,
    )


def current_source_files(settings: Settings) -> list[Path]:
    cache_files = sorted(settings.firms_cache_dir.glob("*.csv"))
    if cache_files:
        return cache_files
    return sorted(settings.firms_sample_dir.glob("*.csv"))


def _active_files(settings: Settings) -> list[Path]:
    archive_files = sorted(settings.firms_archive_dir.rglob("*.csv"))
    return [*archive_files, *current_source_files(settings)]


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
    boundary = load_india_boundary(settings)
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
                if boundary is not None and not contains_point(boundary, lat, lon):
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
                        "raw_payload": {
                            str(key): str(value) for key, value in raw.items() if key is not None
                        },
                    }
                )

    # A UNIQUE constraint will enforce this in PostGIS; the in-memory repository mirrors it now.
    return list({str(row["id"]): row for row in rows}.values())


def _build_events(settings: Settings) -> list[NormalizedThermalEvent]:
    raw_events = _read_raw_events(settings)
    clustering = cluster_observations(
        [
            SpatialObservation(
                id=str(row["id"]),
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
            )
            for row in raw_events
        ],
        epsilon_m=settings.clustering_epsilon_m,
        min_samples=settings.clustering_min_samples,
    )
    for row in raw_events:
        assignment = clustering.assignments[str(row["id"])]
        row["cluster_id"] = assignment.cluster_id
        row["cluster_role"] = assignment.role
        row["cluster_radius_m"] = assignment.radius_m

    administrative_area = (
        administrative_area_context() if load_india_boundary(settings) is not None else None
    )
    facilities = load_facilities(settings)
    facility_index = build_facility_index(facilities)
    land_cover_contexts = load_land_cover_contexts(settings)
    clusters: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in raw_events:
        clusters[str(row["cluster_id"])].append(row)

    events: list[NormalizedThermalEvent] = []
    confidence_scores = {"high": 0.9, "nominal": 0.72, "low": 0.45, "unknown": 0.35}
    window_start = min(
        (row["acquired_at"] for row in raw_events),
        default=datetime.now(UTC),
    )
    window_end = max(
        (row["acquired_at"] for row in raw_events),
        default=window_start,
    )
    observation_window_days = max(1, (window_end.date() - window_start.date()).days + 1)

    for row in raw_events:
        cluster = clusters[str(row["cluster_id"])]
        sensor_count = len({str(item["source"]) for item in cluster})
        detection_count = len(cluster)
        active_days = len({item["acquired_at"].date() for item in cluster})
        cluster_first_seen = min(item["acquired_at"] for item in cluster)
        cluster_last_seen = max(item["acquired_at"] for item in cluster)
        cluster_frps = [float(item["frp_mw"]) for item in cluster]
        baseline_frp = float(median(cluster_frps))
        frp_mad = float(median(abs(value - baseline_frp) for value in cluster_frps))
        centroid_latitude = sum(float(item["latitude"]) for item in cluster) / detection_count
        centroid_longitude = sum(float(item["longitude"]) for item in cluster) / detection_count
        spatial_spread_m = max(
            (
                haversine_m(
                    centroid_latitude,
                    centroid_longitude,
                    float(item["latitude"]),
                    float(item["longitude"]),
                )
                for item in cluster
            ),
            default=0,
        )
        active_ratio = active_days / observation_window_days
        density_score = min(1.0, detection_count / max(1, active_days * 3))
        stability_score = max(0.0, 1 - spatial_spread_m / 1_500)
        sensor_support = min(1.0, sensor_count / 3)
        recurrence_score = min(
            1.0,
            0.45 * active_ratio
            + 0.20 * density_score
            + 0.20 * stability_score
            + 0.15 * sensor_support,
        )
        anomaly_score = None
        if detection_count >= 5 and frp_mad >= 0.1:
            anomaly_score = (float(row["frp_mw"]) - baseline_frp) / (1.4826 * frp_mad)
        if (
            anomaly_score is not None
            and anomaly_score >= 3
            and float(row["frp_mw"]) >= baseline_frp + 5
        ):
            anomaly_status = "elevated"
        elif detection_count >= 5 and active_days >= 3:
            anomaly_status = "within_observed_range"
        else:
            anomaly_status = "insufficient_baseline"

        daily_frps: dict[str, list[float]] = defaultdict(list)
        for item in cluster:
            daily_frps[item["acquired_at"].date().isoformat()].append(float(item["frp_mw"]))
        temporal_history = [
            TemporalHistoryPoint(
                date=date,
                detection_count=len(values),
                mean_frp_mw=round(sum(values) / len(values), 2),
                max_frp_mw=round(max(values), 2),
            )
            for date, values in sorted(daily_frps.items())
        ]
        confidence = str(row["confidence"])
        base_confidence = confidence_scores.get(confidence, 0.35)
        facility_context = nearest_facility(
            float(row["latitude"]),
            float(row["longitude"]),
            facilities,
            facility_index=facility_index,
        )
        land_cover_context: LandCoverContext | None = land_cover_contexts.get(
            land_cover_cell_key(float(row["latitude"]), float(row["longitude"]))
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
            if anomaly_status == "elevated":
                classification = "Elevated industrial thermal anomaly"
            elif active_days >= 4 and recurrence_score >= 0.65:
                classification = "Persistent industrial thermal source candidate"
            else:
                classification = "Thermal anomaly near mapped industrial facility"
            classification_confidence = min(
                0.96,
                base_confidence + 0.14 + (0.08 if active_days >= 4 else 0),
            )
            category = "industrial"
        elif active_days >= 4 and recurrence_score >= 0.72:
            classification = "Persistent unmapped thermal source candidate"
            classification_confidence = min(0.91, base_confidence + 0.14)
            category = "unknown"
        elif land_cover_context and land_cover_context.group == "cropland":
            classification = "Agricultural-burning candidate over MODIS cropland"
            classification_confidence = min(
                0.92,
                base_confidence + 0.10 + (0.05 if sensor_count >= 2 else 0),
            )
            category = "agricultural"
        elif land_cover_context and land_cover_context.group == "vegetation":
            classification = "Vegetation-fire candidate over MODIS land cover"
            classification_confidence = min(
                0.92,
                base_confidence + 0.10 + (0.05 if sensor_count >= 2 else 0),
            )
            category = "vegetation"
        elif sensor_count >= 2:
            classification = "Multi-sensor thermal anomaly"
            classification_confidence = min(0.95, base_confidence + 0.12)
            category = "unknown"
        elif detection_count >= 3:
            classification = "Repeated thermal anomaly"
            classification_confidence = min(0.88, base_confidence + 0.08)
            category = "unknown"
        else:
            classification = "Unclassified thermal anomaly"
            classification_confidence = base_confidence
            category = "unknown"

        explanation = [
            f"NASA FIRMS confidence: {confidence}",
            f"FRP: {float(row['frp_mw']):.2f} MW",
            f"{detection_count} detection(s) in the same {settings.clustering_epsilon_m:.0f} m Haversine DBSCAN cluster",
            f"Observed on {active_days} of {observation_window_days} day(s)",
            f"Observed by {sensor_count} VIIRS source(s) in the evidence window",
            f"Median observed FRP baseline: {baseline_frp:.2f} MW",
        ]
        if facility_context:
            explanation.append(
                f"Nearest mapped {facility_context.facility_type}: "
                f"{facility_context.name} at {facility_context.distance_m:.0f} m"
            )
        else:
            explanation.append("No supported OSM facility found within 25 km")
        if anomaly_status == "elevated":
            explanation.append(
                "FRP is elevated relative to the cluster's seven-day median/MAD baseline"
            )
        if land_cover_context:
            explanation.append(
                "NASA MODIS IGBP land cover: "
                f"{land_cover_context.class_label} ({land_cover_context.observation_date})"
            )
            explanation.append(
                "Annual land cover is contextual evidence and does not confirm the anomaly source"
            )
        else:
            explanation.append("Land-cover context is unavailable for this thermal location")

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
                cluster_id=str(row["cluster_id"]),
                cluster_method=CLUSTER_METHOD,
                cluster_role=row["cluster_role"],
                cluster_radius_m=round(float(row["cluster_radius_m"]), 2),
                cluster_epsilon_m=settings.clustering_epsilon_m,
                cluster_min_samples=settings.clustering_min_samples,
                cluster_detection_count=detection_count,
                cluster_sensor_count=sensor_count,
                recurrence_score=round(recurrence_score, 3),
                observation_window_days=observation_window_days,
                active_days=active_days,
                first_seen=cluster_first_seen,
                last_seen=cluster_last_seen,
                baseline_frp_mw=round(baseline_frp, 3),
                frp_mad_mw=round(frp_mad, 3),
                anomaly_score=round(anomaly_score, 3) if anomaly_score is not None else None,
                anomaly_status=anomaly_status,
                temporal_history=temporal_history,
                category=category,
                classification=classification,
                classification_confidence=round(classification_confidence, 3),
                severity=_severity(float(row["frp_mw"]), row["confidence"]),
                explanation=explanation,
                context_status=(
                    "FIRMS_OSM_MODIS_IGBP_METRIC_CLUSTER_AND_SHORT_TEMPORAL"
                    if facilities and land_cover_contexts
                    else "FIRMS_METRIC_CLUSTER_AND_SHORT_TEMPORAL_PARTIAL_CONTEXT"
                ),
                nearest_facility=facility_context,
                land_cover=land_cover_context,
                administrative_area=administrative_area,
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
    land_cover_path = land_cover_source_path(settings)
    if land_cover_path:
        files = [*files, land_cover_path]
    if settings.india_boundary_file.exists():
        files = [*files, settings.india_boundary_file]
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
    request = Request(url, headers={"User-Agent": "AegisFire/0.1 NASA-FIRMS-client"})
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
        for filename in PUBLIC_REFRESH_FILES:
            _, url = PUBLIC_FEEDS[filename]
            _download(
                url,
                settings.firms_cache_dir / filename,
                settings.firms_request_timeout_seconds,
            )
            downloaded.append(filename)

    downloaded_paths = [settings.firms_cache_dir / filename for filename in downloaded]
    archived_files = archive_source_files(downloaded_paths, settings)
    invalidate_event_cache()
    events = load_events(settings)
    refreshed_at = datetime.now(UTC)
    return RefreshResponse(
        refreshed_at=refreshed_at,
        files=downloaded,
        archived_files=archived_files,
        normalized_events=len(events),
        message=(
            "Refreshed from the authenticated FIRMS Area API."
            if settings.firms_map_key
            else "Refreshed from official public NASA FIRMS South Asia seven-day feeds."
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
