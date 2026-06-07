import type { BrdWorkspaceCacheEntry } from './types';

export const BRD_WORKSPACE_CACHE_KEY = 'swimlane.ai_brd.cache.v1';
export const BRD_WORKSPACE_CACHE_VERSION = 'v1';

export type BrdWorkspaceCacheScope = {
  userId: string;
  projectId: string;
  diagramId: string;
};

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isWarningItemArray(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.code === 'string' &&
        typeof item.message === 'string' &&
        typeof item.severity === 'string' &&
        isStringArray(item.related_node_ids),
    )
  );
}

function isErrorObject(value: unknown) {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.code === 'string' &&
      typeof value.message === 'string' &&
      typeof value.retryable === 'boolean' &&
      isStringArray(value.related_node_ids))
  );
}

function isResponseMetadata(value: unknown) {
  return value === null || isRecord(value);
}

export function isBrdWorkspaceCacheEntry(value: unknown): value is BrdWorkspaceCacheEntry {
  if (!isRecord(value)) return false;
  return (
    value.version === BRD_WORKSPACE_CACHE_VERSION &&
    typeof value.draft === 'string' &&
    (value.spec === null || isRecord(value.spec)) &&
    isWarningItemArray(value.warnings) &&
    isWarningItemArray(value.blockingIssues) &&
    isResponseMetadata(value.metadata) &&
    (value.requestId === null || typeof value.requestId === 'string') &&
    (value.runtimeStatus === null || typeof value.runtimeStatus === 'string') &&
    typeof value.phase === 'string' &&
    typeof value.activeTab === 'string' &&
    (value.dirty === undefined || typeof value.dirty === 'boolean') &&
    isErrorObject(value.error) &&
    (value.lastGenerateFingerprint === null || typeof value.lastGenerateFingerprint === 'string') &&
    (value.lastGeneratedRevision === null || typeof value.lastGeneratedRevision === 'number') &&
    (value.idempotencyKey === null || typeof value.idempotencyKey === 'string') &&
    typeof value.updatedAt === 'string'
  );
}

export function hasDirtyBrdRecovery(entry: BrdWorkspaceCacheEntry | null): boolean {
  return Boolean(entry && entry.dirty !== false && (entry.draft || entry.spec));
}

function cacheKey(scope?: BrdWorkspaceCacheScope | null) {
  if (!scope) return BRD_WORKSPACE_CACHE_KEY;
  return [
    BRD_WORKSPACE_CACHE_KEY,
    scope.userId,
    scope.projectId,
    scope.diagramId,
  ].join(':');
}

export function loadBrdWorkspaceCache(
  scope?: BrdWorkspaceCacheScope | null,
): BrdWorkspaceCacheEntry | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(cacheKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isBrdWorkspaceCacheEntry(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveBrdWorkspaceCache(
  entry: BrdWorkspaceCacheEntry,
  scope?: BrdWorkspaceCacheScope | null,
) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(cacheKey(scope), JSON.stringify(entry));
}

export function clearBrdWorkspaceCache(scope?: BrdWorkspaceCacheScope | null) {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(cacheKey(scope));
}
