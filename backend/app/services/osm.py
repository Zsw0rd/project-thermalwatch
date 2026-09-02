from __future__ import annotations

import json
import math
import tempfile
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import httpx

from app.config import Settings, get_settings
from app.schemas.events import FacilityContext
from app.schemas.facilities import FacilityRefreshResponse, IndustrialFacility

OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
)
SAMPLE_FILENAME = "osm_india_industrial_context.json"
FACILITY_GRID_DEGREES = 0.25
FacilityGrid = dict[tuple[int, int], list[IndustrialFacility]]


def _query(settings: Settings) -> str:
    west, south, east, north = settings.india_bbox
    bbox = f"{south},{west},{north},{east}"
    return f"""
[out:json][timeout:120];
(
  nwr[\"industrial\"=\"refinery\"]({bbox});
  nwr[\"man_made\"=\"flare\"]({bbox});
  nwr[\"power\"=\"plant\"]({bbox});
  nwr[\"industrial\"=\"steelmaking\"]({bbox});
  nwr[\"landuse\"=\"quarry\"]({bbox});
);
out center tags;
""".strip()


def _facility_type(tags: dict[str, str]) -> str:
    if tags.get("industrial") == "refinery":
        return "refinery"
    if tags.get("man_made") == "flare":
        return "flare"
    if tags.get("power") == "plant":
        source = tags.get("plant:source")
        return f"power_plant_{source}" if source else "power_plant"
    if tags.get("industrial") == "steelmaking":
        return "steelmaking"
    if tags.get("landuse") == "quarry":
        return "quarry"
    return "industrial"


def _coordinates(element: dict[str, object]) -> tuple[float, float] | None:
    lat = element.get("lat")
    lon = element.get("lon")
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        return float(lat), float(lon)
    center = element.get("center")
    if isinstance(center, dict):
        center_lat = center.get("lat")
        center_lon = center.get("lon")
        if isinstance(center_lat, (int, float)) and isinstance(center_lon, (int, float)):
            return float(center_lat), float(center_lon)
    return None


def _parse_facilities(payload: dict[str, object]) -> list[IndustrialFacility]:
    facilities: list[IndustrialFacility] = []
    elements = payload.get("elements", [])
    if not isinstance(elements, list):
        return facilities

    for element in elements:
        if not isinstance(element, dict):
            continue
        coordinates = _coordinates(element)
        tags_value = element.get("tags", {})
        if coordinates is None or not isinstance(tags_value, dict):
            continue
        tags = {str(key): str(value) for key, value in tags_value.items()}
        lat, lon = coordinates
        element_type = str(element.get("type", "unknown"))
        element_id = str(element.get("id", "unknown"))
        facility_type = _facility_type(tags)
        name = (
            tags.get("name") or tags.get("operator") or f"Unnamed {facility_type.replace('_', ' ')}"
        )
        facilities.append(
            IndustrialFacility(
                osm_id=f"{element_type}/{element_id}",
                osm_type=element_type,
                name=name,
                facility_type=facility_type,
                latitude=lat,
                longitude=lon,
                operator=tags.get("operator"),
                tags=tags,
            )
        )
    return list({facility.osm_id: facility for facility in facilities}.values())


def _facility_path(settings: Settings) -> Path | None:
    cache_path = settings.firms_cache_dir.parent / "cache" / SAMPLE_FILENAME
    if cache_path.exists():
        return cache_path
    sample_path = settings.firms_sample_dir / SAMPLE_FILENAME
    return sample_path if sample_path.exists() else None


def load_facilities(settings: Settings | None = None) -> list[IndustrialFacility]:
    settings = settings or get_settings()
    path = _facility_path(settings)
    if path is None:
        return []
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return _parse_facilities(payload)


def refresh_facilities(settings: Settings | None = None) -> FacilityRefreshResponse:
    settings = settings or get_settings()
    cache_dir = settings.firms_cache_dir.parent / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    destination = cache_dir / SAMPLE_FILENAME
    payload: dict[str, object] | None = None
    last_error: Exception | None = None
    active_url = OVERPASS_URLS[0]
    with httpx.Client(timeout=150, follow_redirects=True) as client:
        for active_url in OVERPASS_URLS:
            try:
                response = client.post(
                    active_url,
                    data={"data": _query(settings)},
                    headers={"User-Agent": "AegisFire/0.1 OSM-context-client"},
                )
                response.raise_for_status()
                candidate = response.json()
                if isinstance(candidate, dict):
                    payload = candidate
                    break
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
    if payload is None:
        raise RuntimeError("All configured public Overpass instances failed") from last_error
    facilities = _parse_facilities(payload)
    if not facilities:
        raise ValueError("Overpass returned no supported industrial facilities")
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=cache_dir, delete=False, suffix=".json"
    ) as temporary:
        json.dump(payload, temporary, ensure_ascii=False, separators=(",", ":"))
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)
    return FacilityRefreshResponse(
        refreshed_at=datetime.now(UTC),
        facilities=len(facilities),
        cache_file=str(destination),
        message=f"Refreshed industrial context from OpenStreetMap through {active_url}.",
    )


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_m = 6_371_008.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * radius_m * math.asin(math.sqrt(value))


def build_facility_index(facilities: list[IndustrialFacility]) -> FacilityGrid:
    index: FacilityGrid = defaultdict(list)
    for facility in facilities:
        key = (
            math.floor(facility.latitude / FACILITY_GRID_DEGREES),
            math.floor(facility.longitude / FACILITY_GRID_DEGREES),
        )
        index[key].append(facility)
    return dict(index)


def nearest_facility(
    latitude: float,
    longitude: float,
    facilities: list[IndustrialFacility],
    max_distance_m: float = 25_000,
    facility_index: FacilityGrid | None = None,
) -> FacilityContext | None:
    nearest: tuple[IndustrialFacility, float] | None = None
    candidates = facilities
    if facility_index is not None:
        center_lat = math.floor(latitude / FACILITY_GRID_DEGREES)
        center_lon = math.floor(longitude / FACILITY_GRID_DEGREES)
        candidates = [
            facility
            for lat_offset in range(-2, 3)
            for lon_offset in range(-2, 3)
            for facility in facility_index.get(
                (center_lat + lat_offset, center_lon + lon_offset), []
            )
        ]
    for facility in candidates:
        distance = _haversine_m(
            latitude,
            longitude,
            facility.latitude,
            facility.longitude,
        )
        if distance <= max_distance_m and (nearest is None or distance < nearest[1]):
            nearest = (facility, distance)
    if nearest is None:
        return None
    facility, distance = nearest
    return FacilityContext(
        osm_id=facility.osm_id,
        name=facility.name,
        facility_type=facility.facility_type,
        distance_m=round(distance, 1),
        operator=facility.operator,
    )
