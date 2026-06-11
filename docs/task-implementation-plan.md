# Task Implementation Plan

## Task Summary
- Task: Implement TASK-229 through TASK-233 for AI-only Use Case authoring
- Requested by: Codex using senior-ai-developer
- Date: 2026-06-12
- Affected modules: `apps/api/app/ai/prompts`, `apps/api/app/config.py`,
  `apps/api/tests/{test_prompt_registry.py,test_usecase_generation_service.py,test_usecase_synthesis.py,fixtures/usecase_synthesis_quality/*}`,
  `docs/{product/usecase-synthesis-model-policy.md,use-cases/UC-07-sinh-usecase-tu-spec.md,review-task-list.md,progress/changelog.md,activity-log/2026-06.md}`

## Goal Reconstruction
- Requested change: Remove deterministic/scaffold authoring from the BA-facing `Use Case`
  experience, stop returning scaffold fallback portfolios when AI fails, keep validation guardrails,
  and rewrite product/docs/UI copy around AI-only authoring.
- Intended outcome: Use Case generation either returns an AI-authored, guardrail-validated
  portfolio or fails clearly without overwriting persisted artifacts.
- Hidden assumptions:
  - We can improve quality materially without redesigning the entire generation pipeline.
  - The safest immediate lever is stronger prompt + stronger default model + better acceptance
    coverage, not a wide new orchestration stage.
  - Historical prompt versions must stay registered for backward compatibility, while new work can
    promote a newer default version.

## Risk Assessment
- Decision: IMPLEMENT_WITH_GUARDRAILS
- Risk level: Medium
- Main concerns:
  - Persistence and route tests currently rely on deterministic generation to avoid networked AI
    calls, so they need stable mock AI authoring instead of old fallback assumptions.
  - Runtime truthfulness, API contracts, and UI copy must all change together or the repo will keep
    advertising scaffold behavior indirectly.
  - Removing authoring fallback must not accidentally remove schema/grounding/quality/hydration
    guardrails that keep downstream artifacts safe.
- Why this is safe or unsafe to implement as written: The direction is correct if we remove only
  deterministic **authoring** while preserving deterministic **validation/contract enforcement**.

## Guardrails
- Scope limits:
  - Keep the existing AI synthesis + validation pipeline.
  - Do not delete grounding, quality, schema, or hydration layers.
  - Keep legacy metadata readable so persisted degraded drafts from old contracts can still render.
- Required tests:
  - Generation-service regressions for AI-only preference, unavailable runtime, provider/auth
    failure, and quality rejection.
  - Persistence auth/chain regressions using mock AI authoring instead of deterministic fallback.
  - Persisted/legacy Use Case UI regressions for AI-only copy and unavailable/failure states.
- Rollout or migration notes:
  - Internal runtime flags such as `deterministic` and `ai_shadow` still exist, but they now mean
    “authoring unavailable” rather than “return scaffold”.
  - Legacy persisted `deterministic_fallback` metadata can still exist historically, so the UI must
    frame it as degraded old output rather than a current generation choice.

## Execution Plan
- Files likely to change:
  - `apps/api/app/usecases/{generation_service.py,runtime.py,artifact_chain.py}`
  - `apps/api/app/{routes/usecase_generate.py,routes/persistence.py,services/persistence_generation.py,services/persistence_serializers.py,schemas/persistence.py,schemas/usecase.py,services/usecase_builder.py}`
  - `apps/api/tests/{test_usecase_generation_service.py,test_usecase_routes.py,test_persistence_auth_matrix.py,test_persistence_chain.py,test_live_smoke.py}`
  - `src/{usecases/PersistedUseCaseWorkspace.tsx,usecases/UseCasePanel.tsx,usecases/types.ts,usecases/prevalidate.ts,persistence/types.ts,App.tsx}`
  - `docs/{use-cases/UC-07-sinh-usecase-tu-spec.md,product/usecase-synthesis-model-policy.md,review-task-list.md,progress/known-issues.md,progress/changelog.md,activity-log/2026-06.md}`
- Implementation steps:
  1. Rewrite backend and persisted-route tests to expect AI-only generation success or explicit
     failed envelopes instead of scaffold fallback.
  2. Remove deterministic generation preference from request/response/UI contracts and simplify
     runtime states to `available / degraded / unavailable`.
  3. Make generation service fail closed on provider/config/auth failures and quality rejection.
  4. Remove production imports of deterministic authoring helpers while keeping validation
     guardrails intact.
  5. Rewrite BA-facing copy/docs to describe AI-only authoring plus failure states.
  6. Update tracking docs after verification.
- Verification steps:
  1. Run focused backend tests for generation service, routes, and persistence auth/chain.
  2. Run focused UI tests for persisted and legacy Use Case screens.
  3. Run `npm run build`.
  4. Run `git diff --check`.

## Final Recommendation
- Proceed with guardrails
- Rationale: The product direction is right: scaffold output is not acceptable as a BA artifact.
  The safe cut is to remove deterministic authoring while preserving deterministic validation.
- Safer alternative: keep the old fallback only in internal tooling, never in BA-facing persisted
  generation. That alternative is intentionally not chosen for the product surface.
