# Review Snapshot — TASK-102, TASK-103, TASK-075, TASK-076

## Scope

- Date: 2026-06-06
- Reviewed path: `UseCaseDraft edit/approve -> DiagramDraft generate -> LogicFlow edit -> switch/regenerate/import`
- Modules reviewed:
  - Use-case and diagram API schemas/routes
  - Deterministic use-case and diagram builders
  - Use-case editor and diagram lifecycle
  - LogicFlow workspace capture/switching
  - Draw.io interchange and trace preservation
  - Unit, route, component, and Playwright coverage
- Not reviewed:
  - Formal BRD portfolio generation
  - Database persistence/versioning
  - Multi-user concurrency

## Executive Summary

The implementation closes the original product gap: the CTA is now truthful, approved use cases can generate real diagrams, diagrams are isolated per use case in the current session, and semantic edits are surfaced as divergence. The execution path is coherent and the existing test suites cover the happy path well.

The batch is not yet safe enough to treat as a durable round-trip contract. The main risks are contract integrity after frontend edits, silent diagram loss when regenerating use cases, incomplete workspace capture for several layout operations, incorrect modeling of terminal alternate outcomes, and trace metadata that does not survive Draw.io interchange or describe manually added elements.

## Module Map

| Module | Responsibility | Direction |
| --- | --- | --- |
| `apps/api/app/schemas/usecase.py` | Canonical detailed use-case and diagram contract | Harden |
| `apps/api/app/services/usecase_builder.py` | Deterministic structured use-case generation | Keep, add stronger invariants |
| `apps/api/app/services/diagram_builder.py` | Map approved use cases to actor lanes and graph topology | Refactor in place |
| `src/usecases/UseCasePanel.tsx` | Edit/review detailed use cases and expose diagram actions | Harden |
| `src/usecases/diagram.ts` + `lifecycle.ts` | Convert drafts, fingerprint artifacts, derive lifecycle | Harden |
| `src/App.tsx` | Own LogicFlow workspace capture, switching, and regeneration | Split responsibilities |
| `src/io/drawio-*` | Draw.io interchange | Redesign trace extension |
| Tests | Verify schema, lifecycle, graph generation, and handoff | Expand around destructive and invalid states |

## Findings

### 1. [P1, confirmed] Frontend edits can produce an invalid detailed use case that is still approvable

- Evidence:
  - Editing `primary_actor` or `supporting_actors` only changes the actor lists; existing `main_flow_steps[].actor_ref` and alternate-step actor references are not migrated in `src/usecases/UseCasePanel.tsx`.
  - Editing `happy_path_summary` rebuilds the main steps positionally, but existing alternate `source_step_id` and `rejoin_step_id` are not reconciled in `src/usecases/diagram.ts`.
  - Review actions do not run detailed-contract validation before approving or approving all.
  - The backend then rejects unresolved actor/step references during diagram generation.
- Impact:
  - A use case can display `Đã phê duyệt` and `Tạo sơ đồ`, then fail with a 422 only after the user invokes generation.
  - This breaks the promise that approval means “diagram-ready”.
- Recommendation:
  - Add a pure detailed-use-case validator shared by the editor and approval actions.
  - Reconcile actor/step references during edits where the mapping is unambiguous; otherwise block approval with field-level errors.
- Confidence: Confirmed.

### 2. [P1, confirmed] Backend accepts approved contracts that cannot produce a valid deterministic graph

- Evidence:
  - `main_flow_steps` may be empty.
  - Alternate-step IDs are not checked for uniqueness across flows or against main-step IDs.
  - Empty alternate flows can omit both `rejoin_step_id` and `terminal_outcome`.
  - A direct schema/builder probe accepted an empty main flow and generated only `start -> end`; it also accepted duplicate alternate-step IDs and emitted duplicate LogicFlow node IDs.
- Impact:
  - API callers can create graph data with duplicate IDs or diagrams with no business activity despite `review_status=approved`.
  - LogicFlow behavior becomes undefined when multiple nodes share one ID.
- Recommendation:
  - Enforce at least one main step, globally unique step/flow/node-derived IDs, non-empty business text, and exactly one valid alternate-flow outcome mode.
  - Validate slug-derived graph IDs for collisions before returning a draft.
- Confidence: Confirmed.

### 3. [P1, confirmed] Regenerating use cases silently destroys all in-session diagrams

- Evidence:
  - The confirmation copy only says the current use-case draft list will be replaced.
  - On success, `handleGenerateUseCases()` clears `diagramWorkspaces` and `diagramOperationStates` and unbinds the active use case.
  - The code does not check whether any workspace is `semanticEdited`, nor offer export/keep/cancel choices.
- Impact:
  - A user can lose hours of manual diagram changes while believing they only approved replacing use-case drafts.
  - The risk is highest precisely for TASK-076’s diverged diagrams.
- Recommendation:
  - Treat use-case regeneration as a destructive artifact-chain operation.
  - Summarize affected diagrams, require explicit confirmation, and preserve/export orphaned workspaces until the user deliberately discards them.
- Confidence: Confirmed.

### 4. [P1, confirmed] Several layout edits are not captured before switching use cases

- Evidence:
  - Custom lane resize and custom shape resize call `markDiagramChanged()` but not `captureActiveUseCaseDiagram()` on mouse-up.
  - Moving a `sync-bar` returns early from `node:drop` before marking or capturing the workspace.
  - Existing E2E coverage proves clear/switch preservation, but does not cover these paths.
- Impact:
  - The canvas appears updated, but switching to another use case and back restores the pre-edit dimensions or sync-bar position.
  - This violates the “layout edits are preserved without marking divergence” policy.
- Recommendation:
  - Route every LogicFlow mutation through one workspace commit helper carrying an explicit `layout` or `semantic` change kind.
  - Add switch-away/switch-back tests for lane resize, shape resize, node move, and sync-bar move.
- Confidence: Confirmed.

### 5. [P1, confirmed] Terminal alternate outcomes are rendered as successful completion

- Evidence:
  - When `rejoin_step_id` is absent, `diagram_builder.py` routes the alternate branch to the shared success end node.
  - `terminal_outcome` is never rendered as node text, edge text, or trace metadata.
  - The shared end node is traced as `success_outcome`.
- Impact:
  - Rejection, cancellation, or failure paths can visually terminate at the same success outcome, changing the business meaning of the use case.
- Recommendation:
  - Generate a dedicated terminal end/outcome node per terminal alternate flow, with trace to the flow and visible outcome text.
  - Reserve the shared success end for the main successful path.
- Confidence: Confirmed.

### 6. [P2, confirmed] Traceability is session-local and is lost through interchange or manual graph extension

- Evidence:
  - Generated nodes and edges receive `properties.trace`.
  - Draw.io export serializes geometry/type/text but not trace properties; Draw.io import reconstructs only lane and size properties.
  - Palette-created nodes and newly drawn edges do not receive provenance metadata.
  - `semanticEdited` records that a difference exists, but cannot identify which changed graph elements map to a use-case step or are explicitly manual.
- Impact:
  - Export/import of a generated diagram retains its picture but severs source traceability.
  - Future merge, audit, and portfolio BRD generation cannot distinguish generated, modified, and manually added elements.
- Recommendation:
  - Define a versioned provenance envelope for node/edge properties and preserve it in JSON/Draw.io interchange.
  - Assign explicit `manual` provenance to newly created elements and validate trace coverage.
- Confidence: Confirmed.

### 7. [P2, confirmed] Failed regeneration hides an existing recoverable workspace

- Evidence:
  - Regeneration leaves the previous `diagramWorkspaces[useCaseId]` entry intact on failure.
  - `diagramOperationStates[useCaseId] = failed` overrides lifecycle derivation.
  - The failed UI exposes only `Thử lại`, not `Mở bản hiện tại`.
- Impact:
  - Existing work is not deleted, but the normal UI makes it inaccessible until retry succeeds or state is otherwise changed.
- Recommendation:
  - Model operation state separately from artifact availability in the UI.
  - When regeneration fails and a prior workspace exists, expose both `Mở bản hiện tại` and `Thử lại`.
- Confidence: Confirmed.

## Module Directions

### Detailed use-case contract

- Current state: Good structure, insufficient edit-time and API invariants.
- Main risks: dangling references, empty flows, duplicate graph IDs.
- Recommended direction: Harden.
- Why now: Diagram generation now trusts this contract directly; invalid states should be rejected before approval, not after CTA handoff.

### Diagram generator

- Current state: Deterministic and readable for happy/rejoin flows.
- Main risks: terminal paths collapse into success; ID collision safety is absent.
- Recommended direction: Refactor in place.
- Why now: The topology is small enough to correct without replacing the generator.

### Editor workspace lifecycle

- Current state: Per-use-case snapshots work for common events.
- Main risks: mutation coverage is scattered; destructive regeneration can lose work.
- Recommended direction: Split responsibilities.
- Why now: `App.tsx` has become the implicit transaction manager for every graph mutation and artifact transition.

### Trace and interchange

- Current state: Generated graph elements have useful in-memory trace metadata.
- Main risks: trace disappears on interchange and does not cover manual elements.
- Recommended direction: Redesign interface.
- Why now: TASK-077 and persistence/versioning will otherwise build on provenance that cannot survive a normal user workflow.

### Tests

- Current state: Strong happy-path component/E2E coverage.
- Main risks: no negative contract matrix, terminal-flow golden, destructive-regenerate test, or layout switch-back tests.
- Recommended direction: Expand.
- Why now: The missing tests align exactly with the confirmed defects above.

## Recommended Execution Order

1. TASK-104 — block invalid detailed use cases before approval/generation.
2. TASK-105 — enforce canonical backend graph invariants.
3. TASK-106 — protect diagram workspaces during use-case regeneration and failed diagram regeneration.
4. TASK-107 — centralize and complete workspace mutation capture.
5. TASK-108 — render terminal alternate outcomes correctly.
6. TASK-109 — version and preserve graph provenance across manual edits and interchange.

