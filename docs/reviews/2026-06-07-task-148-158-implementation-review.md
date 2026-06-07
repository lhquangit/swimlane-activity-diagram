# TASK-148 to TASK-158 Implementation Review

- Date: 2026-06-07 15:20 +07
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Follow-up persistence hardening tasks `TASK-148` through `TASK-158`
- Reviewed modules: backend runtime scripts, FastAPI auth/persistence routes, persistence services,
  diagram validation, frontend project workspace, UseCasePanel persisted mode, BRD cache, tests,
  Docker/Railway deploy path
- Not reviewed: live Railway staging deploy, live Clerk browser E2E with real hosted Clerk sessions

## Executive Summary

Overall health: the implementation is materially stronger than the TASK-131 to TASK-145 pass.
Backend runner, auth tests, service extraction, diagram validation and Docker build path are now in
good shape locally.

Highest-risk area: frontend scoped dirty-state tracking. The current implementation scopes state by
resource, but the global unsaved-change guard only looks at the active scope.

Fastest high-value win: introduce a small save-state registry/reducer that can answer both "active
resource dirty?" and "any resource dirty?", then use it before switching use case/diagram/feature.

Recommended execution order: fix hidden dirty-state leakage first, then make invalid feature
deep-links explicit, then complete Railway live deploy once the account is logged in and linked.

## Module Map

| Module | Files | Responsibility |
| --- | --- | --- |
| Backend runner and package build | `package.json`, `apps/api/pyproject.toml`, `README.md`, `playwright.config.ts` | Local script contract, backend Python dependency path, Docker package install |
| Auth and ownership | `apps/api/app/auth.py`, `apps/api/app/persistence.py`, `apps/api/tests/test_persistence_auth_matrix.py` | Clerk request authentication, app_user hydration, ownership 404s |
| Persistence API | `apps/api/app/routes/persistence.py`, `apps/api/app/services/persistence_*.py` | Endpoint wiring, DTO serialization, CRUD transaction ownership, saved generation adapters |
| Diagram validation | `apps/api/app/schemas/persistence.py`, `apps/api/app/services/persistence_generation.py` | Saved graph payload validation and conversion to BRD generate request |
| Project workspace frontend | `src/application/ProjectWorkspace.tsx`, `src/application/AppRouter.tsx`, `src/persistence/WorkspaceContext.tsx` | Project/spec/feature routing, scoped Save state, active feature URL |
| Editor integration | `src/App.tsx`, `src/usecases/UseCasePanel.tsx`, `src/brd/cache.ts` | Persisted use-case UX, diagram/BRD Save/Load, recovery cache and deletion |
| Verification and operations | `apps/api/tests/*`, `src/**/*.test.*`, `apps/api/Dockerfile`, `railway.toml` | API/UI regression, Docker image health, Railway deploy contract |

## Findings

### P1 - Dirty state can disappear when switching away from a dirty diagram or BRD

- Claim: `ProjectWorkspace` stores scoped Save states, but `hasUnsavedChanges` only checks the
  currently active use case, diagram and BRD scopes.
- Evidence: `ProjectWorkspace.tsx` derives `useCaseSaveState`, `diagramSaveState` and
  `brdSaveState` from only the active keys at lines 98-114. `setScopedSaveState` preserves dirty
  values for inactive resources at lines 141-143, but no aggregate dirty check scans the map.
  `handleOpenUseCaseDiagramCanvas` switches diagrams without checking any scoped dirty state at
  `src/App.tsx` lines 1936-1952.
- Impact: A user can dirty Diagram A, open Diagram B, and the global beforeunload guard may no
  longer warn even though Diagram A is still dirty in the scoped map. This undermines the intent of
  `TASK-150`.
- Recommendation: Replace ad hoc scoped state with a registry/reducer exposing `isActiveDirty`,
  `isAnyDirty`, `dirtyScopes`, and guarded context-switch helpers.
- Confidence: Confirmed by code inspection. Existing tests pass because they do not cover inactive
  dirty scopes.

### P2 - Invalid feature deep-links silently fall back to the first feature

- Claim: `/projects/:projectId/features/:featureId` does not distinguish "feature not found" from
  "no feature selected"; it silently picks the first feature and replaces the URL.
- Evidence: `ProjectWorkspace.tsx` finds `routedFeature` then falls back to `nextFeatures[0]` at
  lines 76-85.
- Impact: The route contract is usable for refresh, but a stale or mistyped feature URL can open a
  different feature without telling the user. That is safer than leaking cross-user resource
  existence, but still confusing.
- Recommendation: Show a scoped not-found/redirect notice when `routeFeatureId` exists but is not in
  the loaded feature list.
- Confidence: Confirmed by code inspection.

### P2 - BRD Load/Save recovery has no error path for server load failures

- Claim: The persisted BRD load effect does not catch errors from `workspace.loadBrd`.
- Evidence: `src/App.tsx` calls `workspace.loadBrd(diagramId).then(...)` at lines 1062-1085 with no
  `.catch`.
- Impact: A transient backend error while switching diagrams can become an unhandled promise
  rejection and leave stale cache/server state ambiguous in the panel.
- Recommendation: Add an error branch that keeps scoped recovery cache visible, sets BRD status
  clearly, and does not overwrite user drafts.
- Confidence: Confirmed by code inspection.

### P2 - Railway deploy is still correctly marked Partial

- Claim: The code-side Docker path is now verified, but live Railway deployment remains external.
- Evidence: `apps/api/pyproject.toml` explicitly restricts package discovery to `app*` at lines
  26-28, which fixes the Docker package build. The previous verification built and ran
  `swimlane-api:task-157` and hit `/healthz`, but `railway status` reported expired OAuth token and
  no linked project.
- Impact: The image is shippable locally, but migration and `/readyz` are not proven in Railway.
- Recommendation: Keep `TASK-157` partial and create a small follow-up dedicated to live staging
  deploy after `railway login` and `railway link`.
- Confidence: Confirmed by command output from implementation pass.

### P3 - Review task list status was inconsistent for TASK-148

- Claim: `TASK-148` had completion notes and passing verification but still said `Status: Pending`.
- Evidence: `docs/review-task-list.md` line 3300 had the stale status while the completion notes
  record runner normalization and verification.
- Impact: Planning status is misleading for the next execution pass.
- Recommendation: Correct the status to `Done`.
- Confidence: Confirmed.

## Module Directions

### Backend Runner And Package Build

- Current state: solid locally after venv runner normalization and setuptools package discovery.
- Main risks: `.venv` path must exist before npm scripts run; Railway live path not yet verified.
- Recommended direction: Harden.
- Why now: It already unblocks local and E2E tests; only live staging verification remains.
- Near-term actions: keep README setup tight, complete Railway staging deploy, add CI cache or setup
  docs if CI is introduced.

### Auth And Ownership

- Current state: much stronger; auth-disabled fast path and mocked Clerk-on path both have coverage.
- Main risks: no real hosted Clerk browser E2E yet.
- Recommended direction: Keep as-is for backend, add live/browser edge coverage later.
- Why now: Backend trust boundaries are covered enough for MVP; live UI auth can wait until Railway
  and Clerk environments are stable.

### Persistence API

- Current state: service extraction improved route readability without changing contracts.
- Main risks: service functions still combine validation-adjacent decisions and transaction commits.
- Recommended direction: Refactor in place gradually.
- Why now: Current shape is reviewable; deeper domain separation should happen only when workflows
  grow beyond latest-state MVP.

### Diagram Validation

- Current state: good MVP boundary; malformed saved graph payloads are rejected before BRD generate.
- Main risks: validator is still dictionary-based rather than typed node/edge Pydantic models.
- Recommended direction: Harden.
- Why now: The current validator catches the high-risk failures; typed models can follow when graph
  schema stabilizes.

### Project Workspace Frontend

- Current state: useful feature routing and scoped state exist, but inactive dirty-state handling is
  incomplete.
- Main risks: hidden dirty scopes, silent invalid-feature fallback, limited state-machine tests.
- Recommended direction: Redesign interface for Save-state registry.
- Why now: This is the remaining area most likely to create user-visible data loss confusion.

### Editor Integration

- Current state: persisted mode is clearer; UseCase delete and BRD scoped cache are wired.
- Main risks: load error handling and context-switch guards are not centralized.
- Recommended direction: Harden.
- Why now: A small wrapper around load/save outcomes would make the editor less fragile without a
  rewrite.

### Verification And Operations

- Current state: local verification is strong; live operations remain partial.
- Main risks: Railway migration/readiness and real Clerk browser flow are unverified.
- Recommended direction: Complete external rehearsal.
- Why now: Do this after credential rotation/login so results are truthful.

## Verification Run During This Review

- `npm run test:api-mock` -> `82 passed`, `1 warning`.
- `npm run test:ui-mock` -> `63 passed`.
- `git diff --check` -> passed.

