# AI BRD Draft Review - Fire Incident Sample (v2)

- Date: 2026-06-01
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Reader-facing quality review of the latest AI BRD draft for the fire-incident swimlane diagram
- Artifacts reviewed:
  - `apps/api/app/services/interpret.py`
  - `apps/api/app/services/render.py`
  - Generated BRD draft supplied in the request

## Findings

### [P1] Section 10 đang tự mâu thuẫn khi có `context note`

Draft mới đã render đúng `Context: 1 trong 4 nhóm phát hiện dấu hiệu cháy...`, nhưng ngay sau đó lại thêm dòng `Không có assumption/open question.`. Hai câu này không thể đúng cùng lúc.

- Evidence:
  - `render.py` đã render `spec.context_notes` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:78)
  - Nhưng điều kiện empty-state chỉ check `annotations`, `assumptions`, `open_questions`, không check `context_notes` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:85)
- Impact:
  - Người đọc thấy output tự phủ định chính nó.
  - Làm giảm niềm tin vào toàn bộ BRD dù semantic phía trước đã khá hơn.

### [P2] `Decision logic` đã đúng hướng hơn, nhưng nhánh alternate vẫn còn đọc như trace graph

Việc đổi main-path outcome sang `Tiếp tục: ...` là một cải thiện thật. Tuy vậy, nhánh alternate vẫn đang được diễn đạt bằng pattern `A -> B; sau đó quay lại luồng chính tại ...`, nên vẫn thiên về serialization của graph hơn là narrative nghiệp vụ.

- Evidence:
  - `branch_outcome_summary()` vẫn join `path_summary` bằng `->` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:97)
  - Sau đó mới thêm đuôi `quay lại luồng chính` tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:104)
- Impact:
  - BA đọc được logic hơn trước, nhưng vẫn phải “dịch” từ đồ thị sang ngôn ngữ quy trình trong đầu.

### [P2] `Main workflow` vẫn thiếu tín hiệu khởi phát của quy trình

Draft hiện bắt đầu thẳng từ `Nhân sự vận hành liên lạc (VOC)` và bỏ qua tác nhân/trigger mở đầu, dù section `Actors` có `Nguồn phát hiện đầu tiên` và section 10 có context về 4 nguồn phát hiện cháy.

- Evidence:
  - `build_preferred_path()` chỉ đưa `activity`, `decision`, `end` vào main spine tại [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:12) và [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:164)
- Impact:
  - BRD bớt sai hơn trước, nhưng phần “quy trình bắt đầu vì điều gì” vẫn chưa đủ rõ với người chỉ đọc tài liệu.

## What Improved

1. `Parallel activities` không còn invent parallel giả cho `sync-bar` tuyến tính.
2. `Context note` không còn bị gán sai thành note của step `Bắt đầu quy trình`.
3. `Decision logic` đã bớt cơ khí hơn nhờ `Tiếp tục: ...` trên main path.

## Recommended Direction

1. Fix ngay empty-state của section 10.
2. Tiếp tục polish renderer cho alternate branch narrative theo ngôn ngữ nghiệp vụ hơn là `node-path trace`.
3. Quyết định rõ whether trigger/start event nên được nâng vào `Process overview` hoặc bước mở đầu của `Main workflow`.

## Conclusion

Draft v2 đã vượt qua mức “gần như vô nghĩa” của bản trước và đã bắt đầu usable hơn cho review nội bộ. Tuy vậy, nó vẫn chưa nên coi là bản BRD BA-facing đủ sạch cho người dùng cuối, vì còn một bug renderer rõ ràng và hai chỗ narrative vẫn lộ dấu vết của graph serialization.
