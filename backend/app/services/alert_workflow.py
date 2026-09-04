from __future__ import annotations

import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from threading import Lock
from typing import Any

from app.config import Settings, get_settings
from app.schemas.events import AlertPreview, AlertReviewStatus, AlertReviewUpdate

STATE_FILENAME = "alert_review_state.json"
_state_lock = Lock()


def _state_path(settings: Settings) -> Path:
    return settings.firms_cache_dir / STATE_FILENAME


def _read_states(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return {}
    if not isinstance(payload, dict):
        return {}
    return {
        str(alert_id): state
        for alert_id, state in payload.items()
        if isinstance(state, dict)
    }


def _write_states(path: Path, states: dict[str, dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=path.parent,
        delete=False,
        suffix=".json",
    ) as temporary:
        json.dump(states, temporary, ensure_ascii=False, indent=2, sort_keys=True)
        temporary_path = Path(temporary.name)
    temporary_path.replace(path)


def apply_alert_review_states(
    alerts: list[AlertPreview],
    settings: Settings | None = None,
) -> list[AlertPreview]:
    settings = settings or get_settings()
    with _state_lock:
        states = _read_states(_state_path(settings))
    return [
        alert.model_copy(
            update={
                "review_status": state.get("status", alert.review_status),
                "review_note": state.get("note"),
                "reviewed_by": state.get("reviewed_by"),
                "reviewed_at": (
                    datetime.fromisoformat(state["reviewed_at"])
                    if state.get("reviewed_at")
                    else None
                ),
            }
        )
        if (state := states.get(alert.id))
        else alert
        for alert in alerts
    ]


def update_alert_review(
    alert: AlertPreview,
    update: AlertReviewUpdate,
    settings: Settings | None = None,
) -> AlertPreview:
    settings = settings or get_settings()
    path = _state_path(settings)
    now = datetime.now(UTC)
    reset = update.status == "requires_analyst_review"
    state: dict[str, str | None] = {
        "status": update.status,
        "note": None if reset else update.note,
        "reviewed_by": None if reset else update.reviewed_by,
        "reviewed_at": None if reset else now.isoformat(),
    }
    with _state_lock:
        states = _read_states(path)
        states[alert.id] = state
        _write_states(path, states)
    return alert.model_copy(
        update={
            "review_status": update.status,
            "review_note": state["note"],
            "reviewed_by": state["reviewed_by"],
            "reviewed_at": None if reset else now,
        }
    )


def review_status_counts(alerts: list[AlertPreview]) -> dict[AlertReviewStatus, int]:
    counts: dict[AlertReviewStatus, int] = {
        "requires_analyst_review": 0,
        "acknowledged": 0,
        "investigating": 0,
        "closed": 0,
    }
    for alert in alerts:
        counts[alert.review_status] += 1
    return counts
