import { describe, expect, it } from 'vitest';

import type { LaneConfig } from '../nodes';
import { buildGenerateRequest, buildSemanticRequest } from './normalize';

const lanes: LaneConfig[] = [
  { id: 'lane-a', title: 'VOC', x: 200, width: 320 },
  { id: 'lane-b', title: 'Nhân sự', x: 520, width: 320 },
];

describe('buildSemanticRequest', () => {
  it('filters lane nodes and infers lane ids from graph position', () => {
    const request = buildSemanticRequest(
      {
        nodes: [
          { id: 'lane-visual', type: 'lane', x: 200, y: 550 },
          { id: 'n-start', type: 'start', x: 120, y: 120 },
          {
            id: 'n-a1',
            type: 'activity',
            x: 210,
            y: 240,
            text: { value: 'Tiếp nhận yêu cầu' },
            properties: { laneId: 'lane-a' },
          },
          {
            id: 'n-b1',
            type: 'note',
            x: 540,
            y: 360,
            text: { value: 'Cần xác nhận BA' },
          },
        ],
        edges: [
          { id: 'e1', sourceNodeId: 'n-start', targetNodeId: 'n-a1' },
          { id: 'e2', sourceNodeId: 'n-a1', targetNodeId: 'n-b1', text: { value: 'handoff' } },
        ],
      },
      lanes,
      'Demo diagram',
    );

    expect(request.diagram_name).toBe('Demo diagram');
    expect(request.nodes).toHaveLength(3);
    expect(request.nodes.find((node) => node.id === 'lane-visual')).toBeUndefined();
    expect(request.nodes.find((node) => node.id === 'n-a1')?.lane_id).toBe('lane-a');
    expect(request.nodes.find((node) => node.id === 'n-b1')?.lane_id).toBe('lane-b');
    expect(request.edges[1].label).toBe('handoff');
  });

  it('leaves lane_id undefined when a node sits outside every lane boundary', () => {
    const request = buildSemanticRequest(
      {
        nodes: [{ id: 'n-a1', type: 'activity', x: 20, y: 240, text: 'Ngoai lane' }],
        edges: [],
      },
      lanes,
    );

    expect(request.nodes[0]?.lane_id).toBeUndefined();
  });

  it('does not force a lane when the node sits exactly on a lane boundary', () => {
    const request = buildSemanticRequest(
      {
        nodes: [{ id: 'n-a1', type: 'activity', x: 360, y: 240, text: 'O bien lane' }],
        edges: [],
      },
      lanes,
    );

    expect(request.nodes[0]?.lane_id).toBeUndefined();
  });
});

describe('buildGenerateRequest', () => {
  it('preserves the semantic payload and attaches template', () => {
    const request = buildGenerateRequest(
      {
        nodes: [{ id: 'n-a1', type: 'activity', x: 200, y: 240, text: 'Tiếp nhận' }],
        edges: [],
      },
      lanes,
      'full',
      'Generate request demo',
    );

    expect(request.template).toBe('full');
    expect(request.diagram_name).toBe('Generate request demo');
    expect(request.lanes.map((lane) => lane.id)).toEqual(['lane-a', 'lane-b']);
  });
});
