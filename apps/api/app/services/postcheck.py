from __future__ import annotations

from app.schemas.common import WarningItem
from app.schemas.spec import DiagramBRDSpec


def postcheck_spec(
    spec: DiagramBRDSpec,
    traceable_node_ids: set[str] | None = None,
) -> list[WarningItem]:
    warnings: list[WarningItem] = []
    seen_node_ids = {step.node_id for step in spec.main_flow_steps}
    allowed_target_ids = traceable_node_ids or seen_node_ids
    for step in spec.main_flow_steps:
        if not step.node_id:
            warnings.append(
                WarningItem(
                    code="STEP_TRACE_MISSING",
                    severity="warning",
                    message="Có step không trace được về node id.",
                )
            )
            break
    for branch in spec.branches:
        for outcome in branch.outcomes:
            if outcome.target_node_id not in allowed_target_ids:
                warnings.append(
                    WarningItem(
                        code="BRANCH_TARGET_UNKNOWN",
                        severity="warning",
                        message="Có nhánh decision trỏ tới target node không trace được trong canonical graph.",
                        related_node_ids=[branch.decision_node_id, outcome.target_node_id],
                    )
                )
    return warnings
