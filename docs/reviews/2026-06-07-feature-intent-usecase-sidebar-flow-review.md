# Feature Intent to Use Case Sidebar Flow Review

## Review Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-06-07
- Entrypoints reviewed: `src/application/ProjectWorkspace.tsx`, `src/application/ArtifactTree.tsx`, `src/App.tsx`, `src/usecases/UseCasePanel.tsx`, `src/persistence/api.ts`, `src/persistence/types.ts`
- Modules reviewed: persisted artifact navigation, use-case generation UX, use-case editor UX, diagram generation handoff, regression/docs coverage
- Modules not reviewed: backend persistence internals beyond frontend API contracts, live AI provider quality, Clerk/Railway hosted runtime

## Module Map

1. `frontend-workspace-shell`: `ProjectWorkspace`, `ArtifactTree`, `artifact-routing`, and workspace persistence context. Owns tree navigation, route identity, dirty guards, and mounting the correct artifact surface.
2. `usecase-generation-ux`: `App` use-case lifecycle handlers plus `UseCasePanel` input/list sections. Owns Feature Intent -> use-case generation, review, approval, and save state.
3. `usecase-editor-surface`: `UseCasePanel` cards and structured flow editors. Owns editing individual `UseCaseDraft` fields.
4. `diagram-handoff`: `App` diagram inventory/generation/open-canvas handlers and persistence calls. Owns per-use-case diagram generation and canvas binding.
5. `persistence-contract`: `src/persistence/api.ts` and `src/persistence/types.ts`. Owns feature/use-case/diagram resource shape used by the tree and editors.
6. `regression-docs`: `docs/use-cases/UC-07...`, `e2e/brd-flow.spec.ts`, `e2e/artifact-tree.spec.ts`, and component tests. Owns behavioral proof and product traceability.

## Findings

### F1 - Generated use cases are not yet a left-tree-first result

- Claim: The current flow can load persisted use cases into the tree, but generation still produces local drafts inside the editor monolith and requires a separate save before the sidebar can represent them as resources.
- Evidence: `App` copies `workspace.useCaseResources` into local `useCaseDrafts` on feature change, then `handleGenerateUseCases` sets local drafts and marks the use-case scope dirty instead of updating the tree directly (`src/App.tsx:878`, `src/App.tsx:1820`, `src/App.tsx:1866`). The tree renders only `tree.features[].use_cases` from the artifact-tree read model (`src/application/ArtifactTree.tsx:133`, `src/application/ArtifactTree.tsx:147`).
- Impact: After filling Feature Intent, the user does not get the requested mental model: "AI creates a list of use cases in the left bar." The list can remain hidden inside `UseCasePanel`, and the tree is stale until an explicit save/refresh path completes.
- Recommendation: In persisted mode, make the generate action create or replace persisted `UseCase` resources through a clear confirmed operation, refresh the artifact tree, and select the generated Use Cases node or first use case.
- Confidence: Confirmed from current frontend state flow.

### F2 - The selected Use Case route still opens the old workspace overlay

- Claim: Use Case routes exist, but they route back into `UseCasePanel` rather than rendering a dedicated per-use-case editor as the primary content surface.
- Evidence: `ProjectWorkspace` mounts the full `App` component for `use-cases`, `use-case`, `diagram`, and `brd` selections (`src/application/ProjectWorkspace.tsx:637`, `src/application/ProjectWorkspace.tsx:753`). `App` reacts to a selected `use-case` route by opening `UseCasePanel` in the `usecases` section (`src/App.tsx:2077`, `src/App.tsx:2100`). `UseCasePanel` renders the entire list of cards even when a single use case is focused (`src/usecases/UseCasePanel.tsx:485`, `src/usecases/UseCasePanel.tsx:535`).
- Impact: The product still feels like a single diagram canvas with a use-case side workspace, not a database-backed artifact workspace where each use case is a navigable editable artifact.
- Recommendation: Extract a route-backed `UseCaseEditor`/`UseCaseListView` from the panel and mount it directly in `ProjectWorkspace` for `use-cases` and `use-case` routes.
- Confidence: Confirmed from current route/effect wiring.

### F3 - Diagram creation is conceptually correct but hidden behind the old panel inventory

- Claim: The code already supports `POST /api/use-cases/{id}/diagram/generate`, but the user-facing CTA still lives in the use-case overlay/diagram inventory rather than on each persisted use-case artifact surface and tree missing-diagram state.
- Evidence: The persistence API has `generateDiagram(useCaseId)` (`src/persistence/api.ts:155`). `ProjectWorkspace` maps business keys to persisted resource UUIDs before calling that API (`src/application/ProjectWorkspace.tsx:487`). The visible generate buttons are owned by `UseCasePanel`'s diagrams section (`src/usecases/UseCasePanel.tsx:1170`) and wired through `App` (`src/App.tsx:3012`).
- Impact: Users have to understand the old panel sections before they can generate a diagram, and selecting a missing Diagram node can feel like an editor/canvas concern instead of a clear action for one use case.
- Recommendation: Put `Tạo diagram` as a first-class action on each saved/approved use-case editor and on the missing Diagram tree/content state, then route directly to the new Diagram node after generation.
- Confidence: Confirmed from current UI structure.

## Module Directions

### frontend-workspace-shell

- Current state: Routes and tree exist, but use-case routes delegate too much behavior back into the canvas app.
- Main risks:
  - Artifact identity exists in URL but the visual workflow is still panel-first.
  - Tree refresh is not guaranteed immediately after generation.
- Recommended direction: Refactor in place.
- Why now: The database-backed navigation is already present; the next step is to make it the primary UX rather than a wrapper around the old editor.

### usecase-generation-ux

- Current state: Generation and validation are functional, but persisted mode still behaves like a staged local draft workspace.
- Main risks:
  - Generated use cases are invisible in the left tree until saved.
  - Replace/regenerate semantics can diverge between local drafts and persisted resources.
- Recommended direction: Redesign interface.
- Why now: The requested flow depends on the sidebar being the visible output of generation.

### usecase-editor-surface

- Current state: The structured editor is useful, but it edits many use cases inside one overlay.
- Main risks:
  - A user editing one use case lacks a clean resource page and stable save boundary.
  - Focused use-case routing still renders a list, increasing accidental edits.
- Recommended direction: Split responsibilities.
- Why now: Reusing the field editors is fine, but the shell should be route-backed per artifact.

### diagram-handoff

- Current state: Per-use-case generation exists and persists diagrams, but the CTA placement follows the old panel inventory.
- Main risks:
  - Users can miss the intended "edit use case, then generate diagram" path.
  - Missing diagram state is shown as tree metadata rather than a full content action.
- Recommended direction: Refactor in place.
- Why now: The backend contract is already available, so this is mostly UX orchestration.

## Recommended Execution Order

1. Persist generated use cases and refresh the left tree.
2. Split use-case list/editor routes out of the canvas `App`.
3. Move diagram generation CTA to the selected use-case and missing-diagram content surfaces.
4. Remove the old panel as primary navigation while keeping reusable editor components.
5. Add route/tree/generation regression coverage and update UC-07.

## Backlog

Actionable tasks were added as `TASK-179` through `TASK-183` in `docs/review-task-list.md`.
