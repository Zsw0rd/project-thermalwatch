from collections import Counter, defaultdict
from datetime import UTC, datetime
from functools import lru_cache

from app.schemas.events import (
    ClusteringSensitivityReport,
    ClusteringSensitivityVariant,
    NormalizedThermalEvent,
)
from app.services.spatial_clustering import (
    ClusterAssignment,
    SpatialObservation,
    cluster_observations,
    radius_percentiles,
)

PARAMETER_GRID = (
    (500.0, 2),
    (750.0, 2),
    (1_000.0, 2),
    (1_500.0, 2),
    (500.0, 3),
    (750.0, 3),
    (1_000.0, 3),
    (1_500.0, 3),
)


def _co_membership_pairs(
    assignments: dict[str, ClusterAssignment],
) -> frozenset[tuple[str, str]]:
    members_by_cluster: dict[str, list[str]] = defaultdict(list)
    for event_id, assignment in assignments.items():
        if assignment.role != "noise":
            members_by_cluster[assignment.cluster_id].append(event_id)
    return frozenset(
        (members[left], members[right])
        for members in members_by_cluster.values()
        for left in range(len(members))
        for right in range(left + 1, len(members))
    )


def _jaccard(left: frozenset[tuple[str, str]], right: frozenset[tuple[str, str]]) -> float:
    union = left | right
    if not union:
        return 1.0
    return len(left & right) / len(union)


@lru_cache(maxsize=4)
def _evaluate(
    observations: tuple[SpatialObservation, ...],
    operational_epsilon_m: float,
    operational_min_samples: int,
) -> tuple[ClusteringSensitivityVariant, ...]:
    operational = cluster_observations(
        list(observations),
        epsilon_m=operational_epsilon_m,
        min_samples=operational_min_samples,
    )
    operational_pairs = _co_membership_pairs(operational.assignments)
    variants: list[ClusteringSensitivityVariant] = []
    for epsilon_m, min_samples in PARAMETER_GRID:
        result = cluster_observations(
            list(observations),
            epsilon_m=epsilon_m,
            min_samples=min_samples,
        )
        role_counts = Counter(
            assignment.role for assignment in result.assignments.values()
        )
        supported_radii = tuple(
            {
                assignment.cluster_id: assignment.radius_m
                for assignment in result.assignments.values()
                if assignment.role != "noise"
            }.values()
        )
        median_radius, p95_radius, maximum_radius = radius_percentiles(
            supported_radii
        )
        variants.append(
            ClusteringSensitivityVariant(
                epsilon_m=epsilon_m,
                min_samples=min_samples,
                is_operational_setting=(
                    epsilon_m == operational_epsilon_m
                    and min_samples == operational_min_samples
                ),
                total_clusters=result.cluster_count,
                multi_event_clusters=result.multi_event_cluster_count,
                largest_cluster_events=max(
                    (
                        assignment.member_count
                        for assignment in result.assignments.values()
                    ),
                    default=0,
                ),
                core_events=role_counts["core"],
                border_events=role_counts["border"],
                noise_events=result.noise_event_count,
                noise_percent=round(
                    result.noise_event_count / max(1, len(observations)) * 100,
                    2,
                ),
                median_supported_radius_m=round(median_radius, 2),
                p95_supported_radius_m=round(p95_radius, 2),
                maximum_supported_radius_m=round(maximum_radius, 2),
                co_membership_jaccard_vs_operational=round(
                    _jaccard(
                        _co_membership_pairs(result.assignments),
                        operational_pairs,
                    ),
                    4,
                ),
            )
        )
    return tuple(variants)


def clustering_sensitivity_report(
    events: list[NormalizedThermalEvent],
) -> ClusteringSensitivityReport:
    operational_epsilon_m = events[0].cluster_epsilon_m if events else 750.0
    operational_min_samples = events[0].cluster_min_samples if events else 2
    observations = tuple(
        SpatialObservation(event.id, event.latitude, event.longitude)
        for event in events
    )
    return ClusteringSensitivityReport(
        generated_at=datetime.now(UTC),
        event_count=len(events),
        operational_epsilon_m=operational_epsilon_m,
        operational_min_samples=operational_min_samples,
        variants=list(
            _evaluate(
                observations,
                operational_epsilon_m,
                operational_min_samples,
            )
        ),
        methodology=(
            "Deterministic Haversine DBSCAN sweep across 500–1,500 m and two- or "
            "three-sample density thresholds. Pairwise co-membership Jaccard compares "
            "each variant with the operational 750 m / two-sample grouping."
        ),
        caveats=[
            "Sensitivity describes clustering behavior, not classification accuracy or incident validity.",
            "A high co-membership score can still preserve a systematically incorrect grouping.",
            "The eight-date source window is too short to select production parameters.",
            "Reviewed source examples and region/season holdouts are required before calibration.",
        ],
    )
