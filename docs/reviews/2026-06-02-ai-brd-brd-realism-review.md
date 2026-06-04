# AI BRD Draft Review - BRD Realism Pass

- Date: 2026-06-02
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Review the latest AI-generated BRD draft against the user's goal of making the output feel as close as possible to a real BRD draft
- Artifacts reviewed:
  - Generated BRD draft supplied in the request
  - [apps/api/app/schemas/spec.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/spec.py)
  - [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py)
  - [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py)

## Findings

### [P1] `Main workflow` vẫn mới là danh sách bước ngắn, chưa mang cấu trúc nghiệp vụ của BRD thật

Section 5 hiện nhìn sạch và đúng semantic, nhưng mỗi bước vẫn chỉ có một dòng `actor + description`. Với chuẩn BRD, phần này thường cần nói rõ hơn mục đích bước, hành động chính, và kết quả mong đợi hoặc trạng thái đầu ra.

- Evidence:
  - Schema `MainFlowStep` hiện chỉ có `step_id`, `node_id`, `actor_name`, và `description` tại [apps/api/app/schemas/spec.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/spec.py:26).
  - `build_deterministic_spec()` chỉ dựng `description = build_main_flow_description(node)` rồi đưa thẳng vào spec tại [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:17).
  - Renderer chỉ in một dòng numbered list cho mỗi step tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:29).
- Impact:
  - Draft đọc được, nhưng vẫn giống "checklist flow" hơn là "mô tả quy trình nghiệp vụ".
  - Đây là khoảng cách lớn nhất còn lại giữa bản hiện tại và một BRD nháp thực thụ.

### [P2] Section `Actors` chưa tận dụng được trường `responsibilities`, nên vai trò mỗi actor vẫn còn quá mỏng

Phần actor hiện chỉ liệt kê tên lane. Trong BRD thật, người đọc thường cần biết mỗi actor chịu trách nhiệm gì trong quy trình, đặc biệt với quy trình phối hợp nhiều bên.

- Evidence:
  - Schema đã có `responsibilities: list[str]` trong `ActorItem` tại [apps/api/app/schemas/spec.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/spec.py:20).
  - Nhưng builder luôn set `responsibilities: []` tại [apps/api/app/services/spec_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/spec_builder.py:42).
  - Renderer chỉ in `actor.actor_name` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:22).
- Impact:
  - Người đọc biết "ai tham gia", nhưng chưa biết "ai chịu trách nhiệm phần gì".
  - BRD vì vậy vẫn thiếu chiều sâu phân vai.

### [P2] Section `Scope` hiện quá mỏng và còn mang màu kỹ thuật, chưa thể hiện ranh giới quy trình như tài liệu BRD

`Scope` hiện chỉ gồm số actor và số bước chính. Đây là thông tin có ích cho debug hoặc thống kê, nhưng chưa đủ giúp BA hiểu quy trình bao phủ đến đâu và kết thúc ở điều kiện nào.

- Evidence:
  - Section 3 chỉ render hai bullet đếm số lượng tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:18).
- Impact:
  - Bản draft thiếu thông tin về phạm vi nghiệp vụ, điểm bắt đầu, điểm kết thúc, và ranh giới trách nhiệm.
  - Khi gửi người khác đọc, section này vẫn lộ cảm giác "sinh từ hệ thống" hơn là "được viết cho tài liệu".

### [P2] `Appendix A. Traceability (debug)` vẫn được render chung vào bản xuất chính, làm draft chưa thật sự giống BRD reader-facing

Appendix debug có giá trị rất tốt cho traceability, nhưng với mục tiêu "gần BRD thật nhất có thể", nó nên là phần tùy chọn chứ không nên luôn nằm trong bản chính.

- Evidence:
  - `render_brd_markdown()` luôn append `render_traceability_appendix(spec)` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:90).
- Impact:
  - Bản xuất hiện tại vừa là BRD draft vừa là debug artifact.
  - Điều này hợp cho nội bộ kỹ thuật, nhưng chưa tối ưu nếu muốn đưa bản draft đi review như một tài liệu nghiệp vụ.

## What Is Already Good

1. Semantic pipeline hiện đã qua giai đoạn "sai logic graph".
2. `Process overview`, `Business objective`, `Decision logic`, và `Context` đã đọc được với ngôn ngữ gần tài liệu hơn nhiều so với các bản đầu.
3. Whitespace, context formatting, và debug appendix đã được tách lớp tốt hơn trước.

## Recommended Direction

1. Giữ nguyên định hướng deterministic hiện tại; không nên quay sang phụ thuộc mạnh hơn vào prose của model.
2. Nâng cấp `main_flow_steps` thành object giàu ngữ nghĩa hơn, rồi để renderer dùng object đó viết section 5 như một BRD thật.
3. Tận dụng các field schema đã có nhưng đang bỏ trống, nhất là `responsibilities`.
4. Tách rõ hai mode xuất:
   - reader-facing BRD
   - debug/traceability appendix

## Conclusion

Draft hiện tại đã vượt xa mức "vô nghĩa" và đủ tốt để review nội bộ. Khoảng cách còn lại tới một BRD nháp "thật sự giống BRD" không còn nằm ở semantic correctness, mà nằm ở độ dày nghiệp vụ của section 3, 4, 5 và cách tách bản đọc cho BA khỏi phần debug.
