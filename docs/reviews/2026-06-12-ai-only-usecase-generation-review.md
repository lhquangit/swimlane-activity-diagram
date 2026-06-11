# Review whether Use Case generation should drop manual/deterministic authoring entirely

Date: 2026-06-12
Reviewer: Codex
Scope: product/runtime contract for `Use Case` generation after repeated low-quality deterministic fallback output

## Module map

1. Runtime contract and mode surface
   - `apps/api/app/usecases/runtime.py`
   - `apps/api/app/config.py`
   - `src/usecases/PersistedUseCaseWorkspace.tsx`
   - `src/usecases/UseCasePanel.tsx`
2. Generation orchestration
   - `apps/api/app/usecases/generation_service.py`
   - `apps/api/app/routes/usecase_generate.py`
   - `apps/api/app/services/persistence_generation.py`
3. Deterministic authoring path
   - `apps/api/app/usecases/deterministic_builder.py`
   - `apps/api/tests/test_usecase_builder.py`
4. AI output guardrails
   - `apps/api/app/usecases/{grounding.py,quality.py,hydrator.py}`
   - `apps/api/tests/{test_usecase_generation_service.py,test_usecase_synthesis.py}`
5. Product and workflow docs
   - `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`
   - `docs/product/usecase-synthesis-model-policy.md`

## Findings

### 1. [P1] Removing deterministic authoring from the BA-facing Use Case product path is justified

- Claim: The current deterministic/scaffold authoring path is not a safe degraded mode for this
  product. It is producing artifacts that are worse than no artifact.
- Evidence:
  - `apps/api/app/usecases/deterministic_builder.py:75-165` generates fixed categories such as
    intake / execution / coordination / exception with heavily templated titles and objectives.
  - `apps/api/app/usecases/deterministic_builder.py:344` emits generic steps like
    `kiểm tra tính đầy đủ và ngữ cảnh ban đầu của thông tin đầu vào`.
  - The affected user-visible output was confirmed to come from this builder, not from successful AI
    synthesis.
- Impact: As a BA-facing output mode, deterministic authoring is actively harmful because it looks
  finished enough to invite review while containing little real business meaning.
- Direction: Replace incrementally. Remove deterministic authoring from the normal persisted Use
  Case generation path.

### 2. [P1] The current runtime and route contract still treats deterministic generation as a first-class product mode

- Claim: The codebase still models deterministic generation as a supported top-level user workflow,
  not merely an internal fallback.
- Evidence:
  - `apps/api/app/usecases/runtime.py:8-18` defines
    `deterministic | ai_shadow | ai_opt_in | ai_default` as the runtime contract.
  - `src/usecases/PersistedUseCaseWorkspace.tsx:1391-1420` still exposes `Theo rule (scaffold)` as
    a selectable generation preference.
  - `apps/api/app/routes/usecase_generate.py:41-58` returns a normal completed envelope even when
    the generation result is deterministic fallback.
  - `docs/use-cases/UC-07-sinh-usecase-tu-spec.md:47-105` still documents deterministic as a
    supported rollout mode and fallback builder as a normal path.
- Impact: Even if the team no longer trusts deterministic output, the runtime/UI/docs still teach
  developers and users to treat it as part of the intended product.
- Direction: Redesign interface. The product contract should become AI-only for authoring.

### 3. [P1] Removing all rule-based logic would be the wrong cut; the right cut is to remove rule-based authoring while keeping rule-based validation and hydration

- Claim: “Bỏ tất cả rule thủ công” is correct only for authoring, not for the whole pipeline.
- Evidence:
  - `apps/api/app/usecases/grounding.py` and `quality.py` are not authoring systems; they are guard
    layers that catch unsupported actors, weak boundaries, missing evidence, and other invalid AI
    output conditions.
  - `apps/api/app/usecases/hydrator.py` and schema validation establish stable IDs and contract
    shape after the model returns content.
  - If those layers are removed, nothing remains to stop fabricated actors, unsupported evidence
    refs, or malformed alternate-flow structure.
- Impact: Removing all rules would not make the product “more AI”; it would remove the safety rails
  that keep AI output reviewable and downstream-safe.
- Direction: Keep as-is for validation/hydration guardrails, while deleting deterministic authoring
  and user-facing rule mode.

### 4. [P1] The current orchestration conflates three very different outcomes: AI success, AI validation failure, and provider/runtime failure

- Claim: The generation service needs explicit outcome separation if the product is going AI-only.
- Evidence:
  - `apps/api/app/usecases/generation_service.py:44-88` and `212-225` currently route many failure
    cases into `_fallback(...)`.
  - `quality_rejected`, `provider_unavailable`, and `provider_failure` are all mapped back into a
    BA-facing deterministic draft instead of being surfaced as distinct non-success outcomes.
- Impact: In an AI-only product, these conditions must no longer produce a normal artifact payload.
  Otherwise the system will keep smuggling degraded output back into the main workflow.
- Direction: Refactor in place. Introduce explicit failed/degraded non-persistable generation
  outcomes.

### 5. [P2] Tests and docs currently encode the old mixed-mode worldview, so implementation will not hold unless that layer changes too

- Claim: The repo still has broad regression and documentation surface that assumes deterministic Use
  Case generation is legitimate.
- Evidence:
  - `apps/api/tests/test_usecase_generation_service.py:26-87` explicitly tests deterministic and
    shadow rule behavior as the expected contract.
  - `apps/api/tests/test_usecase_builder.py` still locks the deterministic builder copy patterns.
  - UI tests in `src/usecases/PersistedUseCaseWorkspace.test.tsx` and `UseCasePanel.test.tsx`
    still expect `Theo rule (scaffold)` and deterministic fallback badges.
  - `docs/use-cases/UC-07-sinh-usecase-tu-spec.md` still names deterministic as a first-class mode.
- Impact: If the product requirement changes to AI-only authoring, tests and docs will resist that
  change until they are deliberately rewritten.
- Direction: Consolidate duplication and rewrite the contract tests/docs around AI-only authoring.

## Recommended directions by module

1. Runtime contract and mode surface
   - Direction: Redesign interface
   - Reason: the user-facing contract should stop advertising deterministic authoring.

2. Generation orchestration
   - Direction: Refactor in place
   - Reason: success, validation rejection, and provider failure need separate outcome classes.

3. Deterministic authoring path
   - Direction: Replace incrementally
   - Reason: keep only the pieces that are still useful internally, such as artifact-chain helpers,
     and remove the rest from BA-facing generation.

4. AI output guardrails
   - Direction: Keep as-is
   - Reason: these rules are validators, not fake content generators.

5. Product/workflow docs and tests
   - Direction: Redesign interface
   - Reason: the repo still documents and tests the old mixed-mode worldview.

## Decision

Proceed with the product requirement change, but narrowly:

- Remove deterministic/rule-based **authoring** from Use Case generation.
- Keep rule-based **validation, grounding, schema, and hydration**.

That is the technically correct cut. Removing the former addresses the product problem. Removing the
latter would damage correctness without improving generation quality.
