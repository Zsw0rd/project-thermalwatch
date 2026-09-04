from __future__ import annotations

import json
import math
import tempfile
from collections import defaultdict
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image

from app.config import Settings, get_settings
from app.schemas.events import LandCoverContext, LandCoverGroup, LandCoverRefreshResponse

LAYER_ID = "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual"
OBSERVATION_DATE = "2024-01-01"
TILE_MATRIX_SET = "GoogleMapsCompatible_Level8"
TILE_ZOOM = 8
SAMPLE_FILENAME = "modis_igbp_land_cover_2024.json"
SOURCE_URL = (
    "https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/"
    "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual.json"
)
TILE_TEMPLATE = (
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
    f"{LAYER_ID}/default/{OBSERVATION_DATE}/{TILE_MATRIX_SET}/"
    "{z}/{y}/{x}.png"
)

ColorDefinition = tuple[list[int], str, LandCoverGroup]
IGBP_COLORS: dict[tuple[int, int, int], ColorDefinition] = {
    (33, 138, 33): ([1], "Evergreen Needleleaf Forests", "vegetation"),
    (49, 204, 49): ([2], "Evergreen Broadleaf Forests", "vegetation"),
    (152, 204, 49): ([3], "Deciduous Needleleaf Forests", "vegetation"),
    (150, 250, 150): ([4], "Deciduous Broadleaf Forests", "vegetation"),
    (141, 186, 141): ([5], "Mixed Forests", "vegetation"),
    (186, 141, 141): ([6], "Closed Shrublands", "vegetation"),
    (245, 222, 179): ([7], "Open Shrublands", "vegetation"),
    (218, 235, 157): ([8], "Woody Savannas", "vegetation"),
    (255, 213, 0): ([9], "Savannas", "vegetation"),
    (240, 185, 103): ([10], "Grasslands", "vegetation"),
    (71, 131, 181): ([11], "Permanent Wetlands", "vegetation"),
    (250, 239, 115): ([12], "Croplands", "cropland"),
    (255, 0, 0): ([13], "Urban and Built-up Lands", "built_up"),
    (153, 147, 86): ([14], "Cropland/Natural Vegetation Mosaics", "cropland"),
    (255, 255, 255): ([15], "Permanent Snow and Ice", "snow_ice"),
    (191, 191, 189): ([16], "Barren", "barren"),
    (134, 202, 227): ([0, 17], "Water Bodies", "water"),
    (100, 100, 100): ([255], "Unclassified", "unclassified"),
}


def land_cover_cell_key(latitude: float, longitude: float) -> str:
    return f"{round(latitude, 2):.2f}:{round(longitude, 2):.2f}"


def slippy_tile_position(
    latitude: float,
    longitude: float,
    zoom: int = TILE_ZOOM,
) -> tuple[int, int, int, int]:
    latitude = max(-85.05112878, min(85.05112878, latitude))
    scale = 2**zoom
    x_float = (longitude + 180) / 360 * scale
    y_float = (
        1 - math.asinh(math.tan(math.radians(latitude))) / math.pi
    ) / 2 * scale
    tile_x = min(scale - 1, max(0, math.floor(x_float)))
    tile_y = min(scale - 1, max(0, math.floor(y_float)))
    pixel_x = min(255, max(0, math.floor((x_float - tile_x) * 256)))
    pixel_y = min(255, max(0, math.floor((y_float - tile_y) * 256)))
    return tile_x, tile_y, pixel_x, pixel_y


def land_cover_source_path(settings: Settings | None = None) -> Path | None:
    settings = settings or get_settings()
    cache_path = settings.firms_cache_dir / SAMPLE_FILENAME
    if cache_path.exists():
        return cache_path
    sample_path = settings.firms_sample_dir / SAMPLE_FILENAME
    return sample_path if sample_path.exists() else None


def load_land_cover_contexts(
    settings: Settings | None = None,
) -> dict[str, LandCoverContext]:
    settings = settings or get_settings()
    path = land_cover_source_path(settings)
    if path is None:
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return {}
    cells = payload.get("cells", {}) if isinstance(payload, dict) else {}
    if not isinstance(cells, dict):
        return {}
    contexts: dict[str, LandCoverContext] = {}
    for key, value in cells.items():
        if not isinstance(value, dict):
            continue
        try:
            contexts[str(key)] = LandCoverContext.model_validate(value)
        except ValueError:
            continue
    return contexts


def refresh_land_cover_contexts(
    coordinates: dict[str, tuple[float, float]],
    settings: Settings | None = None,
) -> LandCoverRefreshResponse:
    settings = settings or get_settings()
    positions: dict[tuple[int, int], list[tuple[str, int, int]]] = defaultdict(list)
    for key, (latitude, longitude) in coordinates.items():
        tile_x, tile_y, pixel_x, pixel_y = slippy_tile_position(latitude, longitude)
        positions[(tile_x, tile_y)].append((key, pixel_x, pixel_y))

    cells: dict[str, dict[str, object]] = {}
    with httpx.Client(
        timeout=settings.firms_request_timeout_seconds,
        follow_redirects=True,
        headers={"User-Agent": "AegisFire/0.1 NASA-GIBS-land-cover-client"},
    ) as client:
        for (tile_x, tile_y), samples in positions.items():
            url = TILE_TEMPLATE.format(z=TILE_ZOOM, y=tile_y, x=tile_x)
            response = client.get(url)
            response.raise_for_status()
            with Image.open(BytesIO(response.content)) as source_image:
                image = source_image.convert("RGBA").convert("RGB")
                for key, pixel_x, pixel_y in samples:
                    rgb = image.getpixel((pixel_x, pixel_y))
                    values, label, group = IGBP_COLORS.get(
                        rgb,
                        ([255], "Unclassified", "unclassified"),
                    )
                    context = LandCoverContext(
                        observation_date=OBSERVATION_DATE,
                        igbp_values=values,
                        class_label=label,
                        group=group,
                        rgb=rgb,
                        sampling_method=(
                            "Categorical color sampled from NASA GIBS Web Mercator tile "
                            f"at matrix zoom {TILE_ZOOM}"
                        ),
                        source_url=SOURCE_URL,
                    )
                    cells[key] = context.model_dump(mode="json")

    destination = settings.firms_cache_dir / SAMPLE_FILENAME
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "provider": "NASA EOSDIS GIBS",
        "layer_id": LAYER_ID,
        "observation_date": OBSERVATION_DATE,
        "tile_matrix_set": TILE_MATRIX_SET,
        "tile_zoom": TILE_ZOOM,
        "generated_at": datetime.now(UTC).isoformat(),
        "source_url": SOURCE_URL,
        "cells": cells,
    }
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=destination.parent,
        delete=False,
        suffix=".json",
    ) as temporary:
        json.dump(payload, temporary, ensure_ascii=False, separators=(",", ":"))
        temporary_path = Path(temporary.name)
    temporary_path.replace(destination)
    return LandCoverRefreshResponse(
        refreshed_at=datetime.now(UTC),
        observation_date=OBSERVATION_DATE,
        sampled_cells=len(cells),
        tile_count=len(positions),
        cache_file=str(destination),
        message=(
            "Sampled the official NASA GIBS MODIS IGBP annual land-cover layer for "
            "the configured thermal cells."
        ),
    )
