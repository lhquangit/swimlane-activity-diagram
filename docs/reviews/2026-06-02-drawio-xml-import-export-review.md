# Review — Draw.io XML Import/Export Planning

Date: 2026-06-02  
Reviewer: Codex using `senior-ai-reviewer`

## Module map

1. `editor-toolbar-runtime`
   - `src/App.tsx`
   - Purpose: top-level editor actions, import/export entrypoints, and user-facing toolbar composition.

2. `logicflow-canvas-model`
   - `src/nodes.ts`
   - `src/lf-config.ts`
   - Purpose: lane/node geometry, initial graph, and LogicFlow-specific graph shape.

3. `file-interchange`
   - Current: JSON import/export inline in `src/App.tsx`
   - Missing: XML adapter layer for draw.io / diagrams.net `mxGraphModel`.

4. `docs-and-tests`
   - `README.md`
   - `docs/use-cases/*`
   - `docs/review-task-list.md`
   - `e2e/*`
   - Purpose: workflow contract, user guidance, and regression coverage.

## Findings

### [P1] Current import/export flow is tightly coupled to repo-native JSON, not an interchange format

Evidence:
- Toolbar actions are hard-coded to `Mở JSON…`, `Lưu JSON`, and `Export SVG` in [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1798).
- README also documents JSON/SVG as current user-facing file operations in [README.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/README.md:18).

Impact:
- Replacing these actions with draw.io XML is not a label swap. It changes the canonical user-facing interchange contract.
- If implemented inline inside `App.tsx`, the toolbar module will absorb XML parsing, shape mapping, HTML entity decoding, and serialization logic that belong in a dedicated adapter.

Direction:
- `editor-toolbar-runtime`: **Refactor in place**
- Keep toolbar changes thin and move XML conversion into isolated modules.

### [P1] The target XML format is structurally different from the app's current graph model

Evidence:
- The example file is a draw.io `mxfile > diagram > mxGraphModel > root > mxCell[]` tree in [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:1).
- It uses nested swimlanes (`mxCell id="2"` as outer container, lane cells like `id="3"` and `id="8"` as children) in [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:8), [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:28).
- Nodes and edges are encoded through draw.io-specific style strings and parent/geometry semantics, e.g. `shape=startState`, `shape=mxgraph.bpmn.task2`, `rhombus`, `shape=line`, and `edge="1"` in [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:14), [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:22), [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:34), [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:93).

Impact:
- The app needs a real mapping layer for:
  - outer swimlane container
  - inner lane columns
  - start/end/activity/decision/sync-bar/note
  - edge labels and orthogonal routing
  - HTML-rich `value` content
- Without a normalized adapter contract, import/export will drift and round-trip behavior will be brittle.

Direction:
- `file-interchange`: **Redesign interface**
- Introduce explicit `drawio import/export` modules instead of treating XML as a raw alternate file extension.

### [P2] HTML-rich text and style strings are a hidden risk for semantic fidelity

Evidence:
- The example uses HTML-escaped values inside `mxCell.value`, including nested `div`, `font`, `span`, and non-breaking spaces in [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:11), [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:22), [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:45).

Impact:
- Import must decode draw.io HTML into the editor’s plain text conventions without losing step content.
- Export must choose a stable subset of draw.io text/styling so the produced XML is predictable and re-importable.
- This is especially important because the BRD pipeline already depends heavily on text fidelity.

Direction:
- `file-interchange`: **Harden**
- Treat text normalization as a first-class part of the XML adapter contract.

### [P2] XML import/export will affect user workflow docs and tests, not just code

Evidence:
- Current README and use-case docs still frame JSON/SVG as visible actions, and no XML workflow is documented yet in [README.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/README.md:18).
- Existing Playwright flow focuses on BRD behavior and does not cover any file-interchange path.

Impact:
- If we add XML without updating docs and regression coverage, the repo will quickly split into “what users see” vs “what the docs say”.

Direction:
- `docs-and-tests`: **Harden**
- Ship the feature with workflow docs and at least one golden XML round-trip test.

## Recommended execution order

1. Define the XML adapter contract and supported subset.
2. Implement import parser + normalization from `mxGraphModel` to repo graph JSON.
3. Implement export serializer from repo graph JSON to draw.io XML.
4. Swap toolbar affordances to XML-first and temporarily hide JSON/SVG.
5. Add round-trip and fixture-based tests.
