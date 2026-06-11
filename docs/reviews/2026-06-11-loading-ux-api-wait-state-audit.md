# Review: Loading UX Audit For API-Backed Screens

- Date: 2026-06-11
- Reviewer: Codex (`senior-ai-reviewer`)
- Scope: all main user-facing screens and legacy panels that trigger network-backed artifact actions
- Reviewed modules:
  - `router-and-auth`: `src/application/AppRouter.tsx`
  - `dashboard`: `src/application/ProjectDashboard.tsx`
  - `workspace-shell`: `src/application/ProjectWorkspace.tsx`, `src/application/ArtifactTree.tsx`
  - `persisted-usecase-route`: `src/usecases/PersistedUseCaseWorkspace.tsx`
  - `persisted-brd-route`: `src/brd/PersistedBrdWorkspace.tsx`
  - `legacy-usecase-canvas-flow`: `src/App.tsx`, `src/usecases/UseCasePanel.tsx`
- Not reviewed in this pass:
  - browser animation polish and skeleton design details
  - Clerk-hosted screens outside the local app shell

## Executive Summary

- Overall health: initial page loads are mostly covered. The missing UX is concentrated in
  action-level waits after the user clicks a button and the UI should acknowledge a pending API
  call.
- Highest-risk area: destructive and artifact-generation actions currently allow the screen to look
  idle while the request is in flight, which makes repeated clicks and accidental double-submits
  likely.
- Fastest high-value win: add explicit pending/disabled states for delete, generate-diagram, open
  saved-diagram, and DOCX export actions.
- Surfaces already in decent shape:
  - auth boot/loading is covered in
    [src/application/AppRouter.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/AppRouter.tsx:47)
  - initial dashboard load is covered in
    [src/application/ProjectDashboard.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectDashboard.tsx:86)
  - project workspace boot/loading is covered in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:794)
  - persisted Use Case list generation/save and persisted BRD load/generate/save already expose
    pending states in their primary actions

## Findings

### 1. Project deletion on the dashboard has no row-level pending UX

- Severity: P1
- Claim: Deleting a project triggers a real API call, but the card stays visually idle and the
  delete button remains clickable while the request is in flight.
- Evidence:
  - `deleteProject()` awaits `api.deleteProject(project.id)` without setting a per-project pending
    state in
    [src/application/ProjectDashboard.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectDashboard.tsx:47).
  - The card button still renders a static `Xóa` label and has no busy/disabled condition in
    [src/application/ProjectDashboard.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectDashboard.tsx:103).
- Impact: Users can click delete repeatedly and the screen does not acknowledge that destructive
  work is underway.
- Recommendation: Add row-level deleting state, disable both open/delete affordances for that row,
  and show clear copy such as `Đang xóa…`.
- Confidence: Confirmed.

### 2. Persisted workspace destructive actions still lack waiting feedback

- Severity: P1
- Claim: Feature deletion and left-bar Use Case deletion both perform network work with no visible
  pending state in the UI that launched the action.
- Evidence:
  - `deleteFeature()` awaits `api.deleteFeature(activeFeature.id)` and then refreshes the artifact
    tree, but does not set any deleting state in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:403).
  - The Feature screen’s delete button always renders `Xóa` and is never disabled for in-flight
    work in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:905).
  - The left artifact tree delete affordance fires `onDeleteUseCase(...)` immediately and has no
    row-level busy state or disable logic in
    [src/application/ArtifactTree.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ArtifactTree.tsx:252).
- Impact: Destructive actions in the persisted shell can feel unresponsive and are vulnerable to
  repeated clicks while the tree refresh catches up.
- Recommendation: Track deleting state by feature/use-case row, disable the originating controls,
  and keep the tree/content surfaces visually in sync until refresh completes.
- Confidence: Confirmed.

### 3. Persisted Use Case diagram generation has no in-flight loading state

- Severity: P1
- Claim: The persisted Use Case detail route calls generate-and-save for Diagram artifacts, but the
  primary CTA does not switch into a pending state while that multi-step operation runs.
- Evidence:
  - `handleGenerateDiagram()` calls `workspace.generateDiagram(...)`, `workspace.saveDiagram(...)`,
    and `workspace.refreshArtifactTree()` without any local pending state in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:250).
  - The visible CTA remains bound only to review/contract validation and always renders
    `diagramActionLabel`, with no `Đang tạo…` branch in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:537).
- Impact: This is one of the longest waits in the persisted workflow, yet the screen provides no
  acknowledgement that the request is progressing.
- Recommendation: Add an explicit diagram-generation pending state for the persisted route, disable
  the CTA during generation/save/tree-refresh, and surface progress text that explains the current
  operation.
- Confidence: Confirmed.

### 4. Legacy Use Case canvas flow still lacks loading feedback when opening a saved Diagram

- Severity: P2
- Claim: In the legacy Use Case panel flow, opening a saved Diagram can trigger `loadDiagram()`,
  but the user does not see a waiting state while the saved artifact is being fetched.
- Evidence:
  - `handleOpenUseCaseDiagramCanvas()` awaits `workspace.loadDiagram(useCaseId)` without first
    setting any opening/loading state in
    [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:2068).
  - `UseCasePanel` only has row affordances for `operation_state === 'generating'`; the `Mở canvas`
    path has no equivalent pending branch in
    [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:1218).
- Impact: Clicking `Mở canvas` on a saved diagram can appear to do nothing on slower responses,
  even though the system is loading real data.
- Recommendation: Extend the diagram inventory operation model to cover `opening`, disable the row
  while fetch is in flight, and provide a short loading label or status copy.
- Confidence: Confirmed.

### 5. Persisted BRD DOCX export lacks exporting feedback and repeat-click protection

- Severity: P2
- Claim: Exporting a BRD to DOCX is asynchronous, but the export button remains static and
  clickable until the download begins.
- Evidence:
  - `handleExportDocx()` awaits `workspace.exportBrdDocx(...)` with no exporting state in
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:149).
  - The `Export DOCX` button is not disabled during the request and has no pending label in
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:196).
- Impact: Users can trigger duplicate export requests and do not get immediate confirmation that the
  document is being prepared.
- Recommendation: Add exporting state, disable the button during preparation, and show explicit
  feedback such as `Đang tạo file DOCX…`.
- Confidence: Confirmed.

## Module Directions

### dashboard
- Current state: initial load is covered; destructive row actions are not.
- Recommended direction: Harden.

### workspace-shell
- Current state: route boot loading is covered; action-level delete states are missing.
- Recommended direction: Harden.

### persisted-usecase-route
- Current state: list generation/save is covered; diagram generation is not.
- Recommended direction: Refactor in place.

### persisted-brd-route
- Current state: page load/generate/save are covered; export is not.
- Recommended direction: Harden.

### legacy-usecase-canvas-flow
- Current state: diagram generation has loading UX; opening saved diagrams does not.
- Recommended direction: Contain and align with the persisted loading-state policy.

## Task Creation Decision

Created four follow-up tasks in `docs/review-task-list.md`:

- `TASK-211` for dashboard project-delete pending UX
- `TASK-212` for persisted workspace destructive-action pending UX
- `TASK-213` for diagram action loading states across persisted and legacy Use Case flows
- `TASK-214` for persisted BRD DOCX export pending UX
