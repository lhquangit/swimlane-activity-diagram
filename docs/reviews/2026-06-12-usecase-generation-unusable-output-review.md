# Review: Why Current Use-Case Output Is Unusable

- Date: 2026-06-12
- Reviewer: Codex (`senior-ai-reviewer`)
- Scope: current persisted and API-backed `Use Case` generation quality
- Reviewed modules:
  - `generation-config`: `apps/api/app/config.py`, `apps/api/.env.example`, local `apps/api/.env`
  - `generation-orchestration`: `apps/api/app/routes/usecase_generate.py`, `apps/api/app/usecases/generation_service.py`
  - `deterministic-fallback`: `apps/api/app/usecases/deterministic_builder.py`
  - `synthesis-contract`: `apps/api/app/usecases/synthesis_schema.py`, `apps/api/app/usecases/hydrator.py`
  - `quality-and-grounding`: `apps/api/app/usecases/grounding.py`, `apps/api/app/usecases/quality.py`
  - `user-facing-request-path`: `src/usecases/PersistedUseCaseWorkspace.tsx`
  - `tests`: `apps/api/tests/{test_usecase_generation_service.py,test_usecase_synthesis.py,test_usecase_builder.py}`
- Not reviewed in this pass:
  - live provider output samples from production/staging traces
  - prompt/provider cost tuning beyond use-case synthesis

## Executive Summary

- The main reason the current output feels unusable is that the system is still structurally biased
  toward rule-based generation, not domain-aware synthesis.
- In the current repo state, the backend defaults to `USECASE_GENERATION_MODE=deterministic`, and
  the local API env I inspected contains no `USECASE_*` override. That means the server can ignore
  the user's AI intent entirely and still return a completed response.
- When deterministic generation runs, it does not reason about the business procedure. It assembles
  1-4 canned use-case families from shallow heuristics and fixed step templates.
- The quality gate is too weak to reject many outputs that are schema-valid but operationally
  useless to a BA.
- The tests mostly prove fallback mechanics, counts, and structural legality. They do not enforce
  a business-quality bar high enough for "usable" output.

## Module Map

| Module | Responsibility | Direction |
| --- | --- | --- |
| `generation-config` | Decide whether use-case synthesis even attempts AI | Harden immediately |
| `generation-orchestration` | Select AI vs fallback, run quality gate, return metadata | Redesign interface truthfully |
| `deterministic-fallback` | Produce a stable non-AI draft when AI is unavailable or disabled | Keep as fallback only |
| `synthesis-contract` | Enforce strict structured legality | Keep |
| `quality-and-grounding` | Reject unsupported actors/evidence and obviously generic output | Harden substantially |
| `user-facing-request-path` | Let user choose generation mode and understand what actually happened | Harden immediately |
| `tests` | Prove output is not just legal, but useful enough to continue to diagram | Replace incrementally with stronger goldens |

## Findings

### 1. [P1, confirmed] The UI offers AI-oriented generation modes, but the backend can ignore them and stay deterministic

- Evidence:
  - The persisted route exposes `Theo hệ thống`, `Ưu tiên AI`, and `Theo rule` in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:337).
  - Backend config defaults `USECASE_GENERATION_MODE` to `deterministic` in
    [apps/api/app/config.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/config.py:85).
  - The example env also recommends `USECASE_GENERATION_MODE=deterministic` and `USECASE_PROVIDER=mock`
    in [apps/api/.env.example](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/.env.example:11).
  - The generation service explicitly short-circuits AI whenever `mode == "deterministic"` in
    [apps/api/app/usecases/generation_service.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/usecases/generation_service.py:304).
  - In the local API env I inspected for this review, there are no `USECASE_*` overrides present,
    so the config default is what wins.
- Impact:
  - A user can choose `Ưu tiên AI` and still receive deterministic fallback output.
  - The product then looks like "AI is bad" when the system may not have attempted AI at all.
- Recommendation:
  - Make the server mode truthful in UI before generation starts.
  - If the server is hard-pinned to deterministic, disable/hide AI-oriented options instead of
    accepting them and silently downgrading.
- Confidence: Confirmed.

### 2. [P1, confirmed] The deterministic builder is too generic to be a primary generation path

- Evidence:
  - The builder assembles a small fixed family of use-case types: intake, execution, coordination,
    and exception in
    [apps/api/app/usecases/deterministic_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/usecases/deterministic_builder.py:88).
  - Titles and objectives are largely fixed string templates derived from `primary_actor` and
    `feature_name`, for example `thực hiện xử lý chính`, `phối hợp actor và hệ thống`, and
    `xử lý ngoại lệ` in
    [apps/api/app/usecases/deterministic_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/usecases/deterministic_builder.py:93).
  - The main-flow content itself is canned. Representative examples include:
    - `mở thông tin chi tiết cần xử lý`
    - `xử lý tín hiệu, dữ liệu, hoặc suy luận kỹ thuật cần thiết`
    - `xác nhận kết quả xử lý và cập nhật`
    in [apps/api/app/usecases/deterministic_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/usecases/deterministic_builder.py:220).
  - Segmentation depends on keyword/count heuristics such as `tiếp nhận`, `đồng bộ`, `ngoại lệ`,
    number of actors, and number of outputs in
    [apps/api/app/usecases/deterministic_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/usecases/deterministic_builder.py:287).
- Impact:
  - Output can be structurally neat while still saying almost nothing domain-specific.
  - Different business problems collapse into the same 4-step narrative with light word
    substitution.
- Recommendation:
  - Keep this builder only as explicit fallback, baseline, or scaffold.
  - Do not treat its output as acceptable default production content for BA review.
- Confidence: Confirmed.

### 3. [P1, confirmed] The quality gate is too shallow to reject many unusable drafts

- Evidence:
  - Current quality checks only cover duplicated titles, duplicated main flows, too-short flows,
    weak objectives, generic filler ratio, and missing technical actor coverage in
    [apps/api/app/usecases/quality.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/usecases/quality.py:29).
  - The gate does not evaluate whether:
    - the chosen use-case boundaries are meaningful,
    - the steps are materially different across use cases,
    - inputs/outputs/constraints are actually reflected in the procedure,
    - alternate flows represent real business decision points rather than template exceptions.
- Impact:
  - A synthesis can pass the gate while still being useless for diagramming or BRD authoring.
  - The system currently treats "schema-valid and not obviously duplicated" as close to "good".
- Recommendation:
  - Add business-specific acceptance checks, not just anti-garbage checks.
  - Score semantic specificity and trace actual use of input signals, not only actor coverage.
- Confidence: Confirmed.

### 4. [P2, confirmed] The tests mostly validate legality and fallback mechanics, not business usefulness

- Evidence:
  - `test_usecase_generation_service.py` focuses on source metadata, fallback reasons, retries, and
    prompt versioning in
    [apps/api/tests/test_usecase_generation_service.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/test_usecase_generation_service.py:25).
  - `test_usecase_builder.py` primarily checks count, category, actor preservation, and whether
    outputs affect template text in
    [apps/api/tests/test_usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/test_usecase_builder.py:27).
  - `test_usecase_synthesis.py` validates one synthetic "good" payload and a few narrow rejection
    cases, but not whether generated use cases are actually usable for realistic BA review in
    [apps/api/tests/test_usecase_synthesis.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/test_usecase_synthesis.py:10).
- Impact:
  - The suite can stay green while the user-facing artifact quality is still unacceptable.
  - The tests are currently better at protecting the pipeline contract than protecting product
    usefulness.
- Recommendation:
  - Add domain goldens with reviewable expected semantics, not just expected counts and categories.
  - Separate "legal output" from "acceptable output" in the test strategy.
- Confidence: Confirmed.

### 5. [P2, confirmed] Source labeling exists, but it is still too easy to miss the fact that the draft came from rules

- Evidence:
  - The route does render a source badge and note in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:1353).
  - However, the only visible distinction is a compact badge like `Bản nháp theo rule`; the
    pre-generation controls still invite `Ưu tiên AI` in the same surface in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:337).
- Impact:
  - Users can miss the source explanation and blame the AI path for a draft that never used AI.
- Recommendation:
  - Surface the effective server mode before generation and make deterministic-only mode a blocking
    warning, not a passive post-hoc badge.
- Confidence: Confirmed.

## Module Directions

### generation-config
- Current state: defaults point the product toward deterministic generation.
- Recommended direction: Harden immediately.

### generation-orchestration
- Current state: the service is technically honest in metadata, but not honest enough in the
  interactive contract.
- Recommended direction: Redesign interface truthfully.

### deterministic-fallback
- Current state: useful as a safe fallback and baseline, not as a primary experience.
- Recommended direction: Keep as fallback only.

### quality-and-grounding
- Current state: enough to reject obviously invalid output, not enough to guarantee usable output.
- Recommended direction: Harden substantially.

### tests
- Current state: strong on structural legality, weak on business usefulness.
- Recommended direction: Replace incrementally with domain goldens and acceptance thresholds.

## Task Creation Decision

Created four follow-up backlog items in `docs/review-task-list.md`:

- `TASK-216` for truthful server-mode and AI-option gating in the Use Case UI
- `TASK-217` for demoting the deterministic builder from primary generation to explicit scaffold/fallback
- `TASK-218` for strengthening use-case quality gates beyond anti-generic heuristics
- `TASK-219` for domain-grade acceptance goldens that measure usability, not just legality
