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

- frontend **không gọi trực tiếp** OpenAI/provider API
- mọi AI generation đi qua **FastAPI backend**

Lý do:

- tránh lộ API key,
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
8. User review, chỉnh sửa BRD draft, rồi export markdown hoặc copy nội dung.

### Alternate flows

- Diagram mơ hồ -> vẫn generate draft nhưng buộc hiển thị `open_questions`
- Diagram có cycle / unlabeled decision / orphan note -> generate với warning rõ ràng
- Model fail / timeout -> backend trả trạng thái lỗi có thể retry

## 6. UX đề xuất

### Entry point

- Thêm nút `Generate BRD` trên toolbar chính của editor

### Kết quả hiển thị

- Dùng **right-side panel** thay vì modal
- Panel có 3 tab:
  1. `Warnings`
  2. `Structured Spec`
  3. `BRD Draft`

### Chính sách chỉnh sửa output

Phase 1 cho phép:

- user chỉnh sửa **BRD Draft** trực tiếp trong editor text area / markdown editor
- user **không chỉnh sửa trực tiếp canonical structured spec** ở Phase 1

Lý do:

- BRD draft là lớp trình bày, hợp để BA chỉnh ngôn ngữ cho nhanh
- structured spec là canonical layer để giữ traceability và consistency
- nếu cho sửa cả 2 ngay từ Phase 1, nguy cơ lệch giữa semantic source và prose rất cao

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
- cho user chỉnh sửa BRD draft trong panel
- cho user export markdown

### 7.2. FastAPI responsibilities

FastAPI chịu trách nhiệm:

- xác thực request và rate limit
- validate semantic graph
- interpret graph thành canonical structure
- gọi model AI qua provider adapter
- chạy post-check
- trả kết quả chuẩn hóa về frontend

### 7.3. Provider strategy

Phase 1 chọn provider chính là OpenAI, nhưng backend phải có lớp abstraction:

- `LLMProvider`
- `GenerationService`
- `ValidationService`

để sau này có thể đổi sang provider khác hoặc self-hosted model mà không sửa contract frontend.

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

Render từ structured spec sang markdown theo template đã chọn.

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
    width?: number;   // UI hint, backend có thể bỏ qua
    height?: number;  // UI hint, backend có thể bỏ qua
  }>;
  nodes: Array<{
    id: string;
    type: 'start' | 'activity' | 'decision' | 'sync-bar' | 'end' | 'note';
    lane_id?: string;
    text?: string;
    x: number;
    y: number;
    width?: number;   // có ý nghĩa cho sync-bar và shape đã manual resize
    height?: number;  // có ý nghĩa cho shape đã manual resize
    sync_bar_span?: {
      from_lane_id: string;
      to_lane_id: string;
    };  // bắt buộc khi type === 'sync-bar' (sau TASK-002)
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

**Quy ước transport:**

- `x`, `y`, `width`, `height` của node thường: backend chỉ dùng để derive sticky note anchor và detect shape tràn lane; không quyết định semantic flow.
- `sync_bar_span`: backend dùng làm nguồn chính cho `parallel_blocks[]` interpretation; nếu thiếu, backend treat sync-bar đó là ambiguous và đưa vào `warnings[]`.
- `note.anchor` không có trong request — backend tự derive bằng heuristic (nearest node cùng lane trong ngưỡng khoảng cách) và ghi vào structured spec.
- `lane.width` / `lane.height` chỉ là UI hint; semantic không dùng tới.

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

Phase 1 render markdown theo template ngắn gọn, dễ review:

1. Process overview
2. Business objective
3. Scope
4. Actors
5. Main workflow
6. Decision logic
7. Parallel activities
8. Handoffs
9. Exceptions / warnings
10. Assumptions / open questions

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
12. Postconditions / outputs
13. Business rules inferred from labels
14. Exceptions / failure handling
15. Assumptions
16. Open questions

### 11.3. Quyết định về template

Structured spec là canonical data model duy nhất.

Template ngắn và template đầy đủ chỉ là **hai cách render khác nhau** từ cùng một nguồn dữ liệu. Cách này tốt hơn duy trì hai data model song song.

## 12. Model strategy đề xuất

### 12.1. Model chính

Phase 1 khuyến nghị:

- **Primary synthesis**: `gpt-5.5`
- **Operational / lower-cost tasks**: `gpt-5.4-mini`

### 12.2. Cách dùng

- `gpt-5.5`:
  - generate canonical structured spec
  - render BRD draft chất lượng cao
- `gpt-5.4-mini`:
  - rewrite section nhỏ
  - regenerate partial section
  - hỗ trợ task chi phí thấp hơn nếu cần batch lớn

### 12.3. Integration policy

- gọi model qua backend FastAPI
- dùng structured output / JSON schema strict nếu provider hỗ trợ
- pin model snapshot ở implementation phase để tránh drift
- không hard-code frontend vào tên model cụ thể

### 12.4. Tránh

- generate prose trực tiếp từ raw diagram JSON trong một pass (bỏ qua canonical structured spec)
- dùng model nhỏ duy nhất cho toàn bộ pipeline nếu mục tiêu là BRD chất lượng cao

## 13. API contract đề xuất

### `POST /api/brd/validate`

Input: `DiagramSemanticRequest`

Output:

- warnings
- blocking issues
- normalized summary

### `POST /api/brd/generate`

Input:

- `DiagramSemanticRequest`
- template: `default` | `full`

Output:

- `DiagramBRDSpec`
- `brd_markdown`
- warnings
- generation metadata

### `POST /api/brd/regenerate-section`

Phase 2:

- regenerate một section cụ thể từ structured spec hiện tại

### 13.4. HTTP status & error response

| Status | Khi nào | Body |
|---|---|---|
| `200 OK` | Generate thành công, có thể vẫn có warning không blocking | `DiagramBRDSpec` + `brd_markdown` + `warnings[]` |
| `400 Bad Request` | Request schema sai (thiếu field bắt buộc, type sai) | `ErrorResponse` |
| `422 Unprocessable Entity` | Validate semantic fail (no start, no end, sync-bar không hợp lệ) — blocking | `ErrorResponse` + `warnings[]` |
| `429 Too Many Requests` | Vượt rate limit hoặc quota | `ErrorResponse` với `retry_after_seconds` |
| `500 Internal Server Error` | Backend exception ngoài provider | `ErrorResponse` |
| `502 Bad Gateway` | Provider model fail / timeout / invalid JSON sau khi đã retry nội bộ | `ErrorResponse` với `retryable: true` |

Error response shape:

```ts
type ErrorResponse = {
  code: string;            // 'validation_failed' | 'model_timeout' | 'quota_exceeded' | ...
  message: string;         // human-readable, có thể hiển thị cho user
  related_node_ids?: string[];
  retryable?: boolean;
  retry_after_seconds?: number;
};
```

### 13.5. Streaming policy

Phase 1 dùng **single response** với panel UX hiển thị step status tuần tự (`validating` -> `interpreting` -> `generating spec` -> `rendering BRD`) ở client side dựa trên timer/heartbeat, không cần SSE.

Phase 2 có thể nâng lên SSE (`text/event-stream`) hoặc WebSocket nếu user feedback cho thấy single response quá nặng UX với diagram lớn:

- `event: progress` — backend publish step transitions
- `event: warning` — warning xuất hiện sớm trước khi BRD render xong
- `event: result` — final payload
- `event: error` — terminal error

### 13.6. Idempotency

- `POST /api/brd/generate` chấp nhận optional header `Idempotency-Key: <uuid>` để chống double-charge khi user retry trong browser.
- Backend cache `(idempotency_key, diagram_hash) -> response` trong cửa sổ ngắn (vd 10 phút).
- Nếu user gọi lại với cùng `Idempotency-Key` nhưng diagram đã đổi (`diagram_hash` khác) → trả `409 Conflict`.

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

- blocking validation error -> không generate
- non-blocking ambiguity -> generate draft + warnings
- model timeout -> cho retry
- invalid structured output -> backend retry có kiểm soát trước khi fail
- diagram có loop -> generate với mục `loops` / `open_questions`

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

## 18. Phase plan

### Phase 1

- toolbar action `Generate BRD`
- frontend normalize request
- FastAPI validate + interpret + generate
- structured spec + markdown draft
- cho phép edit trực tiếp BRD draft trước khi export
- warning panel + export markdown

### Phase 1 Definition of Done

**Functional:**

- generate thành công cho diagram hợp lệ
- output tiếng Việt
- có structured spec + BRD markdown
- user chỉnh sửa được BRD markdown draft trước khi export
- có warning list
- mọi step trong BRD trace được về node id
- không dùng browser-side provider key

**Quality bar:**

- 100% actor trong BRD map được về `lane_id`
- 100% main flow step có `node_id` reference (xem Section 17 Quality bar)
- 0 step được generate hoàn toàn không trace được về graph
- Decision không có label luôn xuất hiện trong `open_questions[]`, không bị tự bịa `Có/Không`

**Performance / cost target** (đo trên diagram ≤ 30 node, align với `docs/roadmap/phase-1-mvp.md`):

- `POST /api/brd/validate` p95 < 2s
- `POST /api/brd/generate` p50 < 30s, p95 < 90s
- Cost ước lượng per generation: < $0.30 với cấu hình mặc định `gpt-5.5` (sẽ hiệu chỉnh sau lần đo cost thực tế)
- Validate-only call không tốn token provider (chạy hoàn toàn deterministic)

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

## 19. Rủi ro & mitigation

| # | Rủi ro | Mức | Mitigation |
|---|---|---|---|
| R-1 | Model drift theo phiên bản provider khi alias `gpt-5.5` tự cập nhật | M | Pin model snapshot ID trong implementation (xem Section 12.3) + golden eval set định kỳ (Section 17) |
| R-2 | Hallucinate khi diagram mơ hồ (decision chưa label, sync-bar thiếu span, note free-form) | H | Validate blocking (Step 3) + post-check rule-based (Step 7) + bắt buộc đưa ambiguity vào `open_questions[]` thay vì bịa |
| R-3 | Cost / quota vượt budget khi user generate liên tục | M | 2-model strategy + per-user quota + idempotency (Section 13.6) + cap per generation (Section 18) |
| R-4 | Privacy leak khi gửi SOP nội bộ lên provider | M | Backend không log prompt body mặc định (Section 14.3) + provider abstraction (Section 7.3) sẵn sàng swap sang self-hosted Phase 3 |
| R-5 | Provider outage / invalid JSON output | M | Retry có kiểm soát (Section 15) + graceful degrade (báo `502` với `retryable: true`) + provider fallback có thể thêm Phase 2 |
| R-6 | Schema drift giữa frontend graph data và backend semantic schema | M | Versioning request schema (`X-Schema-Version` header) + integration test với sample data từ `src/lf-config.ts` |
| R-7 | Prompt injection qua sticky note hoặc node text độc hại | L-M | Tách rõ system/user content (Section 14.2) + sanitize special tokens + test case với malicious input trong eval set |

## 20. Dependencies với roadmap hiện tại

- Feature này tạo **sub-track AI BRD trong Phase 1**, chạy song song với MVP editor (không thay thế các hạng mục trong `docs/roadmap/phase-1-mvp.md`). Backend FastAPI mới được thêm riêng cho feature này, không phụ thuộc backend collaboration của Phase 2.
- Tuy nhiên các năng lực sau sẽ hưởng lợi mạnh từ roadmap Phase 2 (`docs/roadmap/phase-2-collaboration.md`):
  - persistence của BRD artifact
  - version history
  - artifact storage
  - section regeneration có trạng thái
- Architecture chi tiết cho backend: xem `docs/scope/architecture-brd-backend.md`.

## 21. Tài liệu liên quan

- Tổng quan dự án: [../scope/overview.md](../scope/overview.md)
- Tính năng hiện có: [../scope/features.md](../scope/features.md)
- Roadmap: [../roadmap/README.md](../roadmap/README.md)
- Feature backlog entry: [../scope/features.md](../scope/features.md#9-ai-assistance)
- Use case end-to-end: [../use-cases/UC-06-sinh-brd-tu-diagram.md](../use-cases/UC-06-sinh-brd-tu-diagram.md)
- Backend architecture: [../scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md)

## 22. References

- [OpenAI models overview](https://developers.openai.com/api/docs/models)
- [GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5/)
- [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [Structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
