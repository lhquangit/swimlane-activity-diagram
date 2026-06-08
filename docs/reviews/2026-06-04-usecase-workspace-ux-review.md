## Scope

Review the current `Use case drafts` workspace from the user's point of view:

- input should mean “where I enter project spec and function intent”
- output should mean “the use-case list I can edit”
- each use case should visibly lead to a diagram

## Findings

### [P1] Current panel mixes input, generated output, and architecture/debug context into one long surface

The current `Use Case Drafts` panel renders:

1. request-state notices
2. `Project spec`
3. `Feature intent`
4. `Artifact chain`
5. generated use-case cards

all inside one long scroll container under the single heading `Use Case Drafts`.

- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:53)
- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:81)
- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:159)
- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:305)
- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:322)

Impact:

- the user’s simple model “Input on top, Output below” is buried under implementation-oriented structure
- `Artifact chain` is useful for us as builders, but it sits in the middle of the primary workflow and increases cognitive load for normal users
- the panel title is about the output, while the first half of the panel is actually an ingestion form

Direction: redesign this area as a workspace with explicit phases or columns, not one mixed panel.

### [P1] There is currently no user-facing “diagram list” even though the product story implies one diagram per approved use case

The repo already positions `DiagramDraft` as the next artifact after `UseCaseDraft`, and the user flow clearly expects “for each use case, I can generate one diagram”. But the current UI has no surface that shows:

- which use cases already have a diagram
- which ones do not
- how to open/switch among diagrams per use case

Evidence:

- `UseCasePanel` stops at editable use cases and approve actions, with no per-item diagram affordance in the UI: [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:322)
- the main editor shell still only mounts a single canvas plus the `UseCasePanel` and `BrdPanel`: [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:2149)
- backlog already confirms `UseCaseDraft -> DiagramDraft` is still pending: [docs/review-task-list.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/review-task-list.md:1904)

Impact:

- from the user’s perspective, the journey appears to stop after “I have some use cases”
- the promised bridge from use case to diagram is not visible, so the current UX feels incomplete even if the architecture plans for it

Direction: introduce a first-class diagram list/workspace model, not just a future hidden action.

### [P2] Naming is misleading: “Use Case Drafts” sounds like output only, but it currently contains both the ingestion form and the output list

The current title and toolbar entry both say `Use case drafts`, but the first thing the user sees is a form for `Project spec` and `Feature intent`.

- [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:2043)
- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:56)

Impact:

- users can easily assume they are “editing use cases” before anything has even been generated
- it weakens the separation between input artifacts and derived artifacts

Direction: rename this workspace around the actual job-to-be-done, for example `Spec -> Use cases`, `Use case builder`, or split it into `Inputs` and `Use cases`.

### [P2] The current use-case cards support edit/review, but not the next obvious action per item

Each generated card lets the user change fields and cycle `draft / reviewed / approved`, but once a use case becomes approved the next action is not visible on the card itself.

- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:337)

Impact:

- approved state feels like a dead end instead of a gateway to the next artifact
- the UI is missing the handoff point from “this UC is ready” to “generate/open its diagram”

Direction: redesign cards or rows around lifecycle actions, not only text editing.

## Module directions

- `usecase-frontend-review`: Redesign interface
- `diagram-generation-entrypoint`: Add first-class surface
- `artifact-chain-ux`: Hide from primary flow / move to advanced context
- `workflow-docs`: Refactor in place

## Suggested follow-up

1. Split the workspace into explicit `Input`, `Use cases`, and `Diagrams` surfaces.
2. Remove `Artifact chain` from the default user path or collapse it into an advanced disclosure.
3. Add per-use-case next actions and a visible diagram inventory/state list.
4. Update UC-07 and the roadmap so the UI contract matches the simpler user mental model.
