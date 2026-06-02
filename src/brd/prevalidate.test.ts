import { describe, expect, it } from 'vitest';

import { runLocalPreValidation } from './prevalidate';
import type { DiagramSemanticRequest } from './types';

function makeRequest(partial?: Partial<DiagramSemanticRequest>): DiagramSemanticRequest {
  return {
    diagram_name: 'Demo diagram',
    language: 'vi',
    lanes: [{ id: 'lane-a', title: 'VOC', order: 0 }],
    nodes: [
      { id: 'n-start', type: 'start', x: 100, y: 100 },
      { id: 'n-a1', type: 'activity', lane_id: 'lane-a', text: 'Tiep nhan', x: 200, y: 220 },
      { id: 'n-end', type: 'end', x: 260, y: 360 },
    ],
    edges: [
      { id: 'e1', source_node_id: 'n-start', target_node_id: 'n-a1' },
      { id: 'e2', source_node_id: 'n-a1', target_node_id: 'n-end' },
    ],
    ...partial,
  };
}

describe('runLocalPreValidation', () => {
  it('returns no issues for a minimal valid diagram', () => {
    expect(runLocalPreValidation(makeRequest())).toEqual([]);
  });

  it('flags missing start and end before any backend validation', () => {
    const request = makeRequest({
      nodes: [{ id: 'n-a1', type: 'activity', lane_id: 'lane-a', x: 200, y: 220 }],
      edges: [],
    });

    expect(runLocalPreValidation(request).map((issue) => issue.code)).toEqual([
      'START_REQUIRED',
      'END_REQUIRED',
    ]);
  });

  it('flags nodes without lane and invalid edge endpoints', () => {
    const request = makeRequest({
      nodes: [
        { id: 'n-start', type: 'start', x: 100, y: 100 },
        { id: 'n-a1', type: 'activity', x: 200, y: 220 },
        { id: 'n-end', type: 'end', x: 260, y: 360 },
      ],
      edges: [{ id: 'e1', source_node_id: 'n-a1', target_node_id: 'missing' }],
    });

    expect(runLocalPreValidation(request).map((issue) => issue.code)).toEqual([
      'NODE_MISSING_LANE',
      'EDGE_ENDPOINT_INVALID',
    ]);
  });
});
