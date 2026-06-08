# Review — TASK-179 to TASK-183 Implementation

Date: 2026-06-07
Reviewer: Codex (`senior-ai-reviewer`)
Scope: persisted `Feature Intent -> Use Case -> Diagram` flow introduced for `TASK-179` through `TASK-183`

## Review Scope

- Entrypoints reviewed:
  - `src/application/AppRouter.tsx`
  - `src/application/ProjectWorkspace.tsx`
  - `src/usecases/PersistedUseCaseWorkspace.tsx`
  - `src/persistence/WorkspaceContext.tsx`
  - `src/persistence/save-state.ts`
  - `src/persistence/api.ts`
  - `apps/api/app/services/persistence_service.py`
  - `src/application/ProjectWorkspace.test.tsx`
  - `src/usecases/PersistedUseCaseWorkspace.test.tsx`
  - `e2e/artifact-tree.spec.ts`
  - `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`
- Verification run:
  - `npm run test:ui-mock -- src/application/ProjectWorkspace.test.tsx src/usecases/PersistedUseCaseWorkspace.test.tsx`
  - `npm run test:e2e-mock -- e2e/artifact-tree.spec.ts`

## Module Map

1. `frontend-workspace-shell`
   - Files: `src/application/AppRouter.tsx`, `src/application/ProjectWorkspace.tsx`, `src/App.tsx`
   - Purpose: route composition, persisted shell, canvas mounting boundaries, artifact navigation.
2. `persisted-usecase-surface`
   - Files: `src/usecases/PersistedUseCaseWorkspace.tsx`, `src/styles.css`
   - Purpose: list/editor/missing-diagram UX for persisted Use Cases.
3. `persistence-contract`
   - Files: `src/persistence/WorkspaceContext.tsx`, `src/persistence/save-state.ts`, `src/persistence/api.ts`
   - Purpose: workspace-facing persistence API, scoped save-state, route-to-resource orchestration.
4. `backend-bulk-save`
   - Files: `apps/api/app/services/persistence_service.py`
   - Purpose: authoritative persistence behavior for use-case bulk save and artifact tree refresh.
5. `regression-docs`
   - Files: `src/application/ProjectWorkspace.test.tsx`, `src/usecases/PersistedUseCaseWorkspace.test.tsx`, `e2e/artifact-tree.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`
   - Purpose: lock the new flow through component tests, end-to-end coverage, and canonical docs.

## Findings

### [P1] Regenerate still does additive upsert, not replace, so stale Use Cases survive the "replace list" flow

- Claim: the backend bulk-save path does not delete or retire omitted Use Cases, even though the new generate flow explicitly warns that it will replace the current list.
- Evidence:
  - `PersistedUseCaseWorkspace` prompts the user that regenerate will replace the current list at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:79).
  - `save_owned_use_cases` only updates or creates rows from the submitted payload and never deletes omitted rows at [apps/api/app/services/persistence_service.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/persistence_service.py:269).
  - `TASK-179` is marked done with "replace" semantics and immediate tree truthfulness in [docs/review-task-list.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/review-task-list.md:4148).
- Impact: if a second generation returns fewer or different `use_case_id`s, old Use Cases remain in the database and reappear in the left tree after refresh. The persisted inventory can drift away from the generated set the UI claims is now current.
- Recommendation: define an explicit replace policy in the backend bulk-save layer. Either delete omitted Use Cases transactionally, or mark them superseded/outdated and surface that state in the tree. The frontend confirmation copy should then match the real persistence behavior.
- Confidence: Confirmed.

### [P1] First-time generate failure still has no retry-to-save path, despite the task and completion notes claiming one

- Claim: when generation succeeds but `saveUseCases` fails, the page shows the generated drafts and an error, but does not offer any direct retry-to-save action.
- Evidence:
  - Failure handling only records the error at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:106).
  - The list view only renders `Sửa Use Case` when a persisted resource exists at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:366).
  - `TASK-179` completion notes say a retry affordance exists in [docs/review-task-list.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/review-task-list.md:4171).
- Impact: on the first generation for a feature, a transient persistence failure leaves the user with non-persisted drafts and no non-destructive way to commit them. The only visible primary action is to generate again, which changes content instead of retrying the failed write.
- Recommendation: keep the generated drafts in local state and expose an explicit `Lưu danh sách` / `Thử lưu lại` action that reuses those drafts without re-calling generation. Add a regression that covers the first-time failure path where there are zero existing persisted resources.
- Confidence: Confirmed.

### [P1] The new editor does not implement the documented outdated/diverged diagram lifecycle, and the auto-open handoff is no longer trustworthy

- Claim: the persisted Use Case editor derives diagram CTAs from `diagramExists` plus `is_outdated`, so it misses the documented `diverged` branch and no longer proves the one-click "generate then open canvas" contract.
- Evidence:
  - The editor only decides between `Tạo diagram` and `Tạo lại diagram` from `diagramExists` and `is_outdated` at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:435) and [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:501).
  - The old lifecycle model explicitly distinguishes `outdated` from `diverged` and exposes regenerate for both at [src/usecases/lifecycle.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/lifecycle.ts:117) and [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:1223).
  - UC-07 still specifies `Mở diagram` and `Tạo lại diagram` for `outdated/diverged` plus immediate route/render on generate at [docs/use-cases/UC-07-sinh-usecase-tu-spec.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-07-sinh-usecase-tu-spec.md:62) and [docs/use-cases/UC-07-sinh-usecase-tu-spec.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-07-sinh-usecase-tu-spec.md:64).
  - The persisted E2E had to encode `Tạo diagram` followed by a second manual `Mở diagram` click at [e2e/artifact-tree.spec.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/e2e/artifact-tree.spec.ts:49), which is a weaker contract than the documented one-click handoff.
- Impact: semantically diverged diagrams do not get the intended regenerate affordance on the new surface, and the shipped handoff is now ambiguous: code and docs say "generate then route to canvas", but regression coverage only passes when a second open step is added.
- Recommendation: derive persisted editor CTAs from the same lifecycle helper used by the standalone inventory, including `diverged`. Then choose one contract for post-generate routing, document it once, and assert it directly in browser coverage.
- Confidence: Confirmed for `diverged` handling; strongly inferred from end-to-end behavior for the auto-open contract.

### [P2] The new persisted E2E is still brittle because it selects BRD nodes positionally instead of by artifact identity

- Claim: `artifact-tree.spec.ts` still uses ambiguous positional selection for BRD nodes, so the main regression can fail even when the feature works.
- Evidence:
  - The spec asserts against `locator('.artifact-tree__item').filter({ hasText: 'BRD' }).last()` at [e2e/artifact-tree.spec.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/e2e/artifact-tree.spec.ts:68).
  - A fresh rerun during this review failed because `.last()` resolved to a different `BRD chưa tạo` node from another Use Case rather than the BRD node created by the scenario.
- Impact: `TASK-183` says the flow is locked by E2E, but this coverage can flap based on tree ordering and no longer provides a trustworthy signal for regressions in the persisted chain.
- Recommendation: scope BRD assertions to the specific Use Case subtree created in the test, or assert using the active route plus the exact BRD title/resource identity after save.
- Confidence: Confirmed.

## Module Directions

### frontend-workspace-shell

- Current state: the route split is real and the canvas is no longer the primary Use Case editor.
- Main risks:
  - post-generate handoff semantics are now unclear between docs, code intent, and browser coverage
  - the shell still depends on ad hoc lifecycle checks rather than one shared source of truth
- Recommended direction: Refactor in place
- Why now: the route boundaries are good enough; the next win is to remove lifecycle drift before more persisted surfaces copy the same logic.

### persisted-usecase-surface

- Current state: the new surface is materially better than the old overlay and is close to being the canonical UX.
- Main risks:
  - save-failure recovery is incomplete
  - diagram lifecycle parity with the old inventory is incomplete
- Recommended direction: Harden
- Why now: the UX is already user-facing and the remaining gaps are correctness and recovery gaps, not redesign-level problems.

### persistence-contract

- Current state: scoped save-state and workspace-level persistence APIs are a strong base.
- Main risks:
  - frontend completion notes overstate behavior that the contract does not actually guarantee
  - duplicated refreshes and mixed local/tree patching make true behavior harder to reason about
- Recommended direction: Refactor in place
- Why now: a small amount of contract cleanup will make follow-up fixes safer and easier to test.

### backend-bulk-save

- Current state: the API is simple, but the current semantics are not aligned with the new regenerate-and-replace UX.
- Main risks:
  - omitted Use Cases survive regenerate
  - frontend and backend tell different stories about what "replace" means
- Recommended direction: Redesign interface
- Why now: this is the authoritative truth layer for TASK-179; if it stays additive, the left tree will continue drifting from the UX promise.

### regression-docs

- Current state: there is meaningful new coverage and the docs moved in the right direction.
- Main risks:
  - the main persisted E2E is still brittle
  - docs currently describe a stronger handoff contract than the browser test actually proves
- Recommended direction: Harden
- Why now: the suite is already the merge gate for this flow, so weak selectors and doc/runtime drift will waste time quickly.
