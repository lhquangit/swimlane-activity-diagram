# Review: Use Case Diagram Save Gate

- Date: 2026-06-12
- Reviewer: Codex (`senior-ai-reviewer`)
- Scope: persisted `Use Case` screen behavior around `Lưu Use Case` and `Tạo diagram`
- Reviewed modules:
  - `workspace-shell`: `src/application/ProjectWorkspace.tsx`
  - `persisted-usecase-route`: `src/usecases/PersistedUseCaseWorkspace.tsx`
  - `persisted-usecase-tests`: `src/usecases/PersistedUseCaseWorkspace.test.tsx`
- Not reviewed in this pass:
  - backend diagram generation route
  - legacy `UseCasePanel` flow outside the persisted route

## Executive Summary

- Answer to the product question: yes, the current persisted `Use Case` flow requires the latest
  Use Case changes to be saved before Diagram generation is allowed to proceed.
- Confirmed gap: the guard is enforced in the workspace command layer, but the `Tạo diagram` button
  on the screen does not reflect that save requirement while the Use Case is dirty.
- Resulting UX: users can still click `Tạo diagram`, then only discover the save requirement from
  the thrown error message.

## Findings

### 1. Diagram generation is hard-gated on a saved Use Case, but the editor CTA does not expose that gate up front

- Severity: P2
- Claim: The persisted workspace correctly blocks Diagram generation when the current Use Case is
  unsaved, but the editor still renders an enabled `Tạo diagram` button in that state.
- Evidence:
  - The actual command guard lives in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:695),
    where `generateDiagram()` throws `Hãy lưu Use Case mới nhất trước khi sinh Diagram.` whenever
    `useCaseSaveState` is `dirty`, `saving`, or `failed`.
  - The persisted route calls that command directly from
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:228)
    and shows the resulting error through `setUseCaseError(...)`.
  - The visible button state in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:545)
    only checks `diagramActionPending`, approval status, and contract validity. It does not disable
    on `workspace.useCaseSaveState === 'dirty'`.
  - I found no focused regression asserting that the persisted `Tạo diagram` CTA is disabled or
    replaced with save-first guidance when the Use Case has unsaved edits.
- Impact: The business rule is technically enforced, but the UI advertises a next step that is not
  actually executable yet. That creates avoidable error handling and makes the editor feel
  inconsistent.
- Recommendation: Keep the workspace guard as the source of truth, and harden the screen so the
  button is disabled or replaced by `Lưu Use Case trước` whenever the current Use Case state is not
  saved. Add a focused regression for the dirty-state editor flow.
- Confidence: Confirmed.

## Module Directions

### workspace-shell
- Current state: the command contract is correct and defensive.
- Recommended direction: Keep as-is.

### persisted-usecase-route
- Current state: the route enforces approval/contract rules in the button state, but not the
  save-first rule that the workspace already requires.
- Recommended direction: Harden.

### persisted-usecase-tests
- Current state: generation happy-path, pending-state, and approval-state coverage exist; dirty
  save-gate coverage is missing.
- Recommended direction: Refactor in place.

## Task Creation Decision

Created one follow-up backlog item in `docs/review-task-list.md`:

- `TASK-215` for aligning the persisted `Use Case` diagram CTA with the save-first workspace gate
