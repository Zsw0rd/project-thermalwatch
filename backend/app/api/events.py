from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.session import get_session
from app.schemas.events import (
    AlertCollection,
    AnalyticsSummary,
    ConfidenceLabel,
    EventCollection,
    NormalizedThermalEvent,
    PersistenceResponse,
    RefreshResponse,
)
from app.schemas.facilities import FacilityCollection, FacilityRefreshResponse
from app.services.firms import (
    alert_previews,
    analytics_summary,
    invalidate_event_cache,
    load_events,
    refresh_source_files,
)
from app.services.osm import load_facilities, refresh_facilities
from app.services.persistence import persist_current_snapshot

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
) -> list[NormalizedThermalEvent]:
    bounds = _parse_bbox(bbox)
    events = load_events()
    filtered: list[NormalizedThermalEvent] = []
    for event in events:
        if confidence and event.confidence != confidence:
            continue
        if event.frp_mw < min_frp:
            continue
        if source and event.source != source:
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
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=2000)] = 500,
) -> EventCollection:
    settings = get_settings()
    all_events = _filtered_events(
        confidence=confidence,
        min_frp=min_frp,
        bbox=bbox,
        source=source,
    )
    selected = all_events[offset : offset + limit]
    source_updated_at = max(
        (event.source_attribution.retrieved_at for event in all_events),
        default=datetime.now(UTC),
    )
    west, south, east, north = settings.india_bbox
    return EventCollection(
        mode="operational",
        generated_at=datetime.now(UTC),
        source_updated_at=source_updated_at,
        geographic_scope=f"Configured India bounding box ({west},{south},{east},{north})",
        scope_limitations=[
            "Bounding-box filtering is not a precise India administrative-boundary join.",
            "FIRMS reports thermal anomalies, not confirmed fires or industrial incidents.",
            "OSM proximity is applied; land cover and long-term history are not yet applied.",
            "Recurrence scores only describe co-observation within the current snapshot.",
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
                },
            }
            for event in events
        ],
    }


@router.get("/analytics/summary", response_model=AnalyticsSummary, tags=["analytics"])
async def summary() -> AnalyticsSummary:
    return analytics_summary(load_events())


@router.get("/alerts", response_model=AlertCollection, tags=["alerts"])
async def alerts() -> AlertCollection:
    return alert_previews(load_events())


@router.get("/sources", tags=["system"])
async def sources() -> dict[str, object]:
    settings = get_settings()
    return {
        "provider": "NASA FIRMS",
        "active_sources": sorted({event.source for event in load_events()}),
        "authenticated_area_api_configured": bool(settings.firms_map_key),
        "fallback": "Official public South Asia 24-hour VIIRS CSV feeds",
        "attribution_required": True,
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
