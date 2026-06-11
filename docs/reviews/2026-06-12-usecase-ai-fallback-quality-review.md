# Review why the current persisted Use Case output is still unusable

Date: 2026-06-12
Reviewer: Codex
Scope: persisted `Use Case` generation quality for the feature `Luồng tích điểm cho thú cưng`

## Module map

1. Runtime/config and provider availability
   - `apps/api/app/config.py`
   - `apps/api/app/usecases/runtime.py`
   - `apps/api/.env`
2. Use Case generation orchestration
   - `apps/api/app/usecases/generation_service.py`
   - `apps/api/app/routes/usecase_generate.py`
   - `apps/api/app/services/persistence_generation.py`
3. Deterministic fallback builder
   - `apps/api/app/usecases/deterministic_builder.py`
   - `apps/api/tests/test_usecase_builder.py`
4. Persisted metadata and UI disclosure
   - `apps/api/app/services/persistence_serializers.py`
   - `apps/api/app/schemas/persistence.py`
   - `src/usecases/PersistedUseCaseWorkspace.tsx`

## Findings

### 1. [P1] The exact nonsense text the user sees is coming from the deterministic scaffold builder, not from the strengthened AI prompt

- Claim: The phrases the user quoted are direct deterministic-builder templates.
- Evidence:
  - `apps/api/app/usecases/deterministic_builder.py:93` emits the title pattern
    `"{primary_actor} tiếp nhận và khởi tạo xử lý {feature_label}"`.
  - `apps/api/app/usecases/deterministic_builder.py:344` emits the step text
    `"{primary_actor} kiểm tra tính đầy đủ và ngữ cảnh ban đầu của thông tin đầu vào."`
  - Those same strings are also locked into the deterministic builder tests in
    `apps/api/tests/test_usecase_builder.py:20`.
- Impact: The current artifact is not evidence that prompt `1.2.0` or stronger model policy failed
  semantically. It is evidence that the system stored the fallback scaffold.
- Recommendation: Treat the current bug as a fallback-handling failure first, then quality work
  second.
- Confidence: Confirmed.

### 2. [P1] This feature’s latest persisted generation metadata proves the backend fell back instead of returning AI output

- Claim: For the affected feature, the latest saved generation is deterministic fallback after a
  provider failure.
- Evidence:
  - Direct database inspection of feature `050456c2-8c76-4735-823d-63f7ce2fcaae`
    (`Luồng tích điểm cho thú cưng`) showed:
    - `generation_source='deterministic_fallback'`
    - `fallback_reason='provider_failure'`
    - `provider='openrouter'`
    - `model='openai/gpt-5.4-mini'`
    - `prompt_version='1.2.0'`
    - `attempt_count=2`
  - This metadata shape is persisted from `UseCaseGenerationService.generate()` via
    `apps/api/app/services/persistence_generation.py:56`.
- Impact: The system is currently saving a generic scaffold as the canonical portfolio even when the
  user expects AI output.
- Recommendation: Do not overwrite persisted `UseCaseDraft[]` with deterministic scaffold when the
  AI path fails for auth/provider reasons.
- Confidence: Confirmed.

### 3. [P1] The live provider is failing authentication, and the service currently converts that into a silent scaffold fallback

- Claim: The OpenRouter credentials for this local environment are not working for Use Case
  generation, and the service handles that by silently falling back.
- Evidence:
  - Direct live provider replay with the persisted feature input returned:
    `OpenRouter HTTP 401: {"error":{"message":"User not found.","code":401}}`
  - In `apps/api/app/usecases/generation_service.py:212-225`, non-validation provider failures end
    as `fallback_reason='provider_failure'`, after which `_fallback()` returns scaffold output.
  - `apps/api/app/routes/usecase_generate.py:41-58` always returns a completed envelope when the
    service falls back, so the caller receives a normal-looking artifact payload rather than a hard
    failure.
- Impact: The product currently turns an AI authentication failure into a BA-facing artifact that
  looks like “generated content,” which is exactly why the user experiences this as childish or
  nonsensical output instead of as an operational failure.
- Recommendation: Provider auth/config failures must fail closed for AI-requested generation. The
  user should see an actionable error, not a saved scaffold portfolio.
- Confidence: Confirmed.

### 4. [P1] The runtime truthfulness layer is still too shallow because it only checks whether a key exists, not whether the provider session is valid

- Claim: The UI can still advertise AI availability when the credentials are present but invalid.
- Evidence:
  - `apps/api/app/usecases/runtime.py:35-41` treats OpenRouter as available if an API key string is
    present.
  - It does not validate the key against the provider or remember recent auth failures.
  - That means the persisted feature runtime can still present `ai_default` UX while the live
    provider actually returns `401 User not found.`
- Impact: The user sees AI options and reasonably assumes AI is running, even though the request is
  doomed to fall back.
- Recommendation: Add a provider-health/auth-status layer to the runtime descriptor so the UI can
  distinguish “key configured” from “provider authenticated and usable.”
- Confidence: Confirmed.

### 5. [P2] The persisted Use Case UI currently downplays fallback reasons and presents scaffold output as a normal draft state

- Claim: Even after persistence, the UI messaging is too weak to tell the user that the artifact is
  a degraded fallback caused by provider failure.
- Evidence:
  - `src/usecases/PersistedUseCaseWorkspace.tsx:1360-1366` collapses deterministic fallback into
    the general note `Bản nháp hiện tại được tạo theo scaffold rule.`
  - The component does not surface `fallback_reason`, so provider auth failure is invisible at the
    point of review.
- Impact: Users spend time reviewing meaningless fallback artifacts instead of fixing the real
  blocker or choosing an intentional deterministic draft.
- Recommendation: Surface provider/auth fallback reasons prominently and mark fallback drafts as
  degraded output, not just another source badge.
- Confidence: Confirmed.

## Recommended direction by module

1. Runtime/config and provider availability
   - Direction: Harden
   - Reason: key-presence checks are not enough for truthful AI runtime signaling.

2. Generation orchestration
   - Direction: Refactor in place
   - Reason: non-retryable provider failures should not flow into normal persisted artifact saves.

3. Deterministic fallback builder
   - Direction: Replace incrementally
   - Reason: current scaffold text is too generic to be reviewed as a business artifact. It should
     either become an explicitly minimal starter skeleton or leave the BA-facing flow entirely when
     AI was expected.

4. Persisted metadata and UI disclosure
   - Direction: Harden
   - Reason: fallback status and provider failure cause need to be visible before the user wastes
     review effort.

## Bottom line

The user’s complaint is correct.

This is not a case where the newly strengthened AI prompt produced slightly weak content. The
current persisted artifact is deterministic fallback scaffold caused by a provider authentication
failure, and the system still lets that scaffold masquerade as a normal generated portfolio.
