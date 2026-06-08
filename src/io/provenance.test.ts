import { describe, expect, it } from 'vitest';

import {
  buildTraceCoverage,
  deserializeProvenance,
  generatedProvenance,
  manualProvenance,
  normalizeImportedGraphProvenance,
  serializeProvenance,
} from './provenance';

const trace = {
  use_case_id: 'UC-01',
  source_kind: 'main_step' as const,
  source_id: 'UC-01-S01',
};

describe('diagram provenance', () => {
  it('round-trips generated provenance', () => {
    const encoded = serializeProvenance({ provenance: generatedProvenance(trace) });
    expect(deserializeProvenance(encoded)).toEqual(generatedProvenance(trace));
  });

  it('treats invalid external metadata as untrusted imported content', () => {
    expect(deserializeProvenance('%7B%22version%22%3A99%7D')).toMatchObject({
      origin: 'imported',
      trusted: false,
    });
  });

  it('reports traced, manual, and untrusted coverage', () => {
    expect(
      buildTraceCoverage({
        nodes: [
          {
            id: 'n1',
            type: 'activity',
            x: 0,
            y: 0,
            properties: { provenance: generatedProvenance(trace) },
          },
          {
            id: 'n2',
            type: 'activity',
            x: 0,
            y: 0,
            properties: { provenance: manualProvenance('UC-01') },
          },
        ],
        edges: [
          {
            id: 'e1',
            sourceNodeId: 'n1',
            targetNodeId: 'n2',
            properties: {
              provenance: { version: 1, origin: 'imported', trusted: false },
            },
          },
        ],
      }),
    ).toEqual({ total: 3, traced: 1, manual: 1, untrusted: 1 });
  });

  it('downgrades invalid imported provenance instead of trusting it', () => {
    const normalized = normalizeImportedGraphProvenance({
      nodes: [
        {
          id: 'n1',
          type: 'activity',
          x: 0,
          y: 0,
          properties: {
            provenance: { version: 99, origin: 'generated', trusted: true },
          },
        },
      ],
      edges: [],
    });

    expect(normalized.nodes?.[0].properties?.provenance).toMatchObject({
      version: 1,
      origin: 'imported',
      trusted: false,
    });
  });
});
