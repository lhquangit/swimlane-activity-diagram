import { beforeEach, describe, expect, it } from 'vitest';

import {
  BRD_WORKSPACE_CACHE_KEY,
  BRD_WORKSPACE_CACHE_VERSION,
  clearBrdWorkspaceCache,
  hasDirtyBrdRecovery,
  loadBrdWorkspaceCache,
  saveBrdWorkspaceCache,
} from './cache';
import type { BrdWorkspaceCacheEntry } from './types';

const sampleEntry: BrdWorkspaceCacheEntry = {
  version: BRD_WORKSPACE_CACHE_VERSION,
  dirty: true,
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

  it('keeps scoped persisted workspace drafts isolated', () => {
    const scopeA = { userId: 'user-a', projectId: 'project-a', diagramId: 'diagram-a' };
    const scopeB = { userId: 'user-a', projectId: 'project-a', diagramId: 'diagram-b' };
    saveBrdWorkspaceCache(sampleEntry, scopeA);
    saveBrdWorkspaceCache({ ...sampleEntry, draft: '# Other diagram' }, scopeB);

    expect(loadBrdWorkspaceCache(scopeA)?.draft).toBe('# Demo draft');
    expect(loadBrdWorkspaceCache(scopeB)?.draft).toBe('# Other diagram');
    expect(loadBrdWorkspaceCache()).toBeNull();
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

  it('treats legacy cache entries as dirty recovery but ignores clean server snapshots', () => {
    const { dirty: _dirty, ...legacyEntry } = sampleEntry;

    expect(hasDirtyBrdRecovery(legacyEntry)).toBe(true);
    expect(hasDirtyBrdRecovery({ ...sampleEntry, dirty: false })).toBe(false);
  });
});
