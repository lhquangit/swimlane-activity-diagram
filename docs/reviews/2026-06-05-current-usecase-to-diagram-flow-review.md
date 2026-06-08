# Review Snapshot — Current Use Case to Diagram Flow

## Scope

- Date: 2026-06-05
- Reviewed path: `ProjectSpec + FeatureIntent -> UseCaseDraft[] -> review/approve -> diagram inventory -> canvas`
- Modules reviewed:
  - Use case generation API and deterministic builder
  - Use case editor/review workspace
  - Diagram lifecycle and inventory
  - LogicFlow canvas initialization and handoff
- Not reviewed: formal BRD generation quality and persistence/versioning

## Module Map

| Module | Responsibility | Direction |
| --- | --- | --- |
| `apps/api/app/services/usecase_builder.py` | Generate use case drafts from project/feature input | Harden |
| `src/usecases/UseCasePanel.tsx` | Edit, review, approve, and select use cases | Keep, clarify actions |
| `src/usecases/lifecycle.ts` | Derive diagram status and action permission | Refactor contract |
| `src/App.tsx` | Orchestrate workspace state and LogicFlow canvas | Split generation handoff |
| `src/lf-config.ts` | Build the initial sample graph | Keep as demo-only fixture |

## Findings

### 1. [P1, confirmed] `Mở canvas` does not create or load a diagram

- Evidence:
  - `handleOpenUseCaseDiagramCanvas()` only updates focus, sets `activeCanvasUseCaseId`, closes the panel, and changes status text in `src/App.tsx`.
  - It does not call a diagram generation API, build graph data, or invoke `lf.render(...)`.
  - LogicFlow is initialized independently with `buildInitialData()`, which contains the fire-incident sample.
- Impact:
  - The user reasonably interprets `Mở canvas` as opening the selected use case's diagram, but sees the unrelated startup sample.
  - The visible canvas context can imply that the sample graph belongs to the selected use case even though no trace relationship exists.
- Recommendation:
  - Until real generation exists, do not expose `Mở canvas` for `ready_to_generate`.
  - Use an explicit `Tạo sơ đồ` action for `not_started`; only expose `Mở canvas` after a `DiagramDraft` exists.
  - If manual authoring remains available, label it `Dựng thủ công trên canvas` and initialize a blank actor-lane graph rather than preserving the sample.
- Confidence: Confirmed.

### 2. [P1, confirmed] Current `UseCaseDraft` is editable but not diagram-ready

- Evidence:
  - The schema contains `happy_path_summary: string[]` and `key_exceptions: string[]`, but no per-step ID, actor assignment, branch condition, branch target/rejoin, or trace metadata.
  - The deterministic builder emits generic narrative steps such as “actor performs the main business actions”, rather than an executable flow contract.
- Impact:
  - A generator cannot reliably decide which lane owns each step or how exceptions branch and rejoin.
  - Implementing TASK-075 directly on this schema would produce generic diagrams or embed fragile text heuristics that will later conflict with TASK-076 round-trip traceability.
- Recommendation:
  - Introduce a diagram-ready detailed use case contract before graph generation.
  - Preserve the current summary fields for reader-facing editing, but generate structured steps and alternate flows with stable IDs and actor references.
- Confidence: Confirmed.

### 3. [P2, confirmed] Documentation accurately calls generation out of scope, but primary UI does not disclose that boundary

- Evidence:
  - UC-07 explicitly lists automatic diagram generation as out of scope for Phase 1.
  - The diagram inventory nevertheless labels approved items `Sẵn sàng đi sơ đồ` and enables `Mở canvas`.
- Impact:
  - Internal roadmap state is correct, but the product communicates a completed workflow.
- Recommendation:
  - Make lifecycle and CTA names artifact-aware: `Chưa tạo`, `Đang tạo`, `Sẵn sàng mở`, `Lỗi thời`, and `Phân kỳ`.
- Confidence: Confirmed.

## Current Working Flow

1. Enter `ProjectSpec` and `FeatureIntent`.
2. Click `Sinh use case`.
3. Edit the generated fields manually in the `Use case` tab.
4. Review and approve each use case.
5. `Mở ở vùng sơ đồ` only focuses the inventory item.
6. `Mở canvas` only binds the selected use case ID to the existing editor canvas.
7. To create a diagram today, the user must clear the sample and manually drag lanes/nodes/edges.

There is currently no end-to-end UI flow that automatically converts an approved use case into a diagram.

## Recommended Execution Order

1. TASK-103 — make the current CTA truthful immediately.
2. TASK-102 — define the detailed, diagram-ready use case contract.
3. TASK-075 — generate and render a real `DiagramDraft`.
4. TASK-076 — preserve traceability after manual diagram edits.

