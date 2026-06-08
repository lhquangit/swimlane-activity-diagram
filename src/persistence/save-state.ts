import type { SaveState } from './types';

export type SaveScopeType = 'usecases' | 'usecase' | 'diagram' | 'brd';

export type SaveScope = {
  key: string;
  type: SaveScopeType;
  resourceId: string;
  label: string;
  featureId: string;
};

export type SaveScopeEntry = SaveScope & {
  state: SaveState;
};

export type SaveStateRegistry = Record<string, SaveScopeEntry>;

export function makeUseCasesScope(featureId: string, label: string): SaveScope {
  return {
    key: `feature:${featureId}:usecases`,
    type: 'usecases',
    resourceId: featureId,
    label,
    featureId,
  };
}

export function makeUseCaseScope(
  featureId: string,
  businessKey: string,
  label: string,
): SaveScope {
  return {
    key: `feature:${featureId}:usecase:${businessKey}`,
    type: 'usecase',
    resourceId: businessKey,
    label,
    featureId,
  };
}

export function makeDiagramScope(featureId: string, businessKey: string): SaveScope {
  return {
    key: `feature:${featureId}:diagram:${businessKey}`,
    type: 'diagram',
    resourceId: businessKey,
    label: `Diagram ${businessKey}`,
    featureId,
  };
}

export function makeBrdScope(diagramId: string, featureId: string, label = 'BRD'): SaveScope {
  return {
    key: `diagram:${diagramId}:brd`,
    type: 'brd',
    resourceId: diagramId,
    label,
    featureId,
  };
}

export function getScopeState(registry: SaveStateRegistry, scope: SaveScope | null): SaveState {
  if (!scope) return 'idle';
  return registry[scope.key]?.state ?? 'idle';
}

export function setScopeState(
  registry: SaveStateRegistry,
  scope: SaveScope | null,
  state: SaveState,
): SaveStateRegistry {
  if (!scope) return registry;
  return {
    ...registry,
    [scope.key]: {
      ...scope,
      state,
    },
  };
}

export function clearScope(
  registry: SaveStateRegistry,
  keyOrScope: string | SaveScope | null,
): SaveStateRegistry {
  if (!keyOrScope) return registry;
  const key = typeof keyOrScope === 'string' ? keyOrScope : keyOrScope.key;
  if (!registry[key]) return registry;
  const next = { ...registry };
  delete next[key];
  return next;
}

export function clearScopesByPredicate(
  registry: SaveStateRegistry,
  predicate: (entry: SaveScopeEntry) => boolean,
): SaveStateRegistry {
  let changed = false;
  const next: SaveStateRegistry = {};
  for (const [key, entry] of Object.entries(registry)) {
    if (predicate(entry)) {
      changed = true;
      continue;
    }
    next[key] = entry;
  }
  return changed ? next : registry;
}

export function clearFeatureScopes(
  registry: SaveStateRegistry,
  featureId: string | null,
): SaveStateRegistry {
  if (!featureId) return registry;
  return clearScopesByPredicate(registry, (entry) => entry.featureId === featureId);
}

export function dirtyScopes(registry: SaveStateRegistry): SaveScopeEntry[] {
  return Object.values(registry).filter((entry) => entry.state === 'dirty');
}

export function isAnyDirty(registry: SaveStateRegistry): boolean {
  return dirtyScopes(registry).length > 0;
}

export function formatDirtyScopes(entries: SaveScopeEntry[], limit = 3): string {
  if (entries.length === 0) return '';
  const labels = entries.slice(0, limit).map((entry) => entry.label);
  const remainder = entries.length - labels.length;
  return remainder > 0 ? `${labels.join(', ')} và ${remainder} mục khác` : labels.join(', ');
}

export function confirmDirtyScopeSwitch(
  entries: SaveScopeEntry[],
  currentBusinessKey: string,
  nextBusinessKey: string,
  confirm: (message: string) => boolean,
): boolean {
  if (entries.length === 0) return true;
  return confirm(
    `Bạn đang rời ${currentBusinessKey} để mở ${nextBusinessKey}, nhưng còn thay đổi chưa lưu: ${formatDirtyScopes(entries)}.\n\nBấm OK để tiếp tục và giữ các mục này trong danh sách chưa lưu. Bấm Cancel để ở lại và lưu trước.`,
  );
}
