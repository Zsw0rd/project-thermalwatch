from app.config import get_settings
from app.services.boundary import contains_point, load_india_boundary
from app.services.firms import analytics_summary, load_events
from app.services.osm import load_facilities


def test_sample_pipeline_normalizes_and_filters_events() -> None:
    settings = get_settings()
    events = load_events(settings)

    assert events
    assert len({event.id for event in events}) == len(events)
    west, south, east, north = settings.india_bbox
    assert all(west <= event.longitude <= east for event in events)
    assert all(south <= event.latitude <= north for event in events)
    assert all(event.source_attribution.provider == "NASA FIRMS" for event in events)
    assert all(event.context_status.startswith("FIRMS_") for event in events)
    assert all(event.raw_payload for event in events)
    boundary = load_india_boundary(settings)
    assert boundary is not None
    assert all(contains_point(boundary, event.latitude, event.longitude) for event in events)
    assert all(event.administrative_area is not None for event in events)
    assert all(event.cluster_method == "metric_dbscan_haversine_v1" for event in events)
    assert all(event.cluster_epsilon_m == settings.clustering_epsilon_m for event in events)
    assert all(event.cluster_role in {"core", "border", "noise"} for event in events)


def test_osm_context_is_clipped_to_the_same_administrative_boundary() -> None:
    boundary = load_india_boundary()
    assert boundary is not None
    facilities = load_facilities()
    assert facilities
    assert all(
        contains_point(boundary, facility.latitude, facility.longitude) for facility in facilities
    )


def test_engineered_brightness_delta_is_consistent() -> None:
    events = load_events()
    with_two_bands = [
        event
        for event in events
        if event.brightness_i4_k is not None and event.brightness_i5_k is not None
    ]
    assert with_two_bands
    for event in with_two_bands:
        expected = event.brightness_i4_k - event.brightness_i5_k
        assert event.brightness_delta_k == expected


def test_analytics_summary_matches_event_repository() -> None:
    events = load_events()
    summary = analytics_summary(events)

    assert summary.total_events == len(events)
    assert sum(summary.sensor_counts.values()) == len(events)
    assert summary.max_frp_mw >= summary.mean_frp_mw >= 0
