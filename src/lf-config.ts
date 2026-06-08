import LogicFlow from '@logicflow/core';
import { type LaneConfig, LANE_HEIGHT, LANE_TOP } from './lane-config';

/** Build node data entries for the given lanes. */
export function buildLaneNodes(lanes: LaneConfig[], laneHeight = LANE_HEIGHT) {
  const y = LANE_TOP + laneHeight / 2;
  return lanes.map((lane) => ({
    id: lane.id,
    type: 'lane',
    x: lane.x,
    y,
    zIndex: -1000,
    properties: { width: lane.width, height: laneHeight },
    text: { value: lane.title, x: lane.x, y: LANE_TOP + 18 },
  }));
}

/** Snap an x coordinate to the nearest lane center. */
export function snapToLane(x: number, lanes: LaneConfig[]): number {
  if (lanes.length === 0) return x;
  let best = lanes[0];
  let bestDist = Math.abs(x - best.x);
  for (const lane of lanes) {
    const d = Math.abs(x - lane.x);
    if (d < bestDist) {
      best = lane;
      bestDist = d;
    }
  }
  return best.x;
}

export function getLogicFlowOptions(container: HTMLElement) {
  return {
    container,
    grid: { size: 10, type: 'dot' as const, visible: true, config: { color: '#e5e7eb' } },
    background: { color: 'transparent' },
    keyboard: { enabled: true },
    edgeTextDraggable: true,
    // A node label is part of the shape's drag surface. Keeping label dragging
    // enabled makes pointer gestures move only the text instead of the node.
    nodeTextDraggable: false,
    adjustEdge: true,
    adjustEdgeStartAndEnd: true,
    snapline: true,
    style: {
      edgeText: {
        background: { fill: '#ffffff', stroke: '#9c2a47', radius: 4 },
        color: '#111827',
        fontSize: 11,
      },
      polyline: {
        stroke: '#9c2a47',
        strokeWidth: 1.5,
      },
    },
  };
}
