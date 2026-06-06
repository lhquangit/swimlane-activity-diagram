# Review Snapshot — TASK-114 to TASK-123

## Scope

- Date: 2026-06-06
- Reviewer: Codex (`senior-ai-reviewer`)
- Reviewed path: `ProjectSpec + FeatureIntent -> rollout policy -> prompt/provider -> AI semantic synthesis -> grounding/quality -> deterministic hydration/fallback -> workspace source label`
- Modules reviewed:
  - Shared AI config/provider boundary
  - Prompt registry
  - Use-case synthesis schema, grounding, quality, hydration, and orchestration
  - Use-case API route and response metadata
  - Frontend source label and generation preference UI
  - Unit, API, component, E2E, and live-smoke coverage
- Not reviewed:
  - Real OpenRouter output quality beyond existing live-smoke contract
  - Long-running production telemetry aggregation
  - Persistence/versioning of generated artifacts

## Executive Summary

TASK-114 through TASK-123 materially improve the use-case generation architecture. The implementation now has a neutral provider boundary, versioned prompts, server-owned IDs, deterministic fallback, source labels, rollout modes, and a test pyramid around the happy path. The default kill switch remains deterministic, which is the right operational posture for this phase.

The batch should not yet be treated as safe for `ai_default`. The highest-risk gap is that the grounding and quality gates prove only that evidence refs exist, not that important claims are supported by those refs. A fabricated business claim can pass both gates and be hydrated into a canonical `UseCaseDraft`. There are also two operational gaps: an invalid prompt version can crash the route before fallback, and the default route-level mock provider cannot execute an AI mock path.

## Module Map

| Module | Responsibility | Direction |
| --- | --- | --- |
| `apps/api/app/config.py` + `apps/api/app/ai/providers/*` | Shared AI provider/config, strict schema transport, usage metadata | Harden |
| `apps/api/app/ai/prompts/registry.py` | Versioned prompt artifacts and trust-boundary envelope | Keep, add config guards |
| `apps/api/app/usecases/synthesis_schema.py` + `hydrator.py` | Semantic model output and deterministic canonical ID hydration | Keep, add invariant tests |
| `apps/api/app/usecases/grounding.py` + `quality.py` | Evidence, actor, generic-output, duplicate-flow checks | Harden |
| `apps/api/app/usecases/generation_service.py` | Rollout policy, provider call, retry/fallback, metadata/telemetry | Harden |
| `apps/api/app/routes/usecase_generate.py` | Thin HTTP boundary for use-case generation | Keep, add mode tests |
| `src/usecases/*` + `src/App.tsx` | Generation preference, source badge, and review workspace | Keep |
| Tests/docs | Regression coverage, live smoke, operational guidance | Expand around negative AI paths |

## Findings

### 1. [P1, confirmed] Unsupported business claims can pass grounding and quality gates

- Evidence:
  - `validate_grounding()` only checks whether actors are in the allowed actor list and whether each `evidence_ref` key exists in the catalog; it does not compare the claim text to the referenced source content (`apps/api/app/usecases/grounding.py:63`).
  - `evaluate_synthesis()` checks duplicate titles/flows, short flows, weak objectives, and a small generic phrase list, but not unsupported approvals/rules/outcomes (`apps/api/app/usecases/quality.py:29`).
  - A probe changed a valid synthesized step to `Tự động phê duyệt yêu cầu dù thiết bị không còn trong kho.` while keeping `evidence_refs = ["feature.inputs.0"]`; grounding returned no issues and quality returned `passed`.
- Impact:
  - A model can invent a business rule, approval, or outcome, attach any valid evidence key, and still reach `hydrate_synthesis()`.
  - This violates the key TASK-121 acceptance criterion that actor/rule claims without source must not pass silently, and it weakens TASK-117 enough that `ai_default` would be unsafe.
- Recommendation:
  - Add deterministic unsupported-claim checks for high-risk terms such as approval, rejection, permission, integration, SLA, inventory, and payment unless source text contains matching support.
  - Require evidence coverage by field type: actor claims must reference participants/systems, constraints must reference rules/constraints, input/output claims must reference inputs/outputs.
  - Add adversarial fixtures where the model cites a real but unrelated evidence key.
- Confidence: Confirmed.

### 2. [P1, confirmed] Invalid prompt version bypasses fallback and can produce a 500

- Evidence:
  - `UseCaseGenerationService.generate()` calls `get_prompt("usecase_synthesis", settings.usecase_prompt_version)` before the provider/fallback try block (`apps/api/app/usecases/generation_service.py:69`).
  - `get_prompt()` raises `KeyError` for unknown prompt versions (`apps/api/app/ai/prompts/registry.py:97`).
  - A direct service probe with `usecase_prompt_version="404"` raised `KeyError 'Unknown prompt: usecase_synthesis@404'` instead of returning deterministic fallback metadata.
- Impact:
  - A bad `USECASE_PROMPT_VERSION` env value can take down `/api/usecases/generate` despite the design promise that AI failures fall back to deterministic output.
  - The frontend sees a hard generation failure instead of a truthful `Bản nháp theo rule` result.
- Recommendation:
  - Treat prompt lookup/config errors as `provider_unavailable` or a dedicated `prompt_unavailable` fallback reason.
  - Add route/service tests for unknown prompt version, invalid provider name, and missing provider key.
- Confidence: Confirmed.

### 3. [P2, confirmed] Route-level mock use-case provider cannot execute an AI mock path

- Evidence:
  - The default service provider factory calls `build_provider(provider_name, settings)` without a `mock_payload_factory` (`apps/api/app/usecases/generation_service.py:40`).
  - `build_provider("mock", ...)` raises when `mock_payload_factory` is absent (`apps/api/app/ai/providers/factory.py:18`).
  - A direct service probe with `usecase_provider="mock"` and `usecase_generation_mode="ai_default"` returned deterministic fallback with `fallback_reason="provider_unavailable"` and `attempt_count=0`.
- Impact:
  - Local mock mode cannot exercise `ai_shadow`, `ai_opt_in`, or `ai_default` through the real route without injecting a custom service in tests.
  - This leaves a gap between the TASK-115 acceptance criterion that mock and OpenRouter execute through the shared interface and the production route wiring.
- Recommendation:
  - Provide a deterministic semantic mock payload factory for use-case synthesis at service construction time, or explicitly disallow `USECASE_PROVIDER=mock` for AI modes with startup validation.
  - Add route tests that prove mock AI returns `generation_source="ai"` in `ai_default` and deterministic output in `ai_shadow`.
- Confidence: Confirmed.

### 4. [P2, inferred] Rollout/eval coverage is too permissive to justify `ai_default`

- Evidence:
  - The live use-case smoke accepts either `generation_source in {"ai", "deterministic_fallback"}` and only bounds cost if reported (`apps/api/tests/test_live_smoke.py:180`).
  - Golden quality tests mutate a two-step base payload and assert `passed` for three domains, but do not verify evidence coverage, branch quality, fallback rate, latency percentile, or reviewed snapshots (`apps/api/tests/test_usecase_synthesis.py:154`).
  - Documentation correctly says `ai_default` should wait for quality/fallback/latency/cost thresholds, but there is no executable threshold report in the reviewed batch.
- Impact:
  - `ai_default` can be enabled by config before the project has a measurable quality baseline.
  - A live provider that consistently falls back can still satisfy the current smoke suite.
- Recommendation:
  - Add an eval report test/command that records quality status, fallback reason, latency, cost, and source per fixture.
  - Gate `ai_default` operationally with an explicit checklist or config validation flag until the report meets documented thresholds.
- Confidence: Inferred from coverage and docs; confirming requires running a live fixture set with a production model.

## Module Directions

### Shared AI provider/config

- Current state: The neutral provider boundary is a good incremental replacement for BRD-specific provider code.
- Main risks: mock AI path is not executable through default use-case route wiring; config errors are handled unevenly.
- Recommended direction: Harden.
- Why now: The provider layer is now shared infrastructure, so small config gaps can affect both BRD and use-case generation.

### Prompt registry

- Current state: Prompt ID/version/fingerprint and untrusted JSON envelope are solid foundations.
- Main risks: unknown versions crash use-case generation before fallback.
- Recommended direction: Keep, add config guards.
- Why now: Prompt versioning is valuable only if rollback/config mistakes fail closed into fallback instead of 500.

### Semantic synthesis and hydration

- Current state: Model output is correctly kept away from server-owned technical IDs.
- Main risks: hydration relies on upstream grounding/quality to reject unsupported semantics.
- Recommended direction: Keep, add invariant tests.
- Why now: The ID and reference boundary is mostly right; the next risk is semantic truthfulness, not ID determinism.

### Grounding and quality

- Current state: Useful first-pass checks exist, but they are not strong enough for safety-critical rollout.
- Main risks: unrelated evidence refs can bless fabricated claims; quality checks focus on generic phrasing rather than trace coverage.
- Recommended direction: Harden.
- Why now: This is the main blocker before any AI-default rollout.

### Use-case generation service

- Current state: Rollout modes, retry, metadata, and deterministic fallback are coherent for normal provider failures.
- Main risks: prompt lookup errors bypass fallback; mock mode cannot exercise AI route path; eval gating is not executable.
- Recommended direction: Harden.
- Why now: The orchestration layer is the right owner for safe fallback and rollout enforcement.

### Frontend source UX

- Current state: The source badge and preference controls make the generated source visible and truthful.
- Main risks: The UI can only surface backend metadata; it cannot compensate for backend quality gaps.
- Recommended direction: Keep.
- Why now: No frontend blocker was found in this scope.

## Recommended Execution Order

1. TASK-124 — enforce claim-to-evidence grounding for high-risk business facts.
2. TASK-125 — make prompt/provider configuration failures return deterministic fallback instead of route failure.
3. TASK-126 — add an executable mock AI route path and mode matrix tests.
4. TASK-127 — make rollout quality/cost/fallback thresholds executable before `ai_default`.

## Verification

- `cd apps/api && python3 -m pytest tests/test_usecase_generation_service.py tests/test_usecase_synthesis.py tests/test_usecase_routes.py -q` — 21 tests passed.
- Direct service probes confirmed:
  - `USECASE_PROVIDER=mock` + `ai_default` currently falls back with `provider_unavailable`.
  - unknown prompt version raises `KeyError`.
  - unrelated evidence refs can pass grounding and quality for an unsupported approval claim.
