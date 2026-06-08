# Review — Persisted Use Case Presentation

Date: 2026-06-07
Reviewer: Codex (`senior-ai-reviewer`)
Scope: visual presentation and readability of AI-generated Use Cases on the persisted `use-case` route

## Review Scope

- User-facing symptom:
  - The persisted Use Case editor is visually dense, hard to scan, and looks like a raw form dump rather than a readable artifact. The user-provided screenshot confirms the current page feels cramped and visually noisy.
- Files reviewed:
  - `src/usecases/PersistedUseCaseWorkspace.tsx`
  - `src/styles.css`
  - `src/usecases/UseCasePanel.tsx`
  - `src/usecases/PersistedUseCaseWorkspace.test.tsx`
- What was not reviewed:
  - Backend AI quality or wording quality of generated content
  - LogicFlow canvas layout
  - BRD presentation

## Module Map

1. `persisted-usecase-route`
   - Files: `src/usecases/PersistedUseCaseWorkspace.tsx`
   - Purpose: render list mode, single Use Case editor mode, and missing-Diagram state.
2. `shared-usecase-card-styles`
   - Files: `src/styles.css`
   - Purpose: shared styling primitives for both old `UseCasePanel` and new persisted Use Case route.
3. `legacy-usecase-workspace`
   - Files: `src/usecases/UseCasePanel.tsx`
   - Purpose: older workspace/editor surface whose visual primitives are still being reused.
4. `regression-layer`
   - Files: `src/usecases/PersistedUseCaseWorkspace.test.tsx`
   - Purpose: validate behavior of the persisted Use Case surface.

## Findings

### [P1] The persisted Use Case page is still a raw form stack, not a readable artifact page

- Claim: the new persisted editor renders almost the entire Use Case as fully editable controls in one continuous stack, so the page is hard to scan before the user even decides what to edit.
- Evidence:
  - The editor immediately renders title input, actors textarea, general info, all main-flow rows, all alternate-flow rows, and success outcome in one page at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:476).
  - Main flow and alternate flow sections are always expanded, and every step is rendered as editable form controls by default at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:585) and [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:729).
- Impact: AI-generated content that should be reviewed quickly instead feels like a wall of controls. Users have to parse layout noise before they can judge the Use Case itself.
- Recommendation: redesign the route as an artifact page with two layers:
  1. a read-first summary surface for title, actors, objective, preconditions, counts, review status, and diagram readiness
  2. scoped edit sections for only the part the user is currently modifying
  Use progressive disclosure rather than opening the entire structured editor by default.
- Confidence: Confirmed.

### [P1] Shared `usecase-card` styling is being stretched past its design boundary and now hurts layout clarity

- Claim: the persisted editor still relies on generic `usecase-card` styles originally meant for card-like sections, not a full-page editor. The primitives are too shallow for the density of this screen.
- Evidence:
  - The editor route reuses `usecase-card__header`, `usecase-card__grid`, `usecase-card__flow-step`, `usecase-card__flow-heading`, and related classes throughout [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:476).
  - The shared CSS keeps labels as simple block stacks and does not define a richer step-row layout: `.usecase-card label { display: block; }` at [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css:717), and `.usecase-card__flow-step` is only a left border plus padding at [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css:1054).
  - The title field gets only `font-weight: 600` with no dedicated artifact-title styling at [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css:971).
- Impact: the page reads like nested generic cards and default form fields. Important structure such as “what is metadata”, “what is the main narrative”, and “what are step actions” is visually weak.
- Recommendation: create a dedicated persisted-editor style namespace instead of continuing to stretch the shared `usecase-card` classes. Keep shared primitives only for tokens and very small reusable pieces.
- Confidence: Confirmed.

### [P2] Step rows do not have a strong information architecture, so actions compete visually with content

- Claim: each step mixes heading, reorder/delete controls, actor selection, and action text in one loose vertical block. This makes the step body look busy and causes the user’s eye to bounce between controls and content.
- Evidence:
  - Each step currently renders the step heading, action buttons, actor selector, action textarea, optional warning, and expandable details in one contiguous section at [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:589).
  - The corresponding CSS only defines a simple flex header and stacked labels at [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css:1069) and [src/styles.css](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/styles.css:1059).
- Impact: the high-frequency surface of the editor, the step list, becomes the least readable part of the page. This is exactly where users spend the most time reviewing AI output.
- Recommendation: split each step into a stable two-zone layout:
  - content column: actor, action, and detail summary
  - action rail: move up/down/delete and status/warning
  Also introduce a compact summary line for closed steps so the list can be scanned without opening every detail block.
- Confidence: Confirmed.

### [P2] There is no visual regression coverage for the problem the user is reporting

- Claim: the current tests cover behavior, not presentation quality or responsive readability.
- Evidence:
  - `PersistedUseCaseWorkspace.test.tsx` verifies generation, persistence, and CTA behavior, but contains no layout or visual assertions at [src/usecases/PersistedUseCaseWorkspace.test.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.test.tsx:139).
  - There is no dedicated Playwright visual check for the persisted Use Case route in the reviewed scope.
- Impact: even a well-intentioned UI cleanup can regress back into clutter without tests noticing. The exact pain the user surfaced is currently outside the automated safety net.
- Recommendation: add viewport-based browser coverage for the persisted Use Case page, including desktop and mobile screenshots or structured layout assertions for overflow, field alignment, and section hierarchy.
- Confidence: Confirmed.

## Module Directions

### persisted-usecase-route

- Current state: functionally rich, visually overloaded.
- Main risks:
  - read/review and edit are collapsed into one surface
  - page density hides the AI-generated narrative inside control chrome
- Recommended direction: Redesign interface
- Why now: this route is now the primary UX for persisted Use Cases, so readability is no longer a polish concern; it directly affects whether the new flow feels usable.

### shared-usecase-card-styles

- Current state: reusable, but too generic for this editor.
- Main risks:
  - one-size-fits-all classes flatten hierarchy
  - changes for the persisted editor can accidentally perturb the legacy workspace
- Recommended direction: Split responsibilities
- Why now: the new persisted route has crossed the threshold where it needs its own layout language rather than more conditional tweaks on shared card styles.

### legacy-usecase-workspace

- Current state: still useful as behavioral reference, but not a good visual model for the persisted page.
- Main risks:
  - continued visual copying from this module will drag old panel-era UX into the new route
- Recommended direction: Keep as-is
- Why now: use it as a source of domain behavior only; do not keep inheriting its presentation structure.

### regression-layer

- Current state: strong on logic, weak on layout.
- Main risks:
  - visual regressions will ship unnoticed
- Recommended direction: Harden
- Why now: once the page is redesigned, the team will need a safety net to keep it readable.
