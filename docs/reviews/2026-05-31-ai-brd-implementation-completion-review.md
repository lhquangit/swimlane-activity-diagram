# AI BRD Implementation Completion Review

- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-31
- Scope: current AI BRD implementation after `TASK-019` / `TASK-020` / `TASK-021`
- Reviewed paths:
  - `apps/api/app/routes/*`
  - `apps/api/app/services/*`
  - `apps/api/app/providers/*`
  - `apps/api/app/idempotency.py`
  - `apps/api/tests/*`
  - `src/App.tsx`
  - `src/brd/*`
  - `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`
  - `docs/product/ai-brd-description-feature.md`

## Module Map

1. `frontend-brd-orchestration`
   - `src/App.tsx`, `src/brd/client.ts`, `src/brd/BrdPanel.tsx`
   - Chịu trách nhiệm lấy graph, gọi backend, quản lý idempotency key, hiển thị panel, cho phép edit/export draft.
2. `frontend-semantic-normalization`
   - `src/brd/normalize.ts`
   - Chuyển graph editor thành `DiagramSemanticRequest` trước khi gọi backend.
3. `backend-route-contracts`
   - `apps/api/app/routes/brd_validate.py`, `apps/api/app/routes/brd_generate.py`, `apps/api/app/runtime_contract.py`, `apps/api/app/idempotency.py`, `apps/api/app/rate_limit.py`
   - Áp schema-version, rate limit, idempotency, response envelope.
4. `backend-deterministic-pipeline`
   - `apps/api/app/services/extract.py`, `normalize.py`, `validate.py`, `interpret.py`, `render.py`, `postcheck.py`
   - Phần semantic cốt lõi quyết định độ đúng của BRD.
5. `provider-integration`
   - `apps/api/app/providers/*`, `apps/api/app/config.py`
   - Nối OpenRouter/mock provider vào pipeline.
6. `tests-and-verification`
   - `apps/api/tests/*`, `src/brd/*.test.ts*`
   - Mock-path test coverage cho routes, pipeline, normalize, panel UI.

## Findings

### [P1] Failed or blocking `/generate` requests poison the idempotency key until TTL expiry

- Evidence:
  - `idempotency_store.begin()` creates `state="in_progress"` and only `complete()` transitions it to terminal state in [apps/api/app/idempotency.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/idempotency.py:36).
  - `/generate` returns early for `422 blocking`, `503 provider unavailable`, and `502/503 provider error` without closing that state in [apps/api/app/routes/brd_generate.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/routes/brd_generate.py:112), [apps/api/app/routes/brd_generate.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/routes/brd_generate.py:149), [apps/api/app/routes/brd_generate.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/routes/brd_generate.py:191).
  - The frontend explicitly reuses the same `Idempotency-Key` on retry in [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1188) and UC-06 requires this in [docs/use-cases/UC-06-sinh-brd-tu-diagram.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-06-sinh-brd-tu-diagram.md:82).
- Impact:
  - A retry after timeout/provider failure can get stuck in `202 in_progress` until TTL instead of making forward progress.
  - This breaks the intended retry semantics for the core generate flow.
- Direction: Harden.

### [P1] Post-check still treats valid branch targets as unknown unless they appear in `main_flow_steps`

- Evidence:
  - `postcheck_spec()` builds `seen_node_ids` only from `spec.main_flow_steps` in [apps/api/app/services/postcheck.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/postcheck.py:9).
  - Every branch outcome whose target is not in that subset is flagged as `BRANCH_TARGET_UNKNOWN` in [apps/api/app/services/postcheck.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/postcheck.py:20).
  - But the pipeline explicitly models `branches` separately from `main_flow` in [docs/product/ai-brd-description-feature.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/product/ai-brd-description-feature.md:241), so a branch target may be valid without being on the preferred main path.
- Impact:
  - Valid alternate branch nodes can be reported as hallucinations.
  - This weakens trust in warnings and makes the “post-check against invented outcome” guard too noisy.
- Direction: Redesign interface.

### [P2] Sticky-note semantics from UC-06 are still only lane-based, not proximity-based

- Evidence:
  - Validation marks a note as non-orphan as long as any non-note node exists in the same lane, regardless of distance, in [apps/api/app/services/validate.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/validate.py:69).
  - Interpretation then sends every note directly into `annotations` plus a generic assumption in [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:133), [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:164).
  - UC-06 expects `global_note` vs `anchored_note` behavior for notes that are not near a step in [docs/use-cases/UC-06-sinh-brd-tu-diagram.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-06-sinh-brd-tu-diagram.md:70).
- Impact:
  - The current BRD can miss the difference between a note attached to a concrete step and a note that is just a loose assumption.
  - This is not fatal for generation, but it leaves a semantic hole exactly where BA clarification often lives.
- Direction: Refactor in place.

### [P2] Parallel-flow semantics are still too shallow for `sync-bar`

- Evidence:
  - Each `sync-bar` is rendered as a generic parallel block with `join_node_id=None` and a stock description in [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:111).
  - The product doc defines `sync-bar` as the semantic for “parallel fork/join” in [docs/product/ai-brd-description-feature.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/product/ai-brd-description-feature.md:221).
- Impact:
  - The feature can mention that there is parallelism, but it still cannot explain where parallel work starts, where it joins, or which paths belong to the same block with confidence.
  - This is the biggest remaining semantic gap after main-flow traversal was fixed.
- Direction: Harden.

## Module Directions

### frontend-brd-orchestration

- Current state: The panel flow is usable and the editable draft path works.
- Risk: Retry behavior is coupled to backend idempotency semantics, so route-level mistakes surface directly to the user.
- Direction: Keep as-is, then harden around retry/regenerate UX once backend idempotency is fixed.

### frontend-semantic-normalization

- Current state: Lane boundary inference is much safer than before.
- Risk: There is still no local pre-validation pass matching UC-06 step 3, so every issue is discovered only after a network call.
- Direction: Harden.

### backend-route-contracts

- Current state: Schema-version, rate limit, and envelope structure are in place.
- Risk: Non-success idempotency lifecycle is incomplete.
- Direction: Harden first; this is the highest-leverage fix now.

### backend-deterministic-pipeline

- Current state: Main flow is now graph-aware and rendering is stable.
- Risk: Post-check traceability and note/parallel semantics still underfit the doc contract.
- Direction: Refactor in place.

### provider-integration

- Current state: OpenRouter strict-schema path is scaffolded correctly for Phase 1.
- Risk: It remains unproven until live smoke runs with a real key.
- Direction: Harden, then verify live.

### tests-and-verification

- Current state: Mock-path unit/integration/component coverage is decent.
- Risk: The current suite does not cover poisoned idempotency retries, valid non-main-flow branch targets, or full browser E2E.
- Direction: Expand coverage, not rewrite it.

## Recommended Next Work

### Now

1. Fix idempotency lifecycle for failed/blocking `/generate` results.
2. Redesign post-check traceability so valid branch targets outside the main path do not false-positive.
3. Add regression tests for both cases above.

### Next

1. Implement note anchoring/global-note semantics by proximity.
2. Improve `sync-bar` interpretation so parallel blocks carry real fork/join meaning.
3. Add browser E2E for `Generate BRD -> retry -> edit draft -> outdated`.

### Later

1. Run live OpenRouter smoke and close the remaining `TASK-021` gap.
2. Add a small eval/golden-set lane once semantics above are stable.
