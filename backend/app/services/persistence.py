from collections import defaultdict
from datetime import UTC, datetime
from typing import Any

from geoalchemy2.elements import WKTElement
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db.models import (
    IndustrialFacilityRecord,
    ThermalClusterRecord,
    ThermalEventRecord,
)
from app.schemas.events import PersistenceResponse
from app.services.firms import load_events
from app.services.osm import load_facilities


def _chunks(items: list[dict[str, Any]], size: int = 750) -> list[list[dict[str, Any]]]:
    return [items[index : index + size] for index in range(0, len(items), size)]


def persist_current_snapshot(session: Session) -> PersistenceResponse:
    events = load_events()
    facilities = load_facilities()
    observed_at = datetime.now(UTC)

    grouped_events: dict[str, list] = defaultdict(list)
    for event in events:
        grouped_events[event.cluster_id].append(event)

    cluster_rows: list[dict[str, Any]] = []
    for cluster_id, members in grouped_events.items():
        latitude = sum(event.latitude for event in members) / len(members)
        longitude = sum(event.longitude for event in members) / len(members)
        cluster_rows.append(
            {
                "id": cluster_id,
                "centroid": WKTElement(f"POINT({longitude} {latitude})", srid=4326),
                "first_seen": min(event.acquired_at for event in members),
                "last_seen": max(event.acquired_at for event in members),
                "detection_count": len(members),
                "sensor_count": len({event.source for event in members}),
                "persistence_score": max(event.recurrence_score for event in members),
                "baseline_frp_mw": None,
            }
        )
    for chunk in _chunks(cluster_rows):
        statement = insert(ThermalClusterRecord).values(chunk)
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[ThermalClusterRecord.id],
                set_={
                    "centroid": statement.excluded.centroid,
                    "first_seen": statement.excluded.first_seen,
                    "last_seen": statement.excluded.last_seen,
                    "detection_count": statement.excluded.detection_count,
                    "sensor_count": statement.excluded.sensor_count,
                    "persistence_score": statement.excluded.persistence_score,
                },
            )
        )

    facility_rows = [
        {
            "osm_id": facility.osm_id,
            "name": facility.name,
            "facility_type": facility.facility_type,
            "operator": facility.operator,
            "geom": WKTElement(f"POINT({facility.longitude} {facility.latitude})", srid=4326),
            "tags": facility.tags,
            "source": "OpenStreetMap",
            "last_updated_at": observed_at,
        }
        for facility in facilities
    ]
    for chunk in _chunks(facility_rows):
        statement = insert(IndustrialFacilityRecord).values(chunk)
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[IndustrialFacilityRecord.osm_id],
                set_={
                    "name": statement.excluded.name,
                    "facility_type": statement.excluded.facility_type,
                    "operator": statement.excluded.operator,
                    "geom": statement.excluded.geom,
                    "tags": statement.excluded.tags,
                    "last_updated_at": statement.excluded.last_updated_at,
                },
            )
        )

    event_rows = [
        {
            "id": event.id,
            "source": event.source,
            "geom": WKTElement(f"POINT({event.longitude} {event.latitude})", srid=4326),
            "acquired_at": event.acquired_at,
            "satellite": event.satellite,
            "confidence": event.confidence,
            "frp_mw": event.frp_mw,
            "brightness_i4_k": event.brightness_i4_k,
            "brightness_i5_k": event.brightness_i5_k,
            "brightness_delta_k": event.brightness_delta_k,
            "day_night": event.day_night,
            "raw_payload": event.raw_payload,
            "cluster_id": event.cluster_id,
            "processing_status": "enriched" if event.nearest_facility else "normalized",
        }
        for event in events
    ]
    for chunk in _chunks(event_rows):
        statement = insert(ThermalEventRecord).values(chunk)
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[ThermalEventRecord.id],
                set_={
                    "cluster_id": statement.excluded.cluster_id,
                    "processing_status": statement.excluded.processing_status,
                },
            )
        )

    session.commit()
    return PersistenceResponse(
        persisted_at=observed_at,
        thermal_events=len(event_rows),
        thermal_clusters=len(cluster_rows),
        industrial_facilities=len(facility_rows),
        message="Current FIRMS and OSM snapshots were upserted into PostGIS.",
    )
