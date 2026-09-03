from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_session
from app.schemas.events import (
    AlertCollection,
    AlertPreview,
    AlertReviewUpdate,
    AnalyticsDashboard,
    AnalyticsSummary,
    ArchiveResponse,
    ConfidenceLabel,
    EventCategory,
    EventCollection,
    HistoricalReadiness,
    LandCoverRefreshResponse,
    NormalizedThermalEvent,
    PersistenceResponse,
    PlaybackCollection,
    RefreshResponse,
    ThermalClusterCollection,
    ThermalClusterSummary,
)
from app.schemas.facilities import (
    FacilityCollection,
    FacilityMonitorCollection,
    FacilityMonitorSummary,
    FacilityRefreshResponse,
)
from app.services.alert_workflow import apply_alert_review_states, update_alert_review
from app.services.boundary import (
    BOUNDARY_API_URL,
    administrative_area_context,
    load_india_boundary,
)
from app.services.facility_monitor import build_facility_monitors, facility_monitor_collection
from app.services.firms import (
    alert_previews,
    analytics_summary,
    current_source_files,
    invalidate_event_cache,
    load_events,
    refresh_source_files,
)
from app.services.history_archive import archive_source_files, history_readiness
from app.services.land_cover import (
    LAYER_ID,
    OBSERVATION_DATE,
    land_cover_cell_key,
    load_land_cover_contexts,
    refresh_land_cover_contexts,
)
from app.services.land_cover import (
    SOURCE_URL as LAND_COVER_SOURCE_URL,
)
from app.services.land_cover import (
    TILE_TEMPLATE as LAND_COVER_TILE_TEMPLATE,
)
from app.services.osm import load_facilities, refresh_facilities
from app.services.persistence import persist_current_snapshot
from app.services.temporal import (
    analytics_dashboard,
    build_cluster_summaries,
    cluster_collection,
    playback_collection,
)

router = APIRouter(prefix="/api/v1")


def _parse_bbox(value: str | None) -> tuple[float, float, float, float] | None:
    if value is None:
        return None
    try:
        west, south, east, north = (float(part) for part in value.split(","))
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail="bbox must be west,south,east,north",
        ) from None
    if west >= east or south >= north or not (-180 <= west <= 180 and -180 <= east <= 180):
        raise HTTPException(status_code=422, detail="bbox bounds are invalid")
    if not (-90 <= south <= 90 and -90 <= north <= 90):
        raise HTTPException(status_code=422, detail="bbox latitude is invalid")
    return west, south, east, north


def _filtered_events(
    *,
    confidence: ConfidenceLabel | None = None,
    min_frp: float = 0,
    bbox: str | None = None,
    source: str | None = None,
    category: EventCategory | None = None,
    window_hours: int | None = None,
) -> list[NormalizedThermalEvent]:
    bounds = _parse_bbox(bbox)
    events = load_events()
    cutoff = None
    if window_hours and events:
        cutoff = max(event.acquired_at for event in events) - timedelta(hours=window_hours)
    filtered: list[NormalizedThermalEvent] = []
    for event in events:
        if confidence and event.confidence != confidence:
            continue
        if event.frp_mw < min_frp:
            continue
        if source and event.source != source:
            continue
        if category and event.category != category:
            continue
        if cutoff and event.acquired_at < cutoff:
            continue
        if bounds:
            west, south, east, north = bounds
            if not (west <= event.longitude <= east and south <= event.latitude <= north):
                continue
        filtered.append(event)
    return filtered


@router.get("/events", response_model=EventCollection, tags=["thermal events"])
async def list_events(
    confidence: ConfidenceLabel | None = None,
    min_frp: Annotated[float, Query(ge=0)] = 0,
    bbox: str | None = None,
    source: str | None = None,
    category: EventCategory | None = None,
    window_hours: Annotated[int | None, Query(ge=1, le=24 * 31)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=5000)] = 500,
) -> EventCollection:
    all_events = _filtered_events(
        confidence=confidence,
        min_frp=min_frp,
        bbox=bbox,
        source=source,
        category=category,
        window_hours=window_hours,
    )
    selected = all_events[offset : offset + limit]
    source_updated_at = max(
        (event.source_attribution.retrieved_at for event in all_events),
        default=datetime.now(UTC),
    )
    return EventCollection(
        mode="operational",
        generated_at=datetime.now(UTC),
        source_updated_at=source_updated_at,
        geographic_scope="India ADM0 containment using the pinned geoBoundaries gbOpen polygon",
        scope_limitations=[
            "The India administrative boundary represents 2014 and is not a territorial claim.",
            "FIRMS reports thermal anomalies, not confirmed fires or industrial incidents.",
            "OSM proximity, MODIS IGBP land cover, administrative containment, and temporal recurrence are applied.",
            "The annual 2024 land-cover class is contextual evidence, not a contemporaneous observation or confirmation of the thermal source.",
            "Coverage readiness is explicit; short archives rank candidates but are not learned long-term facility baselines.",
        ],
        total=len(all_events),
        returned=len(selected),
        events=selected,
    )


@router.get("/events/{event_id}", response_model=NormalizedThermalEvent, tags=["thermal events"])
async def get_event(event_id: str) -> NormalizedThermalEvent:
    event = next((item for item in load_events() if item.id == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Thermal event not found")
    return event


@router.get("/events.geojson", tags=["thermal events"])
async def events_geojson(
    min_frp: Annotated[float, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=5000)] = 1000,
) -> dict[str, Any]:
    events = _filtered_events(min_frp=min_frp)[:limit]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": event.id,
                "geometry": {
                    "type": "Point",
                    "coordinates": [event.longitude, event.latitude],
                },
                "properties": {
                    "source": event.source,
                    "acquired_at": event.acquired_at.isoformat(),
                    "frp_mw": event.frp_mw,
                    "confidence": event.confidence,
                    "classification": event.classification,
                    "cluster_id": event.cluster_id,
                    "land_cover_class": (
                        event.land_cover.class_label if event.land_cover else None
                    ),
                    "land_cover_group": (event.land_cover.group if event.land_cover else None),
                },
            }
            for event in events
        ],
    }


@router.get("/analytics/summary", response_model=AnalyticsSummary, tags=["analytics"])
async def summary() -> AnalyticsSummary:
    return analytics_summary(load_events())


@router.get(
    "/history/readiness",
    response_model=HistoricalReadiness,
    tags=["analytics"],
)
async def historical_readiness() -> HistoricalReadiness:
    return history_readiness(load_events())


@router.get(
    "/analytics/dashboard",
    response_model=AnalyticsDashboard,
    tags=["analytics"],
)
async def dashboard_analytics() -> AnalyticsDashboard:
    return analytics_dashboard(load_events())


@router.get("/playback", response_model=PlaybackCollection, tags=["analytics"])
async def playback() -> PlaybackCollection:
    return playback_collection(load_events())


@router.get(
    "/clusters",
    response_model=ThermalClusterCollection,
    tags=["thermal clusters"],
)
async def clusters(
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    persistence_label: str | None = None,
) -> ThermalClusterCollection:
    return cluster_collection(
        load_events(),
        limit=limit,
        persistence_label=persistence_label,
    )


@router.get(
    "/clusters/{cluster_id}",
    response_model=ThermalClusterSummary,
    tags=["thermal clusters"],
)
async def get_cluster(cluster_id: str) -> ThermalClusterSummary:
    cluster = next(
        (item for item in build_cluster_summaries(load_events()) if item.cluster_id == cluster_id),
        None,
    )
    if cluster is None:
        raise HTTPException(status_code=404, detail="Thermal cluster not found")
    return cluster


@router.get(
    "/events/{event_id}/history",
    response_model=ThermalClusterSummary,
    tags=["thermal events"],
)
async def event_history(event_id: str) -> ThermalClusterSummary:
    event = next((item for item in load_events() if item.id == event_id), None)
    if event is None:
        raise HTTPException(status_code=404, detail="Thermal event not found")
    cluster = next(
        item
        for item in build_cluster_summaries(load_events())
        if item.cluster_id == event.cluster_id
    )
    return cluster


@router.get("/alerts", response_model=AlertCollection, tags=["alerts"])
async def alerts() -> AlertCollection:
    collection = alert_previews(load_events())
    return collection.model_copy(update={"alerts": apply_alert_review_states(collection.alerts)})


@router.patch(
    "/alerts/{alert_id}",
    response_model=AlertPreview,
    tags=["alerts"],
)
def update_alert(alert_id: str, update: AlertReviewUpdate) -> AlertPreview:
    collection = alert_previews(load_events())
    alert = next((item for item in collection.alerts if item.id == alert_id), None)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return update_alert_review(alert, update)


@router.get("/sources", tags=["system"])
async def sources() -> dict[str, object]:
    settings = get_settings()
    readiness = history_readiness(load_events(), settings)
    return {
        "provider": "NASA FIRMS",
        "active_sources": sorted({event.source for event in load_events()}),
        "authenticated_area_api_configured": bool(settings.firms_map_key),
        "fallback": "Official public South Asia seven-day VIIRS CSV feeds",
        "attribution_required": True,
        "archive": {
            "snapshot_files": readiness.archive_snapshot_files,
            "observed_calendar_days": readiness.observed_calendar_days,
            "status": readiness.status,
            "methodology": readiness.methodology,
        },
        "geography": administrative_area_context().model_dump(),
        "land_cover": {
            "provider": "NASA EOSDIS GIBS",
            "product": "MCD12Q1.061 MODIS IGBP annual land cover",
            "layer_id": LAYER_ID,
            "observation_date": OBSERVATION_DATE,
            "sampled_cells": len(load_land_cover_contexts(settings)),
            "source_url": LAND_COVER_SOURCE_URL,
            "classification_use": "contextual likelihood feature only",
        },
    }


@router.get("/geography/india", tags=["system"])
async def india_geography() -> dict[str, Any]:
    boundary = load_india_boundary()
    if boundary is None:
        raise HTTPException(status_code=503, detail="Pinned India ADM0 boundary is unavailable")
    return {
        **boundary.feature_collection,
        "attribution": administrative_area_context().model_dump(),
        "metadata_url": BOUNDARY_API_URL,
        "limitations": [
            "The boundary represents 2014 and is used only for deterministic data containment.",
            "Boundary geometry is not a territorial claim or a substitute for authoritative survey data.",
        ],
    }


@router.get("/land-cover/source", tags=["system"])
async def land_cover_source() -> dict[str, object]:
    contexts = load_land_cover_contexts()
    return {
        "provider": "NASA EOSDIS GIBS",
        "product": "MCD12Q1.061 MODIS IGBP annual land cover",
        "layer_id": LAYER_ID,
        "observation_date": OBSERVATION_DATE,
        "sampled_cells": len(contexts),
        "source_url": LAND_COVER_SOURCE_URL,
        "tile_template": LAND_COVER_TILE_TEMPLATE,
        "classification_use": "contextual likelihood feature only",
        "limitation": (
            "Annual 500 m categorical land cover is not contemporaneous source "
            "confirmation and can be mixed at class boundaries."
        ),
    }


@router.get("/facilities", response_model=FacilityCollection, tags=["industrial context"])
async def facilities(
    limit: Annotated[int, Query(ge=1, le=10000)] = 5000,
) -> FacilityCollection:
    all_items = load_facilities()
    items = all_items[:limit]
    return FacilityCollection(
        generated_at=datetime.now(UTC),
        source="OpenStreetMap / Overpass",
        total=len(all_items),
        facilities=items,
    )


@router.get(
    "/facility-monitors",
    response_model=FacilityMonitorCollection,
    tags=["industrial context"],
)
async def facility_monitors(
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> FacilityMonitorCollection:
    return facility_monitor_collection(
        load_events(),
        load_facilities(),
        limit=limit,
    )


@router.get(
    "/facility-monitors/{monitor_id}",
    response_model=FacilityMonitorSummary,
    tags=["industrial context"],
)
async def facility_monitor(monitor_id: str) -> FacilityMonitorSummary:
    monitor = next(
        (
            item
            for item in build_facility_monitors(load_events(), load_facilities())
            if item.monitor_id == monitor_id
        ),
        None,
    )
    if monitor is None:
        raise HTTPException(status_code=404, detail="Facility monitor not found")
    return monitor


@router.post(
    "/ingestion/osm/refresh",
    response_model=FacilityRefreshResponse,
    tags=["ingestion"],
)
async def refresh_osm() -> FacilityRefreshResponse:
    try:
        response = await run_in_threadpool(refresh_facilities)
        invalidate_event_cache()
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"OpenStreetMap Overpass refresh failed: {type(exc).__name__}",
        ) from exc


@router.post(
    "/ingestion/land-cover/refresh",
    response_model=LandCoverRefreshResponse,
    tags=["ingestion"],
)
async def refresh_land_cover() -> LandCoverRefreshResponse:
    try:
        coordinates = {
            land_cover_cell_key(event.latitude, event.longitude): (
                event.latitude,
                event.longitude,
            )
            for event in load_events()
        }
        response = await run_in_threadpool(
            refresh_land_cover_contexts,
            coordinates,
        )
        invalidate_event_cache()
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"NASA GIBS land-cover refresh failed: {type(exc).__name__}",
        ) from exc


@router.post("/ingestion/firms/refresh", response_model=RefreshResponse, tags=["ingestion"])
async def refresh_firms() -> RefreshResponse:
    try:
        return await run_in_threadpool(refresh_source_files)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"NASA FIRMS refresh failed: {type(exc).__name__}",
        ) from exc


@router.post(
    "/ingestion/firms/archive-current",
    response_model=ArchiveResponse,
    tags=["ingestion"],
)
async def archive_current_firms() -> ArchiveResponse:
    settings = get_settings()
    archived_at = datetime.now(UTC)
    archived_files = await run_in_threadpool(
        archive_source_files,
        current_source_files(settings),
        settings,
        archived_at,
    )
    invalidate_event_cache()
    return ArchiveResponse(
        archived_at=archived_at,
        archived_files=archived_files,
        history=history_readiness(load_events(settings), settings),
    )


@router.post(
    "/ingestion/persist",
    response_model=PersistenceResponse,
    tags=["ingestion"],
)
def persist_snapshots(
    session: Annotated[Session, Depends(get_session)],
) -> PersistenceResponse:
    try:
        return persist_current_snapshot(session)
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=503,
            detail=f"PostGIS persistence failed: {type(exc).__name__}",
        ) from exc
