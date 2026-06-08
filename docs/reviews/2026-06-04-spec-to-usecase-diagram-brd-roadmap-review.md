# Review — Roadmap to reach `project spec -> use case -> activity diagram -> formal BRD`

Date: 2026-06-04  
Scope: Product/technical sequencing for the next stage of the project

## Target restated

Desired end-state:

1. User inputs **project spec** and the **function/module to build**
2. System generates a **use-case list**
3. System generates **one or more activity diagrams per use case**
4. User reviews/edits those diagrams
5. System generates a **formal BRD** in the style of [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:1)

## Short answer

The right development order is:

1. **Canonical project/use-case data model**
2. **Use-case generation and review loop**
3. **Use-case -> diagram generation**
4. **Diagram editing + round-trip consistency**
5. **Formal BRD generation from the approved use-case portfolio**
6. **Persistence, versioning, and evaluation hardening**

Do **not** optimize formal BRD rendering first if upstream artifacts are still unstable.  
If use cases and generated diagrams drift, the BRD output will always feel brittle no matter how polished the template is.

## Module map for the target architecture

1. `spec-ingestion`
   - Input project spec, function intent, constraints, terminology
2. `use-case-generation`
   - Derive candidate use cases, actors, objectives, preconditions, outcomes
3. `diagram-generation`
   - Convert a selected use case into swimlane activity diagram graph(s)
4. `diagram-editor-and-roundtrip`
   - Let users refine generated diagrams while preserving semantic linkage
5. `formal-brd-generation`
   - Synthesize the final BRD from approved use cases + diagrams
6. `persistence-versioning`
   - Store project spec, use cases, diagrams, BRD revisions, and trace links
7. `eval-and-qa`
   - Golden tests, regression checks, human review workflow

## Review by module

### 1. `spec-ingestion`
- Purpose: turn vague product input into a normalized machine-usable project/function brief
- Current status in repo: missing as a first-class module
- Risk if skipped: downstream AI steps will infer different meanings from the same free text, causing use case drift
- Direction: `Redesign interface`

### 2. `use-case-generation`
- Purpose: produce the actual work units that the rest of the pipeline should operate on
- Current status in repo: missing; current pipeline starts from diagram, not from use case
- Risk if skipped: diagrams become the accidental source of truth, which is backwards for your target workflow
- Direction: `Add as first-class module`

### 3. `diagram-generation`
- Purpose: create swimlane graph drafts from each use case
- Current status in repo: editor exists, but generation path from structured UC -> graph draft is missing
- Risk if rushed too early: generated diagrams will be visually plausible but semantically unreviewable
- Direction: `Add after use-case stabilization`

### 4. `diagram-editor-and-roundtrip`
- Purpose: keep generated diagrams editable without losing traceability back to the originating use case
- Current status in repo: strong editor base exists, but no explicit UC linkage yet
- Risk if delayed too long: user edits will sever the chain from spec -> UC -> diagram -> BRD
- Direction: `Refactor in place`

### 5. `formal-brd-generation`
- Purpose: compile approved artifacts into a BRD that resembles the sample format
- Current status in repo: partial; a summary BRD exists, but formal BRD mode is still backlog
- Risk if done too early: BRD renderer becomes a patchwork of guessed structure because upstream UC/diagram contracts are not stable
- Direction: `Build after UC + diagram contracts are stable`

### 6. `persistence-versioning`
- Purpose: make artifacts durable and comparable
- Current status in repo: editor and BRD draft currently rely heavily on frontend/local artifacts
- Risk if left too late: once you have spec, UC, diagrams, and BRD revisions, local-only state becomes a serious bottleneck
- Direction: `Add before broad AI orchestration`

### 7. `eval-and-qa`
- Purpose: stop the system from silently degrading as the pipeline grows
- Current status in repo: good momentum on tests for current scope
- Risk if skipped: each new AI stage multiplies the regression surface
- Direction: `Harden continuously`

## Recommended sequence

### Now

1. Define the **canonical artifact chain**:
   - `ProjectSpec`
   - `FeatureIntent`
   - `UseCaseDraft`
   - `DiagramDraft`
   - `FormalBRDDraft`
2. Build **spec -> use case** first
3. Add a **review UI/state** for generated use cases before touching diagram generation

### Next

4. Build **use case -> activity diagram graph** generation
5. Preserve **traceability and round-trip edits** between use case and diagram
6. Only then implement **formal BRD synthesis** from the reviewed use-case portfolio

### Later

7. Add persistence/versioning for projects, UCs, diagrams, BRDs
8. Add evaluation datasets and quality gates
9. Add downstream document publishing (DOCX/Google Docs) after formal BRD mode is stable

## Recommendation

If the question is “what should we build next to most efficiently reach the target?”, the answer is:

**Do not jump straight from current diagram->BRD into prettier BRD output.**

The best next milestone is:

> **Input spec/function -> generate and review structured use cases**

That milestone gives you the missing middle layer your target workflow depends on.  
After that, diagram generation and formal BRD generation become much more deterministic and testable.
