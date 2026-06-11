# Review BRD format so với file mẫu

- Date: 2026-06-10
- Reviewer: Codex
- Scope:
  - So sánh format BRD hiện tại do pipeline AI + renderer sinh ra với file mẫu
    `examples/BRD.docx.md`.
  - Xác định liệu output hiện tại đã bám format mẫu chưa, và nếu chưa thì lệch ở lớp nào.

## Kết luận nhanh

Chưa. BRD hiện tại chưa được trình bày theo format của file mẫu.

Mismatch này là **có hệ thống**, không phải do một lần generate cụ thể:

1. Backend renderer đang khóa output vào một outline generic 10 section.
2. Schema/prompt hiện tại không mang đủ cấu trúc để tái tạo tài liệu mẫu.
3. Frontend persisted BRD renderer chưa support các primitive như bảng/hình/subsection style của mẫu.

## Module map

1. **Sample BRD format**
   - `examples/BRD.docx.md`

2. **BRD generation contract**
   - `apps/api/app/schemas/spec.py`
   - `apps/api/app/ai/prompts/assets/brd_generation/1.0.0/system.md`

3. **BRD markdown rendering**
   - `apps/api/app/services/render.py`
   - `apps/api/tests/test_pipeline.py`

4. **Persisted BRD presentation**
   - `src/brd/markdown.tsx`
   - `src/brd/PersistedBrdWorkspace.tsx`

## Findings

### 1. [P1, confirmed] Backend đang sinh một outline BRD generic, không phải outline của file mẫu

- Evidence:
  - File mẫu mở bằng các phần `1. Mục đích tài liệu`, `2. Phạm vi nghiệp vụ`, `3. Actor`,
    `4. Danh sách user case sau khi gộp`, `5. Trạng thái nghiệp vụ`, rồi các chapter theo từng UC
    với subsection `6.1`, `6.2`, `6.3`, `6.4`, `6.5` tại `examples/BRD.docx.md:5-116`,
    `examples/BRD.docx.md:118-209`.
  - Renderer hiện tại luôn sinh fixed outline
    `1. Process overview -> 10. Context / assumptions / open questions`
    tại `apps/api/app/services/render.py:8-103`.
  - Test backend còn khóa chính xác outline này qua các assert
    `## 3. Scope`, `## 4. Actors`, `## 5. Main workflow`
    tại `apps/api/tests/test_pipeline.py:545-582`.
- Impact:
  - Dù nội dung semantic đúng, output vẫn không thể được xem là “đúng format mẫu”.
  - Người dùng kỳ vọng một formal BRD theo template mẫu sẽ nhận được một process brief tổng quát
    hơn, thiếu taxonomy tài liệu nghiệp vụ.
- Recommendation:
  - Đổi contract renderer từ generic 10-section sang sample-aligned document outline có chapter
    overview, business scope, actor catalog, use-case catalog, business states, và section per UC.
- Confidence: confirmed.
- Direction: **Redesign interface**

### 2. [P1, confirmed] Schema và prompt hiện tại không đủ biểu đạt để dựng tài liệu theo mẫu

- Evidence:
  - `DiagramBRDSpec` chỉ có `summary`, `actors`, `main_flow_steps`, `branches`, `parallel_blocks`,
    `handoffs`, `loops`, `annotations`, `context_notes`, `assumptions`, `open_questions`, `warnings`
    tại `apps/api/app/schemas/spec.py:72-87`.
  - File mẫu lại cần những nhóm dữ liệu riêng như:
    - danh sách user case sau khi gộp (`examples/BRD.docx.md:29-34`)
    - trạng thái nghiệp vụ tách `request state` và `device state` (`examples/BRD.docx.md:36-59`)
    - tiền điều kiện dạng bảng (`examples/BRD.docx.md:67-75`, `129-136`)
    - luồng chính dạng bảng actor/action/result (`examples/BRD.docx.md:83-98`, `144-150`, `165-173`, `186-201`)
    - luồng trạng thái / kết quả nhánh (`examples/BRD.docx.md:100-116`, `175-209`)
  - Prompt system hiện tại chỉ yêu cầu model sinh JSON hợp lệ theo schema, không hề instruct phải
    bám template mẫu tại `apps/api/app/ai/prompts/assets/brd_generation/1.0.0/system.md:1-8`.
- Impact:
  - Ngay cả khi model mạnh hơn, output vẫn không thể ổn định ra format mẫu nếu contract trung gian
    không chứa đúng semantic blocks.
  - Renderer hiện tại buộc phải suy diễn hoặc bỏ hẳn các section của mẫu.
- Recommendation:
  - Định nghĩa lại document contract sample-aligned trước khi sửa renderer; nếu không, renderer sẽ
    tiếp tục phải “đoán” từ dữ liệu không đủ.
- Confidence: confirmed.
- Direction: **Split responsibilities**

### 3. [P2, confirmed] Frontend persisted BRD chưa render được các primitive tài liệu mà file mẫu dùng

- Evidence:
  - Sample dùng dày đặc markdown table và image figure placeholder tại
    `examples/BRD.docx.md:13-18`, `31-34`, `40-58`, `79-81`, `83-98`, `144-150`.
  - Frontend renderer local chỉ parse `heading`, `paragraph`, `unordered-list`, `ordered-list`,
    `rule` tại `src/brd/markdown.tsx:8-38`, `96-215`.
  - Không có parse/render cho table, figure caption, image reference, hay numbered subsection
    formatting gần với Word-style sample.
- Impact:
  - Ngay cả nếu backend bắt đầu emit markdown gần giống file mẫu, persisted BRD page vẫn chưa trình
    bày đúng các bảng và hình chính của tài liệu.
  - Review UI có thể tiếp tục làm người dùng nghĩ tài liệu “không giống mẫu” dù backend đã cải thiện.
- Recommendation:
  - Sau khi chốt backend contract/output, mở rộng renderer frontend để support tối thiểu tables,
    image placeholder/caption, và hierarchy section/subsection rõ ràng.
- Confidence: confirmed.
- Direction: **Refactor in place**

## Recommended direction

### BRD generation contract

- Current state: Contract hiện phù hợp cho “reader-facing process summary”, chưa phù hợp cho
  “formal BRD theo template mẫu”.
- Main risks:
  - Renderer và tests khóa sai target format.
  - Model không có schema để biểu đạt các section đặc thù của mẫu.
  - Mọi cố gắng chỉnh prompt riêng lẻ sẽ không giải quyết tận gốc.
- Recommended direction: **Redesign interface**
- Why now:
  - Nếu team tiếp tục tinh chỉnh wording ở prompt hoặc CSS, outcome vẫn lệch vì document shape đang
    sai từ backend contract. Đây là chỗ cần sửa trước.
- Near-term actions:
  - Map từng section của mẫu sang canonical domain fields.
  - Tách `document contract` khỏi `diagram interpretation contract`.
  - Thêm golden fixture test assert chapter/table structure theo mẫu.

### Persisted BRD presentation

- Current state: UI đã reader-first hơn trước, nhưng vẫn chỉ render subset markdown đơn giản.
- Main risks:
  - Sample-aligned markdown sẽ degrade khi lên UI.
  - Table-heavy BRD vẫn không nhìn giống tài liệu mẫu.
- Recommended direction: **Harden**
- Why now:
  - Sau `TASK-200`, UX cơ bản đã đúng hướng. Phần còn thiếu là document primitives để hiển thị
    formal BRD chứ không chỉ prose/list summary.
- Near-term actions:
  - Support tables trong local markdown renderer.
  - Render figure/caption placeholder ổn định.
  - Thêm regression cho sample-like BRD markdown.

## Follow-up

- `KI-44` tracks the confirmed format mismatch.
- `TASK-201` and `TASK-202` track backend contract/renderer and frontend document rendering follow-up.
