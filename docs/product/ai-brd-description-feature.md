# AI BRD Description Feature

## Mục tiêu

Sinh mô tả nghiệp vụ dạng BRD từ swimlane activity diagram đã được người dùng vẽ, theo cách:

1. nhất quán giữa các diagram,
2. có thể kiểm tra được,
3. giảm hallucination bằng dữ liệu có cấu trúc trước khi sinh prose.

## Quyết định chính

### 1. Output format nên là 2 tầng

Không nên sinh thẳng một đoạn văn dài tự do. Nên đi theo 2 tầng:

1. **Structured intermediate spec**
   - purpose / scope
   - actors (từ lane)
   - ordered steps
   - decisions and branches
   - handoff points
   - exceptions / unclear areas
   - assumptions detected

2. **BRD-ready narrative**
   - Overview
   - Business goal
   - Participants / roles
   - Main workflow
   - Decision logic
   - Exceptions / alternate flows
   - Inputs / outputs
   - Open questions / assumptions

### 2. AI chỉ nên viết từ graph đã normalize

Model không nên đọc trực tiếp raw canvas state rồi tự suy diễn tất cả. Trước khi gọi model, app/backend nên chuẩn hóa diagram thành một representation semantic:

- lanes -> actors / roles
- nodes -> typed business actions
- edges -> flow ordering
- decision edges -> labeled outcomes
- sync-bar -> parallel split / join
- notes -> business note / annotation

### 3. Mức chính xác cao nhất đến từ pipeline nhiều bước

Pipeline khuyến nghị:

1. **Extract**
   - lấy graph JSON
   - normalize node/edge/lane metadata
2. **Validate**
   - phát hiện orphan node, missing start/end, decision thiếu label, sync-bar mơ hồ
3. **Interpret**
   - topological sort
   - group theo lane
   - nhận diện main flow, branch, parallel block
4. **Generate structured spec**
   - ép model trả về JSON/schema cố định
5. **Generate BRD prose**
   - dùng structured spec làm nguồn duy nhất để viết narrative
6. **Post-check**
   - rule-based checks: đủ actor, đủ decision, không thêm step không có trong graph

## BRD Format khuyến nghị

### Option A - Gọn, phù hợp MVP

1. Diagram name
2. Business objective
3. Scope
4. Actors
5. Main flow
6. Alternate / exception flows
7. Decision rules
8. Assumptions / open questions

Phù hợp nếu mục tiêu là export nhanh sang BRD draft.

### Option B - Chuẩn hơn cho enterprise BRD

1. Document metadata
2. Process overview
3. Business objective
4. In-scope / out-of-scope
5. Roles and responsibilities
6. Preconditions
7. Trigger
8. Main process flow
9. Branches and decision logic
10. Parallel activities
11. Postconditions / outputs
12. Business rules inferred from labels
13. Exceptions / failure handling
14. Assumptions
15. Open questions for BA

Khuyến nghị cho dự án này: **Option B ở internal data model, Option A ở UI export mặc định**.

## Những bước cần xử lý để AI mô tả chính xác

### A. Chuẩn hóa dữ liệu đầu vào

Phải có một graph schema ổn định:

- lane id / lane title
- node id / node type / node text
- edge source / target / label
- node order theo topo
- branch markers cho decision
- parallel markers cho sync-bar

### B. Bổ sung semantic layer trước khi gọi model

App/backend nên tự tính thêm:

- `actors[]`
- `ordered_steps[]`
- `decisions[]`
- `parallel_blocks[]`
- `dangling_items[]`
- `ambiguities[]`

Đây là phần deterministic, không nên giao cho model tự đoán.

### C. Dùng structured output

Lần gọi model đầu tiên nên trả về JSON schema cố định, ví dụ:

- `summary`
- `actors`
- `main_flow_steps`
- `branches`
- `parallel_flows`
- `assumptions`
- `open_questions`

Chỉ sau đó mới render thành prose BRD.

### D. Thêm guardrail chất lượng

Nên có các rule:

1. Không được tạo actor không tồn tại trong lane.
2. Không được tạo step không map được tới node id.
3. Decision phải bám label edge nếu có.
4. Nếu graph mơ hồ, model phải trả `open_questions` thay vì bịa.

### E. Giữ human-in-the-loop

Feature này nên sinh:

- `Draft`
- `Needs review`
- `Confidence / ambiguity flags`

Không nên gọi output là “BRD final” ở bản đầu.

## Khuyến nghị model

### Khuyến nghị thực tế

Nên dùng **2-model strategy**:

1. **Primary synthesis model: `gpt-5.5`**
   - dùng cho bước tạo structured spec cuối và BRD narrative bản chất lượng cao
2. **Operational model: `gpt-5.4-mini`**
   - dùng cho validate nhẹ, rewrite, format lại, hoặc batch generation giá rẻ

### Vì sao

`gpt-5.5` hiện được OpenAI khuyến nghị là điểm bắt đầu cho các bài toán reasoning phức tạp; models page nêu rõ “If you're not sure where to start, use gpt-5.5” và mô tả đây là model mới nhất cho công việc chuyên môn phức tạp. `gpt-5.5` cũng có context window ~1M token, phù hợp nếu sau này feature cần nhúng thêm glossary, business rules, template BRD, hoặc nhiều diagram liên quan.

`gpt-5.4-mini` phù hợp cho workload khối lượng lớn và tối ưu chi phí; docs model page mô tả đây là mini model mạnh nhất hiện tại cho coding/computer use/subagents, còn pricing page cho thấy chi phí thấp hơn đáng kể so với frontier models. Nó hợp với các bước phụ trợ hơn là bước tổng hợp business narrative cuối cùng.

### Không khuyến nghị

- Không dùng model nhỏ nhất làm model duy nhất cho BRD narrative, vì phần khó ở đây không phải chỉ là paraphrase mà là hiểu flow, branch, và parallel semantics.
- Không để model viết trực tiếp từ raw diagram JSON trong một pass duy nhất.

## Hướng triển khai đề xuất

### Phase 1

- Export graph semantic JSON
- Validate graph
- Generate structured spec JSON
- Render markdown BRD draft

### Phase 2

- Cho BA chọn template BRD
- Highlight step-to-node traceability
- Show ambiguity warnings
- Re-generate từng section thay vì regenerate cả tài liệu

### Phase 3

- Hỗ trợ nhiều diagram trong cùng một BRD
- Hỗ trợ organization glossary / domain dictionary
- Hỗ trợ feedback loop để tinh chỉnh prompt / eval
