import LogicFlow, { GraphConfigData } from '@logicflow/core';
import { LANES, LaneConfig, LANE_Y, LANE_HEIGHT } from './nodes';

/** Build node data entries for the given lanes. */
export function buildLaneNodes(lanes: LaneConfig[]) {
  return lanes.map((lane) => ({
    id: lane.id,
    type: 'lane',
    x: lane.x,
    y: LANE_Y,
    properties: { width: lane.width, height: LANE_HEIGHT },
    text: { value: lane.title, x: lane.x, y: LANE_Y - LANE_HEIGHT / 2 + 18 },
  }));
}

/** Build the initial diagram data — default lanes + a tiny sample flow. */
export function buildInitialData(): GraphConfigData {
  const nodes: any[] = [...buildLaneNodes(LANES)];

  // 2) A tiny sample so the canvas isn't empty (user can delete and restart)
  nodes.push(
    { id: 'n-start', type: 'start', x: LANES[0].x, y: 110 },
    {
      id: 'n-note',
      type: 'note',
      x: LANES[0].x,
      y: 240,
      text: {
        value:
          '1 trong 4 nhóm phát hiện dấu hiệu cháy:\n- Hệ thống tự động: Sensor báo khói, nhiệt\n- Khán giả: Nút báo cháy, mini app, hotline\n- Nhân viên hiện trường: Bộ đàm\n- Nhân sự CCTV',
        x: LANES[0].x,
        y: 240,
      },
    },
    {
      id: 'n-a1',
      type: 'activity',
      x: LANES[1].x,
      y: 110,
      text: { value: 'Tiếp nhận tín hiệu ban đầu', x: LANES[1].x, y: 110 },
    },
    {
      id: 'n-a2',
      type: 'activity',
      x: LANES[1].x,
      y: 180,
      text: { value: 'Mở nhật ký sự cố', x: LANES[1].x, y: 180 },
    },
    {
      id: 'n-a3',
      type: 'activity',
      x: LANES[1].x,
      y: 250,
      text: {
        value: 'Ghi thời điểm, nguồn báo tin,\nvị trí sơ bộ',
        x: LANES[1].x,
        y: 250,
      },
      properties: { width: 220, height: 60 },
    },
    {
      id: 'n-a4',
      type: 'activity',
      x: LANES[1].x,
      y: 330,
      text: { value: 'Báo tín hiệu cho các actor chính', x: LANES[1].x, y: 330 },
    },
    {
      id: 'n-sync',
      type: 'sync-bar',
      x: (LANES[1].x + LANES[3].x) / 2,
      y: 410,
      properties: { width: 900, height: 8 },
    },
    {
      id: 'n-b1',
      type: 'activity',
      x: LANES[2].x,
      y: 480,
      text: {
        value: 'Điều phối nhân viên hiện trường gần nhất\nqua bộ đàm đến điểm nghi vấn',
        x: LANES[2].x,
        y: 480,
      },
      properties: { width: 260, height: 60 },
    },
    {
      id: 'n-c1',
      type: 'activity',
      x: LANES[3].x,
      y: 540,
      text: {
        value: 'Di chuyển đến điểm nghi vấn để kiểm tra',
        x: LANES[3].x,
        y: 540,
      },
      properties: { width: 240, height: 44 },
    },
    {
      id: 'n-dec1',
      type: 'decision',
      x: LANES[3].x,
      y: 640,
      text: { value: 'Xác minh sự cố\nlà cháy thật?', x: LANES[3].x, y: 640 },
    },
    {
      id: 'n-c2',
      type: 'activity',
      x: LANES[3].x + 60,
      y: 740,
      text: { value: 'Xác nhận thông tin đúng', x: LANES[3].x + 60, y: 740 },
    },
    {
      id: 'n-b2',
      type: 'activity',
      x: LANES[2].x - 40,
      y: 740,
      text: { value: 'Xác nhận thông tin sai', x: LANES[2].x - 40, y: 740 },
    },
    {
      id: 'n-dec2',
      type: 'decision',
      x: LANES[3].x + 60,
      y: 840,
      text: {
        value: 'Có thể xử lý\nnhanh không?',
        x: LANES[3].x + 60,
        y: 840,
      },
    },
    {
      id: 'n-c3',
      type: 'activity',
      x: LANES[3].x + 60,
      y: 940,
      text: { value: 'Xử lý tình hình ngay', x: LANES[3].x + 60, y: 940 },
    },
    {
      id: 'n-b3',
      type: 'activity',
      x: LANES[2].x,
      y: 840,
      text: {
        value: 'Báo cáo qua bộ đàm về kết quả xác minh\ncho các actor trong VOC',
        x: LANES[2].x,
        y: 840,
      },
      properties: { width: 280, height: 60 },
    },
  );

  const edges: any[] = [
    { id: 'e1', sourceNodeId: 'n-start', targetNodeId: 'n-a1', type: 'polyline' },
    { id: 'e2', sourceNodeId: 'n-a1', targetNodeId: 'n-a2', type: 'polyline' },
    { id: 'e3', sourceNodeId: 'n-a2', targetNodeId: 'n-a3', type: 'polyline' },
    { id: 'e4', sourceNodeId: 'n-a3', targetNodeId: 'n-a4', type: 'polyline' },
    { id: 'e5', sourceNodeId: 'n-a4', targetNodeId: 'n-sync', type: 'polyline' },
    { id: 'e6', sourceNodeId: 'n-sync', targetNodeId: 'n-b1', type: 'polyline' },
    { id: 'e7', sourceNodeId: 'n-b1', targetNodeId: 'n-c1', type: 'polyline' },
    { id: 'e8', sourceNodeId: 'n-c1', targetNodeId: 'n-dec1', type: 'polyline' },
    {
      id: 'e9',
      sourceNodeId: 'n-dec1',
      targetNodeId: 'n-c2',
      type: 'polyline',
      text: { value: 'Có' },
    },
    {
      id: 'e10',
      sourceNodeId: 'n-dec1',
      targetNodeId: 'n-b2',
      type: 'polyline',
      text: { value: 'Không' },
    },
    { id: 'e11', sourceNodeId: 'n-c2', targetNodeId: 'n-dec2', type: 'polyline' },
    {
      id: 'e12',
      sourceNodeId: 'n-dec2',
      targetNodeId: 'n-c3',
      type: 'polyline',
      text: { value: 'Có' },
    },
    {
      id: 'e13',
      sourceNodeId: 'n-dec2',
      targetNodeId: 'n-b3',
      type: 'polyline',
      text: { value: 'Không' },
    },
    { id: 'e14', sourceNodeId: 'n-b2', targetNodeId: 'n-b3', type: 'polyline' },
  ];

  return { nodes, edges };
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
    nodeTextDraggable: true,
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
