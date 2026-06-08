# Review Snapshot — TASK-089 to TASK-094

- Date: 2026-06-05
- Scope: `Use Case Workspace` UX redesign (`Input / Use cases / Diagrams`)
- Reviewer: Codex (`senior-ai-reviewer`)

## Module Map

1. `editor-shell`
   - Files: [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx)
   - Responsibility: compose canvas shell, workspace state, BRD flow, and use-case workspace entrypoints.

2. `usecase-workspace-panel`
   - Files: [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx), [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css)
   - Responsibility: render the `Input / Use cases / Diagrams` experience, microcopy, and action flow.

3. `usecase-contract`
   - Files: [src/usecases/types.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/types.ts)
   - Responsibility: define frontend artifacts and lightweight diagram inventory contract.

4. `verification-and-docs`
   - Files: [src/usecases/UseCasePanel.test.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.test.tsx), [e2e/brd-flow.spec.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/e2e/brd-flow.spec.ts), [docs/use-cases/UC-07-sinh-usecase-tu-spec.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-07-sinh-usecase-tu-spec.md), [docs/roadmap/README.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/roadmap/README.md)
   - Responsibility: lock behavior, describe workflow, and align the roadmap.

## Findings

### 1. Approved use cases stay approved even after direct content edits

- Claim: Once a use case reaches `approved`, the user can still edit its title, objective, actors, preconditions, and outcomes without the review state being invalidated.
- Evidence:
  - [src/App.tsx:1498](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1498) `handleUseCaseChange()` replaces the draft verbatim and does not touch `review_status`.
  - [src/usecases/UseCasePanel.tsx:446](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:446) approved items immediately expose `Open in Diagrams`.
  - The editable fields remain available for approved items throughout [src/usecases/UseCasePanel.tsx:469](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:469) to [src/usecases/UseCasePanel.tsx:565](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:565).
- Impact: The UI can present an item as “ready for diagram” even though its content has changed after approval and may no longer reflect the reviewed version. That weakens the trust boundary between review and diagram generation.
- Recommendation: Treat edits to an approved item as review-invalidating. At minimum, demote `approved -> reviewed` or `draft`, or surface a separate `needs re-review` badge and block `Open in Diagrams` until the user explicitly reconfirms.
- Confidence: Confirmed.

### 2. The `Open canvas` handoff loses persistent context once the workspace closes

- Claim: The new `Diagrams` section gives the user a clear inventory, but the moment they choose `Open canvas`, the workspace closes and the selected use case is only preserved in hidden state plus a transient status string.
- Evidence:
  - [src/App.tsx:1540](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1540) `handleOpenUseCaseDiagramCanvas()` sets `selectedUseCaseIdForDiagram`, closes the workspace, and only writes a status message.
  - The main shell has no persistent badge, header, side rail, or inspector for the current use case after the panel closes; the toolbar region around [src/App.tsx:2108](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:2108) still does not expose that binding.
  - UC-07 promises a visible “inventory diagram gắn với từng `use_case_id`” and a clear next step in [docs/use-cases/UC-07-sinh-usecase-tu-spec.md:47](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-07-sinh-usecase-tu-spec.md:47), but the canvas itself does not show which use case the user is now working on.
- Impact: The handoff from approved use case to diagram workspace is easy to lose mentally. A user can end up editing the shared canvas without a stable reminder of which use case it represents.
- Recommendation: Add a persistent editor-level context chip or inspector section that shows the active `use_case_id`, title, and current diagram state whenever the canvas is bound to a use case.
- Confidence: Confirmed.

### 3. Primary UX copy is still mixed-language despite the repo’s VN-first contract

- Claim: The redesign improved structure, but the workspace now mixes Vietnamese and English heavily in the main user-facing flow.
- Evidence:
  - English labels dominate the new surface: `Use Case Workspace`, `Input`, `Use cases`, `Diagrams`, `Generate use cases`, `Open in Diagrams`, `Open canvas`, `Advanced traceability`, `Needs approval`, `Ready for diagram` in [src/usecases/UseCasePanel.tsx:71](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:71), [src/usecases/UseCasePanel.tsx:357](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:357), [src/usecases/UseCasePanel.tsx:451](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:451), [src/usecases/UseCasePanel.tsx:627](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:627).
  - The repo roadmap still states “VN-first UI” in [docs/roadmap/README.md:37](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/roadmap/README.md:37).
- Impact: This increases cognitive friction for the exact BA / Solution Engineer audience the flow is supposed to serve. It also makes the workspace feel less coherent than the rest of the Vietnamese-first editor.
- Recommendation: Normalize the workspace to one primary language, ideally Vietnamese-first for the visible UI, while keeping internal artifact names and type labels for docs/dev surfaces only.
- Confidence: Confirmed.

## Module Directions

### `editor-shell`

- Current state: The shell now exposes the workspace entrypoint and carries enough state for the new UX contract.
- Main risks:
  - The selected use case for the canvas is not visible once the panel closes.
  - Review semantics are not fully enforced after approval.
- Recommended direction: `Harden`
- Why now: The shell is already the place where the cross-artifact handoff lives, so it is the cheapest place to add a persistent context indicator and approval safeguards before `TASK-075` introduces real diagram generation.
- Near-term actions:
  1. Surface persistent “active use case” context in the editor shell.
  2. Make approval state react predictably to post-approval edits.

### `usecase-workspace-panel`

- Current state: The panel structure is substantially better and now matches the user’s mental model.
- Main risks:
  - Mixed-language copy weakens clarity.
  - Approved items still look fully ready even after arbitrary edits.
- Recommended direction: `Refactor in place`
- Why now: The structure is good enough to keep. The next value comes from tightening semantics and copy rather than changing the layout again.
- Near-term actions:
  1. Localize primary UX copy consistently.
  2. Add visible `needs re-review` semantics after approved edits.

### `usecase-contract`

- Current state: The lightweight diagram inventory type is enough for a Phase 1 UI contract.
- Main risks:
  - It cannot yet express a real generated diagram lifecycle beyond `needs_review / ready_to_generate / selected`.
- Recommended direction: `Keep as-is`
- Why now: Until `TASK-075` lands, adding deeper status fields would mostly be speculative. The contract only needs hardening once real `DiagramDraft` artifacts exist.
- Near-term actions:
  1. Revisit the inventory schema when real diagram generation is introduced.

### `verification-and-docs`

- Current state: Tests and docs were updated well enough to lock the redesign path.
- Main risks:
  - No regression currently asserts that editing an approved use case invalidates its readiness.
  - No test currently checks for persistent selected-use-case context on the editor after `Open canvas`.
- Recommended direction: `Harden`
- Why now: The docs and tests are close, but the next implementation step will depend on these promises. Locking the review semantics now will prevent drift.
- Near-term actions:
  1. Add tests for post-approval edits and re-review semantics.
  2. Add UX coverage for persistent active-use-case context on canvas.

