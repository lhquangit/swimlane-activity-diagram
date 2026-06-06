# Review: Use-case Generation Quality

## Scope

- Frontend request path: `src/App.tsx`, `src/usecases/prevalidate.ts`, `src/usecases/client.ts`
- API route and contract: `apps/api/app/routes/usecase_generate.py`, `apps/api/app/schemas/usecase.py`
- Generation logic: `apps/api/app/services/usecase_builder.py`
- Existing provider boundary: `apps/api/app/providers/openrouter_provider.py`

## Executive Summary

The current use-case output is not AI-generated. `POST /api/usecases/generate` always reports
`provider="deterministic"` and `model="spec-usecase-builder-v1"`. The service selects up to four
use-case categories through keywords and list counts, then fills fixed four-step templates.

This explains the observed generic output. The current implementation is useful as a stable
fallback and test oracle, but it should not be presented as domain-aware use-case synthesis.

Recommended direction: keep the deterministic builder as fallback and validation baseline, then
add an LLM structured-output path that proposes business-specific segmentation and flows under the
existing `UseCaseDraft` schema.

## Module Map

| Module | Responsibility | Direction |
| --- | --- | --- |
| Intake adapter | Validate and canonicalize project/feature inputs | Keep and harden |
| Deterministic builder | Stable fallback and baseline generation | Keep as fallback |
| Use-case provider | Domain-aware structured synthesis | Add incrementally |
| Contract validator | Reject invalid actors, IDs, branches and outcomes | Keep as mandatory gate |
| Quality evaluation | Detect generic or unsupported output | Add before defaulting to AI |

## Findings

### P1 - Use-case generation is deterministic despite an AI-oriented product expectation

- Evidence: `usecase_generate.py` calls `generate_use_case_drafts()` directly and returns
  `provider="deterministic"` with `model="spec-usecase-builder-v1"`.
- Impact: Users reasonably expect domain-specific reasoning but receive template expansion.
- Direction: Redesign interface truthfully now; add AI generation incrementally.
- Confidence: Confirmed.

### P1 - Main flows are fixed templates, not derived business procedures

- Evidence: intake, execution, coordination and exception use cases each use fixed four-step
  lists in `usecase_builder.py`.
- Impact: Different domains receive nearly identical verbs such as open, process, update and
  notify; meaningful states, approvals, decisions and responsibilities are missed.
- Direction: Let an LLM propose structured steps and alternate flows, then validate them.
- Confidence: Confirmed.

### P1 - Segmentation relies on shallow keyword/count heuristics

- Evidence: `should_create_intake_use_case`, `should_create_coordination_use_case` and
  `should_create_exception_use_case` inspect a short keyword list and collection lengths.
- Impact: Semantically equivalent Vietnamese wording can be missed, while incidental keywords can
  create unnecessary use cases.
- Direction: Use deterministic signals as hints and fallback, not as the primary semantic planner.
- Confidence: Confirmed.

### P2 - The existing provider abstraction is BRD-specific

- Evidence: OpenRouter settings and provider errors use `BRD_*` names and are only wired through
  `brd_generate.py`.
- Impact: Reusing it directly for use cases would couple unrelated pipelines and configuration.
- Direction: Extract a shared structured-generation provider boundary before adding use-case AI.
- Confidence: Confirmed.

## Recommended Architecture

1. Canonicalize and validate input as today.
2. Ask the model for business-specific `UseCaseDraft[]` through strict structured output.
3. Do not trust model-generated technical IDs; assign stable IDs deterministically after synthesis.
4. Run the existing actor/step/branch contract validator.
5. Run quality checks for generic steps, unsupported claims, duplicated use cases and missing trace
   to input signals.
6. Fall back to the deterministic builder when the provider is unavailable or output remains
   invalid after bounded retry.
7. Show the generation source in UI: `AI draft` or `Rule-based fallback`.

## Target Module Structure

```text
apps/api/app/
├── ai/
│   ├── providers/
│   │   ├── base.py
│   │   ├── mock.py
│   │   └── openrouter.py
│   ├── prompts/
│   │   ├── contract.py
│   │   ├── registry.py
│   │   ├── brd_v1.py
│   │   └── usecase_v1.py
│   └── telemetry.py
├── usecases/
│   ├── schemas.py
│   ├── deterministic_builder.py
│   ├── synthesis_schema.py
│   ├── hydrator.py
│   ├── validator.py
│   ├── quality.py
│   └── generation_service.py
└── routes/
    └── usecase_generate.py
```

Responsibilities:

- Route: HTTP/schema/rate-limit only.
- Generation service: choose AI/fallback, retry, metadata and failure policy.
- Prompt registry: immutable prompt ID/version, rendering and input envelope.
- Synthesis schema: semantic content only; no model-authored technical IDs.
- Hydrator: deterministic IDs, references and compatibility summaries.
- Validator/quality: structural contract plus grounding/specificity checks.
- Deterministic builder: retained as explicit fallback and test baseline.

## Recommended Execution Order

1. TASK-114 - truthful source labeling.
2. TASK-115 - shared provider/config boundary.
3. TASK-118 - split use-case generation into owned modules.
4. TASK-119 - versioned prompt package and prompt tests.
5. TASK-120 - semantic synthesis schema and deterministic hydration.
6. TASK-121 - grounding and prompt-injection controls.
7. TASK-116 - wire AI orchestration with bounded retry/fallback.
8. TASK-122 - observability and prompt/model metadata.
9. TASK-117 - quality evaluation gate.
10. TASK-123 - staged rollout and rollback policy.
