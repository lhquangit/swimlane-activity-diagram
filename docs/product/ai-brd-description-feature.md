# AI BRD Description Feature

## 1. Mục tiêu

Sinh bản mô tả nghiệp vụ dạng BRD draft từ swimlane activity diagram đã được người dùng vẽ, theo cách:

1. đúng logic flow của diagram,
2. có traceability từ BRD quay về node/edge gốc,
3. giảm hallucination bằng pipeline normalize + validate + post-check,
4. đủ chất lượng để BA review và hoàn thiện nhanh, không định vị là “final BRD” ngay từ bản đầu.

Feature này mở rộng giá trị “diagram-as-code” của dự án: diagram không chỉ để vẽ và export, mà còn trở thành nguồn sinh tài liệu nghiệp vụ có kiểm soát.

## 2. Người dùng mục tiêu

| Vai trò | Mục tiêu |
|---|---|
| BA / Solution Engineer | Sinh BRD draft nhanh từ diagram đã chốt logic cơ bản |
| Operation Lead / QA | Review lại main flow, branch, exception, handoff giữa actor |
| Stakeholder nội bộ | Đọc bản mô tả quy trình ở dạng văn bản dễ chia sẻ hơn SVG/PNG |

## 3. Scope và Out-of-scope

### In scope cho Phase 1

- 1 diagram -> 1 BRD draft
- Output mặc định bằng **tiếng Việt**
- Input lấy từ graph JSON hiện có của editor
- Generate:
  - structured semantic spec
  - BRD markdown draft
- Cho phép user **chỉnh sửa trực tiếp BRD draft output**
- Có validate trước khi generate
- Có ambiguity / warning list để user review
- Có traceability từ mỗi section/step về node id liên quan

### Out-of-scope cho Phase 1

- Nhiều diagram trong cùng một BRD
- Workflow approval / comment / collaborative editing cho BRD
- Auto-publish sang Word / Google Docs native
- Realtime co-edit BRD giữa nhiều user
- Full multilingual output trong cùng một lần generate
- Guarantee thay thế hoàn toàn BA review thủ công

## 4. Quyết định sản phẩm chính

### 4.1. Output dùng mô hình 2 tầng

Không generate trực tiếp prose tự do từ raw diagram. Feature này luôn đi qua 2 tầng:

1. **Canonical structured spec**
2. **Rendered BRD draft**

Structured spec là nguồn chân lý trung gian để:

- kiểm tra tính đúng,
- giảm hallucination,
- hỗ trợ regenerate từng section về sau,
- giữ traceability node -> text.

### 4.2. MVP là VN-first

Repo hiện theo nguyên tắc `VN-first UI` ở [docs/roadmap/README.md](../roadmap/README.md). Vì vậy:

- Phase 1: output BRD mặc định là **tiếng Việt**
- Nếu diagram chứa thuật ngữ tiếng Anh, hệ thống giữ nguyên term quan trọng khi cần
- Phase 2 mới mở rộng chọn ngôn ngữ output EN/VN

### 4.3. Backend dùng Python + FastAPI

Decision đã chốt:

- frontend **không gọi trực tiếp** OpenRouter/provider API
- mọi AI generation đi qua **FastAPI backend**

Lý do:

- tránh lộ API key,
- gom quản lý key/quota/usage về một lớp gateway tập trung,
- dễ áp policy privacy/logging/rate limit,
- phù hợp cho validate, retry, eval, caching, và provider abstraction về sau.

### 4.4. Không dùng ảnh/screenshot làm input chính ở Phase 1

Input chính cho model là **semantic graph đã normalize**, không phải screenshot canvas.

Ảnh diagram chỉ nên là fallback debug artifact hoặc công cụ QA nội bộ, không phải nguồn đầu vào mặc định cho generation.

### 4.5. Output là “draft cần review”

System luôn gắn trạng thái:

- `Draft`
- `Needs review`
- `Warnings present` hoặc `No blocking warnings`

Không gọi output là BRD chính thức ở Phase 1.

## 5. Luồng người dùng đề xuất

### Main flow

1. User hoàn thiện diagram.
2. User bấm `Generate BRD` trên toolbar.
3. App chạy validate sơ bộ trên diagram.
4. Nếu có lỗi blocking, app không cho generate và hiển thị danh sách lỗi.
5. Nếu pass, frontend gửi normalized graph sang FastAPI backend.
6. Backend tạo:
   - structured semantic spec
   - BRD markdown draft
   - warnings / assumptions / open questions
7. Frontend mở panel preview:
   - tab `Warnings`
   - tab `Structured spec`
   - tab `BRD Draft`
8. User review, chỉnh sửa BRD draft, rồi export theo surface phù hợp:
   - standalone editor: export markdown hoặc copy nội dung.
   - persisted workspace: chỉnh trực tiếp trên tài liệu hiển thị và export DOCX thật.
9. Nếu user đóng panel, app vẫn giữ last BRD snapshot trong frontend cache để có thể mở lại mà không generate mới.

### Alternate flows

- Diagram mơ hồ -> vẫn generate draft nhưng buộc hiển thị `open_questions`
- Diagram có cycle / unlabeled decision / orphan note -> generate với warning rõ ràng
- Model fail / timeout -> backend trả trạng thái lỗi có thể retry
- User reset / import diagram khác sau khi đã có draft -> cache cũ được giữ nhưng phải hiển thị `Outdated` khi reopen

## 6. UX đề xuất

### Entry point

- Thêm nút `Generate BRD` trên toolbar chính của editor

### Kết quả hiển thị

- Standalone editor tiếp tục dùng **right-side panel** thay vì modal
- Persisted workspace dùng **reader-first artifact page** thay cho popup/panel
- Standalone panel có 3 tab:
  1. `Warnings`
  2. `Structured Spec`
  3. `BRD Draft`

### Chính sách chỉnh sửa output

Phase 1 cho phép:

- standalone editor: user chỉnh sửa **BRD Draft** trong text area / markdown editor
- persisted workspace: user chỉnh sửa trực tiếp trên rendered document surface bằng block-aware
  inline editor; canonical value vẫn là `markdown_content`
- user **không chỉnh sửa trực tiếp canonical structured spec** ở Phase 1
- app lưu **một last BRD snapshot** ở frontend cache (`localStorage`) cho standalone workspace hiện tại
- user có thể dùng `Open last BRD draft` để mở lại snapshot đã cache hoặc `Discard cached BRD` để xoá thủ công

Lý do:

- BRD draft là lớp trình bày, hợp để BA chỉnh ngôn ngữ cho nhanh
- structured spec là canonical layer để giữ traceability và consistency
- nếu cho sửa cả 2 ngay từ Phase 1, nguy cơ lệch giữa semantic source và prose rất cao
- frontend cache giúp giữ continuity trước khi có database, nhưng vẫn phải gắn với policy `Outdated` để tránh nhầm draft cũ với diagram mới

Phase 2 có thể mở thêm:

- `Edit structured spec with validation`
- `Regenerate section from edited spec`

### Tại sao chọn side panel

- user vẫn nhìn được diagram khi review kết quả,
- thuận lợi cho traceability và highlight node liên quan,
- hợp với Phase 2 khi regenerate từng section.

### Trạng thái generate

- loading step-by-step:
  - validating
  - interpreting
  - generating spec
  - rendering BRD
- nếu backend trả progress events thì panel cập nhật tiến trình; nếu chưa có streaming thì vẫn hiển thị step status tuần tự.

## 7. Kiến trúc tổng quát

### 7.1. Frontend responsibilities

Frontend chịu trách nhiệm:

- lấy graph JSON từ LogicFlow
- normalize sơ bộ từ editor schema sang request schema
- gọi FastAPI backend
- render warnings / spec / BRD
- cho user chỉnh sửa BRD draft trong panel hoặc inline document surface tùy mode
- cho user export markdown hoặc DOCX theo route hiện tại

### 7.2. FastAPI responsibilities

FastAPI chịu trách nhiệm:

- xác thực request và rate limit
- validate semantic graph
- interpret graph thành canonical structure
- gọi model AI qua provider adapter
- chạy post-check
- trả kết quả chuẩn hóa về frontend

### 7.3. Provider strategy

Phase 1 chọn **OpenRouter** làm gateway/provider layer chính:

- backend chỉ giữ **OpenRouter API key**
- model được route qua OpenRouter bằng model slug dạng `openai/gpt-5.5`
- việc quản lý usage/quota/key rotation nên tập trung ở OpenRouter workspace / organization

Tuy vậy backend vẫn phải có lớp abstraction:

- `LLMProvider`
- `GenerationService`
- `ValidationService`

để sau này có thể đổi gateway/provider hoặc self-hosted model mà không sửa contract frontend.

## 8. Pipeline xử lý chuẩn

### Step 1. Extract

- lấy graph JSON
- đọc lane, node, edge, note, metadata liên quan

### Step 2. Normalize

Chuyển graph editor thành semantic graph ổn định:

- lane -> actor
- activity -> action step
- decision -> branch point
- sync-bar -> parallel fork/join
- note -> annotation
- edge -> transition

### Step 3. Validate

Kiểm tra các điều kiện:

- có ít nhất 1 start và 1 end
- decision edge có label hay không
- sync-bar có topology hợp lệ hay không
- node có orphan hay không
- graph có cycle hay không
- note có anchor hợp lệ hay không

### Step 4. Interpret

Tạo canonical spec từ graph:

- main flow
- decisions
- branches
- handoffs
- parallel blocks
- loops
- assumptions
- ambiguities

### Step 5. Generate structured spec

Model chỉ được sinh theo schema cố định.

### Step 6. Render BRD draft

Render từ structured spec sang markdown theo template đã chọn bằng code/template deterministic.

### Step 7. Post-check

Rule-based checks sau generation:

1. không có actor lạ ngoài lane
2. không có step không map được về node
3. decision không được tự bịa outcome nếu edge không có label
4. mọi warning blocking phải xuất hiện trong output review

## 9. Semantic model đề xuất

### 9.1. Input graph semantic schema

Frontend gửi lên backend một payload semantic, không gửi raw LF object nguyên khối.

```ts
type DiagramSemanticRequest = {
  diagram_id?: string;
  diagram_name: string;
  language: 'vi';
  lanes: Array<{
    id: string;
    title: string;
    order: number;
  }>;
  nodes: Array<{
    id: string;
    type: 'start' | 'activity' | 'decision' | 'sync-bar' | 'end' | 'note';
    lane_id?: string;
    text?: string;
    x: number;
    y: number;
    metadata?: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source_node_id: string;
    target_node_id: string;
    label?: string;
  }>;
};
```

### 9.2. Quy tắc semantic quan trọng

- `lane -> actor` là mapping chuẩn xuyên suốt
- `handoff` = transition giữa 2 node thuộc 2 lane khác nhau
- `parallel block` = segment bắt đầu ở sync-bar fork và kết thúc ở sync-bar join
- `decision unlabeled` = ambiguity, không được tự map thành `Có/Không`
- `cycle` = không ép topo sort tuyệt đối; phải detect loop và ghi vào `loops[]`

### 9.3. Sticky note policy

Phase 1 chọn policy đơn giản, an toàn:

- note **không được coi là step chính**
- note được map vào 1 trong 2 loại:
  - `anchored_note` nếu có thể gắn với node gần nhất trong cùng lane và trong ngưỡng khoảng cách
  - `global_note` nếu không anchor được
- note chỉ ảnh hưởng tới:
  - `assumptions`
  - `annotations`
  - `open_questions`

note không được dùng để tạo action step mới nếu không có node flow tương ứng.

## 10. Canonical structured spec

Structured spec là output chuẩn nội bộ của pipeline.

```ts
type DiagramBRDSpec = {
  metadata: {
    diagram_name: string;
    source_language: 'vi';
    generated_language: 'vi';
    generated_at: string;
    generator_model: string;
    generator_version: string;
  };
  summary: string;
  actors: Array<{
    lane_id: string;
    actor_name: string;
    responsibilities?: string[];
  }>;
  main_flow_steps: Array<{
    step_id: string;
    node_id: string;
    actor_lane_id?: string;
    actor_name?: string;
    description: string;
  }>;
  branches: Array<{
    decision_node_id: string;
    decision_text: string;
    outcomes: Array<{
      label?: string;
      target_node_id: string;
      status: 'labeled' | 'unlabeled';
    }>;
  }>;
  parallel_blocks: Array<{
    fork_node_id: string;
    join_node_id?: string;
    lane_ids: string[];
    description: string;
  }>;
  handoffs: Array<{
    from_actor: string;
    to_actor: string;
    source_node_id: string;
    target_node_id: string;
  }>;
  loops: Array<{
    node_ids: string[];
    note: string;
  }>;
  annotations: string[];
  assumptions: string[];
  open_questions: string[];
  warnings: Array<{
    code: string;
    severity: 'info' | 'warning' | 'blocking';
    message: string;
    related_node_ids?: string[];
  }>;
};
```

## 11. Format BRD output

### 11.1. Default export template cho Phase 1

Phase 1 render markdown theo template reader-facing, dễ review:

1. Process overview
2. Business objective
3. Scope
4. Actors
5. Main workflow
6. Decision logic
7. Parallel activities
8. Handoffs
9. Exceptions / warnings
10. Context / assumptions / open questions

Quy tắc map nội dung cho Phase 1:

- `loops[]` -> render trong `Exceptions / warnings`
- `annotations[]` -> render trong `Context / assumptions / open questions`

Phase 1 không tạo section riêng tên `Loops` hoặc `Annotations`.

Quy tắc reader-facing cho Phase 1:

- `Scope` ưu tiên mô tả trigger, điểm bắt đầu xử lý, điểm kết thúc chính, và phạm vi bao phủ; số actor / số bước chỉ là metadata phụ.
- `Actors` hiển thị tên actor kèm responsibilities khi hệ thống suy diễn đủ rõ.
- `Main workflow` dùng format mở rộng theo từng bước: heading + `Đầu vào / kích hoạt`, `Mục đích`, `Thực hiện`, `Kết quả mong đợi`.
- `template=default` không kèm `Appendix A. Traceability (debug)` trong bản export reader-facing.

### 11.2. Full template cho Phase 2

Phase 2 bổ sung template đầy đủ hơn cho enterprise:

1. Document metadata
2. Process overview
3. Business objective
4. In-scope / out-of-scope
5. Preconditions
6. Trigger
7. Roles and responsibilities
8. Main process flow
9. Branches and decision logic
10. Parallel activities
11. Handoffs

Trong implementation hiện tại của Phase 1, `template=full` được dùng như debug export mode để giữ `Appendix A. Traceability (debug)` khi QA / dev cần đối chiếu lại với diagram gốc.
12. Postconditions / outputs
13. Business rules inferred from labels
14. Exceptions / failure handling
15. Assumptions
16. Open questions

### 11.3. Quyết định về template

Structured spec là canonical data model duy nhất.

Template ngắn và template đầy đủ chỉ là **hai cách render khác nhau** từ cùng một nguồn dữ liệu. Cách này tốt hơn việc duy trì hai data model song song.

## 12. Model strategy đề xuất

### 12.1. Model chính

Phase 1 khuyến nghị:

- **Primary synthesis**: `openai/gpt-5.5`
- **Operational / lower-cost tasks**: `openai/gpt-5.4-mini`

### 12.2. Cách dùng

- `openai/gpt-5.5`:
  - generate canonical structured spec
- `openai/gpt-5.4-mini`:
  - hỗ trợ các task AI phụ trợ ở Phase 2 như regenerate section hoặc rewrite có kiểm soát

### 12.3. Integration policy

- gọi model qua backend FastAPI
- backend gọi model qua OpenRouter thay vì giữ từng upstream provider key riêng
- dùng structured output / JSON schema strict nếu model/provider route hỗ trợ
- pin model snapshot ở implementation phase để tránh drift
- không hard-code frontend vào tên model cụ thể
- ở Phase 1, model chỉ sinh **canonical structured spec**
- BRD markdown được render deterministically từ structured spec bằng code/template, không gọi model thêm lần 2
- Phase 1 ưu tiên quản lý key/quota thủ công trong OpenRouter workspace; automation bằng Management API là option cho Phase 2 nếu cần provisioning/rotation theo môi trường

### 12.4. Không khuyến nghị

- tránh generate prose trực tiếp từ raw diagram JSON trong một pass
- không dùng model nhỏ duy nhất cho toàn bộ pipeline nếu mục tiêu là BRD chất lượng cao

## 13. API contract đề xuất

### 13.1. Response envelope chung cho Phase 1

Mọi response từ backend nên dùng envelope nhất quán:

```json
{
  "request_id": "req_01abc...",
  "status": "ok",
  "schema_version": "2026-05-31",
  "warnings": [],
  "blocking_issues": [],
  "result": {},
  "error": null,
  "metadata": {}
}
```

Quy ước:

- `request_id`: id duy nhất cho mỗi request backend nhận được
- `status`: trạng thái ngắn gọn để frontend quyết định UI flow
- `schema_version`: version của contract response
- `warnings[]`: semantic warning không block generation
- `blocking_issues[]`: issue khiến request không thể tiếp tục
- `result`: payload thành công của endpoint
- `error`: object lỗi khi request fail ở mức transport/runtime/provider
- `metadata`: thông tin kỹ thuật như latency, model, attempt count, estimated cost

### `POST /api/brd/validate`

Input: `DiagramSemanticRequest`

Output:

```json
{
  "request_id": "req_...",
  "status": "ok | blocking",
  "schema_version": "2026-05-31",
  "warnings": [],
  "blocking_issues": [],
  "result": {
    "normalized_summary": {
      "lane_count": 3,
      "node_count": 18,
      "edge_count": 17
    }
  },
  "error": null,
  "metadata": {
    "latency_ms": 420
  }
}
```

Status codes:

- `200 OK`: request parse được và validate semantic đã chạy xong; có thể là `status = ok` hoặc `status = blocking`
- `400 Bad Request`: JSON/body/header sai contract, thiếu field bắt buộc, hoặc `X-Schema-Version` không hỗ trợ
- `429 Too Many Requests`: vượt rate limit Phase 1
- `500 Internal Server Error`: lỗi nội bộ ngoài dự kiến trong pipeline deterministic

Policy:

- Diagram có vấn đề nghiệp vụ như thiếu start/end, decision unlabeled, orphan note... **không dùng 4xx transport-level**; backend vẫn trả `200` với `status = blocking` hoặc `status = ok` kèm `warnings[]`
- `validate` không cần `Idempotency-Key`

### `POST /api/brd/generate`

Input:

- `DiagramSemanticRequest`
- template: `default` | `full`
- header `Idempotency-Key` là bắt buộc ở Phase 1

Output:

```json
{
  "request_id": "req_...",
  "status": "completed | replayed | in_progress | blocking | conflict | failed",
  "schema_version": "2026-05-31",
  "warnings": [],
  "blocking_issues": [],
  "result": {
    "spec": {},
    "brd_markdown": "# BRD Draft",
    "draft_status": "Draft",
    "review_status": "Needs review"
  },
  "error": null,
  "metadata": {
    "provider": "openrouter",
    "model": "openai/gpt-5.5",
    "attempt_count": 1,
    "latency_ms": 12400,
    "estimated_cost_usd": 0.08
  }
}
```

Status codes:

- `200 OK`: generate hoàn tất hoặc replay thành công; `status = completed | replayed`
- `202 Accepted`: request cùng `Idempotency-Key` đang được xử lý; `status = in_progress`
- `400 Bad Request`: body/header sai contract, template không hỗ trợ, thiếu `Idempotency-Key`
- `409 Conflict`: cùng `Idempotency-Key` nhưng payload khác; `status = conflict`
- `422 Unprocessable Entity`: diagram parse được nhưng đang có blocking issue; `status = blocking`, không gọi model
- `429 Too Many Requests`: vượt rate limit
- `502 Bad Gateway`: provider timeout, provider trả invalid structured output sau retry, hoặc upstream fail; `status = failed`, `error.retryable = true`
- `503 Service Unavailable`: backend chưa có `BRD_OPENROUTER_API_KEY` hoặc provider bị disable tạm thời; `status = failed`

Policy:

- `generate` được phép tự chạy validate semantic lại ở backend; frontend không phải là trust boundary duy nhất
- `generate` chỉ gọi model sau khi pipeline deterministic xác nhận không còn blocking issue
- `metadata.estimated_cost_usd` là ước lượng observability, không phải số billing tuyệt đối

### `POST /api/brd/regenerate-section`

Phase 2:

- regenerate một section cụ thể từ structured spec hiện tại

### 13.4. Error object và status contract

Khi `error != null`, backend trả object theo shape:

```json
{
  "code": "MODEL_TIMEOUT",
  "message": "Sinh BRD thất bại do provider timeout.",
  "retryable": true,
  "related_node_ids": ["n-12", "n-18"]
}
```

Field:

- `code`: machine-readable code
- `message`: message ngắn gọn, có thể hiển thị trực tiếp hoặc map sang i18n key sau này
- `retryable`: frontend có nên hiện CTA `Retry` hay không
- `related_node_ids[]`: optional, dùng khi lỗi/warning gắn với node cụ thể

Danh sách code tối thiểu cho Phase 1:

- `INVALID_REQUEST`
- `SCHEMA_VERSION_UNSUPPORTED`
- `VALIDATION_BLOCKING`
- `IDEMPOTENCY_KEY_REQUIRED`
- `IDEMPOTENCY_KEY_CONFLICT`
- `MODEL_TIMEOUT`
- `MODEL_INVALID_STRUCTURED_OUTPUT`
- `PROVIDER_UNAVAILABLE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Mapping khuyến nghị:

- `VALIDATION_BLOCKING` đi với `422`
- `IDEMPOTENCY_KEY_CONFLICT` đi với `409`
- `MODEL_TIMEOUT` và `MODEL_INVALID_STRUCTURED_OUTPUT` đi với `502`
- `PROVIDER_UNAVAILABLE` đi với `503`

### 13.5. Idempotency policy và response shape

Phase 1 dùng idempotency cho duy nhất `POST /api/brd/generate`.

Request contract:

- frontend phải gửi header `Idempotency-Key`
- key có scope theo `(endpoint, request body hash)`
- TTL mặc định dùng `BRD_IDEMPOTENCY_TTL_SECONDS`

Hành vi backend:

1. Nếu key mới và payload hợp lệ -> xử lý bình thường, trả `200` với `status = completed`
2. Nếu key cũ và payload giống hệt, kết quả đã có -> trả lại kết quả cũ, `200` với `status = replayed`
3. Nếu key cũ và payload giống hệt nhưng request đầu tiên còn đang chạy -> trả `202` với `status = in_progress`
4. Nếu key cũ nhưng payload khác -> trả `409` với `status = conflict`

Response shape tối thiểu cho idempotency:

```json
{
  "request_id": "req_...",
  "status": "completed | replayed | in_progress | conflict",
  "idempotency_key": "brd-gen-01",
  "result": {},
  "error": null,
  "metadata": {
    "cached": false,
    "first_request_at": "2026-05-31T14:00:00Z"
  }
}
```

Lưu ý:

- `validate` không cần idempotency
- frontend phải reuse cùng `Idempotency-Key` khi user bấm retry cho cùng một lần generate
- nếu user sửa diagram hoặc đổi template, frontend phải tạo key mới

## 14. Privacy, security, compliance

### 14.1. Default policy

- không gửi API key provider xuống browser
- không gửi screenshot diagram làm input mặc định
- ưu tiên gửi semantic graph đã rút gọn thay vì toàn bộ raw editor state

### 14.2. Prompt injection guard

Text user nhập trong node/note được coi là **data**, không phải instruction.

System phải:

- tách rõ system instruction và user content
- serialize content thành structured payload
- không cho model diễn giải note như prompt control text

### 14.3. Data handling

Phase 1 nên giả định diagram có thể chứa SOP nội bộ. Vì vậy:

- backend chỉ log metadata tối thiểu cho observability
- prompt/body đầy đủ không nên log mặc định ở production
- output BRD cần lưu kèm version metadata để trace lại nguồn generate

## 15. Error handling

- blocking validation error -> `422` với `status = blocking`, không gọi model
- non-blocking ambiguity -> vẫn generate draft + warnings, `200`
- model timeout -> retry có kiểm soát; nếu vẫn fail, `502` với `error.retryable = true`
- invalid structured output -> retry có kiểm soát; nếu vẫn fail, `502`
- thiếu `Idempotency-Key` ở `/generate` -> `400`
- cùng `Idempotency-Key` nhưng payload khác -> `409`
- diagram có loop -> generate với warning phù hợp, không fail chỉ vì có cycle

## 16. Storage và lifecycle

### Phase 1

- BRD draft là artifact tạm thời có thể export markdown
- chưa coi là source of truth
- source of truth vẫn là diagram JSON

### Phase 2

- có thể lưu structured spec + BRD draft metadata ở backend
- cho phép regenerate từng section từ structured spec cũ

### Invalidation rule

Nếu diagram thay đổi sau khi generate:

- BRD cũ được đánh dấu `outdated`
- user phải generate lại hoặc confirm giữ bản cũ

## 17. Chất lượng và đánh giá

### Quality bar cho Phase 1

- mọi actor trong BRD phải map được về lane
- mọi main flow step phải map được về node id
- decision không label phải xuất hiện ở `open_questions`
- không có step được generate hoàn toàn không trace được về graph

### Eval strategy

Xây bộ golden set nhỏ:

- 5-10 diagram thật
- BRD draft mong đợi do BA review

Đo các tiêu chí:

1. traceability
2. actor coverage
3. branch correctness
4. warning usefulness
5. human acceptance after review
6. generate latency
7. estimated cost per draft

### Performance và cost target cho Phase 1

Target này là **engineering target**, không phải SLA public:

- `POST /api/brd/validate`
  - p95 `< 2s` với diagram tối đa `30 node / 40 edge`
- `POST /api/brd/generate`
  - p50 `< 20s` với diagram tối đa `30 node / 40 edge`
  - p95 `< 45s` với diagram tối đa `30 node / 40 edge`
- deterministic render + post-check sau khi đã có structured spec nên chiếm `< 2s` trong tổng thời gian generate
- estimated cost trung bình cho một lần generate Phase 1 nên giữ `< $0.12`
- hard guardrail cho một lần generate không retry nên giữ `< $0.25`
- backend chỉ retry model khi timeout ngắn hoặc invalid structured output; tối đa `1` controlled retry trong Phase 1 để tránh cost runaway

## 18. Phase plan

### Phase 1

- toolbar action `Generate BRD`
- frontend normalize request
- FastAPI validate + interpret + generate
- structured spec + markdown draft
- cho phép edit trực tiếp BRD draft trước khi export
- warning panel + export markdown

### Phase 1 Definition of Done

- generate thành công cho diagram hợp lệ
- output tiếng Việt
- có structured spec + BRD markdown
- user chỉnh sửa được BRD markdown draft trước khi export
- có warning list
- mọi step trong BRD trace được về node id
- không dùng browser-side provider key
- `POST /api/brd/validate` và `POST /api/brd/generate` có status/error contract nhất quán theo Section 13
- `/generate` có idempotency hoạt động đúng cho các trạng thái `completed | replayed | in_progress | conflict`
- đạt performance/cost target tối thiểu của Section 17 trên golden set Phase 1

### Phase 2

- template full
- regenerate từng section
- highlight traceability từ BRD về canvas
- lưu backend artifact + version metadata
- chọn ngôn ngữ output

### Phase 3

- nhiều diagram trong cùng một BRD
- organization glossary / domain dictionary
- eval feedback loop
- provider abstraction mở rộng / self-hosted option nếu cần

## 19. Dependencies với roadmap hiện tại

- Feature này **có thể bắt đầu ở Phase 1 mở rộng** dù repo hiện chưa có backend, vì backend mới sẽ được thêm bằng Python + FastAPI riêng cho feature này.
- Tuy nhiên các năng lực sau sẽ hưởng lợi mạnh từ roadmap Phase 2:
  - persistence
  - version history
  - artifact storage
  - section regeneration có trạng thái

## 20. Tài liệu liên quan

- Tổng quan dự án: [../scope/overview.md](../scope/overview.md)
- Tính năng hiện có: [../scope/features.md](../scope/features.md)
- Roadmap: [../roadmap/README.md](../roadmap/README.md)
- Feature backlog entry: [../scope/features.md](../scope/features.md#9-ai-assistance)

## 21. References

- [OpenRouter quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter authentication](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs)
- [OpenRouter enterprise quickstart](https://openrouter.ai/docs/cookbook/get-started/enterprise-quickstart)
- [OpenAI models overview](https://developers.openai.com/api/docs/models)
- [GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5/)
- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [Structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
