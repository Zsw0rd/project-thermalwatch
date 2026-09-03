from __future__ import annotations

import hashlib
import math
from collections import defaultdict, deque
from dataclasses import dataclass
from statistics import median
from typing import Literal

EARTH_RADIUS_M = 6_371_008.8
METRES_PER_LATITUDE_DEGREE = 111_320.0
CLUSTER_METHOD = "metric_dbscan_haversine_v1"

ClusterRole = Literal["core", "border", "noise"]


@dataclass(frozen=True, slots=True)
class SpatialObservation:
    id: str
    latitude: float
    longitude: float


@dataclass(frozen=True, slots=True)
class ClusterAssignment:
    cluster_id: str
    role: ClusterRole
    radius_m: float
    member_count: int


@dataclass(frozen=True, slots=True)
class SpatialClusteringResult:
    assignments: dict[str, ClusterAssignment]
    cluster_count: int
    multi_event_cluster_count: int
    noise_event_count: int
    cluster_radii_m: tuple[float, ...]


def haversine_m(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    """Return great-circle distance in metres for WGS84-like coordinates."""
    latitude_a_rad = math.radians(latitude_a)
    latitude_b_rad = math.radians(latitude_b)
    delta_latitude = math.radians(latitude_b - latitude_a)
    delta_longitude = math.radians(longitude_b - longitude_a)
    value = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(latitude_a_rad) * math.cos(latitude_b_rad) * math.sin(delta_longitude / 2) ** 2
    )
    bounded = min(1.0, max(0.0, value))
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(bounded), math.sqrt(1 - bounded))


def _stable_cluster_id(member_ids: list[str]) -> str:
    fingerprint = "|".join(sorted(member_ids))
    return f"TS-{hashlib.sha1(fingerprint.encode('utf-8')).hexdigest()[:10].upper()}"


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = (len(ordered) - 1) * percentile
    lower = math.floor(index)
    upper = math.ceil(index)
    if lower == upper:
        return ordered[lower]
    fraction = index - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def radius_percentiles(radii_m: tuple[float, ...]) -> tuple[float, float, float]:
    values = list(radii_m)
    if not values:
        return 0.0, 0.0, 0.0
    return float(median(values)), _percentile(values, 0.95), max(values)


def cluster_observations(
    observations: list[SpatialObservation],
    *,
    epsilon_m: float,
    min_samples: int,
) -> SpatialClusteringResult:
    """Cluster points with deterministic DBSCAN and Haversine distance.

    DBSCAN noise observations are exposed as singleton analytical clusters so no
    FIRMS detection disappears from downstream review surfaces. Their role remains
    ``noise`` to preserve the distinction from a density-supported cluster.
    """
    if epsilon_m <= 0:
        raise ValueError("epsilon_m must be positive")
    if min_samples < 1:
        raise ValueError("min_samples must be at least one")
    if not observations:
        return SpatialClusteringResult({}, 0, 0, 0, ())

    points = sorted(observations, key=lambda observation: observation.id)
    if len({point.id for point in points}) != len(points):
        raise ValueError("Spatial observation IDs must be unique")

    maximum_absolute_latitude = max(abs(point.latitude) for point in points)
    minimum_cosine = max(0.01, math.cos(math.radians(maximum_absolute_latitude)))
    latitude_step = epsilon_m / METRES_PER_LATITUDE_DEGREE
    longitude_step = epsilon_m / (METRES_PER_LATITUDE_DEGREE * minimum_cosine)

    buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
    point_buckets: list[tuple[int, int]] = []
    for index, point in enumerate(points):
        bucket = (
            math.floor((point.latitude + 90) / latitude_step),
            math.floor((point.longitude + 180) / longitude_step),
        )
        point_buckets.append(bucket)
        buckets[bucket].append(index)

    neighbor_cache: dict[int, list[int]] = {}

    def neighbors(index: int) -> list[int]:
        cached = neighbor_cache.get(index)
        if cached is not None:
            return cached
        point = points[index]
        latitude_bucket, longitude_bucket = point_buckets[index]
        candidates: set[int] = set()
        # Two buckets is deliberately conservative around cell boundaries and the
        # small variation between spherical metres and degrees of latitude.
        for latitude_offset in range(-2, 3):
            for longitude_offset in range(-2, 3):
                candidates.update(
                    buckets.get(
                        (
                            latitude_bucket + latitude_offset,
                            longitude_bucket + longitude_offset,
                        ),
                        (),
                    )
                )
        result = sorted(
            candidate
            for candidate in candidates
            if haversine_m(
                point.latitude,
                point.longitude,
                points[candidate].latitude,
                points[candidate].longitude,
            )
            <= epsilon_m
        )
        neighbor_cache[index] = result
        return result

    unassigned = -99
    noise = -1
    labels = [unassigned] * len(points)
    cluster_number = 0

    for point_index in range(len(points)):
        if labels[point_index] != unassigned:
            continue
        point_neighbors = neighbors(point_index)
        if len(point_neighbors) < min_samples:
            labels[point_index] = noise
            continue

        labels[point_index] = cluster_number
        expansion = deque(point_neighbors)
        queued = set(point_neighbors)
        while expansion:
            candidate_index = expansion.popleft()
            if labels[candidate_index] == noise:
                labels[candidate_index] = cluster_number
            if labels[candidate_index] != unassigned:
                continue
            labels[candidate_index] = cluster_number
            candidate_neighbors = neighbors(candidate_index)
            if len(candidate_neighbors) >= min_samples:
                for neighbor_index in candidate_neighbors:
                    if neighbor_index not in queued:
                        expansion.append(neighbor_index)
                        queued.add(neighbor_index)
        cluster_number += 1

    grouped_indices: dict[int, list[int]] = defaultdict(list)
    for point_index, label in enumerate(labels):
        if label >= 0:
            grouped_indices[label].append(point_index)

    assignments: dict[str, ClusterAssignment] = {}
    radii: list[float] = []
    for member_indices in grouped_indices.values():
        member_ids = [points[index].id for index in member_indices]
        cluster_id = _stable_cluster_id(member_ids)
        centroid_latitude = sum(points[index].latitude for index in member_indices) / len(
            member_indices
        )
        centroid_longitude = sum(points[index].longitude for index in member_indices) / len(
            member_indices
        )
        radius_m = max(
            (
                haversine_m(
                    centroid_latitude,
                    centroid_longitude,
                    points[index].latitude,
                    points[index].longitude,
                )
                for index in member_indices
            ),
            default=0.0,
        )
        radii.append(radius_m)
        for index in member_indices:
            role: ClusterRole = "core" if len(neighbors(index)) >= min_samples else "border"
            assignments[points[index].id] = ClusterAssignment(
                cluster_id=cluster_id,
                role=role,
                radius_m=radius_m,
                member_count=len(member_indices),
            )

    noise_count = 0
    for point_index, label in enumerate(labels):
        if label != noise:
            continue
        point = points[point_index]
        assignments[point.id] = ClusterAssignment(
            cluster_id=_stable_cluster_id([point.id]),
            role="noise",
            radius_m=0.0,
            member_count=1,
        )
        radii.append(0.0)
        noise_count += 1

    total_clusters = len(grouped_indices) + noise_count
    return SpatialClusteringResult(
        assignments=assignments,
        cluster_count=total_clusters,
        multi_event_cluster_count=sum(len(indices) > 1 for indices in grouped_indices.values()),
        noise_event_count=noise_count,
        cluster_radii_m=tuple(radii),
    )
