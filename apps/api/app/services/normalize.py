from __future__ import annotations

from app.schemas.request import DiagramSemanticRequest


def normalize_request(payload: DiagramSemanticRequest) -> DiagramSemanticRequest:
    normalized = payload.model_copy(deep=True)
    normalized.lanes.sort(key=lambda lane: lane.order)
    normalized.nodes.sort(key=lambda node: (node.y, node.x, node.id))
    normalized.edges.sort(key=lambda edge: edge.id)
    for node in normalized.nodes:
        if node.text:
            node.text = node.text.strip()
    for edge in normalized.edges:
        if edge.label:
            edge.label = edge.label.strip()
    return normalized
