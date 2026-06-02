# AI BRD Output Quality Review

- Date: 2026-06-01
- Scope: Review chất lượng đầu ra của AI BRD draft sau khi live path đã hoạt động, dựa trên một sample BRD draft thực tế cho quy trình xử lý đe dọa bom.
- Reviewer: Codex (`$senior-ai-reviewer`)

## Module map

1. **Semantic capture & validation**
   - `src/brd/normalize.ts`
   - `src/brd/prevalidate.ts`
   - `apps/api/app/services/validate.py`
2. **Flow interpretation**
   - `apps/api/app/services/interpret.py`
3. **Spec generation contract**
   - `apps/api/app/services/spec_builder.py`
   - `apps/api/app/services/prompt_builder.py`
   - `apps/api/app/schemas/spec.py`
4. **Reader-facing BRD rendering**
   - `apps/api/app/services/render.py`
5. **Guard rails / post-check**
   - `apps/api/app/services/postcheck.py`

## Findings

### [P1] Main workflow đang bị “flatten” thành một danh sách tuyến tính nên if/else và alternate path gần như mất nghĩa

- `interpret_request()` xây `main_flow_nodes` bằng cách lấy `preferred_path_ids` rồi append toàn bộ node reachable còn lại theo `distance_from_start` và `sort_node_key`, sau đó coi tất cả `activity`, `decision`, `end` là `main_flow_nodes` ở [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:55).
- `render_brd_markdown()` lại render toàn bộ `main_flow_steps` thành một numbered list phẳng ở [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:24).
- Hệ quả thấy rõ trong sample output: nhánh `if/else`, bước sau decision, và end nodes từ nhiều nhánh bị đổ chung vào một luồng chính; người đọc không thể hiểu control flow thật.

**Direction:** `Redesign interface` giữa `interpret` và `render`. `main workflow` phải chỉ chứa spine chính; branch/alternate path cần có cấu trúc riêng đủ để renderer biểu diễn được điều kiện và nhánh con.

### [P1] Handoff semantics đang lấy từ mọi edge cross-lane, nên BRD xuất hiện các dòng gần như vô nghĩa

- Handoff hiện được sinh cho **mọi** edge có `source.lane_id != target.lane_id` ở [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:95).
- Renderer in nguyên `source_node_id -> target_node_id` ra tài liệu ở [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:51).
- Đây là nguyên nhân trực tiếp của các dòng kiểu ``4ec75b2f-... -> 68b8b0db-...`` trong sample. Về mặt kỹ thuật edge đó có tồn tại, nhưng về mặt BRD thì đó không phải “handoff” mà chỉ là một quan hệ điều hướng trong flow.

**Direction:** `Refactor in place`. Tách `cross-lane edge` khỏi `business handoff`. Chỉ những transition thỏa semantic handoff mới được vào section `Handoffs`.

### [P1] Renderer đang rò rỉ internal IDs và lane IDs vào BRD reader-facing thay vì giữ chúng ở trace layer

- Section `Actors` render raw `lane_id` ở [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:20).
- Section `Main workflow`, `Decision logic`, `Parallel activities`, `Handoffs` đều render raw node IDs ở [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:24), [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:31), [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:43), [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:51).
- Điều này làm output đọc như debug dump hơn là BRD draft.

**Direction:** `Redesign interface`. Chia output thành:
- prose reader-facing không lộ internal IDs
- trace appendix hoặc debug view riêng nếu cần map ngược về diagram

### [P2] Parallel section còn quá generic, mới nói “có sync-bar” chứ chưa giải thích được các nhánh song song

- `describe_parallel_block()` mới mô tả ở mức generic như `Tách luồng song song tại sync-bar ...` và vẫn lộ raw sync-bar id ở [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:392).
- Renderer chỉ in `fork_node_id`, `description`, và `lane_ids` ở [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:43).
- Kết quả là người đọc không biết nhánh nào chạy song song, bắt đầu từ đâu, nhập lại ở đâu, và ảnh hưởng tới decision logic thế nào.

**Direction:** `Harden` trước, rồi `Refactor in place`. Giữ `parallel_blocks`, nhưng enrich nó thành business-level branch summary thay vì sync-bar-level summary.

### [P2] Post-check hiện chỉ chặn traceability lỗi, chưa chặn được output “đúng kỹ thuật nhưng vô nghĩa”

- `postcheck_spec()` chỉ check `STEP_TRACE_MISSING` và `BRANCH_TARGET_UNKNOWN` ở [apps/api/app/services/postcheck.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/postcheck.py:7).
- Nó không có guard nào cho:
  - raw internal IDs xuất hiện trong reader-facing sections
  - handoff section chỉ toàn edge ids
  - main workflow chứa node thuộc alternate path/join path mà không có branch framing

**Direction:** `Harden`. Thêm output-quality assertions ở post-check hoặc render-check layer.

## Recommended direction by module

- **Semantic capture & validation**: `Keep as-is` cho Phase 1. Đây không phải điểm gãy chính của sample output.
- **Flow interpretation**: `Redesign interface`. Đây là trung tâm của lỗi “đọc không hiểu flow”.
- **Spec generation contract**: `Refactor in place`. Spec hiện thiên về trace/debug hơn là narrative-ready contract.
- **Reader-facing BRD rendering**: `Redesign interface`. Renderer hiện đang quá literal với raw ids.
- **Guard rails / post-check**: `Harden`. Cần chặn “narratively broken but schema-valid” outputs.

## Suggested next tasks

- `TASK-028` — Tách `main spine` khỏi `branch/alternate paths` trong canonical spec.
- `TASK-029` — Định nghĩa lại semantic của `handoff` thay vì lấy mọi cross-lane edge.
- `TASK-030` — Thiết kế trace appendix riêng, loại raw ids khỏi reader-facing BRD sections.
- `TASK-031` — Nâng `parallel_blocks` thành branch-aware parallel summary.
- `TASK-032` — Thêm golden output quality tests cho branch-heavy diagram thực tế.
