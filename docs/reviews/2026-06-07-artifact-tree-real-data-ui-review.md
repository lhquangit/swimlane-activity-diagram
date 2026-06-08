# Artifact Tree And Real Data UI Review

- Date: 2026-06-07
- Scope: Authenticated project workspace navigation, persisted artifact loading, and runtime sample data
- Reviewer: Codex using `senior-ai-reviewer`

## Executive Summary

The requested left tree matches the persisted domain model, but the current frontend is organized
around three local tabs and one active feature. Implementing only a visual sidebar would leave the
URL, dirty-state guards, data loading, and editor context inconsistent.

The correct direction is:

1. Add a lightweight project artifact-tree read model containing real persisted identities and
   existence/status metadata, without graph or BRD bodies.
2. Make the selected artifact a URL-backed discriminated state.
3. Replace tabs and the feature-only list with one left tree.
4. Load heavy Diagram/BRD payloads only when their real tree node is selected.
5. Remove all runtime sample initialization, sample reset actions, and the user-visible `/demo`
   path. Keep any sample fixture only inside test-only modules.

## Module Map

| Module | Current responsibility | Review direction |
| --- | --- | --- |
| `src/application/ProjectWorkspace.tsx` | Project load, local tabs, active feature, persistence context | Become the artifact-tree shell and selection orchestrator |
| `src/application/AppRouter.tsx` | Project and feature routes, development demo route | Add canonical artifact deep-links and remove user-visible demo |
| `src/App.tsx` | Diagram/use-case/BRD editor monolith | Accept explicit persisted selection and empty state; never seed sample data |
| `src/lf-config.ts` | Lane helpers plus hardcoded fire sample | Keep reusable lane helpers; move sample graph to test-only fixtures |
| `src/persistence/api.ts` | Per-resource CRUD calls | Add project artifact-tree metadata call |
| `apps/api/app/routes/persistence.py` | Owned persistence endpoints | Add owned project tree endpoint |
| `apps/api/app/services/persistence_service.py` | Per-resource persistence operations | Build the tree read model with bounded eager loading |
| `e2e/brd-flow.spec.ts` | Standalone editor regression suite via `/demo` | Decouple tests from runtime sample/demo behavior |

## Findings

### [P1] The workspace navigation model cannot represent the requested tree

- `ProjectWorkspace` stores `tab: 'spec' | 'features' | 'editor'` and renders three top-level tab
  buttons at `src/application/ProjectWorkspace.tsx:37`, `src/application/ProjectWorkspace.tsx:64`,
  and `src/application/ProjectWorkspace.tsx:481`.
- Feature selection is a second navigation system nested inside the Features tab at
  `src/application/ProjectWorkspace.tsx:551`.
- The URL only identifies a project and optional feature at
  `src/application/AppRouter.tsx:67` and `src/application/AppRouter.tsx:75`.

This structure cannot deep-link to a Project Spec, Use Case, Diagram, or BRD node. A tree added on
top of it would create two competing sources of navigation truth.

### [P1] There is no efficient persisted read contract for a complete project tree

- The initial workspace load fetches project, spec, and features, then fetches use cases only for
  the active feature at `src/application/ProjectWorkspace.tsx:81` and
  `src/application/ProjectWorkspace.tsx:153`.
- Diagram and BRD are fetched one resource at a time through
  `src/persistence/api.ts:152` and `src/persistence/api.ts:163`.
- Backend routes expose the same per-level CRUD shape at
  `apps/api/app/routes/persistence.py:141`, `apps/api/app/routes/persistence.py:205`,
  `apps/api/app/routes/persistence.py:252`, and `apps/api/app/routes/persistence.py:307`.

Building a full tree by recursively calling these endpoints would produce N+1 requests and
interleaved loading/error states. The tree needs one metadata endpoint that omits `graph_data`,
`structured_spec`, and `markdown_content`.

### [P1] Every editor mount starts by rendering a hardcoded diagram

- `App` initializes LogicFlow with `lf.render(buildInitialData())` at `src/App.tsx:1338`.
- `buildInitialData()` contains the full fire-incident graph at `src/lf-config.ts:18`.
- The toolbar can restore it through `Reset mẫu` at `src/App.tsx:2352` and
  `src/App.tsx:2686`.

This means sample content exists before persisted Diagram loading resolves and can appear when no
real Diagram exists. It conflicts directly with the requirement that the UI display only real data.

### [P1] Standalone runtime defaults can be mistaken for project data

- `App` initializes a sample Project Spec and Feature Intent through
  `buildDefaultProjectSpec()` and `buildDefaultFeatureIntent()` at `src/App.tsx:189`,
  `src/App.tsx:200`, and `src/App.tsx:835`.
- A development `/demo` route mounts this standalone state at
  `src/application/AppRouter.tsx:57`.

These defaults should not remain in a user-reachable runtime path. Test fixtures are acceptable only
when isolated from normal application routes and production bundles.

### [P2] Current tests are coupled to the sample runtime instead of persisted empty/real states

- `e2e/brd-flow.spec.ts` repeatedly navigates to `/demo`, asserts sample labels, and clicks
  `Reset mẫu`.

Removing sample data without first separating a test harness would delete broad editor coverage.
The test migration must preserve behavior coverage while proving that normal project routes never
render fixture content.

## Recommended Execution Order

1. `TASK-170` and `TASK-171`: define the backend tree contract and canonical artifact routes.
2. `TASK-172` and `TASK-173`: build the tree shell and connect Project/Spec/Feature editors.
3. `TASK-174`: connect Use Case, Diagram, and BRD nodes to persisted editors.
4. `TASK-175` and `TASK-176`: remove sample runtime paths and add truthful empty/loading states.
5. `TASK-177`: route every tree transition through scoped dirty guards and refresh rules.
6. `TASK-178`: complete component/E2E regression coverage and retire stale sample documentation.

