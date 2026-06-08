# Review: TASK-131 to TASK-145 Implementation

Date: 2026-06-07 12:36 +07  
Reviewer: senior-ai-reviewer  
Scope: PostgreSQL/Alembic, Clerk backend auth, persistence APIs, frontend project workspace, Save/Load UX, tests and deployment contract introduced for TASK-131 through TASK-145.

## Executive Summary

The implementation establishes the right MVP shape: seven latest-state tables, server-side ownership checks, explicit generation-vs-save boundaries, protected project routes and a working local persistence chain. The biggest remaining risks are not the schema itself; they are integration polish and trust-boundary coverage.

Highest-risk areas:

1. Test/dev scripts do not use the environment where the new Python dependencies are installed.
2. The project workspace still exposes editor inputs that appear editable but are ignored in persisted project mode.
3. Save-state is too coarse and not reset consistently when switching feature/project context.
4. Diagram payload validation is size-only, while resource-scoped BRD generation assumes typed graph fields.
5. Auth coverage still relies heavily on `AUTH_DISABLED`, so Clerk/JWT failure paths are not proven.

Recommended order: fix scripts and UX correctness first, then harden validation/auth, then split the persistence service layer and broaden E2E coverage.

## Module Map

| Module | Files Reviewed | Responsibility |
| --- | --- | --- |
| Runtime and deployment | `railway.toml`, `apps/api/Dockerfile`, `.dockerignore`, `apps/api/app/config.py`, `apps/api/app/main.py` | API process, env loading, CORS, health/readiness, Railway contract |
| Identity and ownership | `apps/api/app/auth.py`, `apps/api/app/persistence.py` | Clerk session verification, `app_users`, ownership lookup helpers |
| Persistence schema | `apps/api/app/models.py`, `apps/api/alembic/versions/20260607_01_latest_state.py`, `apps/api/app/db.py` | SQLAlchemy tables, migrations, sessions |
| Persistence API | `apps/api/app/routes/persistence.py`, `apps/api/app/schemas/persistence.py` | Project/Spec/Feature/UseCase/Diagram/BRD CRUD and resource-scoped generation |
| Frontend shell/client | `src/application/*`, `src/persistence/*`, `src/main.tsx` | Protected routes, project dashboard/workspace, typed API client/context |
| Editor Save integration | `src/App.tsx`, `src/usecases/UseCasePanel.tsx`, `src/brd/BrdPanel.tsx` | Existing LogicFlow editor wired to persisted resources and Save states |
| Verification | `apps/api/tests/*`, `playwright.config.ts`, `e2e/brd-flow.spec.ts`, `package.json` | Unit/integration/E2E commands and persistence-chain tests |

## Findings

### P1 - `npm run test:api-mock` fails on the current machine

- Claim: The documented API mock test script uses system `python3`, but the newly installed dependencies are in `apps/api/.venv`.
- Evidence: `package.json:9-14` uses `python3` for API runtime/tests, while `playwright.config.ts:14` had to use `apps/api/.venv/bin/python` to start successfully. Running `npm run test:api-mock` failed with `ModuleNotFoundError: No module named 'clerk_backend_api'`.
- Impact: A developer following the repo scripts cannot reliably run backend tests after TASK-131/TASK-132. CI or local machines without globally installed dependencies will fail before executing tests.
- Recommendation: Standardize backend commands through a single Python runner strategy: either use the project venv explicitly, add a bootstrap command, or move to a workspace-managed tool such as `uv`.
- Confidence: Confirmed.

### P1 - Project-mode UseCase input looks editable but is intentionally ignored

- Claim: In persisted project mode, `UseCasePanel` still renders Feature/ProjectSpec inputs, but `App` discards edits and only writes a status message.
- Evidence: `UseCasePanel.tsx:189-305` renders editable feature/actor/rules inputs and `UseCasePanel.tsx:318-345` renders project context inputs. In workspace mode, `App.tsx:1664-1684` returns early from `handleProjectSpecChange` and `handleFeatureIntentChange`.
- Impact: The user can type into fields and see the value snap back or fail to persist. This undermines the revised UX where Spec and Feature are edited in dedicated tabs.
- Recommendation: In workspace mode, replace the input section with read-only context plus CTA buttons to the Project Spec and Feature tabs, or pass explicit `readOnly`/`mode` props and disable the fields.
- Confidence: Confirmed from code path; Browser interaction would confirm user-visible behavior.

### P1 - Dirty/save state is shared and not reset per resource context

- Claim: Spec and Feature share one `shellSaveState`, and child save states are not reset when selecting another feature.
- Evidence: `ProjectWorkspace.tsx:54-57` has one shell state plus child states. Spec save uses the same state at `ProjectWorkspace.tsx:137-163`; Feature save uses it at `ProjectWorkspace.tsx:165-183`; both buttons consume the same state at `ProjectWorkspace.tsx:332` and `ProjectWorkspace.tsx:376`. Feature selection at `ProjectWorkspace.tsx:120-127` only resets `shellSaveState`, while use-case/diagram/BRD states remain as-is.
- Impact: A dirty UseCase/Diagram/BRD from Feature A can show as unsaved in Feature B, or block downstream actions incorrectly. A Spec save can also affect Feature button copy and vice versa.
- Recommendation: Split save-state into `projectSaveState`, `specSaveState`, `featureSaveState`, `useCaseSaveStateByFeature`, `diagramSaveStateByUseCase`, and `brdSaveStateByDiagram`, or derive each from baselines.
- Confidence: Confirmed.

### P1 - Diagram payload validation is too shallow for saved BRD generation

- Claim: The backend accepts almost any node/edge shape as long as `graph_data.nodes` and `graph_data.edges` are arrays, but later assumes fields are typed when converting to `GenerateRequest`.
- Evidence: `DiagramSave.validate_graph_size` only checks array presence and counts in `schemas/persistence.py:166-174`. `stored_generate_request` casts node coordinates with `float(node.get("x", 0))` and passes `node.get("type")` through to strict `GenerateRequest` at `routes/persistence.py:507-547`.
- Impact: A malformed but saved diagram can turn a later BRD validate/generate request into a 500 instead of a controlled 422, and the DB can store graph data that cannot be used downstream.
- Recommendation: Add a strict saved-diagram validator/adapter that validates supported node types, required IDs, lane references, numeric coordinates and edge endpoints before PUT succeeds.
- Confidence: Confirmed.

### P1 - Auth and ownership tests do not yet prove live Clerk trust boundaries

- Claim: Persistence tests prove ownership helper behavior but not actual Clerk token validation, missing-token rejection, authorized parties or role immutability.
- Evidence: `apps/api/tests/conftest.py:9-13` globally defaults `AUTH_DISABLED=true`. The full-chain test swaps `require_current_user` directly at `test_persistence_chain.py:159-168`.
- Impact: A regression in Clerk SDK usage, authorized-party configuration or invalid-token handling could ship while the persistence suite remains green.
- Recommendation: Add tests that patch Clerk authentication at the SDK boundary or use signed test JWTs, covering missing token, invalid token, wrong authorized party, new user creation, role defaulting and cross-user `404`.
- Confidence: Confirmed test gap.

### P2 - Persistence route layer is doing controller, service, serialization and transaction work

- Claim: `routes/persistence.py` has grown into a monolithic service/controller with repeated commit/refresh patterns.
- Evidence: The same file serializes resources (`routes/persistence.py:59-132`), handles every CRUD route (`routes/persistence.py:143-619`), constructs generation inputs (`routes/persistence.py:304-351`, `routes/persistence.py:498-547`) and commits per operation (`routes/persistence.py:169`, `193`, `230`, `264`, `288`, `405`, `479`, `603`).
- Impact: The next set of fixes will either duplicate transaction/error behavior or make this file harder to reason about. Multi-row rules, explicit delete, and conflict handling will be easier to break.
- Recommendation: Refactor in place into small service modules after the P1 correctness fixes land. Keep route functions thin and put transaction boundaries in service functions.
- Confidence: Confirmed maintainability risk.

### P2 - The BRD recovery cache is still global in editor mode and disabled rather than scoped in project mode

- Claim: The previous localStorage cache remains a global editor artifact, while the persisted workspace simply skips cache hydration/persist.
- Evidence: `App.tsx:1000-1039` skips cache load/save when `workspace` exists. Cache APIs are still global in `src/brd/cache.ts`, and toolbar cache actions remain visible in `App.tsx:2595-2608`.
- Impact: The server is now the source of truth, but recovery behavior is inconsistent: standalone demo has global recovery, project workspace has no scoped recovery path for unsaved BRD edits after a hard reload.
- Recommendation: Implement scoped recovery keys by Clerk user/project/diagram ID and hide or rename legacy cache actions in persisted workspace until scoped recovery exists.
- Confidence: Confirmed design gap.

### P2 - Project workspace lacks route-level active feature identity

- Claim: `/projects/:projectId` always selects the first feature after load; active feature is not in URL or stable storage.
- Evidence: Initial load selects `nextFeatures[0]` at `ProjectWorkspace.tsx:74-78`; route definitions only include `/projects/:projectId` at `AppRouter.tsx:66-72`.
- Impact: Refresh or shared links can open a different feature than the user expects, especially because features are ordered by `updated_at`.
- Recommendation: Add query or nested route identity such as `/projects/:projectId/features/:featureId`, and redirect to the selected/first feature explicitly.
- Confidence: Confirmed.

## Module Directions

### Runtime And Deployment

- Current state: Docker/Railway contract is much safer than the initial Railpack approach, but local scripts are inconsistent.
- Main risks: system Python dependency failures; Railway deploy not rehearsed; `.env` rotation still external.
- Recommended direction: Harden.
- Why now: Tooling must be boring before more persistence work builds on it.
- Near-term actions: standardize Python runner, verify Docker build in CI, rehearse Railway after login/credential rotation.

### Identity And Ownership

- Current state: Ownership chain helpers are directionally correct and return non-leaky `404`.
- Main risks: live Clerk validation not covered; role behavior not tested; auth-disabled paths can hide failures.
- Recommended direction: Harden.
- Why now: This is the trust boundary for all persisted data.
- Near-term actions: add Clerk auth matrix tests, add `/api/me` assertions, keep `AUTH_DISABLED` out of production-like test paths.

### Persistence Schema

- Current state: Seven-table latest-state schema matches the requested MVP and has appropriate 1:1 constraints.
- Main risks: JSONB payloads need stricter semantic validation; source timestamp/outdated behavior needs targeted regression tests.
- Recommended direction: Keep schema, harden validators.
- Why now: The schema is not the problem; invalid JSON stored inside it is.
- Near-term actions: add diagram/BRD payload validators, add constraints/outdated tests, avoid schema expansion.

### Persistence API

- Current state: API surface covers the full chain and ownership checks, but the route module owns too many responsibilities.
- Main risks: duplicated transaction behavior, hard-to-test generation adapters, malformed saved graph causing later 500s.
- Recommended direction: Refactor in place.
- Why now: Refactor after validator/auth fixes, before adding delete matrix and sharing/admin roles.
- Near-term actions: extract services, route serializers and graph adapters; add explicit conflict/422 handling.

### Frontend Shell And Workspace

- Current state: The app now has a real project shell, dashboard and protected routing.
- Main risks: fake editable fields in editor mode; save states shared across scopes; feature identity not deep-linkable.
- Recommended direction: Redesign interface boundaries.
- Why now: The user's requested UX is about clear Project/Spec/Feature ownership; ambiguity here will create support issues.
- Near-term actions: make editor input read-only in workspace mode, split save-state baselines, add active feature route/query identity.

### Editor Save Integration

- Current state: Save buttons exist for UseCase, Diagram and BRD, and generation no longer automatically persists.
- Main risks: incomplete context-switch guards; missing explicit UseCase delete UI; BRD recovery is not scoped.
- Recommended direction: Harden.
- Why now: Latest-only storage needs strong save/dirty semantics because there is no revision recovery.
- Near-term actions: add scoped guards, explicit use-case delete, scoped BRD recovery cache and Save-state tests.

### Verification

- Current state: Backend, frontend, Playwright and migration checks can pass when invoked with the right Python.
- Main risks: official scripts can fail; auth matrix is thin; project workspace flow lacks signed-in E2E coverage.
- Recommended direction: Harden.
- Why now: The implementation is broad enough that regression protection matters more than more features.
- Near-term actions: fix scripts, add authenticated persistence E2E, split full-chain API tests into smaller scenario tests.

## Reviewed Commands

- `npm run test:api-mock` — failed because `python3` cannot import `clerk_backend_api`.
- Prior verification from implementation pass remains relevant but should be rerun after script normalization: backend pytest through `apps/api/.venv`, Vitest, Playwright, Vite build and Alembic up/down/up.

