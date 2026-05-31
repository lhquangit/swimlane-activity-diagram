# Review Snapshot - Lane Management And Sizing

## Review Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-30
- Scope reviewed: `src/App.tsx`, `src/nodes.ts`, `src/lf-config.ts`, `src/DndPanel.tsx`, `docs/progress/known-issues.md`, `docs/use-cases/UC-03-quan-ly-lane.md`, `docs/scope/features.md`, `docs/scope/architecture.md`
- Verification: source inspection + local browser check at `http://127.0.0.1:5173/`

## Executive Summary

- `Đổi tên lane` hiện đã chạy trong runtime.
- `Xoá lane` hiện cũng chạy trong runtime, nhưng là interaction ẩn bằng right-click nên rất dễ bị hiểu là chưa làm.
- `Resize lane`, `reorder lane`, và `manual resize shape` chưa được implement. Đây không còn là bug fix dở dang trong code hiện tại, mà là các capability chưa tồn tại.
- `known-issues`, `use case`, và một phần docs sản phẩm đang diễn đạt rộng hơn phạm vi implementation thật, làm kỳ vọng test bị lệch.

## Module Map

| Module | Files | Responsibility |
|---|---|---|
| Editor runtime | `src/App.tsx` | Khởi tạo LogicFlow, đăng ký event rename/delete/snap/autosize, toolbar actions, import/export. |
| Lane and node models | `src/nodes.ts` | Định nghĩa lane model, activity/decision/note autosize, lane layout constants. |
| Diagram config | `src/lf-config.ts` | Seed graph data, build lane nodes, snap-to-lane logic, LogicFlow options. |
| Editor guidance and product docs | `src/DndPanel.tsx`, `docs/use-cases/UC-03-quan-ly-lane.md`, `docs/scope/features.md`, `docs/scope/architecture.md`, `docs/progress/known-issues.md` | Hướng dẫn user, mô tả capability, lưu issue status. |

## Findings

### [P1] Manual lane resize, lane reorder, và manual shape resize chưa tồn tại trong runtime

- Claim: Các capability mà user đang thử test chưa được implement, nên hiện tại không thể kỳ vọng app hỗ trợ chúng.
- Evidence:
  - Lane chỉ được auto-grow theo chiều cao qua `getRequiredLaneHeight()` và `setLaneHeight()`; không có API nào đổi `lane.width` hoặc resize bằng tương tác người dùng (`src/App.tsx:159`, `src/App.tsx:170`, `src/App.tsx:218`).
  - Thứ tự lane phụ thuộc vào thứ tự mảng `lanes` và helper `withPositions()`; không có event drag/reorder hay control move left/right (`src/App.tsx:191`, `src/App.tsx:203`, `src/nodes.ts:374`).
  - Shape chỉ auto-size theo text cho `activity`, `decision`, `note`; không có `NodeResize` plugin hay control resize trong source (`src/nodes.ts:51`, `src/nodes.ts:243`, `src/nodes.ts:268`, `src/nodes.ts:317`).
  - Product doc đã ghi rõ `Resize node (drag corner)` còn backlog (`docs/scope/features.md:55`) và use case lane reorder cũng ghi “Hiện chưa hỗ trợ” (`docs/use-cases/UC-03-quan-ly-lane.md:78`).
- Impact: User test theo kỳ vọng “lane/shape không còn fixed” sẽ thấy app vẫn thiếu khả năng điều chỉnh bố cục. Team có nguy cơ hiểu nhầm đây là regression thay vì feature gap.
- Recommendation: Tách riêng thành backlog rõ ràng cho `lane resize`, `lane reorder`, `manual shape resize` thay vì gộp vào KI-02.
- Confidence: Confirmed.

### [P2] Lane delete và lane rename đang là hidden interaction, nên bị hiểu là hỏng

- Claim: Hai tính năng này có trong runtime, nhưng discoverability quá kém và phần hướng dẫn trong app không phản ánh đúng thao tác.
- Evidence:
  - Rename lane gắn vào `node:dbclick` (`src/App.tsx:291`), delete lane gắn vào `node:contextmenu` (`src/App.tsx:309`).
  - Lane bị set `selectable = false` và `draggable = false`, nên user không thể dựa vào affordance “select rồi DEL” để suy luận ra thao tác đúng (`src/nodes.ts:100`).
  - Sidebar guide chỉ nói double-click node/edge để sửa text và nhấn `DEL` để xoá, không nói lane rename/delete là thao tác riêng (`src/DndPanel.tsx:35`).
  - Browser check xác nhận double-click lane đổi tên được và right-click lane xoá được trên desktop.
- Impact: Tính năng có tồn tại nhưng tester hợp lý vẫn kết luận “chưa làm được”, dẫn tới vòng review/fix sai trọng tâm.
- Recommendation: Thêm affordance rõ ràng cho lane, ít nhất là hướng dẫn inline; tốt hơn là có menu/header action thay cho gesture ẩn.
- Confidence: Confirmed.

### [P2] Tài liệu hiện tại đang overstate phạm vi fix và lệch so với runtime

- Claim: Docs review/progress/use-case hiện mô tả phạm vi fix rộng hơn behavior thật và còn giữ chi tiết runtime cũ.
- Evidence:
  - `known-issues` đang dùng tiêu đề “Lane rename và kích thước lane/shape bị cố định” nên dễ được hiểu là toàn bộ sizing đã được xử lý (`docs/progress/known-issues.md:24`).
  - `UC-03` vẫn ghi event `node:dbl-click` thay vì `node:dbclick` (`docs/use-cases/UC-03-quan-ly-lane.md:34`).
  - `architecture` vẫn mô tả event cũ (`docs/scope/architecture.md:39`).
  - `features` ghi rename/delete là ✅, nhưng không làm rõ đó là hidden interaction; node resize vẫn backlog, trong khi changelog/issue dễ khiến người đọc nghĩ sizing tổng thể đã xong (`docs/scope/features.md:16`, `docs/scope/features.md:17`, `docs/scope/features.md:55`).
- Impact: Tài liệu trở thành nguồn gây lệch kỳ vọng thay vì nguồn sự thật cho implementation.
- Recommendation: Giữ doc status theo đúng capability hiện có: tách “auto-grow theo nội dung” khỏi “manual resize”, và ghi rõ interaction của lane.
- Confidence: Confirmed.

### [P2] Lane auto-size hiện chỉ giải quyết overflow theo trục dọc, chưa giải quyết lane density hoặc width pressure

- Claim: Bản fix sizing hiện mới xử lý node thấp nhất trong canvas, chưa có logic nào cho trường hợp lane bị chật theo chiều ngang hoặc cần điều chỉnh width.
- Evidence:
  - `getRequiredLaneHeight()` chỉ tính `maxBottom` của node rồi nâng `laneHeight` (`src/App.tsx:159`).
  - `setLaneHeight()` chỉ cập nhật `model.height`; `lane.width` giữ nguyên từ config (`src/App.tsx:170`).
  - `buildLaneNodes()` luôn lấy `properties.width` từ `LaneConfig.width` và `handleAddLane()` hard-code lane mới là `320` (`src/lf-config.ts:5`, `src/App.tsx:358`).
- Impact: Nếu bài toán thực tế là nhiều shape, label dài, hoặc cần widen một lane riêng, user vẫn bị giới hạn.
- Recommendation: Khi implement lane resize, tách rõ `autoHeight` và `manualWidth` thay vì coi “lane không còn fixed” là một việc đã xong.
- Confidence: Confirmed.

## Module Directions

### Editor runtime

- Current state: LogicFlow event flow đã đủ để rename/delete/autosize cơ bản.
- Main risks:
  - Trộn lẫn giữa bug fix runtime và product capability chưa tồn tại.
  - Hidden gesture không được phản ánh ở UI.
- Recommended direction: Refactor in place.
- Why now: Đây là nơi cần thêm control rõ ràng cho lane mà không làm vỡ các fix hiện tại.

### Lane and node models

- Current state: Model hiện hỗ trợ autosize theo text và auto-grow lane theo chiều cao.
- Main risks:
  - Width và reorder chưa có data model riêng.
  - Manual resize chưa được bật ở cả lane lẫn shape.
- Recommended direction: Harden.
- Why now: Cần chốt contract về `auto size` vs `manual size` trước khi thêm UI.

### Diagram config

- Current state: Lane positioning phụ thuộc vào thứ tự mảng và width cố định.
- Main risks:
  - Không có abstraction cho reorder hoặc width per lane.
  - Lane mới luôn dùng width mặc định.
- Recommended direction: Redesign interface.
- Why now: Reorder và width control sẽ buộc module này thay đổi.

### Editor guidance and product docs

- Current state: Tài liệu có coverage khá tốt nhưng đang lệch runtime ở các thao tác lane.
- Main risks:
  - User test sai đường vì docs sai hoặc thiếu.
  - Review sau khó phân biệt bug, feature gap, và regression.
- Recommended direction: Consolidate duplication.
- Why now: Chỉ cần một vòng chỉnh docs là giảm được nhiều nhiễu trong các vòng test tiếp theo.

## Recommended Next Steps

1. Sửa tài liệu và known-issues để phản ánh đúng phạm vi fix hiện tại.
2. Quyết định rõ product expectation cho lane sizing: `auto-grow only` hay `auto-grow + manual resize`.
3. Thêm affordance rõ ràng cho lane rename/delete trong UI.
4. Tách backlog riêng cho `lane reorder` và `manual shape resize`.
5. Sau khi chốt UX, thêm browser regression test cho lane rename/delete và sizing behavior.
