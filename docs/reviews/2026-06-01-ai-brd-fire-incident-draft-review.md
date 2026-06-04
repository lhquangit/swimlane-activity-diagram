# AI BRD Draft Review - Fire Incident Sample

- Date: 2026-06-01
- Reviewer: Codex (`senior-ai-reviewer`)
- Scope: Reader-facing BRD draft generated from the current default fire-incident sample diagram
- Reviewed modules:
  - `ai-brd-runtime-composition`
  - `ai-brd-semantic-interpreter`
  - `ai-brd-renderer`
  - `ai-brd-sample-fixtures-and-eval`
- Modules not reviewed:
  - Frontend canvas interactions outside the BRD export flow
  - Deployment/runtime infra

## Executive Summary

- Overall health: The BRD output is materially better than the earlier raw-id dump, but this sample still exposes one confirmed semantic bug and two reader-facing quality gaps.
- Highest-risk area: `ai-brd-semantic-interpreter`
- Fastest high-value win: Stop treating non-branching `sync-bar` nodes as parallel blocks.
- Recommended execution order:
  1. Fix false-positive parallel detection.
  2. Split contextual note semantics from step annotation semantics.
  3. Soften decision narrative for the main path so it reads less mechanically.

## Module Directions

### ai-brd-runtime-composition
- Current state: The generate route now has a good safety net because live-provider output is harmonized back to deterministic reader-facing fields before rendering.
- Main risks:
  - Runtime still trusts the semantic interpreter too much; if interpretation is wrong, the route will faithfully render the wrong business meaning.
- Recommended direction: `Keep as-is`
- Why now: The problem in this sample is not route orchestration anymore; it is upstream semantic classification.

### ai-brd-semantic-interpreter
- Current state: This module now separates main spine, branches, handoffs, and sync-bar summaries, but it still over-classifies some structures.
- Main risks:
  - Non-parallel `sync-bar` nodes are still emitted as parallel blocks.
  - Notes are anchored to the nearest same-lane node even when they are really contextual process notes, not step annotations.
  - Branch summaries still narrate “return to main flow” for the main path in a mechanically correct but awkward way.
- Recommended direction: `Refactor in place`
- Why now: The current draft shows these issues directly in user-facing BRD prose. They will keep resurfacing across diagrams until the semantic layer distinguishes these cases explicitly.

### ai-brd-renderer
- Current state: The renderer no longer leaks raw ids in the first 10 sections and the debug appendix is a good separation.
- Main risks:
  - Decision wording is still too literal because it only knows `path_summary + rejoin_node_text`.
  - The annotation section does not distinguish “context note” from “step note”.
- Recommended direction: `Harden`
- Why now: The remaining draft defects are now subtle enough that renderer wording matters, but it should only be changed after the semantic interpreter exposes cleaner labels.

### ai-brd-sample-fixtures-and-eval
- Current state: The sample fixture and golden tests now catch raw-id leakage and branch/parallel regressions, but they do not yet catch this sample’s false-positive parallel section or contextual note mismatch.
- Main risks:
  - CI can still pass while BRD contains a semantically wrong `Parallel activities` section.
  - The default sample note can still be narrated as a step-specific annotation without any test failing.
- Recommended direction: `Harden`
- Why now: These are exactly the kinds of “looks plausible but wrong” defects that golden quality tests should pin down.

## Findings

### [P1] `Parallel activities` is a false positive for this sample

- Claim: The BRD says there are parallel activities, but the sample diagram does not actually fork into parallel branches.
- Evidence:
  - The sample graph contains `n-a4 -> n-sync -> n-b1` with only one outgoing edge from `n-sync`, so there is no fan-out and no real parallel split in the fixture at [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:64), [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:71), [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:165), [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:166).
  - `interpret.py` still emits a `parallel_block` for every sync-bar with role `join` or `sync`, even when it has no branch summaries, at [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:428), [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:443), [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:459).
- Impact: The draft invents a coordination pattern that does not exist in the source diagram. For a BA, this is worse than missing detail because it creates false business meaning.
- Recommendation: Only emit `parallel_blocks` into the BRD when a sync-bar has real fan-out/fan-in evidence or non-empty branch summaries. Treat isolated `sync` bars as layout/control artifacts unless another semantic rule upgrades them.
- Confidence: Confirmed.

### [P1] The fire-source note is misclassified as a step annotation

- Claim: The note listing the four fire-detection sources is being narrated as “Note cho bước `Bắt đầu quy trình`”, but it is a contextual note for process entry conditions, not a comment on the start node itself.
- Evidence:
  - The sample note content is a general source list in [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:25), [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:31), not an instruction about the `start` node.
  - `resolve_note_anchor()` attaches any nearby same-lane note to the nearest node at [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:341), [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:351), and `format_anchored_note_annotation()` always renders it as a step annotation at [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:361).
- Impact: The BRD overstates traceability by pretending a contextual note belongs to a single step. That can distort requirements interpretation and later acceptance criteria.
- Recommendation: Introduce a second note class for `context_note` or `entry_context_note`. Use content/anchor heuristics so list-like notes near the start become assumptions/context, not step annotations.
- Confidence: Confirmed from the sample fixture and current anchoring rule.

### [P2] Decision narration is still mechanically correct but hard to read

- Claim: The decision section is more structured than before, but it still reads like a serialized graph walk instead of analyst prose.
- Evidence:
  - `trace_branch_path()` always captures a branch path plus `rejoin_node_text` at [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:248), [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:274).
  - `branch_outcome_summary()` always renders that as `"...; sau đó quay lại luồng chính tại ..."` at [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:94), [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:99).
- Impact: The draft is understandable, but still sounds machine-generated. The main-path outcome (“Có -> Xác nhận thông tin đúng; sau đó quay lại luồng chính…”) is especially awkward because it describes ordinary continuation as if it were a detour.
- Recommendation: Distinguish `continue_main_flow` from `alternate_branch`. Render the preferred-path branch as `Tiếp tục: ...` or omit the “quay lại luồng chính” clause when the branch is simply the main continuation.
- Confidence: Confirmed by the current renderer logic; impact is reader-facing quality rather than correctness.

## Recommended Next Tasks

### Now

#### TASK-033 - Suppress false-positive parallel sections for non-branching sync-bars
- Priority: P1
- Module: ai-brd-semantic-interpreter
- Problem: `sync-bar` nodes with no real fan-out/fan-in still become `parallel_blocks`, creating fake `Parallel activities`.
- Why it matters: This invents process semantics that are not present in the diagram.
- Implementation steps:
  1. In `interpret.py`, require real branch evidence before emitting a reader-facing `parallel_block`.
  2. For `role == "sync"` with empty `branch_summaries`, downgrade to no BRD parallel section.
  3. Keep trace/debug visibility if needed, but do not surface a business-level parallel narrative.
  4. Add a fixture/assertion for the current fire sample where `Parallel activities` is empty.
- Acceptance criteria:
  - The default fire sample no longer renders a false `Parallel activities` section.
  - Real fork/join samples still render parallel summaries.
- Dependencies: None
- Verification: `apps/api/tests/test_pipeline.py` and `npm run test:brd-mock`

#### TASK-034 - Split contextual notes from step-anchored annotations
- Priority: P1
- Module: ai-brd-semantic-interpreter
- Problem: Nearby notes are always attached to the nearest node, even when they represent entry context or general operating assumptions.
- Why it matters: The BRD currently mislabels context as step-specific annotation.
- Implementation steps:
  1. Add a semantic distinction between `step_annotation` and `context_note`.
  2. Update note anchoring rules to detect list-like/context notes near process entry.
  3. Render `context_note` under `Assumptions / open questions` or a clearer context wording.
  4. Add a regression for the fire-source note in the default sample.
- Acceptance criteria:
  - The fire-source note no longer renders as `Note cho bước "Bắt đầu quy trình"`.
  - Step-specific notes still anchor correctly when they are genuinely attached to one step.
- Dependencies: TASK-033 optional but not required
- Verification: pipeline golden tests + manual generate on the default sample

### Next

#### TASK-035 - Differentiate main-path continuation from alternate branch narration
- Priority: P2
- Module: ai-brd-renderer
- Problem: Decision outcomes always use the same `... quay lại luồng chính ...` phrasing, even when the branch is just the preferred continuation.
- Why it matters: This keeps the draft sounding graph-serialized rather than analyst-written.
- Implementation steps:
  1. Add a flag in interpreted branch data for `continues_main_flow`.
  2. Update renderer wording so main-path outcomes use `Tiếp tục:` or equivalent.
  3. Keep `quay lại luồng chính` only for real alternate paths that rejoin later.
  4. Expand golden tests to assert the new phrasing.
- Acceptance criteria:
  - Main-path branch wording is shorter and less mechanical.
  - Alternate branches that truly rejoin still show rejoin semantics.
- Dependencies: TASK-028 completed; depends on new branch metadata
- Verification: golden narrative tests for fire sample and one alternate-end sample
