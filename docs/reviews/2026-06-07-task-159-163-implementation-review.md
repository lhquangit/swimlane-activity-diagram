# TASK-159 to TASK-163 Implementation Review

- Date: 2026-06-07 15:43 +07
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Follow-up persistence hardening tasks `TASK-159` through `TASK-163`
- Reviewed modules: save-state registry, ProjectWorkspace routing and dirty guards, App diagram
  switch/load flow, persisted BRD recovery load, Railway staging runbook
- Not reviewed: live Railway staging deploy, real hosted Clerk browser E2E, unrelated dirty
  worktree changes outside the TASK-159 to TASK-163 files

## Executive Summary

Overall health: `TASK-159` through `TASK-162` moved the persisted workspace in the right direction.
The aggregate dirty-state guard exists, invalid feature URLs now show explicit copy, and persisted
BRD load failures no longer become unhandled promise rejections.

Highest-risk area: frontend state transitions around feature/diagram switching. The new registry
tracks more state, but several transitions still do not clear or protect the right scope.

Fastest high-value win: make feature route invalidation and diagram load switching transactional:
clear stale active feature state on invalid URLs, clear discarded/deleted dirty scopes, and catch
persisted diagram load failures before rebinding the active scope.

Recommended execution order: fix stale dirty scopes and invalid route state first, then harden
diagram load failure handling, then protect BRD recovery cache from server overwrite, then add route
and switch-flow regression tests. Keep Railway rehearsal partial until the owner reauthenticates and
links the project.

## Module Map

| Module | Files | Responsibility |
| --- | --- | --- |
| Save-state registry | `src/persistence/save-state.ts`, `src/persistence/save-state.test.ts` | Scope keys, aggregate dirty checks, formatting dirty summaries |
| Workspace context contract | `src/persistence/WorkspaceContext.tsx` | Persistence methods exposed from project workspace to editor |
| Project workspace shell | `src/application/ProjectWorkspace.tsx` | Project/spec/feature routing, active feature state, dirty guards, provider value |
| Editor diagram switch flow | `src/App.tsx` | Use-case diagram load/open/save, canvas binding, BRD panel state |
| BRD recovery cache | `src/App.tsx`, `src/brd/cache.ts`, `src/brd/cache.test.ts` | Scoped local BRD recovery and server BRD hydration |
| Operations | `docs/operations/railway-persistence-release.md`, `railway.toml` | Railway deployment contract and staging rehearsal evidence |
| Verification | `package.json`, `src/**/*.test.*`, `e2e/*` | Build, Vitest UI regression, Playwright mock E2E |

## Findings

### P1 - Discard/delete feature flows leave stale dirty scopes behind

- Claim: The save-state registry now preserves inactive dirty scopes, but feature context changes do
  not clear scopes when the user explicitly confirms discard or deletes a feature.
- Evidence: `makeUseCasesScope` and `makeDiagramScope` include the feature ID in registry keys at
  `src/persistence/save-state.ts` lines 18-33. `selectFeature`, `startNewFeature`, and
  `deleteFeature` reset active feature/canvas state at `src/application/ProjectWorkspace.tsx` lines
  165-188 and 242-259, but none of those paths calls `clearScopesByPredicate`.
- Impact: A user can confirm discarding changes or delete a feature and still be blocked by an
  aggregate unsaved warning from an artifact that is no longer visible or intentionally discarded.
  This can make the new global dirty guard feel stuck.
- Recommendation: Add an explicit discard/delete cleanup helper that removes all scopes owned by
  the old feature, and extend `SaveScope` metadata if BRD scopes need parent feature/use-case
  ancestry to clear cascades reliably.
- Confidence: Confirmed by code inspection.

### P1 - Invalid feature deep-links can still render the previous active feature

- Claim: Invalid feature URLs show a banner, but they do not clear the previous `activeFeatureId`
  when the user navigates from a valid feature URL to an invalid feature URL inside the same project.
- Evidence: `ProjectWorkspace` detects `routeFeatureId && !routedFeature` and sets
  `missingFeatureRouteId` at `src/application/ProjectWorkspace.tsx` lines 91-95. The code only
  updates `activeFeatureId` inside `if (selectedFeature)` at lines 96-103; there is no `else` branch
  that clears active feature state. The editor still renders when `tab === 'editor' && contextValue`
  at lines 544-552.
- Impact: The URL says one feature is missing, but the editor can remain bound to the previous
  feature. That violates the intent of `TASK-161`: invalid URLs should not silently open another
  feature.
- Recommendation: When `routeFeatureId` is present and not found, clear `activeFeatureId`,
  `featureDraftId`, active diagram state and provider context, or force the tab to a safe feature
  list/not-found state.
- Confidence: Confirmed by code inspection.

### P1 - Persisted diagram load failure can leave the active diagram scope half-switched

- Claim: Opening a saved diagram has no error handling around `workspace.loadDiagram`, and
  `loadDiagram` mutates the active business key before the backend load succeeds.
- Evidence: `handleOpenUseCaseDiagramCanvas` awaits `workspace.loadDiagram(useCaseId)` without
  `try/catch` at `src/App.tsx` lines 1952-1964. `ProjectWorkspace.loadDiagram` calls
  `setActiveDiagramBusinessKey(businessKey)` before `api.getDiagram(resource.id)` at
  `src/application/ProjectWorkspace.tsx` lines 329-335.
- Impact: A transient `getDiagram` failure can produce an unhandled async error from the click
  handler and leave the workspace scoped to the next use case even though the canvas did not load.
  The dirty-state toolbar can then point at the wrong diagram scope.
- Recommendation: Make diagram switching transactional: load first, catch and surface failures,
  only update `activeDiagramBusinessKey` and `activeDiagram` after a successful load or a deliberate
  generated/new diagram transition.
- Confidence: Confirmed by code inspection.

### P2 - BRD recovery cache can be overwritten by a successful server load

- Claim: The BRD load failure path preserves cached recovery drafts, but the success path always
  writes saved server BRD into component state after hydrating local cache.
- Evidence: The BRD effect hydrates cached state at `src/App.tsx` lines 1067-1070, then on server
  success overwrites `brdSpec`, `brdDraft`, warnings and phase at lines 1073-1082. The cache-save
  effect persists any non-empty BRD state back to local storage at lines 1023-1042.
- Impact: If the local cache contains an unsaved recovery draft and the server has an older saved
  BRD, a successful server load can replace the visible draft and then overwrite the scoped recovery
  cache. This is adjacent to `TASK-162` and becomes user-visible data loss confusion.
- Recommendation: Track whether a scoped cache was restored and whether the BRD scope is dirty.
  Prefer local recovery when dirty, show a "server version available" action, and only let server
  load win automatically when no dirty/recovery draft exists.
- Confidence: Inferred from state flow, strongly supported by code inspection.

### P2 - Acceptance tests do not cover the new route/switch/recovery flows

- Claim: The verification suite passes, but the implemented acceptance criteria are not represented
  by route or component tests.
- Evidence: `src/persistence/save-state.test.ts` covers registry helpers only. `npm run
  test:ui-mock` passes 66 tests, but searches found no tests for the invalid feature banner,
  `canSwitchDiagramScope`, persisted diagram load rejection or `PERSISTED_BRD_LOAD_FAILED`.
- Impact: The fragile transitions above can regress without failing CI. The current green suite is
  useful but not sufficient evidence that `TASK-160`, `TASK-161` and `TASK-162` are behaviorally
  complete.
- Recommendation: Add targeted component tests around `ProjectWorkspace` and mocked
  `WorkspacePersistence`, plus one Playwright mock flow for dirty diagram switch cancel/continue.
- Confidence: Confirmed by code search and test run.

### P2 - Railway staging rehearsal remains externally blocked

- Claim: `TASK-163` is correctly partial; no live deploy, Alembic pre-deploy or `/readyz` check has
  been completed.
- Evidence: `docs/operations/railway-persistence-release.md` lines 84-93 record the blocker.
  Re-running `railway status` during this review reports expired OAuth token and no linked project.
- Impact: Local build and tests do not prove Railway service variables, pre-deploy migrations or
  readiness checks in the actual staging environment.
- Recommendation: Keep `TASK-163` partial until the project owner runs `railway login` and
  `railway link`, then execute the runbook and record timestamped evidence.
- Confidence: Confirmed by command output.

## Module Directions

### Save-State Registry

- Current state: useful helper layer for persisted artifact scopes.
- Main risks: scope metadata lacks enough ancestry for cascade cleanup; shell-level resources still
  use separate save-state fields.
- Recommended direction: Harden.
- Why now: The registry is the right primitive, but cleanup semantics must be explicit before more
  resource types depend on it.
- Near-term actions: add parent identifiers to `SaveScopeEntry`, implement cleanup helpers, and add
  tests for discard/delete cascades.

### Project Workspace Shell

- Current state: improved explicit routing and aggregate dirty guard, with remaining stale-state
  transitions.
- Main risks: invalid route can keep old provider context; feature changes can retain discarded
  dirty scopes.
- Recommended direction: Refactor in place.
- Why now: Small state-transition fixes will remove the biggest correctness risks without changing
  the project/spec/feature UI model.
- Near-term actions: clear active state on invalid feature routes, clear scopes on discard/delete,
  and test valid/invalid route refresh behavior.

### Editor Diagram Switch Flow

- Current state: prompts before switching away from dirty diagram/BRD, but load failure is not
  transactional.
- Main risks: half-switched active scope and uncaught async errors.
- Recommended direction: Harden.
- Why now: This is a narrow fix around a high-value persisted workspace path.
- Near-term actions: catch load failures, move active scope mutation after success, and add tests for
  cancel, continue and load rejection.

### BRD Recovery

- Current state: scoped cache and load failure handling are present.
- Main risks: successful server load can overwrite local recovery draft; dirty/recovery preference
  is implicit.
- Recommended direction: Redesign interface lightly.
- Why now: Latest-only storage has no version history, so local recovery must be protected with an
  explicit conflict policy.
- Near-term actions: record restored-cache state, prefer dirty local recovery, expose load-server
  and keep-local actions.

### Operations

- Current state: local verification is healthy; Railway live evidence is still missing.
- Main risks: migration/readiness not proven in staging.
- Recommended direction: Complete external rehearsal.
- Why now: Do this only after CLI auth/link is available, otherwise the review would overstate
  production readiness.
- Near-term actions: owner login/link, staging deploy, verify Alembic log, check `/healthz` and
  `/readyz`, update runbook.

## Verification Run During This Review

- `npm run build` -> passed. Vite still reports the existing large chunk warning.
- `npm run test:ui-mock` -> passed, 15 files and 66 tests.
- `railway status` -> failed because OAuth token refresh is invalid and no project is linked.

## Final Recommendation

- Keep `TASK-159` through `TASK-162` marked complete only with follow-up hardening tasks below.
- Keep `TASK-163` partial until Railway access is restored.
- Implement `TASK-164` through `TASK-168` before treating persisted workspace Save UX as stable.
