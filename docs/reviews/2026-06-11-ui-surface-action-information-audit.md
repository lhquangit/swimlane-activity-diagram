# Review: End-User UI Surface Audit For Redundant Actions And Technical Information

- Date: 2026-06-11
- Reviewer: Codex (`senior-ai-reviewer`)
- Scope: persisted workspace screens, dashboard, and legacy side panels that still shape end-user UI
- Reviewed modules:
  - `workspace-shell`: `src/application/ProjectWorkspace.tsx`, `src/application/ArtifactTree.tsx`
  - `dashboard`: `src/application/ProjectDashboard.tsx`
  - `persisted-usecase-route`: `src/usecases/PersistedUseCaseWorkspace.tsx`
  - `persisted-brd-route`: `src/brd/PersistedBrdWorkspace.tsx`
  - `legacy-panels`: `src/usecases/UseCasePanel.tsx`, `src/brd/BrdPanel.tsx`
- Not reviewed in this pass:
  - visual design tokens/CSS quality beyond what affects information density
  - browser E2E screenshots

## Executive Summary

- Overall health: The persisted artifact flow is structurally better than before, but the UI still
  carries too many transitional controls and diagnostics from the build/debug phase.
- Highest-risk area: persisted Use Case and BRD screens now have a strong left-bar navigator, yet
  content surfaces still duplicate navigation actions and expose generation internals directly in
  the main reading flow.
- Fastest high-value win: make the left artifact tree the canonical navigator for persisted
  workspace routes and remove dev-facing provenance/debug data from ordinary user screens.
- Recommended execution order:
  1. Remove duplicated in-content navigation buttons where the left bar already owns the action.
  2. Hide telemetry/provenance/debug metadata from end-user surfaces by default.
  3. Simplify remaining technical copy, sidebars, and low-value status chrome.

## Module Map

### workspace-shell
- Purpose: render the persisted project shell, top header, left artifact tree, and route host.
- Evidence: `ProjectWorkspace` mounts the header + `ArtifactTree` and then route-specific content at
  [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:815).

### persisted-usecase-route
- Purpose: list, edit, and progress saved Use Cases toward Diagram artifacts.
- Evidence: `PersistedUseCaseWorkspace` owns list/editor/missing-diagram modes at
  [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:321).

### persisted-brd-route
- Purpose: read, edit, save, regenerate, and export saved BRD artifacts.
- Evidence: `PersistedBrdWorkspace` owns the persisted BRD document surface at
  [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:175).

### legacy-panels
- Purpose: old side-panel workflows for Use Case and BRD generation/editing that still exist in the
  codebase and can leak technical UI patterns back into user-facing surfaces.
- Evidence: `UseCasePanel` and `BrdPanel` still render request/provenance/debug UI directly inside
  the panel body at
  [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:485)
  and [src/brd/BrdPanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.tsx:70).

## Findings

### 1. Persisted screens still duplicate navigation/actions that the left artifact tree already owns

- Severity: P1
- Claim: The persisted workspace now has a capable left artifact tree, but several screens still
  show local navigation buttons for the same destinations, which creates button clutter and weakens
  the tree as the canonical navigator.
- Evidence:
  - The left tree already opens `Feature`, `Use Cases`, `Use Case`, `Diagram`, and `BRD` directly,
    and also exposes per-use-case disclosure and delete in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:177)
    and [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:240).
  - The Feature screen still renders a `Use Cases` button in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:910).
  - The persisted Use Case list still renders `Sửa Feature Intent` and per-card `Sửa Use Case`
    buttons in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:333)
    and [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:453).
  - The persisted Use Case detail and missing-diagram states still render `Về Use Cases` and
    `Mở diagram` in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:499),
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:559),
    and [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:616).
  - The persisted BRD route still renders `Về Diagram` and another `Mở Diagram` empty-state button
    in [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:193)
    and [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:250).
- Impact: Users see multiple ways to move to the same artifact, so the page looks busier than the
  workflow requires. It also makes future UX consistency harder because navigation logic is spread
  across route content and the tree.
- Recommendation: In persisted workspace routes, make the left artifact tree the canonical
  cross-artifact navigator. Keep only actions that mutate state on the current artifact
  (`save`, `generate`, `export`, scoped destructive actions if product insists) and remove local
  “go to sibling/parent artifact” buttons.
- Confidence: Confirmed.

### 2. Generation provenance and telemetry are still shown as primary end-user information

- Severity: P1
- Claim: Request IDs, provider/model, prompt version, generation mode, latency, estimated cost, and
  fallback details are still visible on ordinary Use Case and BRD screens even though they are
  operator/developer diagnostics, not business-facing content.
- Evidence:
  - `GenerationMetadataCard` in the persisted Use Case route renders request ID, attempt count,
    provider/model, prompt version, mode, quality, latency, and cost in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:1396).
  - The persisted BRD route shows source, provider, model, mode, fallback reason, and request ID
    directly under the hero in
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:226).
  - The legacy Use Case panel still shows request ID and prompt metadata inside the primary section
    header in
    [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:497).
  - The legacy BRD panel still shows request ID, model, latency, and cost in the visible header
    meta row in
    [src/brd/BrdPanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.tsx:90).
- Impact: Normal users are forced to parse implementation details that do not help them review the
  business artifact. This lowers signal density and makes the product feel like an internal tool.
- Recommendation: Define a clear metadata policy: keep business-relevant artifact state visible,
  but move operational provenance/telemetry behind a developer-only disclosure, feature flag, or
  entirely out of the end-user UI.
- Confidence: Confirmed.

### 3. BRD and Use Case screens still expose technical diagnostics and internal configuration that do not help ordinary users

- Severity: P2
- Claim: Several screens still surface raw diagnostics and internal controls such as `Structured
  Spec`, `related_node_ids`, `Template`, trace/debug wording, and storage-implementation messages.
- Evidence:
  - The persisted BRD sidebar exposes a `Template` selector in
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:329).
  - The persisted BRD route still renders warning `related_node_ids` and raw `Structured Spec` JSON
    with “trace and review” copy in
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:361)
    and [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:374).
  - The persisted Use Case missing-diagram state says the artifact is missing “trong database” in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:487).
  - The legacy BRD panel still exposes `Warnings`, `Structured Spec`, and `related_node_ids` as
    first-class tabs/content in
    [src/brd/BrdPanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.tsx:139)
    and [src/brd/BrdPanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.tsx:159).
- Impact: The product keeps mixing business-document review with debugging payloads. That is noisy
  for end users and makes it unclear which information is actionable.
- Recommendation: Strip technical payloads from the normal reading flow. If internal diagnostics are
  still needed during development/support, gate them behind an explicit advanced/dev-only surface.
- Confidence: Confirmed.

### 4. Informational chrome still repeats workflow implementation details instead of user-value context

- Severity: P2
- Claim: Some headers and cards spend space restating artifact plumbing rather than helping users
  decide what to do next.
- Evidence:
  - The workspace header repeats the full artifact chain on every route in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:821).
  - The persisted Use Case list intro and draft warning explain “persist”, “left tree refresh”, and
  “artifact thật” rather than business value in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:328)
    and [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:415).
  - The persisted BRD hero lead explains internal storage/panel behavior in
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:181).
  - The dashboard card shows a raw `updated_at` timestamp on every project without any adjacent
    freshness-based decision support in
    [src/application/ProjectDashboard.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectDashboard.tsx:102).
- Impact: The screens feel denser than necessary and make operational details compete with the
  content users actually came to review or edit.
- Recommendation: Rewrite route intros and supporting copy around user tasks, not artifact plumbing.
  Keep timestamps and status chrome only when they change user decisions.
- Confidence: Confirmed.

## Module Directions

### workspace-shell
- Current state: Good persisted shell with a capable left navigator.
- Main risks:
  - tree and content surfaces now both try to own navigation
  - header copy keeps repeating artifact plumbing
- Recommended direction: Harden
- Why now: The tree has recently become more capable; leaving old navigation buttons in place will
  keep the workspace visually noisy and block a coherent interaction model.

### persisted-usecase-route
- Current state: Functionally solid, visually over-instrumented.
- Main risks:
  - duplicated buttons
  - generation metadata dominates more space than business content
  - technical wording leaks implementation details
- Recommended direction: Refactor in place
- Why now: This route is the handoff point between feature intent and diagram generation, so it is
  one of the first places ordinary users feel UI clutter.

### persisted-brd-route
- Current state: Stronger document reading/editing than before, but still carrying a debug sidebar
  mindset.
- Main risks:
  - dev provenance row under the hero
  - technical sidebar controls and raw JSON
  - duplicated Diagram navigation
- Recommended direction: Refactor in place
- Why now: This is the most document-like screen in the product, so any leftover debug UI is
  especially visible and undermines perceived quality.

### legacy-panels
- Current state: Still useful for compatibility, but they preserve the older debug-heavy UI model.
- Main risks:
  - request/model/prompt/debug tabs can leak back into future product surfaces
  - terminology diverges from the cleaner persisted experience
- Recommended direction: Contain
- Why now: Even if persisted routes are the main product path, the legacy panels should not remain a
  standing source of technical clutter patterns.

## Task Creation Decision

Created four follow-up tasks in `docs/review-task-list.md`:

- `TASK-207` for removing duplicated in-content navigation/actions in persisted workspace routes
- `TASK-208` for hiding developer provenance and telemetry from end-user artifact screens
- `TASK-209` for stripping technical diagnostics/internal controls from BRD and Use Case screens
- `TASK-210` for reducing repeated workflow chrome and low-value status copy across dashboard and workspace headers
