import { beforeEach, describe, expect, it } from 'vitest';

import {
  BRD_WORKSPACE_CACHE_KEY,
  BRD_WORKSPACE_CACHE_VERSION,
  clearBrdWorkspaceCache,
  loadBrdWorkspaceCache,
  saveBrdWorkspaceCache,
} from './cache';
import type { BrdWorkspaceCacheEntry } from './types';

const sampleEntry: BrdWorkspaceCacheEntry = {
  version: BRD_WORKSPACE_CACHE_VERSION,
  draft: '# Demo draft',
  spec: null,
  warnings: [],
  blockingIssues: [],
  metadata: { model: 'openai/gpt-4o-mini', latency_ms: 1234 },
  requestId: 'req_demo_001',
  runtimeStatus: 'completed',
  phase: 'ready',
  activeTab: 'draft',
  error: null,
  lastGenerateFingerprint: '{"diagram":"demo"}',
  lastGeneratedRevision: 4,
  idempotencyKey: 'brd-demo-123',
  updatedAt: '2026-06-02T16:00:00.000Z',
};

describe('brd cache helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('saves and loads a versioned cache entry', () => {
    saveBrdWorkspaceCache(sampleEntry);

    expect(loadBrdWorkspaceCache()).toEqual(sampleEntry);
  });

  it('returns null for invalid payloads or mismatched versions', () => {
    window.localStorage.setItem(
      BRD_WORKSPACE_CACHE_KEY,
      JSON.stringify({ ...sampleEntry, version: 'v0' }),
    );
    expect(loadBrdWorkspaceCache()).toBeNull();

    window.localStorage.setItem(BRD_WORKSPACE_CACHE_KEY, '{"broken":');
    expect(loadBrdWorkspaceCache()).toBeNull();
  });

  it('clears cache explicitly', () => {
    saveBrdWorkspaceCache(sampleEntry);
    clearBrdWorkspaceCache();

    expect(window.localStorage.getItem(BRD_WORKSPACE_CACHE_KEY)).toBeNull();
    expect(loadBrdWorkspaceCache()).toBeNull();
  });
});
