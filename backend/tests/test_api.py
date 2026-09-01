from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_reports_data_mode() -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["data_mode"] in {"snapshot", "live"}


def test_events_endpoint_returns_attributed_firms_data() -> None:
    response = client.get("/api/v1/events", params={"limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "operational"
    assert body["total"] >= body["returned"] > 0
    assert len(body["events"]) == 5
    assert body["events"][0]["source_attribution"]["provider"] == "NASA FIRMS"
    assert "raw_payload" not in body["events"][0]


def test_event_filters_and_geojson() -> None:
    filtered = client.get("/api/v1/events", params={"confidence": "high", "min_frp": 1})
    assert filtered.status_code == 200
    assert all(event["confidence"] == "high" for event in filtered.json()["events"])

    geojson = client.get("/api/v1/events.geojson", params={"limit": 10})
    assert geojson.status_code == 200
    assert geojson.json()["type"] == "FeatureCollection"
    assert len(geojson.json()["features"]) <= 10


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
