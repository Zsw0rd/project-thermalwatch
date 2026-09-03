from datetime import UTC, datetime

from app.config import Settings
from app.services.boundary import contains_point, load_india_boundary
from app.services.history_archive import archive_source_files


def test_india_boundary_contains_mainland_and_island_points() -> None:
    boundary = load_india_boundary()
    assert boundary is not None
    assert contains_point(boundary, 28.6139, 77.2090)  # New Delhi
    assert contains_point(boundary, 12.9716, 77.5946)  # Bengaluru
    assert contains_point(boundary, 11.6234, 92.7265)  # Port Blair
    assert not contains_point(boundary, 31.5204, 74.3587)  # Lahore
    assert not contains_point(boundary, 23.8103, 90.4125)  # Dhaka
    assert not contains_point(boundary, 6.9271, 79.8612)  # Colombo


def test_archive_is_content_addressed_and_idempotent(tmp_path) -> None:
    source_dir = tmp_path / "source"
    source_dir.mkdir()
    source = source_dir / "J1_VIIRS_C2_South_Asia_7d.csv"
    source.write_text("latitude,longitude,frp\n20,78,5\n", encoding="utf-8")
    settings = Settings(firms_archive_dir=tmp_path / "archive")
    archived_at = datetime(2026, 9, 3, tzinfo=UTC)

    first = archive_source_files([source], settings, archived_at)
    second = archive_source_files([source], settings, archived_at)

    assert first == second
    assert len(list(settings.firms_archive_dir.rglob("*.csv"))) == 1
    assert "2026-09-03" in first[0]
    assert source.read_bytes() == next(settings.firms_archive_dir.rglob("*.csv")).read_bytes()

    source.write_text("latitude,longitude,frp\n20,78,7\n", encoding="utf-8")
    archive_source_files([source], settings, archived_at)
    assert len(list(settings.firms_archive_dir.rglob("*.csv"))) == 2
