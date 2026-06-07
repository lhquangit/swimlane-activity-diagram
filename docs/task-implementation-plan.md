# Task Implementation Plan

## Task Summary

- Task: Implement `TASK-129` through `TASK-147`
- Requested by: User
- Date: 2026-06-07
- Affected modules: Railway/env, FastAPI runtime, PostgreSQL/Alembic, Clerk auth, persistence
  services/routes, React routing/workspaces, artifact Save flows, tests and operations docs

## Goal Reconstruction

- Requested change: Turn the current in-memory editor into a signed-in, multi-project application
  that persists the latest Project, Spec, FeatureIntent, UseCase, Diagram and BRD state.
- Intended outcome: A user can create a project, explicitly save every artifact, reload the browser
  and continue from the same chain without accessing another user's data.
- Hidden assumptions: Generation remains separate from Save; Clerk is the identity provider;
  Railway PostgreSQL is the production database; latest-state overwrite is accepted for MVP.

## Risk Assessment

- Decision: IMPLEMENT_WITH_GUARDRAILS
- Risk level: High
- Main concerns: credential disclosure, migration/data-loss risk, IDOR, broad `App.tsx` coupling,
  graph serialization loss, stale BRD cache context, and a scope too large for one unverified patch.
- External blocker: Railway CLI authentication has expired and the repository is not linked, so
  credential rotation and live Railway deployment cannot be truthfully completed from this session.

## Guardrails

- Keep the seven-table latest-state schema; do not add revisions/workspaces/audit/realtime.
- Require server-side ownership checks for every child resource.
- Keep generation and persistence as separate actions.
- Preserve existing generation services and add resource-scoped routes around them.
- Keep legacy actor fields only as temporary compatibility adapters.
- Do not connect to the disclosed credential during implementation verification.
- Mark infrastructure tasks partial until Railway credential rotation/deploy/backup are verified.

## Execution Plan

1. Normalize env/deploy configuration and add PostgreSQL/Alembic foundation.
2. Add Clerk authentication, CORS, request-scoped user and ownership services.
3. Add Project/Spec and FeatureIntent CRUD plus protected React routing.
4. Add UseCase resource identity, generation-from-saved-parent and explicit Save.
5. Add Diagram and BRD serialization/persistence with explicit Save.
6. Add shared dirty-state guards and full-chain tests.
7. Update task statuses, changelog, activity log and Railway operations checklist.

## Verification

- Backend: migration/model/auth/ownership/CRUD/generation tests.
- Frontend: API client, workspace, Save-state and existing LogicFlow/unit suites.
- Integration: production build and Playwright persistence flow.
- Browser: signed-out shell, project workspace and canvas Save behavior.

## Final Recommendation

- Core implementation completed locally on 2026-06-07: migration, auth boundary, ownership CRUD,
  protected project UI, latest-state Save flows and PostgreSQL integration tests.
- Remaining partial work is tracked in `docs/review-task-list.md`, primarily Railway credential
  rotation/deploy/backup execution, live Clerk auth matrix and broader browser navigation coverage.
- Do not claim `TASK-129`, live portions of `TASK-130`, or `TASK-147` complete until Railway access is
  restored and credential rotation/deploy/backup checks are performed.

---

## Task Summary

- Task: Implement `TASK-148` through `TASK-158`
- Requested by: User
- Date: 2026-06-07
- Affected modules: backend runtime scripts, Clerk auth, persistence services/routes, diagram
  validation, project workspace UX, scoped Save state, BRD recovery cache, feature routing,
  Docker/Railway deploy rehearsal and persistence tests

## Goal Reconstruction

- Requested change: Close the follow-up gaps found in the TASK-131 to TASK-145 review.
- Intended outcome: The latest-state project flow should be testable through the repo runner,
  safer at auth/validation boundaries, clearer in persisted UI mode, and less likely to leak stale
  Save/cache state across resources.
- Hidden assumptions: Route contracts remain stable, Railway deploy cannot be completed without
  re-auth/link, and local Docker rehearsal is acceptable evidence for the code-side deploy path.

## Risk Assessment

- Decision: IMPLEMENT_WITH_GUARDRAILS
- Risk level: High
- Main concerns: auth/ownership regressions, malformed persisted diagram data, broad editor state
  coupling, and accidental route contract changes while extracting services.
- Why this is safe to implement as written: The work keeps endpoint paths stable, adds tests before
  and after the service extraction, and treats live Railway deployment as partial when credentials
  are unavailable.

## Guardrails

- Keep public persistence API paths and DTO shapes compatible.
- Keep standalone `/demo` use-case input editable while persisted project mode is read-only for
  parent Spec/Feature context.
- Validate saved diagram graph data at Save time and again before saved-BRD generation.
- Do not perform Railway login/deploy or connect to production credentials in this session.
- Mark `TASK-157` partial until Railway OAuth, project link, migrations and staging health are
  verified live.

## Execution Plan

- Files changed: `package.json`, `README.md`, `apps/api/pyproject.toml`,
  `apps/api/app/auth.py`, `apps/api/app/schemas/persistence.py`,
  `apps/api/app/routes/persistence.py`, `apps/api/app/services/persistence_*.py`,
  `apps/api/tests/test_persistence_auth_matrix.py`, `src/application/*`, `src/persistence/*`,
  `src/usecases/UseCasePanel.tsx`, `src/usecases/UseCasePanel.test.tsx`, `src/brd/cache.ts`,
  `src/brd/cache.test.ts`, `src/App.tsx`, `src/styles.css`, `docs/*`.
- Implementation completed: runner normalization, Clerk auth matrix, diagram validator, service
  extraction, scoped Save-state, persisted read-only parent context, UseCase delete, scoped BRD
  cache, active feature URL route, Docker build fix and scenario tests.
- Verification completed: `npm run api:python:smoke`, `npm run test:api-mock`, `npm run
  test:ui-mock`, `npm run build`, `npm run test:e2e-mock`, `docker build -f
  apps/api/Dockerfile -t swimlane-api:task-157 .`, container `/healthz`, `git diff --check`.

## Final Recommendation

- Proceed with the completed implementation.
- `TASK-148` through `TASK-156` and `TASK-158` are complete locally.
- `TASK-157` is partially complete: Docker build/run/health is verified, but Railway staging deploy
  remains blocked by expired OAuth token and missing project link reported by `railway status`.

---

## Task Summary

- Task: Implement `TASK-159` through `TASK-163`
- Requested by: User
- Date: 2026-06-07
- Affected modules: persisted workspace Save-state, diagram canvas context switching, active
  feature routing, persisted BRD recovery, Railway staging operations

## Goal Reconstruction

- Requested change: Finish the follow-up work from the TASK-148 to TASK-158 review.
- Intended outcome: Persisted workspace should keep unsaved changes visible across resource
  switches, avoid silent route fallback, recover gracefully from BRD load failures, and complete as
  much Railway rehearsal as current credentials allow.
- Hidden assumptions: A native browser confirm is acceptable for the MVP switch guard; Railway live
  deploy requires owner login/link and cannot be completed without those credentials.

## Risk Assessment

- Decision: IMPLEMENT_WITH_GUARDRAILS
- Risk level: Medium
- Main concerns: hidden unsaved state causing data loss confusion, over-coupling more state into
  `App.tsx`, and falsely claiming Railway readiness without live deploy access.
- Why this is safe to implement as written: The UI changes are additive around existing Save paths,
  route behavior becomes more explicit, and Railway remains marked partial when CLI access is
  blocked.

## Guardrails

- Keep active toolbar state scoped to the current artifact while using aggregate dirty state for
  leave/reload guards.
- Preserve inactive dirty scopes instead of discarding them during context switches.
- Do not silently redirect invalid feature URLs to a different feature.
- Keep scoped BRD recovery cache when server load fails.
- Do not attempt Railway deploy without successful `railway login` and `railway link`.

## Execution Plan

- Files changed: `src/persistence/save-state.ts`, `src/persistence/save-state.test.ts`,
  `src/persistence/WorkspaceContext.tsx`, `src/application/ProjectWorkspace.tsx`, `src/App.tsx`,
  `docs/review-task-list.md`, `docs/task-implementation-plan.md`,
  `docs/progress/changelog.md`, `docs/operations/railway-persistence-release.md`.
- Implementation completed: save-state registry, aggregate dirty guard, diagram switch confirmation,
  invalid feature deep-link banner, persisted BRD load error handling, Railway CLI blocker
  verification.
- Verification completed: `npm run build`, `npm run test:ui-mock`, `npm run test:e2e-mock`,
  `railway status`.

## Final Recommendation

- `TASK-159` through `TASK-162` are complete locally.
- `TASK-163` remains partial because Railway CLI still reports expired OAuth token and no linked
  project. Complete it after the project owner runs `railway login` and `railway link`.

---

## Task Summary

- Task: Implement `TASK-164` through `TASK-168`
- Requested by: User
- Date: 2026-06-07
- Affected modules: persisted Save-state ownership, feature routing, diagram context switching, BRD
  recovery conflict handling, frontend regression tests

## Goal Reconstruction

- Requested change: Close the state-transition gaps found in the TASK-159 to TASK-163 review.
- Intended outcome: Explicit discard/delete decisions clear only their owned dirty scopes, invalid
  routes cannot retain stale editor context, diagram switches cannot half-commit on failure, and
  local BRD recovery cannot be overwritten silently by server state.
- Hidden assumptions: Latest-only storage makes local recovery conflict policy data-critical;
  authenticated hosted Clerk E2E is not available in the mock test environment.

## Risk Assessment

- Decision: IMPLEMENT_WITH_GUARDRAILS
- Risk level: Medium
- Main concerns: clearing unrelated dirty scopes, committing active resource identity before async
  success, and turning clean server BRD state into a false recovery draft.
- Guardrails: attach feature ownership to Save scopes, clear only on explicit discard/delete,
  commit diagram identity after successful load/generate, treat legacy BRD caches as dirty, and
  require an explicit action before replacing local recovery with server content.

## Execution And Verification

- Implemented: feature-scope cleanup, invalid-route context reset, transactional diagram
  load/generation, guarded generate switches, BRD dirty-cache policy, server-version conflict CTA,
  correct BRD load retry, and focused integration/unit coverage.
- Verification:
  - `npm run build` passed with the existing large-chunk warning.
  - `npm run test:ui-mock` passed: 16 files, 73 tests.
  - `npm run test:e2e-mock` passed: 17 scenarios.
  - Browser smoke on `/demo` confirmed editor/canvas/toolbar render.
  - `git diff --check` passed.

## Final Recommendation

- `TASK-164` through `TASK-168` are complete locally.
- Keep real hosted Clerk persistence E2E as a separate environment-backed verification item rather
  than weakening the local auth boundary for tests.
