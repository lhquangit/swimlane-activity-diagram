# Review why Use Case output is still poor even when the user selects AI

Date: 2026-06-12
Reviewer: Codex
Scope: persisted `Use Case` generation quality on the current local AI-enabled environment

## Module map

1. Runtime and configuration
   - `apps/api/app/config.py`
   - `apps/api/.env`
2. Use Case generation orchestration
   - `apps/api/app/usecases/generation_service.py`
3. Prompt and synthesis constraints
   - `apps/api/app/ai/prompts/assets/usecase_synthesis/1.1.0/system.md`
4. Quality gate and acceptance coverage
   - `apps/api/app/usecases/quality.py`
   - `apps/api/tests/test_usecase_synthesis.py`

## Findings

### 1. [P1] In the current local env, `Ưu tiên AI` is not the fix because the server is already in `ai_default`

- Claim: The problem is no longer “AI path not selected”. The local backend is already configured to
  prefer AI for Use Case generation.
- Evidence:
  - `apps/api/.env` now contains `USECASE_PROVIDER=openrouter`,
    `USECASE_GENERATION_MODE=ai_default`, and
    `USECASE_MODEL_PRIMARY=openai/gpt-5.4-mini`.
  - The generation service attempts AI whenever mode is `ai_default` unless the user explicitly
    chooses deterministic, at `apps/api/app/usecases/generation_service.py:50-61` and
    `apps/api/app/usecases/generation_service.py:294-299`.
- Impact: The poor result the user is seeing is not explained by runtime-mode truthfulness anymore.
  It means the AI path itself is still underperforming.
- Recommendation: Treat this as an AI synthesis quality problem, not a mode-selection bug.
- Confidence: Confirmed.

### 2. [P1] The current Use Case prompt is still too high-level for hard business segmentation

- Claim: The prompt protects schema legality and actor grounding, but it does not force a stronger
  planning step for splitting one feature into reviewable business use cases with real boundaries.
- Evidence:
  - The prompt emphasizes structured JSON, actor preservation, evidence refs, and avoiding filler in
    `apps/api/app/ai/prompts/assets/usecase_synthesis/1.1.0/system.md:8-30`.
  - It does not provide worked examples, a decomposition rubric for “when to split into separate use
    cases vs keep one flow”, or counterexamples of outputs that are too broad but still schema-valid.
- Impact: A small or mid-capability model can still generate outputs that are technically valid,
  grounded, and non-filler, but remain too coarse to be useful for BA review.
- Recommendation: Strengthen the prompt with explicit segmentation heuristics, negative examples,
  and a short internal planning contract before schema emission.
- Confidence: Confirmed.

### 3. [P1] The configured Use Case model is a `mini` tier, while the task still expects high semantic planning

- Claim: The current local Use Case model choice is a plausible contributor to weak output quality.
- Evidence:
  - `apps/api/.env` uses `USECASE_MODEL_PRIMARY=openai/gpt-5.4-mini`.
  - The service uses exactly `settings.usecase_model` for synthesis at
    `apps/api/app/usecases/generation_service.py:112-117`.
  - There is no second-pass critic, reranker, or planner model in the Use Case pipeline.
- Impact: The pipeline currently asks one relatively small model pass to do business decomposition,
  actor grounding, flow design, alternate-flow design, and evidence mapping in one shot.
- Recommendation: Evaluate a stronger primary model for Use Case synthesis or add a second-pass
  planning/critique stage before acceptance.
- Confidence: Inferred but strong.

### 4. [P2] The quality gate is stricter than before, but it still judges “too generic” better than “not actually useful for a BA”

- Claim: The gate now rejects obvious weak outputs, but it still does not assert enough about
  business usefulness for arbitrary domains.
- Evidence:
  - The gate checks generic boundary phrases, duplicate flows, short flows, weak objectives, trace
  coverage, and technical actor coverage in `apps/api/app/usecases/quality.py:104-178`.
  - Acceptance tests cover several curated good/bad fixtures in
    `apps/api/tests/test_usecase_synthesis.py:214-302`, but they still represent a small set of
    domains and structural patterns.
- Impact: AI outputs can pass the gate while still feeling “not useful enough” on real product
  domains that are not yet represented in the golden suite.
- Recommendation: Add more golden domains from real user complaints and encode stronger BA-facing
  acceptance checks.
- Confidence: Confirmed on code scope; broader domain miss is inferred from coverage shape.

## Recommended direction

- Runtime/config: Keep as-is
- Generation orchestration: Harden
- Prompt/design: Refactor in place
- Quality/acceptance: Harden

The current issue is no longer “the wrong path ran”. We have crossed that line. The remaining gap
is that the AI path is still not good enough for the job. That means the next fixes should focus on
prompt structure, model policy, and domain-grade acceptance criteria rather than more UI truthfulness
work.
