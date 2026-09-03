from datetime import UTC, datetime

from app.schemas.events import (
    EventEvidenceGraph,
    EvidenceGraphEdge,
    EvidenceGraphNode,
    NormalizedThermalEvent,
)


def build_event_evidence_graph(event: NormalizedThermalEvent) -> EventEvidenceGraph:
    conclusion_id = "classification"
    nodes = [
        EvidenceGraphNode(
            node_id="firms-observation",
            kind="observation",
            label="NASA FIRMS observation",
            value=(
                f"{event.frp_mw:.2f} MW FRP · {event.confidence} confidence · "
                f"{event.satellite}"
            ),
            source=(
                f"{event.source_attribution.provider} · "
                f"{event.source_attribution.product}"
            ),
            source_url=event.source_attribution.source_url,
            direction="supports",
        ),
        EvidenceGraphNode(
            node_id="temporal-recurrence",
            kind="temporal",
            label="Observed recurrence",
            value=(
                f"{event.active_days}/{event.observation_window_days} active days · "
                f"score {event.recurrence_score:.2f}"
            ),
            source="AegisFire temporal engine · retained FIRMS observations",
            direction="supports" if event.active_days >= 2 else "neutral",
        ),
        EvidenceGraphNode(
            node_id="spatial-cluster",
            kind="spatial",
            label="Metric source grouping",
            value=(
                f"{event.cluster_detection_count} detections · "
                f"{event.cluster_radius_m:.0f} m radius · {event.cluster_role} point"
            ),
            source=(
                f"AegisFire Haversine DBSCAN · {event.cluster_epsilon_m:.0f} m epsilon · "
                f"minimum {event.cluster_min_samples}"
            ),
            direction="supports" if event.cluster_role != "noise" else "limits",
        ),
    ]

    if event.nearest_facility:
        facility = event.nearest_facility
        nodes.append(
            EvidenceGraphNode(
                node_id="facility-context",
                kind="context",
                label="Mapped industrial context",
                value=(
                    f"{facility.name} · {facility.facility_type.replace('_', ' ')} · "
                    f"{facility.distance_m:.0f} m"
                ),
                source="OpenStreetMap proximity context",
                source_url="https://www.openstreetmap.org/copyright",
                direction=("supports" if event.category == "industrial" else "neutral"),
            )
        )
    else:
        nodes.append(
            EvidenceGraphNode(
                node_id="facility-context",
                kind="context",
                label="Mapped industrial context",
                value="No supported OSM facility found within 25 km",
                source="OpenStreetMap proximity context",
                source_url="https://www.openstreetmap.org/copyright",
                direction="limits" if event.category == "industrial" else "neutral",
            )
        )

    if event.land_cover:
        nodes.append(
            EvidenceGraphNode(
                node_id="land-cover-context",
                kind="context",
                label="Annual land-cover context",
                value=(
                    f"{event.land_cover.class_label} · "
                    f"{event.land_cover.observation_date}"
                ),
                source=(
                    f"{event.land_cover.provider} · {event.land_cover.product} · "
                    f"{event.land_cover.native_resolution_m} m"
                ),
                source_url=event.land_cover.source_url,
                direction=(
                    "supports"
                    if (
                        event.category == "vegetation"
                        and event.land_cover.group == "vegetation"
                    )
                    or (
                        event.category == "agricultural"
                        and event.land_cover.group == "cropland"
                    )
                    else "neutral"
                ),
            )
        )

    nodes.extend(
        [
            EvidenceGraphNode(
                node_id=conclusion_id,
                kind="classification",
                label="Rules-based candidate classification",
                value=f"{event.classification} · {event.classification_confidence:.0%}",
                source=f"AegisFire {event.model_version}",
                direction="neutral",
            ),
            EvidenceGraphNode(
                node_id="interpretation-boundary",
                kind="limitation",
                label="Interpretation boundary",
                value=(
                    "Thermal evidence and contextual likelihood only; no fire, accident, "
                    "source, causation, or responsible facility is confirmed."
                ),
                source="AegisFire evidence policy",
                direction="limits",
            ),
        ]
    )
    evidence_nodes = [
        node
        for node in nodes
        if node.node_id not in {conclusion_id, "interpretation-boundary"}
    ]
    edges = [
        EvidenceGraphEdge(
            source_node_id=node.node_id,
            target_node_id=conclusion_id,
            relation=(
                "supports"
                if node.direction == "supports"
                else "limits"
                if node.direction == "limits"
                else "contextualizes"
            ),
        )
        for node in evidence_nodes
    ]
    edges.append(
        EvidenceGraphEdge(
            source_node_id="interpretation-boundary",
            target_node_id=conclusion_id,
            relation="limits",
        )
    )
    return EventEvidenceGraph(
        generated_at=datetime.now(UTC),
        event_id=event.id,
        cluster_id=event.cluster_id,
        classification_node_id=conclusion_id,
        classification=event.classification,
        category=event.category,
        confidence=event.classification_confidence,
        model_version=event.model_version,
        feature_version=event.feature_version,
        nodes=nodes,
        edges=edges,
        interpretation_boundary=(
            "The graph explains why a candidate label was assigned from available evidence. "
            "It is not proof of an incident, physical source, ownership, or causation."
        ),
    )
