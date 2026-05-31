# Review Snapshot - Lane Layout, Edge Coherence, And Sync Bar

## Review Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-30
- Scope reviewed: `src/App.tsx`, `src/nodes.ts`, `src/lf-config.ts`, `docs/progress/known-issues.md`, `docs/review-task-list.md`
- Verification: source inspection + local browser check at `http://127.0.0.1:5173/`

## Executive Summary

- Lane resize/reorder hiện mới xử lý được một phần: node thường có `laneId` sẽ đổi `x` theo lane, nhưng binding đang là offset tuyệt đối nên không có guard giữ node nằm trong biên lane khi lane bị thu hẹp.
- `sync-bar` đang đứng ngoài toàn bộ lane-binding flow, nên khi lane đổi width/thứ tự, junction node này đứng yên còn node hai bên di chuyển. Điều đó kéo theo edge bị giãn/reroute lệch logic.
- `sync-bar` cũng không có bất kỳ đường UX nào để resize ở runtime hiện tại, dù model bên dưới kế thừa `RectResize.model`.

## Module Map

| Module | Files | Responsibility |
|---|---|---|
| Lane layout orchestration | `src/App.tsx` | Commit lane layout, bind node vào lane, reorder/resize lane, resize node thủ công, import/export runtime state. |
| Node geometry models | `src/nodes.ts` | Định nghĩa geometry và resize contract cho lane, activity, decision, sync-bar, note. |
| Seed graph and topology | `src/lf-config.ts` | Seed lane/node positions, đặc biệt là junction `sync-bar` và các edge đi qua nó. |
| Review and backlog artifacts | `docs/progress/known-issues.md`, `docs/review-task-list.md` | Theo dõi bug đã xác nhận và hướng triển khai kế tiếp. |

## Findings

### [P1] Lane width changes can leave lane-bound nodes outside their lane because binding is stored as an absolute offset with no clamp

- Claim: Runtime hiện chỉ reapply `laneOffsetX` theo kiểu tuyệt đối, nên khi lane bị thu hẹp, node có thể vẫn giữ offset cũ và tràn ra ngoài biên lane.
- Evidence:
  - `getLaneBinding()` lưu `laneOffsetX` là `model.x - lane.x`, tức offset tuyệt đối theo pixel, không phải tỷ lệ hoặc anchor theo biên (`src/App.tsx:299`).
  - `realignNodesToLaneLayout()` chỉ gọi `node.moveTo(nextLane.x + binding.offsetX, node.y)` và không clamp theo `nextLane.width` hoặc kích thước thực của node (`src/App.tsx:404`).
  - `startLaneResize()` recompute lane width rồi gọi `realignNodesToLaneLayout(prevLanes, resized)` nhưng không có bước nào bảo đảm node sau khi move vẫn nằm trong lane (`src/App.tsx:931`, `src/App.tsx:944`, `src/App.tsx:955`).
- Impact: Với lane hẹp đi hoặc layout thay đổi mạnh, node có thể bị nửa trong nửa ngoài lane. Đây là bug correctness của layout, không còn là chuyện polish UX.
- Recommendation: Chuyển từ `absolute offset` sang một binding có semantics rõ hơn, ví dụ `relativeX` theo tỷ lệ hoặc `alignment + inset`, rồi clamp lại theo `lane.width` và `node.width` mỗi lần commit layout.
- Confidence: Confirmed by source; user symptom is consistent with current implementation.

### [P1] Cross-lane edge logic cannot stay coherent because `sync-bar` is excluded from lane realignment while connected nodes move

- Claim: `sync-bar` không đi theo lane khi lane reorder/resize, nên các edge đi qua junction này bị kéo lệch khỏi ý đồ topology ban đầu.
- Evidence:
  - `hydrateNodeLaneBindings()` và `realignNodesToLaneLayout()` đều skip `sync-bar` hoàn toàn (`src/App.tsx:397`, `src/App.tsx:409`).
  - `node:dnd-add` và `node:drop` cũng loại `sync-bar` khỏi luồng snap/binding (`src/App.tsx:471`, `src/App.tsx:490`).
  - Seed graph tạo `n-sync` như junction nối giữa `n-a4` và `n-b1` qua `e5`, `e6` (`src/lf-config.ts:70`, `src/lf-config.ts:159`, `src/lf-config.ts:160`).
  - Runtime check: sau khi reorder lane đầu tiên sang phải, `n-a4` di chuyển từ `x=528` sang `x=405`, nhưng `sync-bar` vẫn đứng ở `x=547`; như vậy junction không đi theo topology mới dù lane đã đổi chỗ.
- Impact: Các edge nối vào `sync-bar` vẫn còn kỹ thuật là “connected”, nhưng visual logic bị méo: fork/join không còn nằm ở vùng hợp lý giữa các lane liên quan. Với diagram nghiệp vụ, đây là lỗi semantic chứ không chỉ thẩm mỹ.
- Recommendation: Biến `sync-bar` thành first-class participant của lane layout. Cần lưu nó theo `span` hoặc `attached lanes/nodes`, rồi recompute `x/width` của chính `sync-bar` trong `commitLaneLayout()` trước khi reroute edges.
- Confidence: Confirmed by source and local browser verification.

### [P1] Edge rerouting during lane layout commits is inconsistent because the explicit edge-sync path is only used for manual shape resize

- Claim: Codebase đã có helper `syncConnectedEdges()`, nhưng helper này chỉ chạy ở manual shape resize; lane layout commits lại dựa vào side effects ngầm của `moveTo`, dẫn tới behavior không nhất quán giữa resize shape và resize/reorder lane.
- Evidence:
  - `syncConnectedEdges()` tồn tại như một helper riêng để cập nhật edge endpoints theo anchors hiện tại (`src/App.tsx:327`).
  - Helper này chỉ được gọi trong `startShapeResize()` (`src/App.tsx:1041`).
  - `commitLaneLayout()` và `realignNodesToLaneLayout()` không gọi bất kỳ bước reroute/edge-sync tường minh nào sau khi dịch node (`src/App.tsx:429`, `src/App.tsx:404`).
- Impact: Runtime phụ thuộc vào behavior implicit của LogicFlow cho một số move path, trong khi path khác lại tự sync bằng tay. Đây là nền đất dễ sinh regression, nhất là khi có junction node như `sync-bar` hoặc khi sau này thêm custom anchors.
- Recommendation: Chuẩn hóa một post-layout pass: sau khi lane commit và node/sync-bar được reposition, reroute toàn bộ edge của các node bị ảnh hưởng theo một cơ chế thống nhất.
- Confidence: Confirmed for code inconsistency; mức độ méo edge cụ thể ngoài `sync-bar` là partly inferred from source plus user report.

### [P2] `sync-bar` cannot be manually resized because the runtime never exposes it as an active resizable node

- Claim: Dù `SyncBarModel` kế thừa `RectResize.model`, runtime hiện không có đường nào để user chọn và resize `sync-bar`.
- Evidence:
  - `isUserResizableNode()` chỉ cho phép `activity`, `decision`, `note` (`src/App.tsx:203`).
  - `handleCanvasMouseUp()` chỉ set `activeNodeId` nếu node type thỏa `isUserResizableNode()` (`src/App.tsx:866`).
  - `shapeOverlay` và `startShapeResize()` phụ thuộc hoàn toàn vào `activeNode` này (`src/App.tsx:898`, `src/App.tsx:979`).
  - Browser check: click trực tiếp vào `sync-bar` không hiện `shape-resize-handle`, cũng không hiện lane toolbar.
  - `SyncBarModel` còn khóa `minHeight = maxHeight = 8`, tức nếu sau này mở resize thì contract hợp lý nhất là `width-only`, không phải full freeform resize (`src/nodes.ts:315`).
- Impact: User report “vẫn đang không thay đổi được kích thước Sync Bar” là đúng với runtime hiện tại. Đây không phải bug perception.
- Recommendation: Cho `sync-bar` một resize contract rõ ràng: `width-only` bằng custom handle hoặc mở nó trong `isUserResizableNode()` rồi freeze chiều cao ở model/UI.
- Confidence: Confirmed.

## Module Directions

### Lane layout orchestration

- Current state: Đã có khung commit lane layout, nhưng semantics của binding còn quá mỏng cho lane resize/reorder thực tế.
- Main risks:
  - Node binding không giữ được invariant “node phải còn nằm trong lane”.
  - `sync-bar` và edge reroute đi theo một flow khác hẳn node thường.
- Recommended direction: Refactor in place.
- Why now: Phần lớn bug nằm ở orchestration, không cần rewrite mô hình node từ đầu.

### Node geometry models

- Current state: Geometry cơ bản ổn, nhưng `sync-bar` mới chỉ là rect mỏng chứ chưa có contract layout riêng cho junction spanning nhiều lane.
- Main risks:
  - `sync-bar` bị xử như shape thường ở model nhưng lại bị bỏ qua ở runtime.
  - Resize contract giữa `activity/note/decision` và `sync-bar` không đồng nhất.
- Recommended direction: Redesign interface.
- Why now: Nếu không chốt `sync-bar` là node thuộc một lane hay span nhiều lane, mọi fix edge/layout phía trên sẽ tiếp tục chắp vá.

### Seed graph and topology

- Current state: Seed diagram đang phụ thuộc mạnh vào vị trí tuyệt đối của `n-sync`.
- Main risks:
  - Layout changes phá vỡ quan hệ hình học ban đầu của fork/join.
  - Import/export sau này khó giữ semantic nếu chỉ lưu `x/y` tuyệt đối.
- Recommended direction: Harden.
- Why now: Đây là nơi cần làm rõ dữ liệu topology nào phải persisted để layout không bị drift.

## Recommended Next Steps

1. Chuẩn hóa lane-binding cho node thường: dùng relative/clamped placement thay cho absolute `laneOffsetX`.
2. Thiết kế dữ liệu riêng cho `sync-bar`: ít nhất cần biết nó span lane nào hoặc bám node nào.
3. Thêm một `post-layout reroute pass` sau `commitLaneLayout()` để edge update theo cùng một luật.
4. Mở `sync-bar` resize với contract `width-only` và persist `nodeSize.width`.
5. Viết regression test cho ba flow: resize lane hẹp đi, reorder lane có `sync-bar`, resize `sync-bar`.
