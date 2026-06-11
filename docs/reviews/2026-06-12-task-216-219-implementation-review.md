# Review `TASK-216` to `TASK-219` implementation

Date: 2026-06-12
Reviewer: Codex
Scope: truthful use-case generation runtime, deterministic scaffold labeling, deeper quality gate, and domain-grade acceptance goldens

## Module map

1. Backend generation runtime and orchestration
   - `apps/api/app/usecases/{runtime.py,generation_service.py}`
2. Persistence/API contract
   - `apps/api/app/{schemas/persistence.py,services/persistence_serializers.py}`
3. Persisted Use Case UI
   - `src/{persistence/types.ts,usecases/PersistedUseCaseWorkspace.tsx}`
4. Legacy Use Case UI copy parity
   - `src/usecases/UseCasePanel.tsx`
5. Quality gate and goldens
   - `apps/api/app/usecases/quality.py`
   - `apps/api/tests/{test_usecase_generation_service.py,test_usecase_synthesis.py}`

## Findings

### 1. [P1] Persisted Use Case UI now fails open if the new runtime field is absent

- Claim: The review target was to make generation mode truthful before click, but the persisted UI
  falls back to showing AI-oriented choices whenever `usecase_generation_runtime` is missing.
- Evidence:
  - Backend and frontend both declare `usecase_generation_runtime` as optional in
    `FeatureIntentResource` at
    `apps/api/app/schemas/persistence.py:148` and `src/persistence/types.ts:46`.
  - `buildGenerationOptions()` treats `null` runtime as `ai_default`, which shows `Theo hệ thống`
    and `Ưu tiên AI` again in `src/usecases/PersistedUseCaseWorkspace.tsx:1391-1405`.
  - The new UI regression only covers an injected runtime-present case in
    `src/usecases/PersistedUseCaseWorkspace.test.tsx:564-585`.
  - Persistence API tests that already assert feature metadata do not assert the new runtime field
    at `apps/api/tests/test_persistence_auth_matrix.py:281-378`.
- Impact: The exact user-facing failure that `TASK-216` was meant to fix can silently return if the
  serializer regresses, an older API payload is served, or a future refactor forgets this field.
- Recommendation: Fail closed. When runtime is missing, hide AI-specific choices and surface a
  neutral “Không xác định được khả năng AI” note until the API contract is present. Also add
  persistence endpoint tests that assert the runtime descriptor is always returned.
- Confidence: Confirmed.

### 2. [P1] The new trace-based quality gate validates coverage across the whole portfolio, not per use case

- Claim: `TASK-218` deepened the quality gate, but the new input/output/constraint trace checks are
  aggregated across the entire synthesis. One well-grounded use case can therefore mask another
  weak use case in the same portfolio.
- Evidence:
  - `evaluate_synthesis()` builds one shared `evidence_refs` set across every use case at
    `apps/api/app/usecases/quality.py:93-102`.
  - The new `MISSING_INPUT_TRACE`, `MISSING_OUTPUT_TRACE`, and `MISSING_CONSTRAINT_TRACE` checks
    then run once against that aggregate at `apps/api/app/usecases/quality.py:104-136`.
  - The acceptance goldens cover fully good portfolios and one fully bad scaffold fixture, but do
    not include a mixed portfolio where one use case is grounded and another is not, in
    `apps/api/tests/test_usecase_synthesis.py:263-280`.
- Impact: A portfolio can still pass while containing extra use cases that are semantically weak but
  piggyback on evidence supplied by another stronger use case. That undermines the stated goal of
  rejecting schema-valid but unusable drafts.
- Recommendation: Add per-use-case grounding-quality checks for required business traces, then add a
  mixed-portfolio regression fixture where only one use case is properly grounded.
- Confidence: Confirmed by code path; mixed-portfolio exploit is an inference from that logic.

## Module directions

### Backend generation runtime and orchestration
- Current state: better than before; runtime truthfulness exists and fallback language is clearer.
- Main risks:
  - truthfulness still depends on optional API transport
  - runtime decision is serialized through a global config singleton
- Recommended direction: Harden
- Why now: the behavioral fix is in place, but one contract regression could re-open the same
  misleading UX immediately.
- Near-term actions:
  - make runtime contract mandatory on persisted feature resources
  - add API contract tests for feature list/detail endpoints

### Persistence/API contract
- Current state: structurally simple, but under-tested for the new runtime field.
- Main risks:
  - missing response-field regression coverage
- Recommended direction: Harden
- Why now: the UI logic now depends on this field for safe behavior.
- Near-term actions:
  - extend persistence auth/chain tests to assert `usecase_generation_runtime`

### Persisted Use Case UI
- Current state: user-facing copy is much more honest.
- Main risks:
  - fail-open behavior when runtime is absent
- Recommended direction: Refactor in place
- Why now: one small fallback decision currently decides whether the UX stays truthful.
- Near-term actions:
  - switch null-runtime fallback to conservative mode
  - add UI regression for missing-runtime payloads

### Legacy Use Case UI copy parity
- Current state: labels now match the scaffold wording.
- Main risks:
  - none significant in this review scope
- Recommended direction: Keep as-is

### Quality gate and goldens
- Current state: substantially improved, but still portfolio-level for new trace checks.
- Main risks:
  - mixed portfolios can hide bad use cases
- Recommended direction: Harden
- Why now: this is the last gap between “portfolio looks better” and “every artifact is actually
  reviewable”.
- Near-term actions:
  - move required trace checks to per-use-case evaluation
  - add mixed good/bad fixture coverage
