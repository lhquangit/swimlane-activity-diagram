import type { DiagramSemanticRequest, WarningItem } from './types';

function blocking(code: string, message: string, relatedNodeIds: string[] = []): WarningItem {
  return {
    code,
    severity: 'blocking',
    message,
    related_node_ids: relatedNodeIds,
  };
}

export function runLocalPreValidation(request: DiagramSemanticRequest): WarningItem[] {
  const issues: WarningItem[] = [];
  const nodeIds = new Set(request.nodes.map((node) => node.id));
  const startNodes = request.nodes.filter((node) => node.type === 'start');
  const endNodes = request.nodes.filter((node) => node.type === 'end');

  if (request.lanes.length === 0) {
    issues.push(blocking('LANE_REQUIRED', 'Diagram cần ít nhất 1 lane.'));
  }
  if (startNodes.length === 0) {
    issues.push(blocking('START_REQUIRED', 'Diagram cần ít nhất 1 node start.'));
  }
  if (endNodes.length === 0) {
    issues.push(blocking('END_REQUIRED', 'Diagram cần ít nhất 1 node end.'));
  }

  for (const node of request.nodes) {
    if ((node.type === 'activity' || node.type === 'decision') && !node.lane_id) {
      issues.push(blocking('NODE_MISSING_LANE', `Node "${node.id}" chưa thuộc lane nào.`, [node.id]));
    }
  }

  for (const edge of request.edges) {
    if (!nodeIds.has(edge.source_node_id) || !nodeIds.has(edge.target_node_id)) {
      issues.push(
        blocking(
          'EDGE_ENDPOINT_INVALID',
          `Edge "${edge.id}" tham chiếu node không tồn tại.`,
          [edge.source_node_id, edge.target_node_id],
        ),
      );
    }
  }

  return issues;
}
