# AI BRD Implementation Readiness Review

- Date: 2026-05-31
- Reviewer: Codex
- Scope: AI BRD feature vừa implement (`apps/api`, `src/brd`, `src/App.tsx`) + mock test layer
- Reviewed by execution order:
  - frontend orchestration
  - backend routes/runtime
  - semantic pipeline
  - provider adapter
  - tests/tooling

## Review scope

### Entrypoints reviewed

- `src/App.tsx`
- `src/brd/client.ts`
- `apps/api/app/main.py`
- `apps/api/app/routes/brd_validate.py`
- `apps/api/app/routes/brd_generate.py`

### Modules reviewed

1. `ai-brd-frontend-flow`
2. `ai-brd-backend-runtime`
3. `ai-brd-core-pipeline`
4. `ai-brd-provider-live`
5. `ai-brd-test-pyramid`

### Modules not deeply reviewed

- Existing lane/LogicFlow editor modules outside the BRD integration path
- Railway deployment manifests / CI jobs, because they are not in repo yet

## Executive summary

- Overall health: Vertical slice mock-first đã chạy được, nhưng chưa đủ điều kiện để coi feature là hoàn thiện.
- Highest-risk area: semantic interpretation hiện chưa bám topology thật của graph.
- Fastest high-value win: sửa `interpret_request()` để sinh `main_flow_steps` theo traversal thật thay vì theo tọa độ.
- Merge/readiness verdict: phù hợp cho internal mock demo và tiếp tục phát triển; chưa nên coi là done cho real BRD generation.

## Findings

### [P1] `main_flow_steps` hiện được suy từ tọa độ canvas, không phải từ graph topology

- Claim: Backend đang mô tả "luồng chính" bằng thứ tự `y/x` của node thay vì đi theo edge từ `start`.
- Evidence:
  - `apps/api/app/services/interpret.py:22-26` tạo `main_flow_nodes` bằng sort `(y, x, id)`.
  - `apps/api/app/routes/brd_generate.py:114-124` đưa `interpreted["main_flow_nodes"]` vào deterministic/mock spec.
  - `docs/use-cases/UC-06-sinh-brd-tu-diagram.md:33-37` mô tả Step 4 là interpret graph để ra structure nghiệp vụ.
- Impact: Diagram có branch, parallel path, hoặc node rời vẫn có thể sinh BRD "mượt" nhưng sai logic. Đây là lỗi correctness ở lõi feature.
- Recommendation: thay `main_flow_nodes` bằng traversal bắt đầu từ `start`, tách node reachable khỏi branch/parallel/disconnected nodes, và thêm regression tests cho topology không trùng với vị trí canvas.
- Confidence: Confirmed.

### [P1] Frontend semantic normalization đang che mất lỗi node ngoài lane

- Claim: Node đặt lệch lane vẫn có thể được auto-map vào lane gần nhất, nên backend không còn cơ hội block đúng.
- Evidence:
  - `src/brd/normalize.ts:25-34` dùng `inferLaneId()` theo khoảng cách tới tâm lane gần nhất.
  - `apps/api/app/services/validate.py:32-41` chỉ block khi `lane_id` bị thiếu.
- Impact: Actor mapping, handoff, và main-flow ownership trong BRD có thể sai mà user không hề thấy blocking issue.
- Recommendation: chỉ infer lane nếu node nằm trong span lane hợp lệ; nếu mơ hồ hoặc nằm ngoài lane thì trả `undefined` để backend block.
- Confidence: Confirmed.

### [P1] Live provider path chưa khớp contract Phase 1 đã chốt

- Claim: Mock path ổn, nhưng nhánh live hiện mới là scaffold, chưa match contract đã ghi trong docs.
- Evidence:
  - `apps/api/app/routes/brd_validate.py:18-21` nhận `X-Schema-Version` nhưng không enforce.
  - `apps/api/app/config.py:18-21` có `BRD_REQUEST_RATE_LIMIT`, nhưng runtime không dùng nó.
  - `apps/api/app/providers/openrouter_provider.py:33-37` dùng `response_format: {"type": "json_object"}` thay vì strict schema mode như doc.
  - `apps/api/app/routes/brd_generate.py:145-180` chưa có controlled retry và đang hard-code `estimated_cost_usd = 0.08`.
  - `docs/product/ai-brd-description-feature.md:463-467`, `docs/product/ai-brd-description-feature.md:534-587`, `docs/scope/architecture-brd-backend.md:112-130` đã chốt strict output, rate-limit, retry, và status contract rõ hơn.
- Impact: Nếu merge với kỳ vọng "generate thật qua OpenRouter" thì feature vẫn chưa hoàn thiện về correctness, operability, và cost observability.
- Recommendation: coi `TASK-016` là chưa đủ; bổ sung enforcement schema version, rate limit, bounded retry, strict structured output, và metadata cost/attempt thật trước khi gọi là done.
- Confidence: Confirmed.

### [P2] `postcheck_spec()` đang bỏ lọt branch target không trace được

- Claim: Guard cuối cho branch target gần như không bắt được case target có giá trị nhưng không trace được về flow.
- Evidence:
  - `apps/api/app/services/postcheck.py:20-29` dùng điều kiện `if outcome.target_node_id not in seen_node_ids and not outcome.target_node_id:`
  - Điều kiện này chỉ đúng khi target vừa "không thuộc seen set" vừa "rỗng/falsy", nên target sai nhưng non-empty sẽ lọt qua.
- Impact: Khi live model bắt đầu sinh spec thật, hallucinated outcome target hoặc stale node reference có thể qua post-check và đi thẳng vào BRD draft.
- Recommendation: đổi condition thành check riêng cho `target_node_id not in seen_node_ids`, rồi thêm regression test cho target lạ.
- Confidence: Confirmed.

## Module directions

### 1. `ai-brd-frontend-flow`

- Current state: UI flow generate/preview/edit draft đã usable.
- Main risks:
  - semantic normalize đang quá "helpful" nên che lỗi layout
  - frontend flow vẫn phụ thuộc backend để phát hiện gần như toàn bộ semantic issue
- Recommended direction: Harden
- Why now: frontend hiện là trust-shaping layer trước khi dữ liệu vào backend; normalize sai sẽ làm cả pipeline sai sạch sẽ.
- Near-term actions:
  - sửa lane inference theo boundary
  - thêm browser E2E mock flow
  - cân nhắc prevalidation tối thiểu đúng như UC-06

### 2. `ai-brd-backend-runtime`

- Current state: routes rõ ràng, envelope/idempotency mock path chạy ổn.
- Main risks:
  - contract docs chưa được enforce đầy đủ ở runtime
  - live path chưa có guard operational quan trọng
- Recommended direction: Harden
- Why now: runtime là nơi promise của docs trở thành behavior thật; nếu để lệch lâu, frontend và docs sẽ drift nhanh.
- Near-term actions:
  - enforce `X-Schema-Version`
  - implement rate limit
  - nâng live metadata/retry lên đúng contract

### 3. `ai-brd-core-pipeline`

- Current state: có khung extract/normalize/validate/interpret/render/postcheck, nhưng phần interpret vẫn còn placeholder-grade.
- Main risks:
  - main flow sai semantics
  - postcheck guard chưa đủ để bảo vệ traceability
- Recommended direction: Refactor in place
- Why now: đây là lõi giá trị của feature; nếu chưa đúng semantic, phần UI/provider/test phía trên chỉ đang làm đẹp cho output sai.
- Near-term actions:
  - graph traversal thật cho main flow
  - explicit handling cho disconnected nodes
  - strengthen postcheck cho outcome/traceability

### 4. `ai-brd-provider-live`

- Current state: adapter gọi được OpenRouter về mặt skeleton.
- Main risks:
  - chưa strict structured output
  - chưa retry bounded
  - cost/attempt metadata chưa thật
- Recommended direction: Harden
- Why now: đây là ranh giới từ mock sang production usefulness; không nên mở live traffic trước khi path này bám contract.
- Near-term actions:
  - strict schema output
  - controlled retry
  - live smoke với key thật

### 5. `ai-brd-test-pyramid`

- Current state: mock test layer đã có giá trị và chạy được.
- Main risks:
  - chưa có browser E2E local app flow
  - chưa có regression fixture cho semantic corner cases lớn nhất
- Recommended direction: Keep as-is rồi mở rộng
- Why now: nền test đã đúng hướng; chỉ cần bù đúng khoảng trống có leverage cao.
- Near-term actions:
  - thêm E2E mock flow
  - thêm topology fixtures cho interpret/postcheck

## Recommended task updates

Đã thêm các task sau vào `docs/review-task-list.md`:

- `TASK-019` — traversal thật cho `main_flow_steps`
- `TASK-020` — bỏ lane inference kiểu nearest-center
- `TASK-021` — khóa live-provider contract theo doc
- `TASK-022` — sửa `postcheck_spec()` cho branch target

## Review verdict

Không, phần code vừa implement **chưa hoàn thiện** nếu tiêu chí là "feature generate BRD đúng semantic và đủ contract để dùng live".  

Nó đã đạt:

- mock-first vertical slice usable
- UI flow generate/review/edit draft ổn
- backend/runtime/test scaffold hợp lý

Nhưng chưa đạt:

- semantic correctness cho main flow
- reliable lane ownership inference
- live-provider contract completeness
- đầy đủ post-check traceability guard
