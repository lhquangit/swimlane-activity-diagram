import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildInitialData } from '../lf-config';
import { DEFAULT_LANES, LANE_HEIGHT, withPositions } from '../lane-config';
import { exportDrawioXml } from './drawio-export';
import { importDrawioXml } from './drawio-import';
import type { EditorGraphData } from './drawio-types';

describe('draw.io XML interchange', () => {
  it('imports the bomb draw.io fixture into lanes, nodes, and edges', () => {
    const xml = readFileSync(
      resolve(process.cwd(), 'examples/bomb.drawio.xml'),
      'utf-8',
    );

    const result = importDrawioXml(xml);

    expect(result.diagramName).toBe('Trang-1');
    expect(result.lanes.length).toBeGreaterThanOrEqual(6);
    expect(result.lanes[0]?.title).toContain('Nguồn phát hiện');
    expect(result.graph.nodes?.some((node) => node.type === 'start')).toBe(true);
    expect(result.graph.nodes?.some((node) => node.type === 'decision')).toBe(true);
    expect(result.graph.nodes?.some((node) => node.type === 'sync-bar')).toBe(true);
    expect(result.graph.nodes?.some((node) => node.type === 'note')).toBe(true);
    expect(result.graph.edges?.length).toBeGreaterThan(0);
    expect(result.graph.edges?.some((edge) => {
      const text = typeof edge.text === 'string' ? edge.text : edge.text?.value;
      return Boolean(text);
    })).toBe(true);
  });

  it('exports app graph into draw.io-like XML structure', () => {
    const lanes = withPositions(DEFAULT_LANES);
    const xml = exportDrawioXml(
      buildInitialData() as unknown as EditorGraphData,
      lanes,
      LANE_HEIGHT,
      'Demo Diagram',
    );

    expect(xml).toContain('<mxfile');
    expect(xml).toContain('<mxGraphModel');
    expect(xml).toContain('lfType=activity');
    expect(xml).toContain('lfType=note');
    expect(xml).toContain('edgeLabel;html=1');
    expect(xml).toContain('Demo Diagram');
  });

  it('round-trips the repo sample through export -> import with core semantics preserved', () => {
    const lanes = withPositions(DEFAULT_LANES);
    const xml = exportDrawioXml(
      buildInitialData() as unknown as EditorGraphData,
      lanes,
      LANE_HEIGHT,
      'Roundtrip Diagram',
    );
    const result = importDrawioXml(xml);

    expect(result.lanes).toHaveLength(lanes.length);
    expect(result.graph.nodes?.find((node) => node.id === 'n-start')?.type).toBe('start');
    expect(result.graph.nodes?.find((node) => node.id === 'n-note')?.type).toBe('note');
    expect(result.graph.nodes?.find((node) => node.id === 'n-sync')?.type).toBe('sync-bar');
    expect(result.graph.edges?.find((edge) => edge.id === 'e9')).toMatchObject({
      sourceNodeId: 'n-dec1',
      targetNodeId: 'n-c2',
    });
  });
});
