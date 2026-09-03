import math

from app.config import Settings
from app.schemas.events import ClusterReviewUpdate
from app.services.cluster_review import create_cluster_review
from app.services.firms import load_events
from app.services.model_pipeline import (
    FEATURE_NAMES,
    TARGET_CLASSES,
    build_training_samples,
    model_training_readiness,
)
from app.services.temporal import build_cluster_summaries


def test_cluster_feature_contract_is_finite_and_location_free() -> None:
    events = load_events()
    samples = build_training_samples(events, [])

    assert samples
    assert len(samples) == len({event.cluster_id for event in events})
    assert all(len(sample.features) == len(FEATURE_NAMES) for sample in samples)
    assert all(math.isfinite(value) for sample in samples for value in sample.features)
    assert all(sample.weak_label in TARGET_CLASSES for sample in samples)
    assert "latitude" not in FEATURE_NAMES
    assert "longitude" not in FEATURE_NAMES


def test_reviewed_training_gate_counts_only_latest_eligible_label(tmp_path) -> None:
    events = load_events()
    cluster = build_cluster_summaries(events)[0]
    representative = next(
        event for event in events if event.id == cluster.representative_event_id
    )
    settings = Settings(
        cluster_review_file=tmp_path / "reviews.json",
        model_benchmark_report_file=tmp_path / "benchmark.json",
    )
    create_cluster_review(
        cluster,
        representative,
        ClusterReviewUpdate(label="uncertain", reviewed_by="pytest"),
        settings,
    )
    create_cluster_review(
        cluster,
        representative,
        ClusterReviewUpdate(label="likely_industrial", reviewed_by="pytest"),
        settings,
    )

    readiness = model_training_readiness(events, settings)

    assert readiness.reviewed_records == 2
    assert readiness.reviewed_clusters == 1
    assert readiness.eligible_reviewed_samples == 1
    assert readiness.reviewed_label_counts["industrial"] == 1
    assert readiness.excluded_or_uncertain_reviews == 0
    assert readiness.status == "blocked_insufficient_reviewed_labels"
