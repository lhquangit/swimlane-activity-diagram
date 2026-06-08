import { describe, expect, it } from 'vitest';

import {
  clearFeatureScopes,
  clearScope,
  clearScopesByPredicate,
  confirmDirtyScopeSwitch,
  dirtyScopes,
  formatDirtyScopes,
  getScopeState,
  isAnyDirty,
  makeBrdScope,
  makeDiagramScope,
  makeUseCaseScope,
  makeUseCasesScope,
  setScopeState,
} from './save-state';

describe('save-state registry', () => {
  it('tracks dirty scopes even when another scope becomes active', () => {
    const diagramA = makeDiagramScope('feature-1', 'UC-001');
    const diagramB = makeDiagramScope('feature-1', 'UC-002');
    let registry = {};

    registry = setScopeState(registry, diagramA, 'dirty');
    registry = setScopeState(registry, diagramB, 'idle');

    expect(getScopeState(registry, diagramB)).toBe('idle');
    expect(isAnyDirty(registry)).toBe(true);
    expect(dirtyScopes(registry).map((scope) => scope.key)).toEqual([diagramA.key]);
  });

  it('clears deleted resource scopes by key or predicate', () => {
    const useCases = makeUseCasesScope('feature-1', 'Use cases');
    const diagram = makeDiagramScope('feature-1', 'UC-001');
    const brd = makeBrdScope('diagram-1', 'feature-1', 'BRD UC-001');
    let registry = {};

    registry = setScopeState(registry, useCases, 'dirty');
    registry = setScopeState(registry, diagram, 'dirty');
    registry = setScopeState(registry, brd, 'dirty');
    registry = clearScope(registry, diagram);
    registry = clearScopesByPredicate(registry, (scope) => scope.resourceId === 'diagram-1');

    expect(dirtyScopes(registry).map((scope) => scope.key)).toEqual([useCases.key]);
  });

  it('formats dirty scope labels for prompts', () => {
    const first = makeDiagramScope('feature-1', 'UC-001');
    const second = makeBrdScope('diagram-1', 'feature-1', 'BRD UC-001');
    const registry = setScopeState(setScopeState({}, first, 'dirty'), second, 'dirty');

    expect(formatDirtyScopes(dirtyScopes(registry), 1)).toBe('Diagram UC-001 và 1 mục khác');
  });

  it('clears every persisted scope owned by a discarded feature', () => {
    const featureOneUseCases = makeUseCasesScope('feature-1', 'Use cases feature 1');
    const featureOneUseCase = makeUseCaseScope('feature-1', 'UC-001', 'Use case UC-001');
    const featureOneDiagram = makeDiagramScope('feature-1', 'UC-001');
    const featureOneBrd = makeBrdScope('diagram-1', 'feature-1', 'BRD UC-001');
    const featureTwoDiagram = makeDiagramScope('feature-2', 'UC-002');
    let registry = {};

    for (const scope of [
      featureOneUseCases,
      featureOneUseCase,
      featureOneDiagram,
      featureOneBrd,
      featureTwoDiagram,
    ]) {
      registry = setScopeState(registry, scope, 'dirty');
    }

    registry = clearFeatureScopes(registry, 'feature-1');

    expect(dirtyScopes(registry).map((scope) => scope.key)).toEqual([featureTwoDiagram.key]);
  });

  it('keeps dirty scopes tracked when a context switch continues and cancels cleanly', () => {
    const diagram = makeDiagramScope('feature-1', 'UC-001');
    const registry = setScopeState({}, diagram, 'dirty');
    const entries = dirtyScopes(registry);

    expect(confirmDirtyScopeSwitch(entries, 'UC-001', 'UC-002', () => false)).toBe(false);
    expect(confirmDirtyScopeSwitch(entries, 'UC-001', 'UC-002', () => true)).toBe(true);
    expect(dirtyScopes(registry).map((scope) => scope.key)).toEqual([diagram.key]);
  });
});
