# AI BRD Draft Review - Fire Incident Sample (v4)

- Date: 2026-06-02
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Reader-facing quality review of the latest fire-incident BRD draft after TASK-039 to TASK-041
- Artifacts reviewed:
  - `apps/api/app/services/render.py`
  - `apps/api/app/services/spec_builder.py`
  - Generated BRD draft supplied in the request

## Findings

### [P2] `Business objective` vẫn chỉ là placeholder tĩnh, chưa phản ánh diagram thật

Section 2 hiện vẫn luôn in cùng một câu: `Mục tiêu nghiệp vụ được suy ra từ flow hiện tại và cần BA xác nhận thêm khi cần.`

- Evidence:
  - `render.py` đang hard-code nguyên câu này tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:15)
- Impact:
  - Toàn bộ BRD đã bắt đầu mang hình dạng tài liệu thật, nên một section tĩnh như vậy trở nên lạc tông và lộ rõ đây vẫn là draft tool-generated.
  - Với case cháy, reader kỳ vọng mục tiêu gần hơn với nghiệp vụ như tiếp nhận tín hiệu, xác minh nhanh, điều phối xử lý, và đóng quy trình an toàn.

### [P2] `Process overview` đã đúng hơn nhiều, nhưng vẫn còn quá generic so với case cháy cụ thể

Section 1 đã nêu được trigger và actor đầu tiên, nhưng câu mở đầu vẫn là `Quy trình mô tả cách các actor phối hợp ... theo diagram hiện tại`, nên nghe khá cơ học và chưa neo đủ vào domain "sự cố cháy".

- Evidence:
  - `build_process_overview()` vẫn bắt đầu bằng câu generic ở [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:109)
- Impact:
  - Draft hiện đọc được, nhưng phần opening vẫn giống một template điền dữ liệu hơn là một mô tả quy trình nghiệp vụ cụ thể.

### [P3] Section 10 hiện đúng semantic, nhưng tên section vẫn hơi lệch với nội dung khi chỉ có `Context`

Output giờ đã render `Context` rất gọn, nhưng về mặt trải nghiệm đọc, section tên `Assumptions / open questions` mà chỉ chứa context đầu vào vẫn hơi lạ.

- Evidence:
  - Renderer giữ nguyên contract 10 section tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:76)
- Impact:
  - Không phải bug, chỉ là một điểm polish nhỏ nếu sau này bạn muốn export bản BRD nhìn “tự nhiên” hơn nữa.

## What Improved

1. Reader-facing text không còn lộ line break của canvas.
2. `Context` note đã được render thành heading + sub-bullets rõ ràng.
3. Empty-state wording bớt kỹ thuật hơn hẳn.
4. `Decision logic`, `Handoffs`, và `Process overview` giờ đã đọc giống tài liệu hơn nhiều so với các bản trước.

## Recommended Direction

1. Giữ nguyên semantic pipeline hiện tại; nó đã qua ngưỡng ổn định cho Phase 1.
2. Tập trung vòng tiếp theo vào prose generation deterministic:
   - business objective
   - opening overview
   - optional section-title polish cho section 10

## Conclusion

Draft này đã đủ tốt để review nghiệp vụ nội bộ và không còn mang cảm giác “sinh ra rồi phải dịch lại từ graph” như trước. Phần còn lại chủ yếu là nâng chất lượng prose để bản xuất ra trông giống một BRD nháp tử tế hơn là một tài liệu kỹ thuật đã được làm sạch.
