from app.config import Settings
from app.schemas.events import ClusterReviewUpdate
from app.services.cluster_review import cluster_review_collection, create_cluster_review
from app.services.firms import load_events
from app.services.temporal import build_cluster_summaries


def test_cluster_reviews_are_append_only_evidence_snapshots(tmp_path) -> None:
    events = load_events()
    cluster = build_cluster_summaries(events)[0]
    representative = next(event for event in events if event.id == cluster.representative_event_id)
    settings = Settings(cluster_review_file=tmp_path / "reviews.json")

    first = create_cluster_review(
        cluster,
        representative,
        ClusterReviewUpdate(
            label="uncertain",
            note="Insufficient independent evidence",
            reviewed_by="pytest",
        ),
        settings,
    )
    second = create_cluster_review(
        cluster,
        representative,
        ClusterReviewUpdate(
            label="likely_industrial",
            note="Mapped facility context supports this label",
            reviewed_by="pytest",
        ),
        settings,
    )
    collection = cluster_review_collection(settings)

    assert first.incident_confirmation is False
    assert second.review_id != first.review_id
    assert collection.total == 2
    assert collection.unique_reviewed_clusters == 1
    assert collection.label_counts == {"uncertain": 1, "likely_industrial": 1}
    assert collection.reviews[0].evidence_snapshot["cluster_method"] == "metric_dbscan_haversine_v1"
