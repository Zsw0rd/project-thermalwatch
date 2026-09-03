from __future__ import annotations

import json
import os
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from app.config import Settings, get_settings
from app.schemas.events import (
    IngestionRunCollection,
    IngestionRunRecord,
    NormalizedThermalEvent,
    OperationalHealth,
    RefreshResponse,
    SourceFileHealth,
)
from app.services.firms import current_source_files, refresh_source_files
from app.services.history_archive import history_readiness

_audit_lock = threading.Lock()


@contextmanager
def _audit_file_lock(path: Path):
    """Coordinate audit writes from the API and scheduler processes."""
    lock_path = path.with_suffix(f"{path.suffix}.lock")
    deadline = time.monotonic() + 10
    descriptor: int | None = None
    while descriptor is None:
        try:
            descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            try:
                if time.time() - lock_path.stat().st_mtime > 120:
                    lock_path.unlink(missing_ok=True)
                    continue
            except FileNotFoundError:
                continue
            if time.monotonic() >= deadline:
                raise TimeoutError("Timed out waiting for the ingestion audit lock")
            time.sleep(0.05)
    try:
        yield
    finally:
        os.close(descriptor)
        lock_path.unlink(missing_ok=True)


def _read_runs(path: Path) -> list[IngestionRunRecord]:
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(payload, list):
        return []
    records: list[IngestionRunRecord] = []
    for item in payload:
        try:
            records.append(IngestionRunRecord.model_validate(item))
        except (TypeError, ValueError):
            continue
    return records


def append_ingestion_run(
    record: IngestionRunRecord,
    settings: Settings | None = None,
) -> IngestionRunRecord:
    settings = settings or get_settings()
    path = settings.ingestion_audit_file
    path.parent.mkdir(parents=True, exist_ok=True)
    with _audit_lock, _audit_file_lock(path):
        records = _read_runs(path)
        records.append(record)
        temporary = path.with_suffix(f"{path.suffix}.{os.getpid()}.tmp")
        temporary.write_text(
            json.dumps(
                [item.model_dump(mode="json") for item in records],
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    return record


def ingestion_runs(
    settings: Settings | None = None,
    *,
    limit: int = 50,
) -> IngestionRunCollection:
    settings = settings or get_settings()
    records = sorted(
        _read_runs(settings.ingestion_audit_file),
        key=lambda record: record.finished_at,
        reverse=True,
    )
    return IngestionRunCollection(
        generated_at=datetime.now(UTC),
        total=len(records),
        runs=records[:limit],
    )


def run_firms_ingestion_cycle(
    trigger: Literal["manual_api", "scheduler"] = "scheduler",
    settings: Settings | None = None,
) -> RefreshResponse:
    settings = settings or get_settings()
    started_at = datetime.now(UTC)
    source_mode = (
        "authenticated_area_api" if settings.firms_map_key else "public_firms_feeds"
    )
    try:
        response = refresh_source_files(settings)
    except Exception as error:
        append_ingestion_run(
            IngestionRunRecord(
                run_id=uuid.uuid4().hex,
                trigger=trigger,
                status="failed",
                started_at=started_at,
                finished_at=datetime.now(UTC),
                source_mode=source_mode,
                files=[],
                archived_files=[],
                normalized_events=0,
                error_type=type(error).__name__,
            ),
            settings,
        )
        raise
    append_ingestion_run(
        IngestionRunRecord(
            run_id=uuid.uuid4().hex,
            trigger=trigger,
            status="succeeded",
            started_at=started_at,
            finished_at=response.refreshed_at,
            source_mode=source_mode,
            files=response.files,
            archived_files=response.archived_files,
            normalized_events=response.normalized_events,
        ),
        settings,
    )
    return response


def record_archive_only_run(
    *,
    started_at: datetime,
    finished_at: datetime,
    files: list[str],
    archived_files: list[str],
    normalized_events: int,
    settings: Settings | None = None,
) -> IngestionRunRecord:
    settings = settings or get_settings()
    return append_ingestion_run(
        IngestionRunRecord(
            run_id=uuid.uuid4().hex,
            trigger="archive_only",
            status="succeeded",
            started_at=started_at,
            finished_at=finished_at,
            source_mode="local_archive",
            files=files,
            archived_files=archived_files,
            normalized_events=normalized_events,
        ),
        settings,
    )


def operational_health(
    events: list[NormalizedThermalEvent],
    settings: Settings | None = None,
) -> OperationalHealth:
    settings = settings or get_settings()
    now = datetime.now(UTC)
    source_files = []
    freshness_threshold_hours = settings.firms_refresh_interval_minutes / 60 * 2
    for path in current_source_files(settings):
        modified_at = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
        age_hours = max(0.0, (now - modified_at).total_seconds() / 3600)
        is_cache = path.parent.resolve() == settings.firms_cache_dir.resolve()
        source_files.append(
            SourceFileHealth(
                name=path.name,
                origin="cache" if is_cache else "bundled",
                bytes=path.stat().st_size,
                modified_at=modified_at,
                age_hours=round(age_hours, 2),
                status=(
                    "fresh"
                    if is_cache and age_hours <= freshness_threshold_hours
                    else "stale"
                    if is_cache
                    else "bundled_snapshot"
                ),
            )
        )
    latest_observation = max((event.acquired_at for event in events), default=None)
    observation_lag = (
        max(0.0, (now - latest_observation).total_seconds() / 3600)
        if latest_observation
        else None
    )
    readiness = history_readiness(events, settings)
    runs = ingestion_runs(settings, limit=1)
    last_run = runs.runs[0] if runs.runs else None
    issues: list[str] = []
    if not events:
        issues.append("No normalized FIRMS observations are available.")
    if readiness.observed_calendar_days < 30:
        issues.append(
            f"Only {readiness.observed_calendar_days}/30 observed UTC dates are available."
        )
    if last_run and last_run.status == "failed":
        issues.append(f"The latest ingestion cycle failed with {last_run.error_type}.")
    if any(file.status == "stale" for file in source_files):
        issues.append("One or more live cache files exceed two refresh intervals.")
    if settings.demo_mode and not last_run:
        issues.append("No scheduled refresh is recorded; deterministic bundled evidence is active.")

    if not events or (last_run and last_run.status == "failed"):
        status = "attention"
    elif settings.demo_mode and not any(file.origin == "cache" for file in source_files):
        status = "demo_ready"
    elif all(file.status == "fresh" for file in source_files):
        status = "healthy"
    else:
        status = "attention"
    return OperationalHealth(
        generated_at=now,
        status=status,
        data_mode="snapshot" if settings.demo_mode else "live",
        normalized_events=len(events),
        latest_observation_at=latest_observation,
        observation_lag_hours=(round(observation_lag, 2) if observation_lag is not None else None),
        source_files=source_files,
        observed_calendar_days=readiness.observed_calendar_days,
        archive_snapshot_files=readiness.archive_snapshot_files,
        last_ingestion_run=last_run,
        refresh_interval_minutes=settings.firms_refresh_interval_minutes,
        scheduler_command="python -m app.jobs.firms_refresh --loop",
        issues=issues,
    )
