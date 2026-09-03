from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings
from app.schemas.events import AdministrativeAreaContext

type Point = tuple[float, float]
type Ring = tuple[Point, ...]
type Polygon = tuple[Ring, ...]

BOUNDARY_API_URL = "https://www.geoboundaries.org/api/current/gbOpen/IND/ADM0/"
BOUNDARY_SOURCE_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/"
    "gbOpen/IND/ADM0/geoBoundaries-IND-ADM0.geojson"
)


@dataclass(frozen=True)
class AdministrativeBoundary:
    polygons: tuple[Polygon, ...]
    polygon_bounds: tuple[tuple[float, float, float, float], ...]
    feature_collection: dict[str, Any]
    source_path: Path


def administrative_area_context() -> AdministrativeAreaContext:
    return AdministrativeAreaContext(
        provider="geoBoundaries",
        dataset="gbOpen",
        country_name="India",
        iso3="IND",
        boundary_level="ADM0",
        boundary_id="IND-ADM0-67634026",
        shape_id="67634026B97797269081249",
        boundary_year=2014,
        license="CC0 1.0",
        containment_method="point-in-polygon against pinned full-resolution MultiPolygon",
        source_url=BOUNDARY_SOURCE_URL,
    )


def _ring(raw_ring: list[list[float]]) -> Ring:
    return tuple((float(point[0]), float(point[1])) for point in raw_ring)


def _polygons(geometry: dict[str, Any]) -> tuple[Polygon, ...]:
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if not isinstance(coordinates, list):
        raise TypeError("Boundary geometry has no coordinate array")
    if geometry_type == "Polygon":
        return (tuple(_ring(ring) for ring in coordinates),)
    if geometry_type == "MultiPolygon":
        return tuple(tuple(_ring(ring) for ring in polygon) for polygon in coordinates)
    raise ValueError(f"Unsupported boundary geometry: {geometry_type}")


@lru_cache(maxsize=8)
def _load_boundary(path_value: str, modified_ns: int, size: int) -> AdministrativeBoundary:
    del modified_ns, size
    path = Path(path_value)
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    features = payload.get("features", [])
    if payload.get("type") != "FeatureCollection" or len(features) != 1:
        raise ValueError("India ADM0 boundary must contain exactly one feature")
    feature = features[0]
    if not isinstance(feature, dict) or not isinstance(feature.get("geometry"), dict):
        raise TypeError("India ADM0 boundary feature has no geometry")
    polygons = _polygons(feature["geometry"])
    bounds = tuple(
        (
            min(point[0] for point in polygon[0]),
            min(point[1] for point in polygon[0]),
            max(point[0] for point in polygon[0]),
            max(point[1] for point in polygon[0]),
        )
        for polygon in polygons
    )
    return AdministrativeBoundary(
        polygons=polygons,
        polygon_bounds=bounds,
        feature_collection=payload,
        source_path=path,
    )


def load_india_boundary(settings: Settings | None = None) -> AdministrativeBoundary | None:
    settings = settings or get_settings()
    path = settings.india_boundary_file
    if not path.exists():
        return None
    stat = path.stat()
    return _load_boundary(str(path.resolve()), stat.st_mtime_ns, stat.st_size)


def _point_on_segment(point: Point, start: Point, end: Point) -> bool:
    x, y = point
    x1, y1 = start
    x2, y2 = end
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > 1e-10:
        return False
    return (
        min(x1, x2) - 1e-10 <= x <= max(x1, x2) + 1e-10
        and min(y1, y2) - 1e-10 <= y <= max(y1, y2) + 1e-10
    )


def _inside_ring(point: Point, ring: Ring) -> bool:
    if len(ring) < 3:
        return False
    x, y = point
    inside = False
    previous = ring[-1]
    for current in ring:
        if _point_on_segment(point, previous, current):
            return True
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            intersection_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < intersection_x:
                inside = not inside
        previous = current
    return inside


def contains_point(
    boundary: AdministrativeBoundary | None,
    latitude: float,
    longitude: float,
) -> bool:
    if boundary is None:
        return False
    point = (longitude, latitude)
    for polygon, bounds in zip(boundary.polygons, boundary.polygon_bounds, strict=True):
        west, south, east, north = bounds
        if not (west <= longitude <= east and south <= latitude <= north):
            continue
        if not polygon or not _inside_ring(point, polygon[0]):
            continue
        if any(_inside_ring(point, hole) for hole in polygon[1:]):
            continue
        return True
    return False
