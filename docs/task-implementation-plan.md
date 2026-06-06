# Task Implementation Plan

## Task Summary
- Task: Implement TASK-114 through TASK-123 for AI-backed use-case generation
- Requested by: User
- Date: 2026-06-06
- Affected modules: shared AI provider/config, prompt registry, use-case generation domain, API contract, workspace UI, tests and operational docs

## Goal Reconstruction
- Requested change: Replace the opaque deterministic-only use-case path with a versioned, grounded AI synthesis pipeline while retaining a reliable rule fallback.
- Intended outcome: Users can opt into richer AI-generated use cases, see exactly which source produced the draft, and continue working when the provider or output quality fails.
- Hidden assumptions: Existing diagram-ready `UseCaseDraft` contracts and deterministic IDs must remain stable; model output is untrusted; production cost and quality are not yet proven.

## Risk Assessment
- Decision: IMPLEMENT_WITH_GUARDRAILS
- Risk level: High
- Main concerns: Model hallucination can poison every downstream artifact; direct default rollout introduces latency/cost drift; provider-specific code and prompt text can become coupled to BRD; logging business input can leak sensitive data.
- Why this is safe or unsafe to implement as written: The architecture is sound only when deterministic generation remains the default/kill switch and AI output is rejected unless schema, grounding, and quality checks all pass.

## Guardrails
- Scope limits: Local version-controlled prompt registry; no prompt management database or external observability dependency in this phase.
- Required tests: Provider contract, prompt snapshots, hydrator, adversarial grounding, quality fixtures, mode matrix, API fallback/metadata, UI source labels, full regression.
- Rollout or migration notes: Default mode is `deterministic`; supported modes are `ai_shadow`, `ai_opt_in`, and `ai_default`; every AI failure returns the existing deterministic result.
- Observability notes: Emit prompt/model/source/status/count metadata only. Prompt bodies and business payloads remain excluded from logs by default.

## Execution Plan
- Files likely to change: `apps/api/app/ai/*`, `apps/api/app/usecases/*`, API routes/schemas/config, `src/usecases/*`, `src/App.tsx`, tests and canonical docs.
- Implementation steps:
  1. Introduce neutral provider/config and versioned prompt registry.
  2. Add semantic synthesis schema, deterministic hydrator, grounding, and quality gates.
  3. Add orchestration with bounded retry, deterministic fallback, shadow mode, and metadata.
  4. Connect the thin API route and truthful source/opt-in UI.
  5. Verify rollout modes and update operational/product documentation.
- Verification steps: Run API/UI/E2E suites, production build, and Browser desktop/mobile QA.

## Final Recommendation
- Proceed with guardrails.
- Rationale: The feature improves domain quality without sacrificing the stable existing workflow or hiding model uncertainty from users.
- Safer alternative: Keep deterministic-only generation if quality fixtures or live cost/latency thresholds do not justify enabling AI by default.

## Outcome
- Status: Done
- Implemented: TASK-114, TASK-115, TASK-118, TASK-119, TASK-120, TASK-121, TASK-116, TASK-122, TASK-117, TASK-123.
- Default rollout: `deterministic`; AI remains opt-in/flag controlled.
- Verification: provider/prompt/domain/API/UI suites, production build, Playwright flow and Browser QA.
