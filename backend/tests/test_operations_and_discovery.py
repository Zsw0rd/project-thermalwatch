from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.schemas.events import IngestionRunRecord, RefreshResponse
from app.services import ingestion_operations
from app.services.firms import load_events
from app.services.ingestion_operations import (
    append_ingestion_run,
    ingestion_runs,
    operational_health,
    run_firms_ingestion_cycle,
)
from app.services.source_fingerprint import (
    build_source_fingerprints,
    source_fingerprint_collection,
)

client = TestClient(app)


def test_ingestion_audit_is_append_only_and_newest_first(tmp_path) -> None:
    settings = Settings(ingestion_audit_file=tmp_path / "ingestion_runs.json")
    started_at = datetime(2026, 9, 3, 8, tzinfo=UTC)
    for offset in range(2):
        append_ingestion_run(
            IngestionRunRecord(
                run_id=f"run-{offset}",
                trigger="scheduler",
                status="succeeded",
                started_at=started_at + timedelta(hours=offset),
                finished_at=started_at + timedelta(hours=offset, minutes=1),
                source_mode="public_firms_feeds",
                files=[f"source-{offset}.csv"],
                archived_files=[f"archive-{offset}.csv"],
                normalized_events=777,
            ),
            settings,
        )

    collection = ingestion_runs(settings, limit=1)
    assert collection.total == 2
    assert [run.run_id for run in collection.runs] == ["run-1"]
    assert not settings.ingestion_audit_file.with_suffix(".json.lock").exists()


def test_ingestion_cycle_records_success(monkeypatch, tmp_path) -> None:
    settings = Settings(ingestion_audit_file=tmp_path / "ingestion_runs.json")
    refreshed_at = datetime(2026, 9, 3, 9, tzinfo=UTC)

    def fake_refresh(_: Settings) -> RefreshResponse:
        return RefreshResponse(
            refreshed_at=refreshed_at,
            files=["cache/source.csv"],
            archived_files=["archive/source.csv"],
            normalized_events=12,
            message="test refresh",
        )

    monkeypatch.setattr(ingestion_operations, "refresh_source_files", fake_refresh)
    response = run_firms_ingestion_cycle("scheduler", settings)
    runs = ingestion_runs(settings)

    assert response.normalized_events == 12
    assert runs.total == 1
    assert runs.runs[0].status == "succeeded"
    assert runs.runs[0].trigger == "scheduler"


def test_ingestion_cycle_records_only_sanitized_failure_type(monkeypatch, tmp_path) -> None:
    settings = Settings(ingestion_audit_file=tmp_path / "ingestion_runs.json")

    def fake_failure(_: Settings) -> RefreshResponse:
        raise RuntimeError("credential-bearing upstream detail")

    monkeypatch.setattr(ingestion_operations, "refresh_source_files", fake_failure)
    with pytest.raises(RuntimeError, match="credential-bearing"):
        run_firms_ingestion_cycle("manual_api", settings)

    runs = ingestion_runs(settings)
    assert runs.runs[0].status == "failed"
    assert runs.runs[0].error_type == "RuntimeError"
    assert "credential-bearing" not in settings.ingestion_audit_file.read_text(encoding="utf-8")


def test_operational_health_exposes_freshness_and_history_limits(tmp_path) -> None:
    settings = Settings(ingestion_audit_file=tmp_path / "ingestion_runs.json")
    events = load_events()
    health = operational_health(events, settings)

    assert health.normalized_events == len(events)
    assert health.status in {"healthy", "demo_ready", "attention"}
    assert health.source_files
    assert health.observed_calendar_days >= 7
    assert health.refresh_interval_minutes == 360
    assert "firms_refresh" in health.scheduler_command
    assert any("/30 observed UTC dates" in issue for issue in health.issues)


def test_source_fingerprints_are_stable_and_unknowns_are_ranked() -> None:
    events = load_events()
    fingerprints = build_source_fingerprints(events)
    repeated = build_source_fingerprints(events)
    discoveries = source_fingerprint_collection(
        events,
        category="unknown",
        discoveries_only=True,
        limit=100,
    )

    assert len(fingerprints) == len({event.cluster_id for event in events})
    assert [item.fingerprint_id for item in fingerprints] == [
        item.fingerprint_id for item in repeated
    ]
    assert discoveries.total > 0
    assert all(item.category == "unknown" for item in discoveries.fingerprints)
    assert all(item.source_context == "unresolved" for item in discoveries.fingerprints)
    assert discoveries.fingerprints[0].discovery_priority >= discoveries.fingerprints[-1].discovery_priority
    assert "not a source identity" in discoveries.methodology


def test_operations_and_discovery_endpoints_are_evidence_bounded() -> None:
    health_response = client.get("/api/v1/operations/health")
    runs_response = client.get("/api/v1/operations/ingestion-runs")
    discovery_response = client.get("/api/v1/discoveries/unknown", params={"limit": 5})
    fingerprint_response = client.get(
        "/api/v1/source-fingerprints",
        params={"category": "industrial", "limit": 3},
    )

    assert health_response.status_code == 200
    assert runs_response.status_code == 200
    assert discovery_response.status_code == 200
    assert fingerprint_response.status_code == 200
    assert len(discovery_response.json()["fingerprints"]) == 5
    assert all(
        item["discovery_status"] in {"priority_unknown", "watch_unknown"}
        for item in discovery_response.json()["fingerprints"]
    )
    assert all(
        item["category"] == "industrial"
        for item in fingerprint_response.json()["fingerprints"]
    )
