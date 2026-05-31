# Code Review Task List

## Review Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-30
- Entrypoints reviewed: `src/App.tsx`, `src/nodes.ts`, `src/lf-config.ts`
- Modules reviewed: lane-layout-orchestration, node-geometry-models, seed-graph-topology
- Modules not reviewed: backend/persistence beyond current JSON import-export, external LogicFlow internals beyond runtime behavior needed for this review

## Executive Summary

- Overall health: Runtime chính cho lane resize/reorder và `sync-bar` đã được khóa lại; backlog còn lại nghiêng về refactor, schema hardening, và regression tests.
- Highest-risk area: `src/App.tsx` lane commit flow.
- Fastest high-value win: Tách helper layout ra khỏi `App.tsx` và thêm regression tests browser cho lane-edge-sync.
- Recommended execution order: Refactor helper layout -> harden import/export metadata -> thêm regression tests.

## Module Directions

### lane-layout-orchestration

- Current state: Có flow commit lane layout, nhưng đang trộn UI action, binding, geometry, và edge side effects vào một chỗ.
- Main risks:
  - `laneOffsetX` là absolute pixel offset nên không giữ được node trong lane khi width thay đổi.
  - `sync-bar` bị loại khỏi flow này nên cross-lane logic bị lệch.
- Recommended direction: Refactor in place.
- Why now: Đây là nơi sửa trực tiếp được ba bug user report mà chưa cần đổi stack hay rewrite lớn.

### node-geometry-models

- Current state: `activity`, `decision`, `note` có resize contract; `sync-bar` mới chỉ có model hình học cơ bản.
- Main risks:
  - `sync-bar` chưa có contract `width-only` rõ ràng.
  - Không có metadata topology để nói nó thuộc lane nào hoặc span lane nào.
- Recommended direction: Redesign interface.
- Why now: Nếu `sync-bar` vẫn chỉ là rect mỏng vô danh, mọi fix lane/edge sẽ luôn phải special-case.

### seed-graph-topology

- Current state: Diagram mẫu đang encode topology bằng `x/y` tuyệt đối.
- Main risks:
  - Layout commit thay đổi lane có thể làm seed topology drift.
  - Import/export về sau khó giữ semantic nếu chỉ dựa trên toạ độ.
- Recommended direction: Harden.
- Why now: Cần chốt dữ liệu nền trước khi mở rộng fix sang import/export và regression tests.

## Prioritized Tasks

### Now

#### TASK-001 - Chuẩn hóa lane binding để node luôn nằm trong lane sau resize/reorder
- Priority: P1
- Status: Done (2026-05-31)
- Module: lane-layout-orchestration
- Problem: Node thường đang được bind vào lane bằng `laneOffsetX` tuyệt đối, nên khi lane hẹp lại hoặc đổi vị trí mạnh, node có thể giữ offset cũ và tràn khỏi lane.
- Why it matters: Đây là bug correctness trực tiếp trên layout, đúng với symptom user report đầu tiên.
- Implementation steps:
  1. Đổi dữ liệu binding từ `laneOffsetX` tuyệt đối sang một representation có semantics rõ hơn, ví dụ `relativeX`, hoặc `alignment + inset`.
  2. Trong `realignNodesToLaneLayout()`, tính lại `x` của node theo binding mới.
  3. Clamp vị trí node theo `lane.width` và kích thước thực của node để node không vượt ra ngoài hai mép lane.
  4. Khi user drag node trong lane, cập nhật binding mới theo rule tương tự thay vì reset về `0` hoặc offset tuyệt đối.
- Acceptance criteria:
  - Sau khi thu hẹp lane, node thuộc lane đó vẫn nằm trọn trong lane.
  - Sau khi reorder lane, node đi theo lane đúng semantic đã lưu.
  - Export/import giữ được binding mới.
- Dependencies: None
- Verification: Browser test với 1 node đặt gần mép phải, 1 node gần mép trái, rồi shrink lane và reorder lane.

#### TASK-002 - Đưa `sync-bar` vào lane layout commit như một junction node thực thụ
- Priority: P1
- Status: Done (2026-05-31)
- Module: lane-layout-orchestration
- Problem: `sync-bar` đang bị skip trong `hydrateNodeLaneBindings()` và `realignNodesToLaneLayout()`, nên khi lane đổi width/thứ tự, junction này đứng yên còn node hai bên di chuyển.
- Why it matters: Các edge qua fork/join bị kéo lệch logic, dù technical connection vẫn còn.
- Implementation steps:
  1. Chốt dữ liệu topology cho `sync-bar`: tối thiểu cần biết nó span lane nào, hoặc bám vào node nguồn/đích nào.
  2. Bổ sung metadata đó vào graph data và seed data.
  3. Trong `commitLaneLayout()`, recompute `sync-bar` position/width sau khi lanes thay đổi.
  4. Loại bỏ việc skip `sync-bar` trong những chỗ cần realign, hoặc tách hẳn một `realignSyncBars()` pass rõ ràng.
- Acceptance criteria:
  - Sau reorder/resize lane, `sync-bar` di chuyển theo topology mới thay vì đứng yên.
  - Các node nối với `sync-bar` không bị để lại hai bên junction cũ.
  - Export/import không làm mất metadata topology mới.
- Dependencies: TASK-001
- Verification: Browser test với sample diagram hiện tại, reorder lane đầu và resize lane giữa, rồi kiểm tra `sync-bar` có cập nhật vị trí.

#### TASK-003 - Chuẩn hóa reroute edge sau lane layout commit
- Priority: P1
- Status: Done (2026-05-31)
- Module: lane-layout-orchestration
- Problem: Runtime hiện chỉ gọi `syncConnectedEdges()` ở manual shape resize; lane commit lại không có post-layout reroute pass thống nhất.
- Why it matters: Edge behavior giữa các flow đang không nhất quán và rất dễ regress khi thêm special-case cho `sync-bar`.
- Implementation steps:
  1. Xác định danh sách node bị ảnh hưởng trong mỗi `commitLaneLayout()`.
  2. Sau khi node/sync-bar được reposition, chạy một pass update endpoints/reroute edge cho tất cả node bị ảnh hưởng.
  3. Gộp helper hiện có (`syncConnectedEdges`) vào flow dùng chung, hoặc thay bằng API LogicFlow phù hợp hơn nếu có.
  4. Đảm bảo lane resize, lane reorder, và shape resize đều đi qua cùng một đường reroute.
- Acceptance criteria:
  - Edge sau reorder/resize lane không còn giữ anchor cũ sai chỗ.
  - Shape resize và lane layout commit không còn dùng hai cơ chế edge sync khác nhau.
  - Flow với `sync-bar` giữ được topology dễ hiểu sau khi lane đổi layout.
- Dependencies: TASK-002
- Verification: Browser test các edge `e5`, `e6` quanh `n-sync` và ít nhất một edge giữa hai node thường.

#### TASK-004 - Mở manual resize cho `sync-bar` với contract `width-only`
- Priority: P1
- Status: Done (2026-05-31)
- Module: node-geometry-models
- Problem: `sync-bar` hiện không bao giờ trở thành `activeNode`, nên user không thể resize nó; đồng thời model đang khóa chiều cao ở `8`, nghĩa là UX đúng phải là resize chiều ngang.
- Why it matters: Đây là bug user report thứ ba, và cũng là một prerequisite để junction layout trở nên chỉnh được bằng tay.
- Implementation steps:
  1. Mở `sync-bar` vào flow active selection cho resize, hoặc tạo handle riêng cho nó.
  2. Giữ `minHeight = maxHeight = 8`, nhưng cho phép thay đổi `width`.
  3. Persist `nodeSize.width`/`width` của `sync-bar` vào graph data.
  4. Khi width thay đổi, reroute lại các edge nối vào `sync-bar`.
- Acceptance criteria:
  - Click `sync-bar` hiện control resize phù hợp.
  - User kéo được chiều ngang của `sync-bar`.
  - Export/import giữ được width mới của `sync-bar`.
- Dependencies: TASK-003
- Verification: Browser test click và kéo `sync-bar`, rồi reload/import lại JSON.

### Next

#### TASK-005 - Tách helper geometry/layout khỏi `App.tsx`
- Priority: P2
- Status: Pending
- Module: lane-layout-orchestration
- Problem: `App.tsx` đang chứa quá nhiều logic layout: lane binding, hit-test, edge sync, resize handlers, import normalization.
- Why it matters: Nếu tiếp tục vá trực tiếp ở đây, mỗi bug fix mới sẽ làm risk regression cao hơn.
- Implementation steps:
  1. Tách helper lane binding/re-align sang một module riêng, ví dụ `src/layout/lane-layout.ts`.
  2. Tách helper edge reroute/sync sang `src/layout/edge-sync.ts`.
  3. Giữ `App.tsx` chủ yếu làm orchestration/UI wiring.
  4. Viết type rõ cho `LaneBinding`, `SyncBarLayout`, `AffectedNodeSet`.
- Acceptance criteria:
  - `App.tsx` không còn tự cài mọi helper layout nội bộ.
  - Logic lane commit có thể unit test mà không cần render React component.
- Dependencies: TASK-001, TASK-002, TASK-003
- Verification: Typecheck + chạy lại smoke test browser cho lane resize/reorder và sync-bar.

#### TASK-006 - Nâng seed/import-export từ absolute coordinates lên topology-aware metadata
- Priority: P2
- Status: Partial (2026-05-31)
- Module: seed-graph-topology
- Problem: Graph data hiện lưu gần như hoàn toàn theo `x/y` tuyệt đối, chưa có semantic data để rebuild layout ổn định sau lane changes.
- Why it matters: Khi app tiến thêm một bước về lane-aware layout, import/export sẽ trở thành nguồn regression nếu không cùng contract.
- Implementation steps:
  1. Thêm metadata rõ cho node thường (`laneId`, binding mới) và `sync-bar` (`span`, attached lanes/nodes, width override`).
  2. Chuẩn hóa import path để hydrate đủ metadata trước khi render.
  3. Chuẩn hóa export path để không làm rơi contract mới.
  4. Backfill sample data và reset data theo schema mới.
- Acceptance criteria:
  - Export JSON chứa đủ dữ liệu để rebuild lane-aware layout.
  - Import JSON vào lại cho ra vị trí tương đương trước khi reload.
- Dependencies: TASK-001, TASK-002, TASK-004
- Verification: Export/import round-trip với diagram đã resize/reorder lane và resize `sync-bar`.

### Later

#### TASK-007 - Thêm regression test cho lane-edge-sync và sync-bar resize
- Priority: P2
- Status: Pending
- Module: seed-graph-topology
- Problem: Đây là nhóm bug liên quan SVG/layout runtime, rất khó bắt nếu chỉ dựa vào TypeScript build.
- Why it matters: Một khi đã chốt contract mới cho lane binding và junction topology, cần khóa nó bằng test.
- Implementation steps:
  1. Thêm browser regression test cho lane reorder với `sync-bar`.
  2. Thêm test cho lane shrink làm node vẫn nằm trong lane.
  3. Thêm test cho resize `sync-bar` và reroute edge tương ứng.
  4. Thêm test round-trip export/import cho diagram đã có lane/sync-bar overrides.
- Acceptance criteria:
  - Có command regression rõ ràng trong `package.json`.
  - Các bug user report hiện tại sẽ fail test nếu regress.
- Dependencies: TASK-001 đến TASK-006
- Verification: Chạy suite local và quan sát từng case pass ổn định.

## AI BRD Docs Alignment

### Now

#### TASK-008 - Đồng bộ Phase 1 BRD template với UC-06 cho loops và annotations
- Priority: P1
- Status: Done (2026-05-31)
- Module: ai-brd-docs
- Problem: `UC-06` đang yêu cầu section `Loops` và `Annotations`, nhưng template Phase 1 trong feature doc chưa định nghĩa hai section này.
- Why it matters: Nếu không chốt ngay, backend renderer và QA sẽ không có cùng kỳ vọng về output Phase 1.
- Implementation steps:
  1. Chọn một contract duy nhất cho Phase 1:
     - thêm `Loops` và `Annotations` thành section riêng, hoặc
     - map chúng vào `Exceptions / warnings` và `Assumptions / open questions`.
  2. Cập nhật `docs/product/ai-brd-description-feature.md`.
  3. Cập nhật `docs/use-cases/UC-06-sinh-brd-tu-diagram.md` cho khớp wording và expected output.
- Acceptance criteria:
  - Feature doc và UC-06 mô tả cùng một Phase 1 template.
  - Không còn section nào được UC yêu cầu nhưng template không định nghĩa.
- Dependencies: None
- Verification: Review chéo Section 11 của feature doc với phần `Kết quả mong đợi` và các alternate flows trong UC-06.

#### TASK-009 - Chốt contract Step 6: deterministic render hay LLM render
- Priority: P1
- Status: Done (2026-05-31)
- Module: ai-brd-docs
- Problem: Product spec, backend architecture, và UC-06 chưa thống nhất việc BRD markdown có được render deterministically từ structured spec hay gọi model thêm một lần nữa.
- Why it matters: Quyết định này ảnh hưởng trực tiếp đến traceability, chi phí, post-check scope, và thiết kế service backend.
- Implementation steps:
  1. Chọn contract cho Phase 1.
  2. Nếu chọn deterministic render, sửa product spec và backend architecture để Step 6 không còn được mô tả như model generation.
  3. Nếu chọn LLM render, bổ sung guardrails, cost impact, và post-check scope tương ứng.
  4. Sync lại UC-06 để mô tả đúng flow backend.
- Acceptance criteria:
  - Ba doc dùng cùng một mô tả cho Step 5 và Step 6.
  - Không còn module/service nào ngụ ý một đường đi khác.
- Dependencies: None
- Verification: Review chéo pipeline ở feature doc, module map ở backend architecture, và Step 9 trong UC-06.

#### TASK-010 - Siết chặt contract vận hành của backend architecture doc
- Priority: P2
- Status: Done (2026-05-31)
- Module: ai-brd-docs
- Problem: `architecture-brd-backend.md` đang mô tả deployment như đã chốt nhưng vẫn để hosting/domain mở, đồng thời thiếu env var `BRD_PROVIDER` dù local workflow dùng nó.
- Why it matters: Điều này gây drift giữa tài liệu vận hành và bootstrap backend thực tế.
- Implementation steps:
  1. Hoặc chốt một lựa chọn deploy Phase 1, hoặc đổi wording để nói rõ đây là option memo với decision còn mở.
  2. Thêm `BRD_PROVIDER` vào bảng env vars và mô tả precedence rules.
  3. Nếu giữ nhiều deployment option, thêm tiêu chí chọn giữa Fly.io và VPS.
  4. Cập nhật review v2 hoặc thêm addendum để chỉ rõ `UC-06` và `architecture-brd-backend.md` đã tồn tại.
- Acceptance criteria:
  - Backend architecture doc không còn tự mâu thuẫn giữa phần mở đầu và phần open questions.
  - Env-var table bao phủ toàn bộ biến được local workflow sử dụng.
  - Review v2 không còn khiến người đọc nghĩ hai doc này chưa được tạo.
- Dependencies: None
- Verification: Review chéo Section 1/7/12 của backend architecture doc và phần disposition cuối của review v2.
