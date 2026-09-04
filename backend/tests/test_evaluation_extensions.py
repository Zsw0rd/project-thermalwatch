from app.config import Settings
from app.services.clustering_sensitivity import clustering_sensitivity_report
from app.services.evidence_graph import build_event_evidence_graph
from app.services.firms import load_events
from app.services.model_pipeline import model_registry


def test_evidence_graph_is_attributed_connected_and_non_confirmatory() -> None:
    event = load_events()[0]
    graph = build_event_evidence_graph(event)

    node_ids = {node.node_id for node in graph.nodes}
    assert graph.classification_node_id in node_ids
    assert "firms-observation" in node_ids
    assert "interpretation-boundary" in node_ids
    assert all(edge.source_node_id in node_ids for edge in graph.edges)
    assert all(edge.target_node_id in node_ids for edge in graph.edges)
    assert all(edge.target_node_id == graph.classification_node_id for edge in graph.edges)
    assert any(node.source_url for node in graph.nodes if node.kind == "observation")
    assert "not proof" in graph.interpretation_boundary.lower()


def test_clustering_sensitivity_includes_operational_control_and_no_accuracy_claim() -> None:
    report = clustering_sensitivity_report(load_events())
    controls = [variant for variant in report.variants if variant.is_operational_setting]

    assert len(report.variants) == 8
    assert len(controls) == 1
    assert controls[0].co_membership_jaccard_vs_operational == 1.0
    assert controls[0].core_events + controls[0].border_events + controls[0].noise_events == report.event_count
    assert "not classification accuracy" in report.caveats[0].lower()


def test_registry_has_one_serving_rules_model_and_no_automatic_candidate() -> None:
    settings = Settings()
    registry = model_registry(load_events(settings), settings)
    serving = [entry for entry in registry.entries if entry.serving]

    assert len(serving) == 1
    assert serving[0].version == registry.operational_version
    assert registry.rollback_target == "rules_temporal_metric_v3"
    assert all(
        not entry.serving
        for entry in registry.entries
        if entry.lifecycle != "operational"
    )
    assert "never auto-promote" in registry.promotion_policy[-1].lower()
