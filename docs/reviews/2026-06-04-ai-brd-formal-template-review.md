# Review — AI BRD format gap vs `examples/BRD.docx.md`

Date: 2026-06-04  
Scope: AI BRD output structure, schema, and renderer direction

## Summary

The current AI BRD draft is no longer semantically broken, but it is still a **process-summary document**, not a **formal BRD/use-case document** like [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:1).  

If the target is “draft BRD should look as close as possible to that sample,” we should not treat this as more prose polish. We need a **new document model + renderer profile** that can express:

- document purpose
- business scope table
- actor/role table
- consolidated use-case catalog
- business state catalogs
- per-use-case sections with:
  - objective
  - preconditions
  - main flow step table
  - state flow
  - exception table
  - sub-branches where needed

## Module directions

- `ai-brd-schema`: `Redesign interface`
- `ai-brd-spec-builder`: `Refactor in place`
- `ai-brd-renderer`: `Split responsibilities`
- `ai-brd-tests`: `Harden`

## Findings

### [P1] Current renderer is hard-coded to a 10-section process-summary template, not a formal BRD template

Evidence:
- The current markdown output is fixed to:
  `Process overview`, `Business objective`, `Scope`, `Actors`, `Main workflow`, `Decision logic`, `Parallel activities`, `Handoffs`, `Exceptions / warnings`, and `Context / assumptions / open questions` in [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:8).
- The example document instead starts with:
  `Mục đích tài liệu`, `Phạm vi nghiệp vụ`, `Actor`, `Danh sách user case sau khi gộp`, `Trạng thái nghiệp vụ`, then multiple per-UC sections in [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:5), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:11), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:20), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:29), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:36), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:61).

Impact:
- Even with better wording, the current output will still “feel wrong” because the document shape itself is different from the target artifact.

Recommendation:
- Add a separate `formal_brd` renderer/template mode instead of forcing the current 10-section draft to impersonate the sample.

### [P1] The current schema cannot represent the target document faithfully

Evidence:
- `DiagramBRDSpec` only models one flat process with `actors`, `main_flow_steps`, `branches`, `parallel_blocks`, `handoffs`, `loops`, and notes/warnings in [apps/api/app/schemas/spec.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/spec.py:83).
- There is no first-class structure for:
  - business scope groups
  - actor role table
  - use-case catalog
  - business states
  - per-use-case preconditions
  - per-use-case main-flow row tables
  - per-use-case exception tables
- The sample depends heavily on exactly those constructs in [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:13), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:22), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:31), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:40), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:69), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:83), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:108).

Impact:
- The renderer currently has to “fake” BRD richness from a process-summary schema. That sets a hard ceiling on how close it can get to the sample.

Recommendation:
- Introduce a higher-level document schema for `formal_brd` output, even if it is deterministically derived from the current semantic graph.

### [P2] The builder assumes one main spine, while the sample is organized as a use-case portfolio

Evidence:
- The deterministic builder creates one `main_flow_steps` list from `interpreted["main_flow_nodes"]` in [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:23).
- The sample does not present one flat process only. It presents:
  - a consolidated use-case list in [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:29)
  - then separate UC sections with their own objective, preconditions, main flow, state flow, and exceptions in [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:61), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:118), [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:211).

Impact:
- Current AI BRD can describe a flow, but it cannot yet reorganize that flow into the “portfolio of use cases” style that the sample uses.

Recommendation:
- Add a UC segmentation layer on top of the semantic graph, likely driven by major decision branches, end states, and domain/action clusters.

### [P2] Actor modeling is still lane-centric, but the sample needs business/system actor roles

Evidence:
- Current actor items come from lanes and inferred responsibilities in [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:53) and [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:340).
- The sample actor table includes non-lane system actors such as `Portal` and `V-app` alongside human actors in [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:22).

Impact:
- If we keep actors equal to lanes, the output will miss an important BRD convention: business actors and system participants are not always the same thing.

Recommendation:
- Add a system-actor inference layer and render actor roles as a table, not a bullet list.

## Recommended direction

Do **not** keep stretching the current reader-facing summary template to imitate the sample.  
Instead:

1. Keep the current draft as `summary_brd` or equivalent.
2. Add a second output profile: `formal_brd`.
3. Build a deterministic transformation from semantic graph -> formal BRD document model.
4. Render `formal_brd` as tables + UC sections aligned to the sample style.

That is the cleanest path to “look like a real BRD” without breaking the simpler draft mode that is already working.
