# Review: Artifact Tree Use Case Delete And Disclosure UX

- Date: 2026-06-11
- Reviewer: Codex (`senior-ai-reviewer`)
- Scope: persisted artifact left bar for Feature -> Use Case navigation and actions
- Reviewed modules:
  - `artifact-tree-ui`: `src/application/ArtifactTree.tsx`, `src/application/ArtifactTree.test.tsx`
  - `workspace-command-layer`: `src/application/ProjectWorkspace.tsx`, `src/persistence/WorkspaceContext.tsx`, `src/persistence/api.ts`
  - `persisted-usecase-route`: `src/usecases/PersistedUseCaseWorkspace.tsx`
- Not reviewed in this pass:
  - browser E2E coverage
  - backend delete route internals beyond the exposed command path

## Executive Summary

- Overall health: Good base, but the left bar is still read-only navigation for use cases.
- Highest-risk area: tree UX and destructive-action wiring are split across components, so adding
  delete inline without a small interface refactor would couple `ArtifactTree` directly to route
  state and confirmation logic.
- Fastest high-value win: expose existing `deleteUseCase` capability from the left bar with a
  scoped confirm flow and regression coverage.
- Recommended execution order:
  1. Add left-bar delete action with safe routing/state cleanup.
  2. Add explicit collapse/expand state for per-use-case branches and polish disclosure UX.

## Module Map

### artifact-tree-ui
- Purpose: render the persisted project left bar and own local disclosure state for visible tree
  branches.
- Evidence: `ArtifactTree` owns `collapsed` state and renders project/feature/use-case hierarchy at
  [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:16).

### workspace-command-layer
- Purpose: adapt persistence API calls into route-aware workspace commands, including delete and
  post-delete navigation cleanup.
- Evidence: `deleteUseCase` already exists in the workspace context at
  [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:659).

### persisted-usecase-route
- Purpose: use-case detail/list page for persisted mode, currently the only surface that exposes
  delete for a saved use case.
- Evidence: route-level delete confirm and command call live at
  [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:239).

## Findings

### 1. Left bar cannot delete a use case even though the command already exists

- Claim: The app already has a canonical delete command for persisted use cases, but the left bar
- does not expose it.
- Evidence:
  - Workspace context exposes `deleteUseCase` in
    [src/persistence/WorkspaceContext.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/persistence/WorkspaceContext.tsx:67).
  - `ProjectWorkspace` implements delete, clears related scopes, clears active diagram when needed,
    refreshes the tree, and routes back to the feature list in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:659).
  - `ArtifactTree` only renders navigation items and has no action slot per use case in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:184).
- Impact: Users have to leave the left bar, open the detail route, then delete there. That is
  slower than the mental model implied by an artifact tree and makes project cleanup feel
  inconsistent.
- Recommendation: Add a scoped delete action on each use-case row in the left bar, but keep the
  actual destructive command and route cleanup in `ProjectWorkspace`.
- Confidence: Confirmed.

### 2. Use-case branches are always expanded, so the tree gets noisy as soon as a feature has many use cases

- Claim: Per-use-case disclosure state does not exist; diagram and BRD children are always visible
  once the parent feature is expanded.
- Evidence:
  - `ArtifactTree` has collapse state for `project`, `features`, and each feature key, but not for
    each use case key in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:24)
    and [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:138).
  - Use-case children are rendered unconditionally under each use case in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:202).
- Impact: The left bar scales poorly. Every use case permanently occupies three visible rows
  (`Use Case`, `Diagram`, `BRD`), which becomes noisy and harder to scan.
- Recommendation: Add per-use-case disclosure state and auto-expand the active use case path while
  keeping inactive siblings collapsible.
- Confidence: Confirmed.

### 3. Tree action UX will become brittle if delete and collapse are added ad hoc to `TreeItem`

- Claim: `ArtifactTree` currently conflates selection rendering and branch layout, so bolting on row
  actions without a small interface step risks broken focus order and accidental navigation.
- Evidence:
  - `TreeItem` is used as a full clickable row, while disclosure toggles live beside it in separate
    wrappers; there is no explicit row action model in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:141)
    and [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:186).
  - Keyboard navigation currently targets `[role="treeitem"]` buttons only in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:28),
    so new inline buttons could escape the existing focus model if not designed deliberately.
- Impact: Quick inline controls can regress accessibility, trigger parent row navigation by
  bubbling, or make tree keyboard behavior inconsistent.
- Recommendation: Refactor artifact-tree row primitives in place before adding multiple inline
  actions; keep selection, disclosure, and row actions as separate interactive targets with explicit
  tests.
- Confidence: Inferred from current structure, high confidence.

## Module Directions

### artifact-tree-ui
- Current state: Good navigation baseline, limited action/disclosure depth.
- Main risks:
  - no per-use-case collapse model
  - no safe slot for destructive row actions
  - keyboard/focus regressions if actions are added informally
- Recommended direction: Refactor in place
- Why now: The component already owns the tree disclosure state, so this is the right layer to add
  per-use-case expand/collapse and row action affordances before more artifact operations accumulate.
- Near-term actions:
  - introduce explicit row layout primitives for select/disclose/actions
  - add per-use-case collapse state
  - add regression tests for focus, disclosure, and delete action isolation

### workspace-command-layer
- Current state: Delete behavior is already centralized and safe enough to reuse.
- Main risks:
  - left-bar actions could bypass existing confirmation/navigation expectations
  - active route cleanup can regress if a left-bar delete path is implemented separately
- Recommended direction: Keep as-is
- Why now: The command layer already clears state and refreshes the tree. Reusing it is lower risk
- than inventing a second delete path from the sidebar.
- Near-term actions:
  - reuse existing `deleteUseCase` from the left bar
  - keep confirm messaging and post-delete route fallback in one orchestration layer

### persisted-usecase-route
- Current state: Detail route already proves delete semantics and confirmation copy.
- Main risks:
  - UX duplication between detail page and left bar
  - divergence in confirm wording or post-delete routing
- Recommended direction: Harden
- Why now: The route should remain the semantic reference for delete behavior even if the left bar
  becomes a second trigger surface.
- Near-term actions:
  - extract or reuse confirm copy/policy from one place
  - add tests that both triggers produce the same cleanup behavior

## Task Creation Decision

Created two follow-up tasks in `docs/review-task-list.md`:

- `TASK-205` for left-bar delete capability on use-case rows
- `TASK-206` for per-use-case collapse/expand and tree-row UX hardening
