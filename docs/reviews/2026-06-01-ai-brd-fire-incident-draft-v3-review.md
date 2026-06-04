# AI BRD Draft Review - Fire Incident Sample (v3)

- Date: 2026-06-01
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Reader-facing quality review of the latest BRD draft after TASK-036 to TASK-038
- Artifacts reviewed:
  - `apps/api/app/services/render.py`
  - `apps/api/app/services/spec_builder.py`
  - `apps/api/app/services/interpret.py`
  - Generated BRD draft supplied in the request

## Findings

### [P2] Reader-facing BRD vẫn rò rỉ line break của canvas text vào câu văn

Draft mới đã đúng hơn về semantic, nhưng vẫn còn nhiều câu bị ngắt dòng giữa chừng như `Xác minh sự cố\nlà cháy thật?`, `qua bộ đàm đến điểm nghi vấn`, hoặc `Báo cáo qua bộ đàm ...\ncho các actor trong VOC`.

- Evidence:
  - `build_main_flow_description()` giữ nguyên `node.text` ở [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:87)
  - `human_node_label()` cũng giữ nguyên `node.text` cho activity/decision ở [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:714) và [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:723)
- Impact:
  - Người đọc vẫn cảm giác đang xem text lấy thẳng từ shape trên canvas, không phải nội dung đã được chuẩn hóa cho tài liệu.

### [P2] `Context` list hiện đúng semantic nhưng chưa đúng hình thức tài liệu

Section 10 không còn tự mâu thuẫn nữa, nhưng `Context:` đang được render như một bullet đầu dòng rồi các dòng list bên trong note lại rơi xuống thành các bullet ngang cấp tiếp theo. Semantic đã đúng, nhưng hình thức BRD vẫn hơi vụn và không rõ đâu là tiêu đề, đâu là các mục con.

- Evidence:
  - Renderer đang append nguyên `context_note` sau prefix `- Context:` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:78)
  - `format_context_note()` hiện chỉ trả nguyên `note.text` ở [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:426)
- Impact:
  - Bản BRD đọc được, nhưng phần bối cảnh đầu vào chưa có dáng của một mục tài liệu rõ ràng.

### [P3] Một số empty-state wording vẫn mang ngôn ngữ kỹ thuật hơn là ngôn ngữ BA

Ví dụ `Không có parallel block.` là wording đúng về kỹ thuật, nhưng chưa phải câu tự nhiên trong tài liệu nghiệp vụ.

- Evidence:
  - Empty-state section song song đang hard-code tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:50)
- Impact:
  - Không làm sai nội dung, nhưng giữ lại cảm giác “tool output” thay vì “draft tài liệu”.

## What Improved

1. `Process overview` đã nêu rõ trigger, context đầu vào, và actor tiếp nhận đầu tiên.
2. `Decision logic` không còn dùng mũi tên trace graph ở nhánh alternate.
3. Section 10 không còn tự phủ định khi chỉ có `Context:` note.
4. `Parallel activities` không còn false-positive như các bản trước.

## Recommended Direction

1. Harden renderer bằng một lớp `reader-facing text normalization` cho node text/note text.
2. Render `Context` theo format có cấu trúc hơn: prose ngắn + list con, hoặc sub-bullets được kiểm soát.
3. Polish empty-state wording để BRD xuất ra nghe giống tài liệu hơn.

## Conclusion

Bản v3 này đã sang một ngưỡng mới: không còn “sai logic lớn” nữa và đã đủ để review nghiệp vụ nội bộ. Phần còn lại chủ yếu là export polish và chuẩn hóa câu chữ để BRD đọc mượt như tài liệu BA thật, thay vì như một bản chuyển đổi khá tốt từ diagram.
