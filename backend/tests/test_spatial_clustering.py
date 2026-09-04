from app.services.spatial_clustering import (
    SpatialObservation,
    cluster_observations,
    haversine_m,
)


def test_haversine_distance_is_metric_and_geographically_plausible() -> None:
    distance = haversine_m(20.0, 78.0, 20.005, 78.0)
    assert 550 < distance < 560


def test_dbscan_is_deterministic_and_retains_noise_as_singletons() -> None:
    observations = [
        SpatialObservation("a", 20.0, 78.0),
        SpatialObservation("b", 20.005, 78.0),
        SpatialObservation("c", 20.010, 78.0),
        SpatialObservation("d", 22.0, 80.0),
    ]
    forward = cluster_observations(observations, epsilon_m=750, min_samples=3)
    reverse = cluster_observations(list(reversed(observations)), epsilon_m=750, min_samples=3)

    assert forward.assignments == reverse.assignments
    assert len({forward.assignments[key].cluster_id for key in ("a", "b", "c")}) == 1
    assert forward.assignments["b"].role == "core"
    assert forward.assignments["a"].role == "border"
    assert forward.assignments["c"].role == "border"
    assert forward.assignments["d"].role == "noise"
    assert forward.assignments["d"].member_count == 1
    assert forward.multi_event_cluster_count == 1
    assert forward.noise_event_count == 1


def test_dbscan_rejects_invalid_density_configuration() -> None:
    observations = [SpatialObservation("a", 20.0, 78.0)]
    try:
        cluster_observations(observations, epsilon_m=0, min_samples=2)
    except ValueError as error:
        assert "epsilon_m" in str(error)
    else:
        raise AssertionError("Expected a positive-epsilon validation error")
