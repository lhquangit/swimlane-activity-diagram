import type { LaneConfig } from '../nodes';
import { DiagramSemanticRequest, GenerateBrdRequest } from './types';

type GraphDataNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  text?: { value?: string } | string;
  properties?: Record<string, unknown>;
};

type GraphDataEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  text?: { value?: string } | string;
};

type GraphData = {
  nodes?: GraphDataNode[];
  edges?: GraphDataEdge[];
};

function inferLaneId(node: GraphDataNode, lanes: LaneConfig[]) {
  const storedLaneId =
    typeof node.properties?.laneId === 'string' ? node.properties.laneId : undefined;
  if (lanes.length === 0) return undefined;

  const containingLanes = lanes.filter((lane) => isNodeWithinLane(node.x, lane));

  if (storedLaneId) {
    const storedLane = lanes.find((lane) => lane.id === storedLaneId);
    if (storedLane && isNodeWithinLane(node.x, storedLane)) {
      return storedLaneId;
    }
  }

  if (containingLanes.length !== 1) return undefined;
  return containingLanes[0]?.id;
}

function readTextValue(raw: GraphDataNode['text'] | GraphDataEdge['text']) {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object' && typeof raw.value === 'string') return raw.value.trim();
  return undefined;
}

export function buildSemanticRequest(
  graphData: GraphData,
  lanes: LaneConfig[],
  diagramName = 'Swimlane Activity Diagram',
): DiagramSemanticRequest {
  const semanticNodes = (graphData.nodes ?? [])
    .filter((node) => node.type !== 'lane')
    .map((node) => ({
      id: node.id,
      type: node.type as DiagramSemanticRequest['nodes'][number]['type'],
      lane_id: inferLaneId(node, lanes),
      text: readTextValue(node.text),
      x: node.x,
      y: node.y,
      metadata: {
        ...node.properties,
      },
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));

  const semanticEdges = (graphData.edges ?? [])
    .map((edge) => ({
      id: edge.id,
      source_node_id: edge.sourceNodeId,
      target_node_id: edge.targetNodeId,
      label: readTextValue(edge.text),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    diagram_name: diagramName,
    language: 'vi',
    lanes: lanes
      .map((lane, index) => ({
        id: lane.id,
        title: lane.title,
        order: index,
      }))
      .sort((a, b) => a.order - b.order),
    nodes: semanticNodes,
    edges: semanticEdges,
  };
}

export function buildGenerateRequest(
  graphData: GraphData,
  lanes: LaneConfig[],
  template: 'default' | 'full' = 'default',
  diagramName = 'Swimlane Activity Diagram',
): GenerateBrdRequest {
  return {
    ...buildSemanticRequest(graphData, lanes, diagramName),
    template,
  };
}

export function buildRequestFingerprint(request: DiagramSemanticRequest | GenerateBrdRequest) {
  return JSON.stringify(request);
}

function isNodeWithinLane(nodeX: number, lane: LaneConfig) {
  const halfWidth = lane.width / 2;
  const left = lane.x - halfWidth;
  const right = lane.x + halfWidth;
  return nodeX > left && nodeX < right;
}
