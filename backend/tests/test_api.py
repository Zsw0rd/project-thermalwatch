from fastapi.testclient import TestClient

from app.main import app
from app.services.land_cover import slippy_tile_position

client = TestClient(app)


def test_health_reports_data_mode() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "aegisfire-api"
    assert body["data_mode"] in {"snapshot", "live"}

    root = client.get("/api/v1")
    assert root.status_code == 200
    assert root.json()["name"] == "AegisFire API"


def test_events_endpoint_returns_attributed_firms_data() -> None:
    response = client.get("/api/v1/events", params={"limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "operational"
    assert body["total"] >= body["returned"] > 0
    assert len(body["events"]) == 5
    assert body["events"][0]["source_attribution"]["provider"] == "NASA FIRMS"
    assert body["events"][0]["land_cover"]["provider"] == "NASA EOSDIS GIBS"
    assert (
        body["events"][0]["feature_version"] == "firms_osm_modis_igbp_india_adm0_metric_dbscan_v4"
    )
    assert body["events"][0]["cluster_method"] == "metric_dbscan_haversine_v1"
    assert body["events"][0]["administrative_area"]["iso3"] == "IND"
    assert "raw_payload" not in body["events"][0]


def test_land_cover_source_is_attributed_and_sampled() -> None:
    response = client.get("/api/v1/land-cover/source")
    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "NASA EOSDIS GIBS"
    assert payload["layer_id"] == "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual"
    assert payload["observation_date"] == "2024-01-01"
    assert payload["sampled_cells"] > 2_000
    assert "not contemporaneous" in payload["limitation"].lower()


def test_land_cover_pixel_lookup_uses_standard_web_mercator_position() -> None:
    assert slippy_tile_position(19.076, 72.878) == (179, 114, 211, 45)


def test_geography_and_historical_readiness_are_explicit() -> None:
    geography = client.get("/api/v1/geography/india")
    assert geography.status_code == 200
    geography_body = geography.json()
    assert geography_body["type"] == "FeatureCollection"
    assert geography_body["features"][0]["geometry"]["type"] == "MultiPolygon"
    assert geography_body["attribution"]["provider"] == "geoBoundaries"
    assert geography_body["attribution"]["license"] == "CC0 1.0"

    readiness = client.get("/api/v1/history/readiness")
    assert readiness.status_code == 200
    readiness_body = readiness.json()
    assert readiness_body["observed_calendar_days"] >= 7
    assert readiness_body["readiness_30_percent"] < 100
    assert readiness_body["status"] == "insufficient_history"
    assert "not evidence" in readiness_body["caveats"][0].lower()


def test_event_filters_and_geojson() -> None:
    filtered = client.get("/api/v1/events", params={"confidence": "high", "min_frp": 1})
    assert filtered.status_code == 200
    assert all(event["confidence"] == "high" for event in filtered.json()["events"])

    geojson = client.get("/api/v1/events.geojson", params={"limit": 10})
    assert geojson.status_code == 200
    assert geojson.json()["type"] == "FeatureCollection"
    assert len(geojson.json()["features"]) <= 10
    assert geojson.json()["features"][0]["properties"]["land_cover_class"]


def test_invalid_bbox_is_rejected() -> None:
    response = client.get("/api/v1/events", params={"bbox": "98,38,68,6"})
    assert response.status_code == 422


def test_alerts_are_review_items_not_incident_confirmations() -> None:
    response = client.get("/api/v1/alerts")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] > 0
    assert "no alert confirms a fire" in payload["methodology"].lower()
    assert all(alert["review_status"] == "requires_analyst_review" for alert in payload["alerts"])


def test_facilities_endpoint_preserves_osm_attribution() -> None:
    response = client.get("/api/v1/facilities", params={"limit": 3})
    assert response.status_code == 200
    payload = response.json()
    assert payload["source"] == "OpenStreetMap / Overpass"
    assert payload["total"] >= len(payload["facilities"]) == 3


def test_seven_day_temporal_cluster_and_history_surfaces() -> None:
    events_response = client.get(
        "/api/v1/events",
        params={"min_frp": 1, "window_hours": 24, "limit": 3},
    )
    assert events_response.status_code == 200
    event = events_response.json()["events"][0]
    assert event["observation_window_days"] >= 7
    assert event["active_days"] >= 1
    assert event["baseline_frp_mw"] >= 0
    assert event["model_version"] == "rules_temporal_metric_v3"

    history_response = client.get(f"/api/v1/events/{event['id']}/history")
    assert history_response.status_code == 200
    history = history_response.json()
    assert history["cluster_id"] == event["cluster_id"]
    assert history["temporal_history"]
    assert "incident confirmation" in " ".join(history["evidence"]).lower()


def test_cluster_and_analytics_dashboards_are_evidence_bounded() -> None:
    cluster_response = client.get("/api/v1/clusters", params={"limit": 5})
    assert cluster_response.status_code == 200
    clusters = cluster_response.json()
    assert clusters["observation_window_days"] >= 7
    assert clusters["total"] >= clusters["returned"] == 5
    assert all(
        cluster["data_quality"] in {"seven_day_observation", "snapshot_only"}
        for cluster in clusters["clusters"]
    )
    assert any("not incident confirmation" in caveat for caveat in clusters["caveats"])

    analytics_response = client.get("/api/v1/analytics/dashboard")
    assert analytics_response.status_code == 200
    analytics = analytics_response.json()
    assert analytics["total_events"] > 0
    assert analytics["total_clusters"] > 0
    assert len(analytics["daily_activity"]) >= 7
    assert "no trained ml" in analytics["methodology"].lower()


def test_clustering_diagnostics_expose_metric_grouping_and_noise() -> None:
    response = client.get("/api/v1/clustering/diagnostics")
    assert response.status_code == 200
    diagnostics = response.json()
    assert diagnostics["algorithm"] == "DBSCAN"
    assert diagnostics["distance_metric"] == "Haversine great-circle distance"
    assert diagnostics["epsilon_m"] == 750
    assert diagnostics["min_samples"] == 2
    assert diagnostics["total_events"] > 0
    assert (
        diagnostics["clustered_events"] + diagnostics["noise_events"] == diagnostics["total_events"]
    )
    assert diagnostics["total_clusters"] == (
        diagnostics["multi_event_clusters"] + diagnostics["singleton_clusters"]
    )
    assert "do not validate or confirm incidents" in " ".join(diagnostics["caveats"]).lower()


def test_validation_collection_is_explicitly_non_confirmatory() -> None:
    response = client.get("/api/v1/validation/reviews")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == len(payload["reviews"])
    assert "never assert incident confirmation" in payload["methodology"].lower()
    assert all(review["incident_confirmation"] is False for review in payload["reviews"])


def test_playback_frames_are_temporal_and_evidence_bounded() -> None:
    response = client.get("/api/v1/playback")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_events"] > 0
    assert len(payload["frames"]) >= 7
    assert [frame["date"] for frame in payload["frames"]] == sorted(
        frame["date"] for frame in payload["frames"]
    )
    assert sum(frame["detection_count"] for frame in payload["frames"]) == payload["total_events"]
    assert "not fire spread" in " ".join(payload["caveats"]).lower()


def test_facility_monitors_expose_observed_history_without_causation_claims() -> None:
    response = client.get("/api/v1/facility-monitors", params={"limit": 5})
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= payload["returned"] == 5
    monitor = payload["monitors"][0]
    assert monitor["history"]
    assert monitor["facility"]["osm_id"]
    assert "does not establish" in monitor["caveat"].lower()

    detail = client.get(f"/api/v1/facility-monitors/{monitor['monitor_id']}")
    assert detail.status_code == 200
    assert detail.json()["monitor_id"] == monitor["monitor_id"]


def test_alert_review_lifecycle_round_trip() -> None:
    alerts = client.get("/api/v1/alerts").json()["alerts"]
    alert_id = alerts[0]["id"]
    acknowledged = client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={
            "status": "acknowledged",
            "note": "Reviewed in automated API test",
            "reviewed_by": "pytest",
        },
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["review_status"] == "acknowledged"
    assert acknowledged.json()["reviewed_at"] is not None

    refreshed = client.get("/api/v1/alerts").json()["alerts"]
    reviewed = next(alert for alert in refreshed if alert["id"] == alert_id)
    assert reviewed["review_status"] == "acknowledged"

    reset = client.patch(
        f"/api/v1/alerts/{alert_id}",
        json={"status": "requires_analyst_review", "reviewed_by": "pytest"},
    )
    assert reset.status_code == 200
    assert reset.json()["review_status"] == "requires_analyst_review"
