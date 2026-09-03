from __future__ import annotations

import hashlib
import shutil
from datetime import UTC, datetime
from pathlib import Path

from app.config import Settings, get_settings
from app.schemas.events import HistoricalReadiness, NormalizedThermalEvent


def _digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(block)
    return hasher.hexdigest()


def archive_source_files(
    paths: list[Path],
    settings: Settings | None = None,
    archived_at: datetime | None = None,
) -> list[str]:
    """Copy raw source files into immutable, content-addressed daily snapshots."""
    settings = settings or get_settings()
    archived_at = archived_at or datetime.now(UTC)
    archived: list[str] = []
    for source in paths:
        if not source.exists() or not source.is_file():
            continue
        digest = _digest(source)
        destination = (
            settings.firms_archive_dir / archived_at.date().isoformat() / digest[:12] / source.name
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            shutil.copy2(source, destination)
        archived.append(str(destination))
    return archived


def history_readiness(
    events: list[NormalizedThermalEvent],
    settings: Settings | None = None,
) -> HistoricalReadiness:
    settings = settings or get_settings()
    observed_dates = {event.acquired_at.date() for event in events}
    window_start = min((event.acquired_at for event in events), default=None)
    window_end = max((event.acquired_at for event in events), default=None)
    observed_days = len(observed_dates)
    span_days = (
        (window_end.date() - window_start.date()).days + 1
        if window_start is not None and window_end is not None
        else 0
    )
    if observed_days >= 90:
        status = "ninety_day_ready"
    elif observed_days >= 30:
        status = "thirty_day_candidate"
    else:
        status = "insufficient_history"
    return HistoricalReadiness(
        generated_at=datetime.now(UTC),
        observation_window_start=window_start,
        observation_window_end=window_end,
        observed_calendar_days=observed_days,
        calendar_span_days=span_days,
        unique_events=len({event.id for event in events}),
        unique_cells=len({event.cluster_id for event in events}),
        archive_snapshot_files=len(list(settings.firms_archive_dir.rglob("*.csv"))),
        bundled_seed_files=len(list(settings.firms_sample_dir.glob("*.csv"))),
        readiness_30_percent=round(min(100, observed_days / 30 * 100), 1),
        readiness_90_percent=round(min(100, observed_days / 90 * 100), 1),
        status=status,
        methodology=(
            "Readiness counts distinct UTC acquisition dates across de-duplicated FIRMS "
            "records. Successful refreshes are copied byte-for-byte into content-addressed "
            "daily archive folders before normalization."
        ),
        caveats=[
            "Readiness is coverage telemetry, not evidence that a learned seasonal baseline exists.",
            "Missing source days and satellite coverage gaps are not interpolated.",
            "The deterministic bundled snapshot remains available when live services are unavailable.",
        ],
    )
