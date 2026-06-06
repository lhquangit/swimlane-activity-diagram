# Review Snapshot — TASK-095 to TASK-097

- Date: 2026-06-05
- Scope: approval invalidation, active-use-case canvas context, and VN-first workspace copy
- Reviewer: Codex (`senior-ai-reviewer`)

## Module Map

1. `editor-shell-state`
   - Files: [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx)
   - Responsibility: own use-case review state, diagram-inventory focus, active canvas binding, and shell-level context.

2. `usecase-workspace-ui`
   - Files: [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx), [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css)
   - Responsibility: render editable use cases, lifecycle actions, diagram inventory, persistent context presentation, and user-facing copy.

3. `usecase-lifecycle-contract`
   - Files: [src/usecases/types.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/types.ts), [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx)
   - Responsibility: derive `review_status`, `diagram_status`, and whether diagram handoff is allowed.

4. `verification-and-docs`
   - Files: [src/usecases/UseCasePanel.test.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.test.tsx), [e2e/brd-flow.spec.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/e2e/brd-flow.spec.ts), [docs/use-cases/UC-07-sinh-usecase-tu-spec.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-07-sinh-usecase-tu-spec.md)
   - Responsibility: lock review semantics, canvas handoff behavior, and documented UX promises.

## Findings

### 1. [P1] Inventory focus can disagree with the use case actually bound to the canvas

- Claim: The implementation keeps `selectedUseCaseIdForDiagram` and `activeCanvasUseCaseId` as separate states, but the inventory renders the former as `selected` and describes it as selected “trên canvas”.
- Evidence:
  - [src/App.tsx:832](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:832) and [src/App.tsx:835](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:835) define separate selected and active IDs.
  - [src/App.tsx:854](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:854) derives inventory status from `selectedUseCaseIdForDiagram`, while the shell context at [src/App.tsx:855](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:855) derives from `activeCanvasUseCaseId`.
  - [src/App.tsx:1586](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1586) changes only the selected ID when opening another use case in the diagram inventory.
  - [src/App.tsx:203](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:203) then labels that use case `selected`, with copy saying it is selected on the canvas.
- Impact: After opening canvas for use case A, the user can open the diagram inventory from use case B. The persistent shell still correctly says canvas A, while the inventory says B is selected on canvas. This is a dangerous ambiguity before real `DiagramDraft` loading lands.
- Recommendation: Model inventory focus and active canvas binding as distinct concepts. Only the active ID should produce an “active on canvas” status; inventory focus should use a separate neutral highlight or no lifecycle status.
- Confidence: Confirmed from the state transition and render derivation.

### 2. [P1] Diagram status and canvas permission have two independent sources of truth

- Claim: The inventory label is driven by `diagram_status`, but the `Mở canvas` permission is driven only by `review_status`.
- Evidence:
  - [src/usecases/types.ts:57](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/types.ts:57) allows `review_status` and `diagram_status` to vary independently.
  - [src/usecases/UseCasePanel.tsx:620](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:620) renders the status label from `diagram_status`.
  - [src/usecases/UseCasePanel.tsx:624](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:624) exposes `Mở canvas` whenever `review_status === 'approved'`, regardless of the diagram state.
- Impact: A future `outdated`, `diverged`, or otherwise blocked diagram item can display a blocked status and still expose `Mở canvas`. The current builder avoids this combination, but the interface does not enforce the invariant and `TASK-076` will expand exactly this state space.
- Recommendation: Make diagram lifecycle the source of truth for handoff permission and encode valid review/diagram combinations in one helper or discriminated contract.
- Confidence: Confirmed interface inconsistency; currently latent because `buildDiagramInventory()` emits compatible combinations.

### 3. [P2] TASK-097 is improved substantially but does not fully meet its VN-first acceptance criteria

- Claim: Headings, primary actions, and status pills are now Vietnamese-first, but the main input flow still mixes English terminology beyond technical trace surfaces.
- Evidence:
  - Main form labels still include `intent`, `feature`, `function`, `actor`, `trigger`, `input`, and `output` at [src/usecases/UseCasePanel.tsx:97](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:97), [src/usecases/UseCasePanel.tsx:208](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:208), and [src/usecases/UseCasePanel.tsx:213](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:213).
  - The primary list still exposes `Request`, `activity diagram`, and `canvas` at [src/usecases/UseCasePanel.tsx:410](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:410), [src/usecases/UseCasePanel.tsx:572](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:572), and [src/usecases/UseCasePanel.tsx:599](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:599).
  - The roadmap contract says Vietnamese is primary and English can follow later in [docs/roadmap/README.md:37](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/roadmap/README.md:37).
- Impact: The main workflow still reads as mixed-language rather than intentionally Vietnamese-first. This is smaller than the original problem, but the task should be considered mostly complete rather than fully normalized.
- Recommendation: Define a small accepted-term glossary, translate the remaining primary labels, and reserve raw artifact/type vocabulary for `Trace kỹ thuật`.
- Confidence: Confirmed; whether `use case` and `canvas` remain accepted loanwords is a product glossary decision.

### 4. [P2] The component regression reimplements production lifecycle logic instead of testing it

- Claim: The component harness contains its own copy of approval invalidation, so that test can stay green even if `App.handleUseCaseChange()` regresses.
- Evidence:
  - [src/usecases/UseCasePanel.test.tsx:82](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.test.tsx:82) duplicates the JSON comparison helper.
  - [src/usecases/UseCasePanel.test.tsx:125](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.test.tsx:125) reimplements `approved -> reviewed` in the harness.
  - The production behavior lives separately at [src/App.tsx:1543](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1543).
  - The E2E test at [e2e/brd-flow.spec.ts:159](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/e2e/brd-flow.spec.ts:159) does cover the real title-edit path, but no test covers the A-active/B-focused contradiction from Finding 1.
- Impact: Test coverage is green, but the most important lifecycle derivation is not unit-testable in isolation and the new multi-state handoff gap is unprotected.
- Recommendation: Extract pure lifecycle derivation helpers and add tests for every editable field plus the active-vs-focused transition.
- Confidence: Confirmed.

## Module Directions

### `editor-shell-state`

- Current state: The shell now preserves active use-case context and invalidates approval correctly on direct edits.
- Main risks:
  - Inventory focus and active canvas binding can drift semantically.
  - `App.tsx` remains the owner of too many use-case lifecycle rules.
- Recommended direction: `Refactor in place`
- Why now: Real `UseCaseDraft -> DiagramDraft` generation will make a wrong active binding materially destructive, not just confusing.
- Near-term actions:
  1. Separate focused inventory state from active canvas state.
  2. Move lifecycle derivation to pure helpers.

### `usecase-workspace-ui`

- Current state: The core workflow and main actions are clearer, and the active context strip is useful.
- Main risks:
  - The panel can render contradictory status/action combinations.
  - Visible copy still lacks a settled VN-first glossary.
- Recommended direction: `Harden`
- Why now: The current layout is worth keeping; the remaining work is semantic consistency, not another redesign.

### `usecase-lifecycle-contract`

- Current state: The Phase 1 types are sufficient for a mock inventory but do not enforce valid lifecycle combinations.
- Main risks:
  - Two status fields can disagree.
  - Permission logic is not derived from the displayed diagram state.
- Recommended direction: `Redesign interface`
- Why now: `TASK-075` and `TASK-076` will add generated, outdated, and diverged states; the current loose contract will become brittle immediately.

### `verification-and-docs`

- Current state: Focused component tests, full E2E, and build all pass.
- Main risks:
  - Component tests duplicate lifecycle logic.
  - E2E does not cover switching inventory focus while another use case remains active on canvas.
- Recommended direction: `Harden`
- Why now: Adding one transition test now is cheaper than debugging the wrong diagram being loaded later.

## Overall Assessment

- `TASK-095`: functionally sound for the current frontend-only workflow.
- `TASK-096`: visible context is good, but active-vs-focused state semantics need one follow-up before real diagram generation.
- `TASK-097`: materially improved, but only partially complete against the strict VN-first acceptance wording.
- Recommended execution order: `TASK-098` -> `TASK-099` -> `TASK-101` -> `TASK-100` -> `TASK-075`.

## Verification

- `npm run test:ui-mock -- --run src/usecases/UseCasePanel.test.tsx` — 4 tests passed.
- `npm run test:e2e-mock -- e2e/brd-flow.spec.ts` — 7 tests passed.
- `npm run build` — passed; existing Vite chunk-size warning remains.
