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
- Status: Done
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
- Status: Partial (2026-05-31)
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
- Remaining gap: Hai acceptance criteria đầu đã thỏa, nhưng AC thứ 3 vẫn còn mở vì `docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md` chưa có addendum/superseding note.
- Verification: Review chéo Section 1/7/12 của backend architecture doc và phần disposition cuối của review v2.

## AI BRD Implementation Order

### Now

#### TASK-011 - Scaffold backend app và shared contract types cho AI BRD
- Priority: P1
- Status: Done (2026-05-31)
- Module: ai-brd-backend-contract
- Problem: Hiện repo mới có tài liệu; chưa có FastAPI app, response models, hay frontend type tương ứng để hiện thực hóa contract vừa chốt.
- Why it matters: Nếu không dựng contract trước, backend và frontend sẽ phải đoán shape của request/response trong lúc code, rất dễ lệch khỏi doc.
- Implementation steps:
  1. Tạo `apps/api/` theo layout đã chốt trong `docs/scope/architecture-brd-backend.md`.
  2. Khai báo Pydantic models cho:
     - `DiagramSemanticRequest`
     - `DiagramBRDSpec`
     - `ResponseEnvelope`
     - `ValidationResult`
     - `GenerateResult`
     - `ErrorObject`
  3. Tạo TypeScript types tương ứng ở frontend cho request/response envelope.
  4. Thêm `.env.example` cho backend với toàn bộ env vars đã mô tả trong doc, nhưng không chứa secret thật.
- Acceptance criteria:
  - Repo có backend app skeleton chạy được với `/healthz`.
  - Backend và frontend cùng dùng một contract type rõ ràng cho `validate` và `generate`.
  - Không có field nào trong Section 13 của feature doc bị thiếu ở schema code.
- Dependencies: None
- Verification: Chạy backend local, hit `/healthz`, typecheck backend/frontend schema layer.

#### TASK-012 - Implement deterministic core pipeline và `MockProvider`
- Priority: P1
- Status: Done (2026-05-31)
- Module: ai-brd-core-pipeline
- Problem: Frontend chưa thể tích hợp ổn định nếu backend chưa có deterministic path để trả về fixture hợp lệ theo contract.
- Why it matters: Đây là nền cho chiến lược `mock-first`; cần test flow thật qua HTTP mà chưa phụ thuộc OpenRouter key.
- Implementation steps:
  1. Implement stub/pure modules:
     - `extract.py`
     - `normalize.py`
     - `validate.py`
     - `interpret.py`
     - `render.py`
     - `postcheck.py`
  2. Tạo `MockProvider` trả `DiagramBRDSpec` deterministic theo input hash hoặc fixture seed.
  3. Đảm bảo BRD markdown luôn được render từ spec bằng template deterministic, không có prose pass thứ hai.
  4. Backfill 2-3 fixture diagram representative: happy path, blocking validation, ambiguity with warnings.
- Acceptance criteria:
  - Backend có thể tạo `spec + brd_markdown` bằng `BRD_PROVIDER=mock`.
  - Cùng một input mock cho ra cùng một output.
  - Có ít nhất một fixture cho `completed`, một fixture cho `blocking`, và một fixture cho `warnings`.
- Dependencies: TASK-011
- Verification: Unit tests cho pipeline modules + snapshot test cho renderer output.

#### TASK-013 - Implement `POST /api/brd/validate` và `POST /api/brd/generate` với error/idempotency contract
- Priority: P1
- Status: Done (2026-05-31)
- Module: ai-brd-backend-runtime
- Problem: Contract đã có trên doc, nhưng chưa có runtime thực thi envelope, status codes, error object, hay idempotency behavior.
- Why it matters: Đây là điểm nối thật sự để frontend có thể code dựa trên backend local mà không cần mock thủ công trong client.
- Implementation steps:
  1. Implement route `POST /api/brd/validate` theo envelope/status contract.
  2. Implement route `POST /api/brd/generate` theo envelope/status contract.
  3. Thêm idempotency storage Phase 1 dạng in-memory hoặc TTL cache local theo `BRD_IDEMPOTENCY_TTL_SECONDS`.
  4. Implement các trạng thái:
     - `completed`
     - `replayed`
     - `in_progress`
     - `conflict`
     - `blocking`
     - `failed`
  5. Map đầy đủ các mã lỗi/doc status codes đã chốt trong Section 13 và 15.
- Acceptance criteria:
  - `/validate` trả đúng `200/400/429/500` theo contract.
  - `/generate` trả đúng `200/202/400/409/422/429/502/503` theo contract.
  - Reuse cùng `Idempotency-Key` + payload giống nhau cho ra `replayed` hoặc `in_progress`.
  - Reuse cùng key + payload khác cho ra `409 conflict`.
- Dependencies: TASK-011, TASK-012
- Verification: API integration tests cho status/error/idempotency matrix bằng `MockProvider`.

#### TASK-014 - Tích hợp frontend với backend mock và hoàn thiện BRD side panel
- Priority: P1
- Status: Done (2026-05-31)
- Module: ai-brd-frontend-flow
- Problem: Feature UX chính chưa tồn tại: nút `Generate BRD`, side panel, warning states, editable draft, outdated state.
- Why it matters: Đây là phần user nhìn thấy; cần nối với backend mock trước để kiểm được toàn bộ luồng mà chưa phụ thuộc provider thật.
- Implementation steps:
  1. Thêm action `Generate BRD` trên toolbar editor.
  2. Tạo API client gọi `POST /api/brd/validate` và `POST /api/brd/generate`.
  3. Render panel 3 tab:
     - `Warnings`
     - `Structured Spec`
     - `BRD Draft`
  4. Cho phép edit markdown trực tiếp trong `BRD Draft`.
  5. Implement UX cho các trạng thái:
     - loading step-by-step
     - `blocking`
     - `failed`
     - `replayed`
     - `conflict`
     - `outdated`
  6. Implement `Copy` và `Export markdown`.
- Acceptance criteria:
  - User có thể generate BRD từ backend mock và thấy đủ 3 tab.
  - User sửa được `BRD Draft` và export ra đúng nội dung đã sửa.
  - Diagram đổi sau khi generate làm panel hiển thị `Outdated`.
  - Frontend không chứa hard-coded fake response ngoài test harness.
- Dependencies: TASK-013
- Verification: Browser smoke test local với backend mock + frontend dev server.

#### TASK-015 - Thêm test pyramid mặc định cho mock path
- Priority: P1
- Status: Done (2026-06-01)
- Module: ai-brd-test-pyramid
- Problem: Nếu không khóa mock path bằng test sớm, feature sẽ rất dễ regress ngay khi bắt đầu nối provider thật.
- Why it matters: Đây là hàng rào giúp vòng coding hằng ngày không cần API key nhưng vẫn an toàn.
- Implementation steps:
  1. Thêm backend unit tests cho deterministic modules.
  2. Thêm backend integration tests cho `validate/generate` với `MockProvider`.
  3. Thêm browser/Playwright flow cho:
     - happy path generate
     - blocking validation
     - edited draft export
     - outdated badge
     - idempotent retry/replay
  4. Thêm scripts/package commands tách biệt rõ:
     - `test:api-mock`
     - `test:ui-mock`
     - `test:brd-mock`
- Acceptance criteria:
  - Có command test mặc định không cần key thật.
  - PR/local dev có thể verify feature AI BRD end-to-end bằng mock path.
  - Failure ở contract/status/idempotency hoặc UI tab flow sẽ làm test fail rõ.
- Dependencies: TASK-013, TASK-014
- Verification: Chạy full mock suite local không cần `BRD_OPENROUTER_API_KEY`.
- Progress update:
  - Da them backend pytest suite cho `validate/generate`, idempotency, va deterministic render mapping.
  - Da them UI tests bang Vitest + Testing Library cho semantic normalization va BRD panel tabs/edit flow.
  - Da them scripts `test:api-mock`, `test:ui-mock`, `test:brd-mock`.
  - Da them Playwright E2E cho flow `Generate BRD` -> edit draft -> outdated -> export, va case local pre-validation chan request backend.

#### TASK-019 - Đổi `interpret_request()` sang graph traversal thật cho main flow
- Priority: P1
- Module: ai-brd-core-pipeline
- Status: Done (2026-05-31)
- Problem: `main_flow_steps` hiện được suy từ thứ tự tọa độ (`y`, `x`) của node thay vì đi theo topology của graph, nên BRD có thể mô tả sai luồng chính khi diagram có branch, parallel path, hoặc node rời.
- Why it matters: Đây là lỗi correctness trực tiếp trên output nghiệp vụ; BRD nghe mượt nhưng có thể sai logic thực của diagram.
- Implementation steps:
  1. Trong `services/interpret.py`, thay logic sort theo tọa độ bằng traversal bắt đầu từ `start` nodes và adjacency từ edges.
  2. Tách rõ:
     - `main_flow_nodes`
     - `branch outcomes`
     - `parallel blocks`
     - `disconnected / unreachable nodes`
  3. Định nghĩa policy Phase 1 cho nhiều `start` hoặc graph rời: block hay warning + `open_questions`.
  4. Thêm regression tests cho:
     - happy path tuyến tính
     - branch có hai outcome
     - node rời không được lọt vào `main_flow_steps`
     - loop không phá traversal
- Acceptance criteria:
  - `main_flow_steps` phản ánh thứ tự theo edge topology, không theo tọa độ canvas.
  - Node không reachable từ `start` không tự xuất hiện trong main flow.
  - Branch và parallel path vẫn được giữ riêng theo contract hiện tại.
- Dependencies: TASK-012, TASK-013
- Verification: Backend tests với fixture graph có cùng tọa độ nhưng topology khác nhau phải cho main flow khác nhau.

#### TASK-020 - Ngừng gán lane theo “nearest center” cho node ngoài lane
- Priority: P1
- Module: ai-brd-frontend-flow
- Status: Done (2026-05-31)
- Problem: `buildSemanticRequest()` đang tự gán `lane_id` theo lane gần nhất nếu node không có `properties.laneId`, khiến node đặt lệch khỏi lane vẫn được hợp thức hóa và backend không còn cơ hội block đúng.
- Why it matters: Sai actor, sai handoff, và che khuất lỗi diagram placement trước khi AI diễn giải nghiệp vụ.
- Implementation steps:
  1. Thay `inferLaneId()` trong `src/brd/normalize.ts` bằng check theo biên lane thực tế (`lane.x`, `lane.width`) thay vì sort theo khoảng cách tâm.
  2. Chỉ infer `lane_id` khi node nằm trong horizontal span hợp lệ của lane; nếu mơ hồ hoặc nằm ngoài tất cả lane, trả `undefined`.
  3. Preserve explicit `properties.laneId` nếu còn hợp lệ; nếu không hợp lệ thì clear và để backend block.
  4. Thêm UI/backend test cho node bị kéo ra ngoài lane và expected blocking issue.
- Acceptance criteria:
  - Node ngoài lane không còn được map âm thầm sang lane gần nhất.
  - Backend trả `NODE_MISSING_LANE` cho activity/decision bị lệch lane sau normalize.
  - Handoff/actor mapping không đổi đối với diagram hợp lệ hiện có.
- Dependencies: TASK-014
- Verification: Thêm test normalize + manual browser smoke với node kéo ra ngoài lane rồi generate.

#### TASK-021 - Khóa lại live-provider contract theo doc Phase 1
- Priority: P1
- Module: ai-brd-provider-live
- Status: Partial (2026-05-31)
- Problem: Nhánh live hiện chưa khớp contract đã chốt: `X-Schema-Version` chưa được enforce, `BRD_REQUEST_RATE_LIMIT` chưa có runtime effect, không có controlled retry, và OpenRouter path mới dùng `json_object` thay vì strict schema output khi khả dụng.
- Why it matters: Mock path chạy được nhưng live path vẫn chưa đủ điều kiện để gọi là “hoàn thiện” hay merge-ready cho real generation.
- Implementation steps:
  1. Enforce `X-Schema-Version` ở `/validate` và `/generate`, trả `400` cho version không hỗ trợ.
  2. Implement rate-limit Phase 1 tối thiểu theo `BRD_REQUEST_RATE_LIMIT` và trả `429` đúng envelope.
  3. Trong `OpenRouterProvider`, ưu tiên structured output strict mode theo doc khi model route hỗ trợ.
  4. Thêm controlled retry tối đa 1 lần cho timeout / invalid structured output, populate `attempt_count`.
  5. Thay `estimated_cost_usd = 0.08` hard-code bằng metadata tính từ response usage hoặc policy fallback có ghi rõ nguồn.
- Acceptance criteria:
  - Live path match được status/error contract chính trong docs.
  - Provider timeout / invalid structured output có retry bounded và metadata phản ánh số lần thử.
  - Cost metadata không còn là constant giả định.
- Dependencies: TASK-016
- Verification: Live smoke test với key thật + tests/mock cho schema-version và rate-limit branch.
- Progress update:
  - Da enforce `X-Schema-Version` tren `/validate` va `/generate`.
  - Da them in-memory rate limit Phase 1 va response `429`.
  - Da nang `OpenRouterProvider` len `json_schema` strict mode, wrap schema validation error thanh retryable provider error, va map usage cost/tokens.
  - Da them bounded retry toi da 1 lan cho live path va metadata `attempt_count`.
- Remaining gap:
  - Chua co live smoke voi `BRD_OPENROUTER_API_KEY`, nen chua the xac nhan runtime thuc te cua OpenRouter path.

#### TASK-022 - Sửa post-check branch target và thêm regression test cho hallucinated outcome
- Priority: P2
- Module: ai-brd-core-pipeline
- Status: Done (2026-06-01)
- Problem: `postcheck_spec()` đang dùng điều kiện không thể bắt đúng case target branch “có giá trị nhưng không trace được”, nên hallucinated/stale target IDs có thể lọt qua.
- Why it matters: Đây là guard cuối cùng giữa structured spec và BRD markdown; nếu guard hỏng, traceability guarantee bị thủng.
- Implementation steps:
  1. Sửa điều kiện trong `services/postcheck.py` để warn khi `target_node_id` không thuộc `seen_node_ids`, không chỉ khi target rỗng.
  2. Bổ sung warning code/wording rõ cho case target không trace được.
  3. Thêm unit test tạo spec có branch outcome trỏ tới node không tồn tại trong main flow.
- Acceptance criteria:
  - Outcome trỏ tới node lạ sinh warning deterministic.
  - Không có false positive cho branch target hợp lệ.
- Dependencies: TASK-019
- Verification: Pytest cho `postcheck_spec()` với cả valid và invalid branch target.
- Progress update:
  - Da sua condition de bat duoc target node la that su khong trace duoc thay vi bo qua hoan toan.
  - Da them regression test cho case target branch tro toi node la.
  - Da doi traceability set cua post-check sang canonical node registry de tranh false-positive voi target hop le ngoai main flow.

#### TASK-023 - Hoàn thiện idempotency lifecycle cho mọi exit path của `/generate`
- Priority: P1
- Status: Done (2026-06-01)
- Module: ai-brd-provider-live
- Problem: `/generate` hiện chỉ đóng idempotency entry ở nhánh `200 completed`; các nhánh `422`, `502`, `503` có thể để key nằm mãi ở trạng thái `in_progress` cho đến khi TTL hết.
- Why it matters: Retry cùng `Idempotency-Key` là contract cốt lõi của feature. Nếu key bị “poisoned”, user bấm retry đúng cách vẫn không tiến thêm được.
- Implementation steps:
  1. Chốt policy idempotency cho non-success outcomes:
     - case nào được cache/replay,
     - case nào release để thử lại,
     - case nào mark failed với metadata riêng.
  2. Mở rộng `IdempotencyStore` với API rõ ràng cho terminal failure path (`fail` hoặc `release`).
  3. Áp policy đó cho tất cả early-return branches của `/generate`.
  4. Đồng bộ lại frontend retry behavior nếu cần phân biệt retry key cũ hay key mới.
  5. Thêm regression tests cho retry sau `422 blocking`, `502 retryable`, `503 non-retryable`.
- Acceptance criteria:
  - Retry sau lỗi generate không bị kẹt `202 in_progress` cho đến hết TTL.
  - `replayed`, `in_progress`, `conflict`, và terminal failure đều có semantics nhất quán.
  - Tests fail nếu non-success path lại bỏ quên idempotency transition.
- Dependencies: TASK-021
- Verification: Pytest cho từng status branch + manual retry smoke ở UI.
- Progress update:
  - Da them `IdempotencyStore.release(...)` cho entry dang `in_progress`.
  - `/generate` hien release key tren moi non-success exit path sau khi da `begin(...)`.
  - Da them regression tests cho retry sau `422`, `502`, `503` voi cung `Idempotency-Key`.

#### TASK-024 - Đổi post-check traceability set từ `main_flow_steps` sang canonical node registry
- Priority: P1
- Status: Done (2026-06-01)
- Module: ai-brd-core-pipeline
- Problem: Guard hiện tại chỉ biết `main_flow_steps`, nên branch target hợp lệ ở alternate path vẫn bị flag là unknown.
- Why it matters: Warning false-positive làm người dùng mất niềm tin vào post-check, trong khi đây là lớp chống hallucination cuối cùng.
- Implementation steps:
  1. Chọn nguồn traceability set đúng cho post-check:
     - mọi node đã interpret,
     - hoặc registry canonical lưu trong spec metadata/result.
  2. Refactor `postcheck_spec()` để validate branch target theo registry mới, không chỉ theo main flow.
  3. Giữ warning riêng cho target thật sự không trace được.
  4. Thêm regression tests cho:
     - branch target hợp lệ ngoài preferred main path,
     - target node lạ thật sự,
     - target thuộc parallel path.
- Acceptance criteria:
  - Branch target hợp lệ ngoài main flow không còn false-positive.
  - Target node bịa/hỏng vẫn sinh warning deterministic.
  - `TASK-022` có thể chuyển sang `Done` khi AC này pass.
- Dependencies: TASK-019
- Verification: Pytest cho post-check với fixtures main-flow/branch/parallel khác nhau.
- Progress update:
  - `postcheck_spec()` da nhan `traceable_node_ids` thay vi hard-code vao `main_flow_steps`.
  - Route `/generate` da truyen canonical registry cua tat ca node khong phai note vao post-check.
  - Da them regression test cho branch target hop le ngoai main flow.

#### TASK-025 - Implement sticky note anchoring và `global_note` semantics
- Priority: P2
- Status: Done (2026-06-01)
- Module: ai-brd-core-pipeline
- Problem: Hệ thống hiện chỉ nhìn note theo `lane_id`, chưa phân biệt note gắn với một step cụ thể và note toàn cục không neo vào flow.
- Why it matters: Đây là nơi BA thường ghi assumption và open question; nếu semantics mờ, BRD mất nhiều giá trị review nhất.
- Implementation steps:
  1. Định nghĩa rule proximity/anchor cho sticky note ở normalize/validate/interpret.
  2. Phân loại `anchored_note` và `global_note`.
  3. Với `anchored_note`, gắn trace về step gần nhất hoặc node liên quan.
  4. Với `global_note`, map vào `Assumptions / open questions` theo wording của UC-06.
  5. Thêm tests cho note gần step, note xa step, note ở lane khác.
- Acceptance criteria:
  - Note xa mọi step được coi là `global_note`.
  - Note gần step không bị gom mù vào assumption chung.
  - Output BRD phản ánh rõ distinction này.
- Dependencies: TASK-020
- Verification: Pytest cho proximity rules + browser smoke với note gần/xa.
- Progress update:
  - Da them rule anchor cho note theo explicit metadata (`anchor_node_id`) hoac proximity trong cung lane.
  - Note gan step duoc dua vao `annotations` voi context cua step gan nhat.
  - Note xa step duoc coi la `global_note`, sinh `NOTE_ORPHAN` va map vao `assumptions`.
  - Da them regression test cho global note xa flow.

#### TASK-026 - Nâng semantic của `sync-bar` từ “parallel generic” lên fork/join block có nghĩa
- Priority: P2
- Status: Done (2026-06-01)
- Module: ai-brd-core-pipeline
- Problem: Mỗi `sync-bar` hiện chỉ tạo ra một `parallel_block` chung chung với `join_node_id=None`, nên BRD mới biết “có song song” chứ chưa mô tả được cấu trúc song song.
- Why it matters: Parallel flow là một trong những phần khó nhất để BA review; nếu mô tả quá nông, feature sẽ hụt giá trị ở các diagram thực tế.
- Implementation steps:
  1. Chốt metadata/heuristic để phân biệt fork, join, hoặc combined sync-bar.
  2. Suy ra các branch song song liên quan tới từng sync-bar.
  3. Populate `parallel_blocks` với shape giàu nghĩa hơn (`fork_node_id`, `join_node_id`, `lane_ids`, path summary).
  4. Render markdown cho parallel block theo wording dễ review hơn.
  5. Thêm tests cho simple fork-join và cross-lane sync sample.
- Acceptance criteria:
  - `parallel_blocks` không còn chỉ là description stock + lane list.
  - BRD draft mô tả được điểm bắt đầu/kết thúc của phần song song ở mức Phase 1.
  - Không regress các diagram không có sync-bar.
- Dependencies: TASK-019, TASK-024
- Verification: Pytest fixture cho parallel graph + browser smoke trên sample diagram có sync-bar.
- Progress update:
  - Da classify `sync-bar` thanh `fork`, `join`, `fork_join`, hoac `sync`.
  - Da suy join candidate cho fork block bang common downstream sync-bar.
  - `parallel_blocks` hien co `join_node_id` va description co y nghia hon thay vi message stock.
  - Da them regression test cho fork/join sample.

### Next

#### TASK-016 - Implement `OpenRouterProvider` và live provider adapter
- Priority: P2
- Status: Done (2026-06-01)
- Module: ai-brd-provider-live
- Problem: Sau khi mock path ổn định, backend vẫn chưa thực sự gọi provider thật để sinh structured spec.
- Why it matters: Đây là bước chuyển từ MVP contract sang khả năng generate thật cho người dùng.
- Implementation steps:
  1. Implement `openrouter_provider.py` theo `LLMProvider` interface.
  2. Gọi OpenRouter với model slug `openai/gpt-5.5`.
  3. Parse structured output theo schema strict nếu route hỗ trợ.
  4. Thêm controlled retry tối đa 1 lần cho timeout / invalid structured output.
  5. Populate metadata runtime:
     - `provider`
     - `model`
     - `attempt_count`
     - `latency_ms`
     - `estimated_cost_usd`
- Acceptance criteria:
  - Khi `BRD_PROVIDER=openrouter` và key hợp lệ, `/generate` trả kết quả thật theo cùng envelope mock path.
  - Khi key thiếu, backend trả `503` đúng contract.
  - Không có nhánh live nào phá vỡ deterministic renderer/postcheck chain.
- Dependencies: TASK-013
- Progress update:
  - Backend hien da auto-load `apps/api/.env` cho local runtime, giup live provider path doc duoc key va provider mode ma khong can export env thu cong moi lan.
  - Da sua schema normalizer de OpenRouter/OpenAI strict structured output chap nhan `additionalProperties=false` va `required` day du cho moi object node.
  - Da verify live happy path va replay cung `Idempotency-Key` voi `BRD_PROVIDER=openrouter`.
- Verification: Manual smoke test local với `.env` có `BRD_OPENROUTER_API_KEY`.

#### TASK-017 - Thêm live smoke suite và guard cost cho provider thật
- Priority: P2
- Status: Done (2026-06-01)
- Module: ai-brd-live-smoke
- Problem: Nếu chỉ có mock suite, provider adapter thật và cost/retry behavior có thể hỏng âm thầm; nếu chạy live vô điều kiện, chi phí và độ ổn định sẽ tệ.
- Why it matters: Cần một lớp verify hẹp nhưng đáng tin cho OpenRouter path.
- Implementation steps:
  1. Thêm command riêng, ví dụ:
     - `test:api-live`
     - `test:eval-live`
  2. Gate các command này bằng env presence:
     - `BRD_PROVIDER=openrouter`
     - `BRD_OPENROUTER_API_KEY`
  3. Viết 2-3 smoke case tối thiểu:
     - happy path valid diagram
     - same-key replay
     - provider error path nếu controllable
  4. Log rõ estimated cost để theo dõi budget.
- Acceptance criteria:
  - Live suite không chạy mặc định khi thiếu key.
  - Có thể verify provider path end-to-end mà không ảnh hưởng mock suite.
  - Live run không vượt guardrail cost đã chốt trong feature doc.
- Dependencies: TASK-016
- Verification: Chạy command live cục bộ với key thật và xem response/metadata.
- Progress update:
  - Da them command `npm run test:api-live`.
  - Da them `apps/api/tests/test_live_smoke.py` voi 2 smoke case: happy path va replay cung `Idempotency-Key`.
  - Live suite hien skip ro rang khi `BRD_PROVIDER` khac `openrouter` hoac thieu `BRD_OPENROUTER_API_KEY`.
  - Da chay live thanh cong voi key that tren `openai/gpt-4o-mini`; smoke metadata mau: `latency_ms ~ 6500`, `estimated_cost_usd ~ 0.0005247`.

#### TASK-027 - Đồng bộ frontend pre-validation với `UC-06`
- Priority: P2
- Status: Done (2026-06-01)
- Module: ai-brd-frontend-validation
- Problem: `UC-06` mô tả frontend phải chặn sớm các diagram invalid ngay trong browser, nhưng runtime hiện luôn round-trip backend validation trước.
- Why it matters: Đây là chỗ dễ gây lệch kỳ vọng giữa doc, QA, và UX thật; đồng thời các lỗi quá hiển nhiên chưa cần tốn request backend.
- Implementation steps:
  1. Chốt dứt khoát một trong hai hướng:
     - implement local pre-validation trong frontend,
     - hoặc sửa `UC-06` để phản ánh backend-first validation là chủ đích.
  2. Nếu giữ local pre-validation, thêm checks tối thiểu cho:
     - có `start` và `end`,
     - activity/decision thuộc đúng 1 lane,
     - edge có source/target hợp lệ.
  3. Surface blocking issue ngay trên UI trước khi gọi `/api/brd/validate`.
  4. Thêm tests cho case invalid graph bị chặn tại client.
- Acceptance criteria:
  - Doc và runtime không còn lệch nhau ở bước validate đầu tiên.
  - Diagram invalid hiển thị feedback sớm, không cần gọi backend nếu lỗi thuộc local rule set.
  - Nếu chọn backend-first thay vì local validation, `UC-06` được sửa rõ để tránh hiểu nhầm.
- Dependencies: TASK-014
- Verification: Vitest/browser smoke cho invalid graph + review lại `UC-06`.
- Progress update:
  - Da them local pre-validation trong frontend truoc khi goi `/api/brd/validate`.
  - Diagram invalid hien blocking issue ngay tren BRD panel va khong tao network request backend.
  - Da cap nhat `UC-06` de phan anh dung UI behavior hien tai.

#### TASK-028 - Tách `main spine` khỏi branch/alternate path trong canonical BRD spec
- Priority: P1
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: `interpret_request()` đang gom gần như toàn bộ node reachable vào `main_flow_nodes`, khiến renderer biến branch và alternate path thành một numbered list phẳng.
- Why it matters: Đây là nguyên nhân lớn nhất làm BRD “đọc không hiểu flow”, kể cả khi graph và model đều đúng.
- Implementation steps:
  1. Trong `interpret.py`, tách rõ các lớp:
     - `main_spine_nodes`
     - `branch_paths`
     - `parallel_paths`
     - `terminal_nodes`
  2. Main spine chỉ giữ path chính từ `start` đến một terminal/join hợp lý theo policy đã chốt.
  3. Với mỗi `decision`, capture branch path theo edge label thay vì chỉ giữ `target_node_id`.
  4. Không append mù toàn bộ node reachable còn lại vào `main_flow`.
  5. Update schema/spec nếu cần để renderer có đủ dữ liệu branch-aware.
- Acceptance criteria:
  - `Main workflow` không còn lẫn các bước chỉ thuộc alternate path.
  - Nhánh `if/else` có thể được render thành narrative đọc hiểu được.
  - Diagram branch-heavy không còn cho cảm giác “mọi thứ bị đổ vào một list”.
- Dependencies: TASK-019, TASK-024, TASK-026
- Verification: Golden fixture cho diagram có decision + multiple ends; assert output prose thể hiện được nhánh.
- Progress update:
  - `interpret.py` giờ chỉ giữ `preferred path` làm `main_flow_nodes`; alternate path không còn bị append mù vào main workflow.
  - Branch outcome capture thêm `path_summary`, `target_node_text`, và `rejoin_node_text` để renderer có thể kể lại if/else như narrative.
  - Đã thêm regression test cho case decision có main spine + alternate end path.

#### TASK-029 - Định nghĩa lại semantic của `handoff` thay vì lấy mọi edge cross-lane
- Priority: P1
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: Handoff hiện được suy từ mọi edge cross-lane, nên section `Handoffs` chứa nhiều dòng gần như vô nghĩa về mặt nghiệp vụ.
- Why it matters: Section này hiện làm giảm niềm tin vào toàn bộ BRD draft vì người đọc thấy các cặp node-id không mang ý nghĩa business.
- Implementation steps:
  1. Chốt rule `business handoff` cho Phase 1, ví dụ:
     - có chuyển trách nhiệm rõ giữa hai actor,
     - không phải edge điều hướng từ decision,
     - không phải fan-out/fan-in quanh sync-bar,
     - không phải edge kết thúc chỉ để merge về end.
  2. Refactor `interpret.py` để chỉ emit handoff khi thỏa rule đó.
  3. Nếu cần, thêm `handoff_reason` hoặc `handoff_label`.
  4. Update renderer để ưu tiên actor/action wording thay vì id pairs.
- Acceptance criteria:
  - Section `Handoffs` không còn các dòng kiểu ``node-id -> node-id`` vô nghĩa.
  - Decision branches và sync-bar transitions không tự động trở thành handoff.
  - Handoff còn lại đọc như chuyển giao trách nhiệm thực sự.
- Dependencies: TASK-028
- Verification: Fixture với cross-lane branch edge, sync-bar edge, và handoff thật; chỉ handoff thật được render.
- Progress update:
  - `interpret.py` chỉ emit handoff khi edge thật sự đi từ activity sang activity/decision ở actor khác.
  - Edge từ decision, sync-bar, start/end không còn tự động trở thành handoff.
  - `Handoffs` renderer đổi sang wording nghiệp vụ thay vì in cặp id.

#### TASK-030 - Tách reader-facing BRD khỏi trace/debug identifiers
- Priority: P1
- Status: Done
- Module: ai-brd-renderer
- Problem: Renderer đang in raw `lane_id`, `node_id`, `fork_node_id`, `target_node_id` vào gần như mọi section của BRD draft.
- Why it matters: Output hiện đọc như debug dump hơn là tài liệu cho BA/SE review.
- Implementation steps:
  1. Thiết kế contract hai lớp:
     - reader-facing prose
     - trace appendix/debug metadata
  2. Trong `render.py`, loại raw ids khỏi `Actors`, `Main workflow`, `Decision logic`, `Parallel activities`, `Handoffs`.
  3. Nếu vẫn cần traceability, đưa ids xuống appendix cuối file hoặc chỉ giữ trong tab `Structured Spec`.
  4. Chỉ cho phép ids xuất hiện trong reader-facing markdown khi bật explicit debug mode.
- Acceptance criteria:
  - BRD draft chính đọc được mà không cần hiểu internal ids.
  - Traceability vẫn còn, nhưng không phá readability.
  - Output sample bomb-threat không còn lane ids kiểu `lane-1780316...` trong section actors.
- Dependencies: TASK-028, TASK-029
- Verification: Snapshot test của markdown renderer; assert reader-facing sections không chứa UUID/lane-id pattern.
- Progress update:
  - `render.py` bỏ raw ids khỏi 10 section reader-facing đầu tiên.
  - Thêm `Appendix A. Traceability (debug)` để giữ mapping step/node, decision target, parallel fork/join, và handoff trace.
  - Live path được harmonize về deterministic reader-facing fields để provider output thô không còn rò sang BRD chính.

#### TASK-031 - Nâng `parallel_blocks` thành business-level parallel summary
- Priority: P2
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: `parallel_blocks` hiện chỉ nói “có sync-bar” và liệt kê lane ids, chưa giải thích được nhánh song song nào chạy, nhập lại ở đâu, và ý nghĩa nghiệp vụ là gì.
- Why it matters: Với diagram có phối hợp đa actor, phần parallel là chỗ BA cần đọc nhất nhưng output hiện gần như không giúp gì.
- Implementation steps:
  1. Trong `interpret.py`, ngoài `fork_node_id/join_node_id`, capture luôn path summaries của từng branch song song.
  2. Map lane ids sang actor titles ngay từ semantic layer hoặc render layer.
  3. Render lại section `Parallel activities` theo kiểu:
     - điểm tách nhánh,
     - các nhánh song song,
     - điểm đồng bộ lại.
  4. Nếu join không xác định chắc chắn, downgrade thành `open_question`.
- Acceptance criteria:
  - Section `Parallel activities` mô tả được ai làm song song việc gì.
  - Không còn phụ thuộc vào raw sync-bar ids để người đọc hiểu.
  - Diagram không có sync-bar không bị regress.
- Dependencies: TASK-028, TASK-026
- Verification: Golden fixture có fork/join thực; output parallel section phải nêu được từng branch.
- Progress update:
  - `parallel_blocks` giờ có `role`, `actor_names`, `branch_summaries`, và `join_summary`.
  - Sync-bar fork/join được render thành mô tả song song đọc hiểu được, không còn phụ thuộc vào raw ids.
  - Đã thêm regression fixture xác nhận mô tả được từng nhánh `Actor A` / `Actor B`.

#### TASK-032 - Thêm golden quality tests cho BRD output reader-facing
- Priority: P1
- Status: Done
- Module: ai-brd-eval
- Problem: Test hiện tại chủ yếu check contract/schema/idempotency; chưa có hàng rào nào cho “output đúng schema nhưng vô nghĩa khi đọc”.
- Why it matters: Đây chính là kiểu lỗi user vừa báo, và nó sẽ tái phát nếu không có golden tests ở mức narrative quality.
- Implementation steps:
  1. Chọn 3-5 diagram representative, trong đó có một diagram branch-heavy như case xử lý đe dọa bom.
  2. Lưu expected assertions ở mức chất lượng đọc:
     - không lộ raw ids ở reader-facing sections,
     - `if/else` xuất hiện đúng section,
     - `handoffs` không chứa edge vô nghĩa,
     - parallel section có nhánh đọc hiểu được.
  3. Viết test runner sau `render_brd_markdown()` hoặc ở eval layer.
  4. Fail test nếu output vi phạm các quality assertions trên.
- Acceptance criteria:
  - Regression kiểu “schema pass nhưng BRD vô nghĩa” bị chặn trong CI/local.
  - Có ít nhất một fixture sát use case thật của user.
  - Task này trở thành gate cho các refactor pipeline tiếp theo.
- Dependencies: TASK-028, TASK-029, TASK-030, TASK-031
- Verification: Chạy suite golden quality và confirm case bomb-threat pass theo rubric đọc hiểu.
- Progress update:
  - `apps/api/tests/test_pipeline.py` giờ có golden assertions cho branch narrative, appendix trace, không lộ raw ids ở reader-facing markdown, handoff semantics, và parallel summary.
  - `apps/api/tests/test_routes.py` thêm regression cho live provider path: dù provider trả spec thô với raw ids, response cuối vẫn được harmonize thành BRD đọc được.
  - `playwright.config.ts` tách backend E2E sang port `18000` để suite mock ổn định ngay cả khi máy đang chạy backend live ở `8000`.

### Later

#### TASK-018 - Xây golden-set eval lane cho chất lượng BRD
- Priority: P3
- Status: Pending
- Module: ai-brd-eval
- Problem: Sau khi feature chạy được, vẫn cần một chất lượng lane riêng để đánh giá traceability, warning usefulness, và acceptance của BA trên diagram thật.
- Why it matters: Đây là cách kiểm soát drift model/prompt lâu dài mà không trộn vào vòng coding thường ngày.
- Implementation steps:
  1. Chọn 5-10 diagram representative từ use case thật.
  2. Lưu expected review notes / acceptance rubric cho từng diagram.
  3. Viết runner tạo BRD draft và ghi metadata latency/cost.
  4. So sánh các tiêu chí đã chốt ở Section 17 của feature doc.
  5. Document cách chạy eval thủ công hoặc scheduled.
- Acceptance criteria:
  - Có golden set tối thiểu cho Phase 1.
  - Có report cơ bản cho traceability, actor coverage, branch correctness, warning usefulness, human acceptance.
  - Eval lane tách biệt khỏi mock suite và live smoke suite.
- Dependencies: TASK-016, TASK-017
- Verification: Chạy eval trên 5-10 diagram và lưu kết quả review đầu tiên.

#### TASK-033 - Ngăn `sync-bar` không phân nhánh tạo false-positive `Parallel activities`
- Priority: P1
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: Sample cháy hiện có `sync-bar` như một điểm điều tiết layout/control, nhưng BRD vẫn sinh `Parallel activities` dù graph không có fan-out song song thật.
- Why it matters: Đây là bug semantic thật: BRD đang invent một cơ chế phối hợp song song không tồn tại trong diagram nguồn.
- Implementation steps:
  1. Trong `interpret.py`, với `role == "sync"` hoặc `role == "join"`, chỉ emit `parallel_block` reader-facing nếu có branch evidence thật (`branch_summaries`, multi-in/multi-out phù hợp, hoặc join semantics đã được xác minh).
  2. Nếu sync-bar chỉ nằm trên một đường đi tuyến tính, hạ nó xuống trace/debug artifact thay vì business summary.
  3. Thêm regression fixture dựa trên sample cháy mặc định để khẳng định section `Parallel activities` rỗng.
  4. Đảm bảo case fork/join thật không regress.
- Acceptance criteria:
  - Sample cháy mặc định không còn section `Parallel activities` giả.
  - Fixture fork/join thật vẫn giữ được summary song song đọc hiểu được.
- Dependencies: TASK-031
- Verification: `apps/api/tests/test_pipeline.py`, `npm run test:brd-mock`
- Progress update:
  - `interpret.py` không còn emit `parallel_block` cho `role == "sync"` tuyến tính.
  - Sample tuyến tính qua `sync-bar` giờ không tạo section `Parallel activities` giả.
  - Fixture fork/join thật vẫn pass nguyên.

#### TASK-034 - Tách `context note` khỏi `step annotation`
- Priority: P1
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: Note mô tả bối cảnh đầu vào như danh sách nguồn phát hiện cháy đang bị anchor vào `start` và render thành `Note cho bước "Bắt đầu quy trình"`.
- Why it matters: BRD đang gán sai ngữ nghĩa của note, làm người đọc tưởng đây là comment của một step cụ thể thay vì context/assumption của quy trình.
- Implementation steps:
  1. Bổ sung semantic loại note riêng: `context_note` hoặc `entry_context_note`.
  2. Update rule anchoring trong `interpret.py` để note gần `start` nhưng mang nội dung dạng list/context không bị auto-map thành step annotation.
  3. Render `context_note` vào `Assumptions / open questions` hoặc một wording context phù hợp.
  4. Thêm golden assertion cho sample cháy mặc định.
- Acceptance criteria:
  - Note nguồn phát hiện cháy không còn render thành annotation của `Bắt đầu quy trình`.
  - Note thực sự bám theo một step cụ thể vẫn anchor đúng như trước.
- Dependencies: None
- Verification: pipeline golden tests + manual generate sample cháy
- Progress update:
  - Thêm semantic phân loại note: `step_annotation`, `context_note`, `global_note`.
  - Note dạng list/context gần điểm vào quy trình giờ đi vào `context_notes`, không còn bị ép thành annotation của một step.
  - Render section 10 dùng prefix `Context:` cho nhóm note này.

#### TASK-035 - Phân biệt `main-path continuation` với `alternate branch` trong decision narrative
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: Decision outcomes hiện luôn dùng phrasing `... sau đó quay lại luồng chính tại ...`, kể cả khi nhánh đó chỉ là continuation bình thường của main flow.
- Why it matters: Draft đọc được, nhưng vẫn rất “machine-like” và tạo cảm giác flow vòng vèo hơn thực tế.
- Implementation steps:
  1. Bổ sung metadata trong branch outcome để đánh dấu `continues_main_flow`.
  2. Update renderer để main-path outcome dùng phrasing ngắn hơn, ví dụ `Tiếp tục: ...`.
  3. Chỉ dùng `quay lại luồng chính` cho nhánh alternate thực sự rẽ ra rồi mới nhập lại sau.
  4. Mở rộng golden tests cho sample cháy và một sample alternate-end.
- Acceptance criteria:
  - Main-path decision outcome không còn mang phrasing “quay lại luồng chính” một cách máy móc.
  - Alternate branches vẫn giữ được semantics rejoin khi cần.
- Dependencies: TASK-028
- Verification: markdown golden tests + sample BRD review
- Progress update:
  - Branch outcome thêm cờ `continues_main_flow`.
  - Renderer đổi nhánh continuation trên main path sang phrasing `Tiếp tục: ...`.
  - Chỉ nhánh alternate thực sự mới còn wording `quay lại luồng chính`.

#### TASK-036 - Sửa empty-state mâu thuẫn trong section `Assumptions / open questions`
- Priority: P1
- Status: Done
- Module: ai-brd-renderer
- Problem: Khi draft có `context_notes` nhưng không có `annotation`, `assumption`, hay `open_question`, renderer vẫn in thêm dòng `Không có assumption/open question.`
- Why it matters: Output reader-facing đang tự phủ định chính nó, làm giảm niềm tin vào BRD dù semantic đã đúng hơn.
- Implementation steps:
  1. Update điều kiện empty-state trong `render.py` để tính cả `context_notes`.
  2. Thêm regression test ở mức markdown renderer cho case chỉ có `context_notes`.
  3. Verify sample cháy không còn đồng thời xuất hiện `Context:` và `Không có assumption/open question.`
- Acceptance criteria:
  - Section 10 không còn tự mâu thuẫn khi chỉ có `context_notes`.
  - Pipeline tests chặn regression này.
- Dependencies: TASK-034
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - `render.py` dùng helper `has_assumption_section_content()` để tính cả `context_notes` trước khi render empty-state.
  - Thêm regression test cho case section 10 chỉ có `context_notes`.
  - Sample cháy không còn đồng thời hiện `Context:` và `Không có assumption/open question.`

#### TASK-037 - Làm `Decision logic` của alternate branch bớt mang hình thái trace graph
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: Nhánh alternate vẫn đang render theo pattern `A -> B; sau đó quay lại luồng chính tại ...`, nên đọc giống trace graph hơn là mô tả nghiệp vụ.
- Why it matters: Đây là phần BA cần đọc để hiểu if/else, nhưng wording hiện còn buộc người đọc tự diễn giải lại.
- Implementation steps:
  1. Bổ sung formatter riêng cho alternate branch outcome thay vì luôn join `path_summary` bằng `->`.
  2. Ưu tiên các phrasing kiểu `Nếu ... thì ...` hoặc `Trường hợp ...` khi có 1-2 bước rõ ràng.
  3. Chỉ rơi về trace-style wording khi path dài hoặc semantic không chắc.
  4. Thêm golden assertions cho case cháy và một case branch nhiều bước.
- Acceptance criteria:
  - Decision section vẫn traceable nhưng đọc gần ngôn ngữ nghiệp vụ hơn.
  - Không regress main-path continuation `Tiếp tục: ...`.
- Dependencies: TASK-035
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - Renderer không còn join alternate path bằng `->` ở BRD reader-facing.
  - Alternate branch nhiều bước giờ dùng phrasing `Thực hiện lần lượt ... rồi ...`.
  - Wording rejoin đổi sang `nhập lại luồng chính` để tự nhiên hơn.

#### TASK-038 - Làm rõ trigger mở đầu của quy trình trong BRD reader-facing
- Priority: P2
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: Draft hiện bắt đầu main workflow từ actor vận hành trung tâm và bỏ mờ tín hiệu khởi phát, dù diagram và context có actor nguồn phát hiện đầu tiên.
- Why it matters: Người chỉ đọc BRD có thể hiểu quy trình “bắt đầu ở VOC” thay vì “được kích hoạt bởi một nguồn phát hiện ban đầu”.
- Implementation steps:
  1. Chốt rule reader-facing: trigger/start event sẽ đi vào `Process overview`, `Main workflow`, hoặc cả hai.
  2. Nếu giữ main spine như hiện tại, bổ sung deterministic summary sentence về tác nhân khởi phát.
  3. Thêm regression cho sample cháy để output nêu rõ nguồn kích hoạt quy trình.
- Acceptance criteria:
  - Draft reader-facing nêu rõ vì sao/quy trình được kích hoạt từ đâu.
  - Không cần đưa raw `start` node vào numbered flow nếu không muốn đổi template.
- Dependencies: TASK-034
- Verification: review sample cháy + pipeline golden tests
- Progress update:
  - `spec_builder.py` dựng `Process overview` theo deterministic summary mới thay vì giữ summary mơ hồ từ provider.
  - Summary giờ nêu rõ actor/kênh khởi phát khi có `context_note` gần start và chỉ ra actor tiếp nhận xử lý ban đầu.
  - Live path cũng bị harmonize về summary deterministic để không regress giữa mock và live provider.

#### TASK-039 - Chuẩn hóa whitespace của canvas text trước khi render BRD reader-facing
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: Reader-facing BRD vẫn giữ nguyên line break trong `node.text` và `note.text`, nên câu văn bị ngắt giữa chừng theo layout của canvas thay vì theo ngữ nghĩa tài liệu.
- Why it matters: Draft hiện đã đúng semantic hơn nhiều, nhưng vẫn lộ rõ dấu vết “text copy từ shape”, làm giảm chất lượng BA-facing.
- Implementation steps:
  1. Thêm helper normalize text cho reader-facing render, gộp line break nội bộ thành khoảng trắng khi không phải list có chủ đích.
  2. Áp dụng helper này cho `build_main_flow_description()`, `human_node_label()`, handoff reason, và branch path summary.
  3. Giữ nguyên raw text cho appendix/debug trace nếu cần.
  4. Thêm regression test cho decision/activity text nhiều dòng.
- Acceptance criteria:
  - Main workflow, decision logic, và handoff section không còn ngắt câu theo line break của canvas.
  - Note/list có chủ đích vẫn giữ được cấu trúc khi cần.
- Dependencies: None
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - Thêm `reader_text.py` với helper `normalize_inline_text()` để collapse line break của canvas thành prose reader-facing.
  - Áp dụng normalization ở `spec_builder.py`, `interpret.py`, và `render.py` như một lớp phòng thủ cuối cho mock/live/provider output.
  - Thêm regression cho activity/decision/handoff nhiều dòng để reader-facing markdown không còn lộ line break của canvas.

#### TASK-040 - Render `Context` note theo cấu trúc tài liệu rõ ràng hơn
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: `Context:` hiện đúng semantic nhưng format markdown còn vụn: bullet tiêu đề và các dòng list con đang trộn cùng cấp, chưa cho cảm giác đây là một mục bối cảnh được trình bày có cấu trúc.
- Why it matters: Đây là phần mở đầu quan trọng của BRD; nếu trình bày lỏng, người đọc vẫn thấy output giống tool dump hơn là draft tài liệu.
- Implementation steps:
  1. Chọn một format ổn định cho `context_notes`: prose ngắn + sub-bullets, hoặc bullet cha với các bullet con thụt cấp rõ ràng.
  2. Tách dòng đầu của context note làm heading/lead-in, phần còn lại render thành các mục con.
  3. Đảm bảo nhiều `context_notes` vẫn render nhất quán.
  4. Thêm golden test cho sample cháy.
- Acceptance criteria:
  - Section 10 trình bày `Context` như một mục tài liệu có cấu trúc.
  - Không regress case context note một dòng.
- Dependencies: TASK-039
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - `render.py` parse `context_note` thành heading + sub-bullets thay vì đổ nguyên multiline text vào một bullet duy nhất.
  - `reader_text.py` thêm `split_structured_note()` để tách dòng đầu và các mục con có chủ đích.
  - Golden test của sample context nhiều dòng giờ kiểm tra được cả heading lẫn sub-bullets.

#### TASK-041 - Đổi empty-state wording kỹ thuật sang phrasing BA-facing
- Priority: P3
- Status: Done
- Module: ai-brd-renderer
- Problem: Một số empty-state như `Không có parallel block.` vẫn mang ngôn ngữ kỹ thuật của hệ thống thay vì ngôn ngữ tài liệu nghiệp vụ.
- Why it matters: Đây là polish nhỏ nhưng giúp draft nhìn bớt “máy”, nhất là khi user export trực tiếp để review.
- Implementation steps:
  1. Review tất cả empty-state của 10 section BRD chính.
  2. Đổi các phrasing kỹ thuật sang câu gần ngôn ngữ BA hơn.
  3. Thêm snapshot/golden assertion cho ít nhất `Parallel activities` và `Decision logic`.
- Acceptance criteria:
  - Reader-facing BRD không còn lộ phrasing kỹ thuật như `parallel block`.
  - Appendix/debug wording có thể giữ nguyên nếu cần.
- Dependencies: None
- Verification: review markdown snapshot + `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - Empty-state của `Decision logic`, `Parallel activities`, `Handoffs`, và section 10 đã đổi sang phrasing BA-facing hơn.
  - Appendix/debug vẫn giữ wording kỹ thuật tối thiểu để không ảnh hưởng traceability.
  - Regression tests hiện khóa cả wording mới lẫn rule không render empty-state mâu thuẫn.

#### TASK-042 - Sinh `Business objective` theo nghiệp vụ thay vì placeholder tĩnh
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: Section `Business objective` hiện luôn in một câu placeholder chung, không phản ánh quy trình cụ thể của diagram.
- Why it matters: Khi các section khác đã khá reader-facing, một objective tĩnh làm lộ rõ giới hạn của draft và giảm giá trị dùng ngay cho BA review.
- Implementation steps:
  1. Bổ sung deterministic objective builder dựa trên trigger/context, main spine, decision points, và end state.
  2. Ưu tiên template domain-agnostic nhưng cụ thể, ví dụ `tiếp nhận tín hiệu - xác minh - điều phối - kết thúc an toàn`.
  3. Giữ fallback generic chỉ khi semantic không đủ.
  4. Thêm golden test cho sample cháy và một sample không có context note.
- Acceptance criteria:
  - `Business objective` không còn là câu placeholder tĩnh ở các sample có semantic đủ rõ.
  - Nếu semantic nghèo, hệ thống vẫn có fallback an toàn.
- Dependencies: None
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - `render.py` không còn hard-code objective placeholder mà dựng deterministic objective từ corpus reader-facing.
  - Có heuristic riêng cho case `sự cố cháy`, `đe dọa bom`, và fallback generic.
  - Golden test đã khóa case cháy để objective nêu rõ tiếp nhận, xác minh, điều phối, và khép quy trình an toàn.

#### TASK-043 - Làm `Process overview` bớt generic và gắn hơn với domain của diagram
- Priority: P2
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: `Process overview` hiện đã nêu đúng trigger và actor đầu tiên, nhưng câu mở đầu vẫn là template chung `các actor phối hợp ... theo diagram hiện tại`.
- Why it matters: Opening paragraph là thứ BA đọc đầu tiên; nếu còn generic, draft vẫn cho cảm giác “template đã được điền dữ liệu” hơn là mô tả nghiệp vụ thật.
- Implementation steps:
  1. Bổ sung rule suy diễn domain phrase từ `context_note`, `diagram_name`, hoặc các step đầu.
  2. Thay câu mở đầu bằng phrasing cụ thể hơn với case hiện tại, ví dụ neo vào `sự cố cháy` nếu có tín hiệu đủ mạnh.
  3. Giữ deterministic fallback generic cho diagram mơ hồ.
  4. Thêm golden test cho sample cháy.
- Acceptance criteria:
  - Với sample cháy, `Process overview` nêu rõ đây là quy trình xử lý sự cố cháy thay vì chỉ nói “xử lý sự kiện”.
  - Các sample khác không bị ép domain sai.
- Dependencies: TASK-042
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - `spec_builder.py` thêm bước suy diễn subject/domain từ `diagram_name`, `context_notes`, và main flow.
  - `Process overview` giờ có opening domain-specific cho case cháy và đe dọa bom, fallback về generic khi tín hiệu không đủ.
  - Regression test sample cháy xác nhận opening đã chuyển từ `xử lý sự kiện` sang `xử lý sự cố cháy`.

#### TASK-044 - Xem lại contract section 10 khi chỉ có `Context`
- Priority: P3
- Status: Done
- Module: ai-brd-renderer
- Problem: Section `Assumptions / open questions` hiện có thể chỉ chứa `Context`, nên tên section hơi lệch với nội dung dù semantic bên trong đã đúng.
- Why it matters: Đây là polish nhỏ, nhưng ảnh hưởng cảm giác “naturalness” của bản BRD export.
- Implementation steps:
  1. Quyết định có giữ contract 10 section cố định hay cho phép đổi label theo content.
  2. Nếu giữ 10 section, cân nhắc thêm lead-in sentence giải thích context đầu vào được nhóm tại đây.
  3. Nếu đổi label động, cập nhật use case/doc và golden tests tương ứng.
- Acceptance criteria:
  - Section 10 không gây cảm giác lệch nhãn với nội dung trong các draft điển hình.
  - Không làm rối contract Phase 1 đã chốt nếu chưa thực sự cần.
- Dependencies: None
- Verification: review sample cháy + doc alignment check
- Progress update:
  - Chốt giữ 10 section của Phase 1 nhưng đổi label section 10 sang `Context / assumptions / open questions`.
  - Renderer, test suite, feature doc, và `UC-06` đã được sync theo label mới.
  - Contract Phase 1 vẫn giữ 10 section, chỉ làm rõ hơn nội dung thực tế của section cuối.

#### TASK-045 - Mở rộng schema `MainFlowStep` để chứa nội dung BRD-level cho từng bước
- Priority: P1
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: `MainFlowStep` hiện chỉ có một `description` ngắn, nên section 5 không thể diễn đạt mục đích bước, hành động chính, và kết quả mong đợi như một BRD thật.
- Why it matters: Đây là khoảng cách lớn nhất còn lại giữa draft hiện tại và một BRD nháp thực thụ. Nếu schema không giàu hơn, renderer không có đủ dữ liệu để nâng chất section 5.
- Implementation steps:
  1. Mở rộng `MainFlowStep` trong `apps/api/app/schemas/spec.py` với các field BRD-facing tối thiểu như `step_title`, `step_purpose`, `business_action`, `expected_result`, và optional `input_or_trigger`.
  2. Cập nhật `build_deterministic_spec()` để suy diễn các field này từ `main_flow_nodes`, context, handoff, và neighboring nodes.
  3. Giữ fallback an toàn cho diagram nghèo ngữ nghĩa để field nào không suy ra được thì không bịa thêm.
  4. Cập nhật live harmonization nếu cần để mock/live giữ cùng contract.
- Acceptance criteria:
  - `DiagramBRDSpec.main_flow_steps` có đủ dữ liệu để render một step giàu nghiệp vụ hơn một dòng text.
  - Không làm regress traceability hay thứ tự main spine.
- Dependencies: None
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - `MainFlowStep` đã được mở rộng với `step_title`, `step_purpose`, `business_action`, `expected_result`, và `input_or_trigger`.
  - `build_deterministic_spec()` giờ không chỉ copy text node mà còn enrich từng bước bằng heuristic bảo thủ theo loại node, ngữ cảnh đầu vào, handoff, và bước lân cận.
  - End step không còn rơi về actor mồ côi khi thiếu `lane_id`; hệ thống suy actor đóng quy trình từ bước ngay trước nếu hợp lý.

#### TASK-046 - Render section `Main workflow` theo format BRD mở rộng thay vì numbered list một dòng
- Priority: P1
- Status: Done
- Module: ai-brd-renderer
- Problem: Dù semantic đã đúng, section 5 hiện vẫn giống checklist flow vì renderer chỉ in `[Actor] description`.
- Why it matters: Đây là phần BA sẽ đọc kỹ nhất. Nếu section 5 còn ngắn gọn quá mức, toàn bộ draft vẫn chưa đạt cảm giác "BRD thật".
- Implementation steps:
  1. Thiết kế format ổn định cho mỗi step, ví dụ:
     - heading: `1. [Actor] Tên bước`
     - sub-lines: `Mục đích`, `Thực hiện`, `Kết quả`
  2. Cập nhật `render_brd_markdown()` để dùng các field mới của `MainFlowStep` thay vì chỉ `description`.
  3. Giữ output đủ ngắn để không biến section 5 thành đoạn văn dày đặc, nhưng đủ rõ để BA hiểu nghiệp vụ của từng bước.
  4. Thêm golden snapshot cho sample cháy và ít nhất một sample khác.
- Acceptance criteria:
  - `Main workflow` đọc như mô tả nghiệp vụ của từng bước, không còn giống checklist tối giản.
  - Section 5 vẫn bám đúng thứ tự spine và actor ownership.
- Dependencies: TASK-045
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - `render.py` đã đổi section 5 sang format nhiều lớp cho mỗi step: heading + `Đầu vào / kích hoạt`, `Mục đích`, `Thực hiện`, `Kết quả mong đợi`.
  - Reader-facing `Main workflow` giờ không còn là checklist một dòng; nó giữ spine cũ nhưng đọc gần hơn với mô tả nghiệp vụ.
  - Golden tests đã khóa format mới cho sample reader-facing.

#### TASK-047 - Điền `responsibilities` cho actor và làm section `Actors` mang tính BRD hơn
- Priority: P2
- Status: Done
- Module: ai-brd-core-pipeline
- Problem: Section `Actors` hiện chỉ liệt kê tên actor, trong khi schema đã có `responsibilities` nhưng builder luôn để trống.
- Why it matters: BRD thật cần cho người đọc hiểu vai trò của từng bên trong quy trình, không chỉ danh sách người tham gia.
- Implementation steps:
  1. Suy diễn trách nhiệm chính của từng actor từ các bước main flow và decision mà actor đó sở hữu.
  2. Lọc trùng và chuẩn hóa responsibilities thành 1-3 bullet ngắn cho mỗi actor.
  3. Cập nhật renderer để section 4 hiển thị actor name kèm responsibilities khi có.
  4. Thêm regression/golden test cho sample cháy.
- Acceptance criteria:
  - Ít nhất các actor chính trong sample có trách nhiệm được mô tả ngắn gọn.
  - Không bịa trách nhiệm vượt quá semantic hiện có của diagram.
- Dependencies: TASK-045
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - Builder đã suy diễn `responsibilities` từ step titles và business actions của từng actor thay vì để trống.
  - Renderer hiện hiển thị actor name kèm responsibilities dưới dạng sub-bullets khi có.
  - Rule suy diễn đã được chỉnh để tránh false-positive trách nhiệm chỉ vì câu expected-result có chứa từ khóa nghiệp vụ.

#### TASK-048 - Làm lại section `Scope` theo hướng ranh giới quy trình thay vì thống kê số lượng
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: `Scope` hiện chỉ có số actor và số bước chính, nên chưa phản ánh phạm vi nghiệp vụ của quy trình.
- Why it matters: Một BRD reader-facing cần nói quy trình bắt đầu từ đâu, xử lý đến mức nào, và khép ở điều kiện nào. Chỉ đếm số lượng là chưa đủ.
- Implementation steps:
  1. Thiết kế lại nội dung section 3 để gồm các mục như `Trigger`, `Điểm bắt đầu xử lý`, `Điểm kết thúc`, `Phạm vi bao phủ`.
  2. Suy diễn các field này từ `summary`, `context_notes`, `main_flow_steps`, `end` node, và decision outcomes.
  3. Giữ lại các chỉ số đếm nếu cần nhưng chuyển chúng thành metadata phụ, không phải trọng tâm của section.
  4. Cập nhật docs/golden tests tương ứng.
- Acceptance criteria:
  - Section `Scope` giúp người đọc hiểu ranh giới quy trình chứ không chỉ số liệu thống kê.
  - Sample cháy nêu được trigger, đầu mối tiếp nhận, và trạng thái kết thúc chính.
- Dependencies: TASK-045
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py`
- Progress update:
  - Section 3 đã được làm lại để nêu `Trigger / đầu vào`, `Điểm bắt đầu xử lý`, `Điểm kết thúc chính`, `Phạm vi bao phủ`, và metadata tổng quan.
  - Số actor / số bước vẫn còn nhưng chỉ là thông tin tổng quan phụ, không còn là toàn bộ section.
  - Golden tests hiện khóa được scope boundaries của sample reader-facing.

#### TASK-049 - Tách bản export BRD reader-facing khỏi `Appendix A. Traceability (debug)`
- Priority: P2
- Status: Done
- Module: ai-brd-renderer
- Problem: Bản BRD hiện xuất ra luôn kèm appendix debug, nên vẫn mang tính artifact kỹ thuật hơn là tài liệu nghiệp vụ thuần.
- Why it matters: Với mục tiêu "gần BRD thật nhất có thể", phần trace/debug nên là tùy chọn cho người kỹ thuật chứ không phải mặc định của bản reader-facing.
- Implementation steps:
  1. Thêm mode hoặc option export cho `render_brd_markdown()`, ví dụ `include_debug_appendix=True|False`.
  2. Mặc định UI/export reader-facing tắt appendix debug, còn debug mode hoặc internal export có thể bật.
  3. Cập nhật panel/export flow để user chọn hoặc hệ thống tự chọn mode phù hợp.
  4. Thêm test cho cả hai mode.
- Acceptance criteria:
  - Có thể export một bản BRD sạch không chứa appendix debug.
  - Traceability appendix vẫn tồn tại khi cần cho QA/dev review.
- Dependencies: None
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests` và manual export review
- Progress update:
  - `render_brd_markdown()` giờ dùng `template="default"` cho bản reader-facing không appendix, và `template="full"` cho bản có `Appendix A. Traceability (debug)`.
  - Flow hiện tại của frontend vẫn gửi `template=default`, nên export markdown mặc định đã sạch hơn cho BA đọc.
  - Regression tests đã khóa cả mode mặc định lẫn mode `full`.

#### TASK-050 - Thêm golden acceptance test cho tiêu chí “giống BRD thật” ở sample reader-facing
- Priority: P2
- Status: Done
- Module: ai-brd-eval
- Problem: Test hiện khóa khá tốt semantic correctness, nhưng chưa khóa đủ những tiêu chí prose khiến draft trông giống BRD thật hơn.
- Why it matters: Khi bắt đầu nâng chất section 3/4/5, rất dễ regress về độ dài, cấu trúc, hoặc quay lại kiểu output quá kỹ thuật.
- Implementation steps:
  1. Chọn 2-3 sample điển hình như cháy và đe dọa bom.
  2. Viết golden assertions cho section 3, 4, 5, và export mode không appendix.
  3. Thêm một rubric reader-facing tối thiểu: step richness, actor responsibilities, scope boundaries, absence of debug dump.
  4. Tách suite này khỏi smoke/live để nó phục vụ quality gate cho prose.
- Acceptance criteria:
  - Có test tự động cho ít nhất một sample “đủ giống BRD thật” theo tiêu chí đã chốt.
  - Các task prose tiếp theo không còn chỉ dựa vào review thủ công.
- Dependencies: TASK-045, TASK-046, TASK-047, TASK-048, TASK-049
- Verification: `apps/api/.venv/bin/python -m pytest apps/api/tests`
- Progress update:
  - Test suite đã bổ sung golden assertions cho section 3, 4, 5 và mode export không appendix.
  - Route tests cũng đã được cập nhật để phân biệt rõ `default` reader-facing với `full` debug appendix.
  - Live smoke với OpenRouter đã được rerun thành công sau khi schema `MainFlowStep` được mở rộng.

#### TASK-051 - Định nghĩa frontend cache contract cho AI BRD draft
- Priority: P1
- Status: Done
- Module: ai-brd-frontend-state
- Problem: BRD state hiện chỉ nằm trong React memory, chưa có một contract cache rõ ràng để lưu và khôi phục draft/spec/warnings sau khi đóng panel hoặc reload app.
- Why it matters: Nếu không chốt shape cache ngay từ đầu, feature rất dễ rơi vào trạng thái “lưu được markdown nhưng mất metadata, outdated state, hoặc retry context”.
- Implementation steps:
  1. Định nghĩa một `BrdWorkspaceCacheEntry` trong frontend types, gồm tối thiểu: `draft`, `spec`, `warnings`, `blockingIssues`, `metadata`, `requestId`, `runtimeStatus`, `phase`, `lastGenerateFingerprint`, `lastGeneratedRevision`, `updatedAt`.
  2. Chốt storage key/version, ví dụ `swimlane.ai_brd.cache.v1`.
  3. Chốt policy Phase 1: chỉ lưu **một last snapshot** cho workspace hiện tại, chưa làm multi-history.
  4. Document rõ field nào là source of truth khi hydrate lại app.
- Acceptance criteria:
  - Có contract cache rõ ràng, versioned, đủ dữ liệu để khôi phục BRD panel mà không generate lại.
  - Không cần đoán lại state từ raw markdown.
- Dependencies: None
- Verification: typecheck + unit test parse/serialize cache payload
- Progress update:
  - Đã thêm `BrdWorkspaceCacheEntry` và helper `src/brd/cache.ts` với storage key `swimlane.ai_brd.cache.v1`.
  - Cache contract được version hóa ở mức frontend và có guard parse/version trong unit test.

#### TASK-052 - Persist AI BRD snapshot vào `localStorage` khi generate thành công hoặc user chỉnh draft
- Priority: P1
- Status: Done
- Module: ai-brd-frontend-state
- Problem: Sau khi generate xong hoặc user edit draft, dữ liệu vẫn chỉ ở RAM; reload trang là mất.
- Why it matters: Đây là lõi của yêu cầu cache frontend trước khi có database.
- Implementation steps:
  1. Thêm helper save/load/clear cache trong `src/brd/*`, tách khỏi `App.tsx`.
  2. Khi `/generate` thành công, persist snapshot mới vào `localStorage`.
  3. Khi user chỉnh `BRD Draft`, debounce hoặc persist lại snapshot đã sửa.
  4. Chỉ lưu các field cần thiết; không lưu graph JSON trùng lặp nếu chưa cần.
- Acceptance criteria:
  - Reload app vẫn khôi phục được BRD draft gần nhất và các metadata liên quan.
  - Bản export sau khi reload vẫn đúng với nội dung user đã sửa.
- Dependencies: TASK-051
- Verification: Vitest unit test cho save/load + browser manual reload test
- Progress update:
  - `App.tsx` giờ persist snapshot sau khi đã có BRD draft/spec và tự cập nhật lại cache khi user sửa `BRD Draft`.
  - Snapshot lưu đủ draft/spec/warnings/metadata/runtime state để export sau reload vẫn bám đúng nội dung user đã sửa.

#### TASK-053 - Hydrate cache khi app mở và thêm affordance `Open last BRD draft`
- Priority: P1
- Status: Done
- Module: ai-brd-ui
- Problem: Hiện close panel chỉ ẩn UI, và panel chỉ được mở lại từ flow generate; user không có đường rõ ràng để mở lại draft đã có.
- Why it matters: Đây là lý do UX hiện bị cảm nhận như “đóng là mất draft”.
- Implementation steps:
  1. Khi `App` mount, đọc cache và hydrate các state BRD nếu payload hợp lệ.
  2. Thêm action UI rõ ràng để reopen draft đã cache, ví dụ một nút `Open last BRD draft` trên toolbar hoặc cạnh nút generate.
  3. Nếu panel bị close nhưng cache/state còn, action reopen phải mở lại đúng tab/draft/spec thay vì generate mới.
  4. Giữ close panel là đóng UI, không xóa cache.
- Acceptance criteria:
  - User có thể đóng panel rồi mở lại draft cũ mà không generate lại.
  - Reload app vẫn có affordance để mở lại bản draft đã cache.
- Dependencies: TASK-051, TASK-052
- Verification: Playwright E2E cho close -> reopen và reload -> reopen
- Progress update:
  - App hydrate BRD state từ cache khi mount nhưng giữ panel đóng mặc định.
  - Toolbar có action `Open last BRD draft` để reopen đúng snapshot đã lưu.

#### TASK-054 - Thêm invalidation và `outdated` policy cho BRD cache theo fingerprint/revision
- Priority: P1
- Status: Done
- Module: ai-brd-frontend-state
- Problem: Nếu chỉ hydrate cache mà không so với diagram hiện tại, user có thể đọc nhầm draft cũ như thể nó còn khớp hoàn toàn với graph mới.
- Why it matters: Cache không có invalidation sẽ làm feature “tiện” nhưng nguy hiểm về mặt nghiệp vụ.
- Implementation steps:
  1. Khi lưu cache, persist cả `lastGenerateFingerprint` và `lastGeneratedRevision`.
  2. Khi hydrate, so sánh với diagram hiện tại để xác định `fresh` / `outdated`.
  3. Nếu outdated, panel hoặc action reopen phải hiển thị badge/warning rõ ràng.
  4. Chốt policy khi import JSON mới hoặc reset canvas: giữ cache cũ ở trạng thái outdated hay clear hẳn.
- Acceptance criteria:
  - Cache cũ không bao giờ được trình bày như bản còn khớp tuyệt đối với diagram mới.
  - User luôn được báo rõ khi đang mở lại draft outdated.
- Dependencies: TASK-052, TASK-053
- Verification: unit test fingerprint compare + E2E cho mutate diagram sau hydrate
- Progress update:
  - Cache snapshot lưu cả `lastGenerateFingerprint` và `lastGeneratedRevision`.
  - Reopen sau reset/import/reload giờ tính `Outdated` theo fingerprint/revision thay vì coi cache luôn là fresh.
  - Policy Phase 1 được chốt là giữ cache cũ ở trạng thái `Outdated` cho đến khi user regenerate hoặc discard.

#### TASK-055 - Thêm hành động xóa cache BRD thủ công và dọn lifecycle khi reset/import
- Priority: P2
- Status: Done
- Module: ai-brd-ui
- Problem: Sau khi có cache, hệ thống cũng cần cách cho user bỏ bản cũ đi khi nó không còn giá trị hoặc sau các hành động phá ngữ cảnh như reset/import hoàn toàn diagram khác.
- Why it matters: Cache mà không có clear path sẽ sớm trở thành nguồn nhầm lẫn.
- Implementation steps:
  1. Thêm action `Discard cached BRD` hoặc tương đương.
  2. Xác định các event nên prompt/auto-clear cache: reset canvas, import diagram khác, load sample khác.
  3. Clear cả in-memory BRD state và `localStorage` khi user xác nhận discard.
  4. Update status text/UX copy cho rõ.
- Acceptance criteria:
  - User có cách chủ động bỏ BRD cache cũ.
  - Các thao tác thay đổi diagram mang tính “context switch” không để lại cached draft mơ hồ.
- Dependencies: TASK-052, TASK-053
- Verification: manual test reset/import/discard
- Progress update:
  - Toolbar có action `Discard cached BRD` để clear cả in-memory state lẫn `localStorage`.
  - Reset/import/clear hiện giữ cache ở trạng thái outdated và update status copy để user biết draft cũ không còn khớp hoàn toàn.

#### TASK-056 - Khóa frontend cache behavior bằng unit + E2E tests
- Priority: P2
- Status: Done
- Module: ai-brd-tests
- Problem: Cache UI/state rất dễ regress: save thiếu field, hydrate sai tab, close/reopen không ổn, outdated badge biến mất.
- Why it matters: Không có test, tính năng cache sẽ mong manh hơn chính feature generate.
- Implementation steps:
  1. Thêm unit test cho serialize/deserialize cache entry và version guard.
  2. Mở rộng Playwright flow cho:
     - generate -> close -> reopen
     - generate -> edit draft -> reload -> reopen
     - generate -> mutate diagram -> reopen cached draft -> thấy outdated
  3. Thêm test discard cache.
  4. Nếu cần, mock `localStorage` trong Vitest cho component-level test.
- Acceptance criteria:
  - Có automated coverage cho save, hydrate, reopen, outdated, discard.
  - Cache behavior không chỉ dựa vào manual test.
- Dependencies: TASK-052, TASK-053, TASK-054, TASK-055
- Verification: `npm run test:brd-mock` + Playwright E2E
- Progress update:
  - Đã thêm `src/brd/cache.test.ts` cho save/load/clear/version guard.
  - Playwright flow đã mở rộng để cover `generate -> close -> reopen -> reload -> outdated -> discard`.

#### TASK-057 - Chốt draw.io XML interchange contract và supported subset
- Priority: P1
- Status: Done
- Module: file-interchange
- Problem: Repo hiện chỉ có contract file thao tác trực tiếp ở mức JSON/SVG, trong khi yêu cầu mới là import/export draw.io XML theo format `mxfile > diagram > mxGraphModel` giống [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:1).
- Why it matters: Nếu không chốt subset hỗ trợ trước, parser và serializer sẽ dễ lệch nhau, dẫn tới import được một kiểu nhưng export ra một kiểu khác hoặc mất semantic lane/node.
- Implementation steps:
  1. Tạo doc contract ngắn cho draw.io XML support trong repo docs hoặc README kỹ thuật: outer swimlane container, lane columns, start/end/activity/decision/sync-bar/note, edges có label.
  2. Chốt field mapping giữa LogicFlow graph và draw.io `mxCell`:
     - lane root container
     - lane parent cell
     - node `type -> style`
     - edge `source/target/value/style`
  3. Chốt policy text: decode HTML-rich `value` khi import và encode subset ổn định khi export.
  4. Chốt policy Phase 1: tạm ẩn `Mở JSON`, `Lưu JSON`, `Export SVG` khỏi toolbar, nhưng không xóa code path nền ngay.
- Acceptance criteria:
  - Có supported subset rõ ràng cho import/export XML.
  - Dev có thể implement parser/serializer mà không phải đoán format draw.io được support.
- Dependencies: None
- Verification: Review chéo contract với [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:1)
- Progress update:
  - Supported subset đã được chốt trong [docs/use-cases/UC-05-import-export.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-05-import-export.md:1).
  - Contract text/style/geometry đã được encode thành adapter helpers tại `src/io/drawio-shared.ts`.

#### TASK-058 - Tách XML adapter layer khỏi `App.tsx`
- Priority: P1
- Status: Done
- Module: editor-toolbar-runtime
- Problem: Import/export hiện đang được xử lý inline trong [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1798), không phù hợp để nhét thêm parse/serialize draw.io XML.
- Why it matters: Nếu xử lý XML trực tiếp trong `App.tsx`, file này sẽ phình thêm và rất khó test unit cho file-interchange logic.
- Implementation steps:
  1. Tạo module mới, ví dụ `src/io/drawio-import.ts` và `src/io/drawio-export.ts`.
  2. Giữ `App.tsx` chỉ làm việc với `FileReader`, download, và call adapter.
  3. Nếu cần, thêm `src/io/drawio-types.ts` cho các shape trung gian như `MxCell`, `MxGeometry`, `DrawioDocument`.
  4. Chuẩn bị helper text decode/encode dùng chung thay vì lặp lại logic trong import/export.
- Acceptance criteria:
  - `App.tsx` không tự parse XML string hoặc build `mxCell` string thủ công.
  - XML mapping logic nằm trong module có thể unit test độc lập.
- Dependencies: TASK-057
- Verification: Typecheck + code review entrypoint flow
- Progress update:
  - Đã tách parser/serializer sang `src/io/drawio-import.ts`, `src/io/drawio-export.ts`, `src/io/drawio-shared.ts`, `src/io/drawio-types.ts`.
  - `App.tsx` chỉ còn giữ file-picker/download orchestration.

#### TASK-059 - Implement import XML draw.io -> LogicFlow graph normalization
- Priority: P1
- Status: Done
- Module: file-interchange
- Problem: Editor chưa thể đọc file draw.io XML kiểu [examples/bomb.drawio.xml](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/bomb.drawio.xml:1), dù đây là format interchange người dùng muốn dùng.
- Why it matters: Không có import path thì user không thể đưa các sơ đồ hiện có từ draw.io vào editor để tiếp tục chỉnh hoặc generate BRD.
- Implementation steps:
  1. Parse XML bằng `DOMParser` và validate sơ bộ cấu trúc `mxfile/diagram/mxGraphModel/root`.
  2. Đọc outer swimlane container và lane children để reconstruct `LaneConfig[]`.
  3. Map `mxCell` vertex styles sang node types:
     - `shape=startState` -> `start`
     - `shape=endState` -> `end`
     - `shape=mxgraph.bpmn.task2` -> `activity` hoặc `note` theo heuristics contract
     - `rhombus` -> `decision`
     - `shape=line` -> `sync-bar`
  4. Map edge cells sang LogicFlow edges, giữ label nếu có.
  5. Normalize text từ HTML-rich `value` về plain text editor-facing.
  6. Trả ra graph data + lane metadata tương thích với flow hydrate hiện tại.
- Acceptance criteria:
  - Import được `examples/bomb.drawio.xml` vào canvas mà không crash.
  - Lane/node/edge topology chính được giữ đúng ở mức dùng được cho editor và BRD pipeline.
  - Các node import xong vẫn bám lane hợp lệ.
- Dependencies: TASK-057, TASK-058
- Verification: fixture import test với `examples/bomb.drawio.xml` + browser smoke import
- Progress update:
  - Import path hiện parse được `mxfile/diagram/mxGraphModel/root`, reconstruct lane columns, map node/edge types, và normalize text draw.io HTML về plain text editor-facing.
  - Playwright smoke đã cover import fixture từ toolbar.

#### TASK-060 - Implement export LogicFlow graph -> draw.io XML serializer
- Priority: P1
- Status: Done
- Module: file-interchange
- Problem: Sau khi chỉnh diagram trong editor, user cần xuất ra draw.io XML tương thích để dùng lại ở diagrams.net hoặc lưu trữ theo format yêu cầu.
- Why it matters: Import-only sẽ làm feature bị cụt; export là nửa còn lại của interchange contract.
- Implementation steps:
  1. Build serializer tạo `mxfile > diagram > mxGraphModel > root`.
  2. Sinh outer swimlane container + lane child cells tương đương contract đã chốt.
  3. Map node types sang draw.io styles/geometry:
     - lane
     - start/end ellipse
     - activity/note task-like blocks
     - decision rhombus
     - sync-bar line
  4. Map edges sang `mxCell edge="1"` với `source`, `target`, `value`, và style mặc định ổn định.
  5. Encode text thành HTML-safe `value` nhất quán để re-import không vỡ nội dung.
- Acceptance criteria:
  - Export XML mở được ở draw.io/diagrams.net.
  - File export có cấu trúc cùng họ với `examples/bomb.drawio.xml`.
  - Re-import file vừa export lại vào app cho ra topology tương đương.
- Dependencies: TASK-057, TASK-058
- Verification: golden XML export test + manual open in draw.io
- Progress update:
  - Export path sinh outer swimlane container, lane cells, node cells, edge cells, và edge-label cells.
  - Exported XML đã pass round-trip test `graph -> XML -> graph`.

#### TASK-061 - Đổi toolbar sang XML-first và tạm ẩn JSON/SVG
- Priority: P2
- Status: Done
- Module: editor-toolbar-runtime
- Problem: Toolbar hiện vẫn lộ các action cũ `Mở JSON…`, `Lưu JSON`, `Export SVG` ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1798), trong khi user muốn XML là interchange chính.
- Why it matters: UX phải phản ánh đúng workflow đang được khuyến nghị; nếu không user sẽ bị kéo theo hai cơ chế file song song.
- Implementation steps:
  1. Tạm ẩn khỏi toolbar các action:
     - `Mở JSON…`
     - `Lưu JSON`
     - `Export SVG`
  2. Thêm action mới:
     - `Import XML…`
     - `Export XML`
  3. Giữ `Export PNG` nếu vẫn hữu ích cho snapshot hình ảnh.
  4. Update status copy và error copy cho XML-specific failures.
  5. Không xóa code JSON/SVG adapter nền ngay; chỉ hạ khỏi surface UI trong Phase 1 của XML rollout.
- Acceptance criteria:
  - Toolbar không còn hiển thị JSON/SVG actions cũ.
  - User thấy rõ XML là file format chính cho interchange.
- Dependencies: TASK-059, TASK-060
- Verification: browser smoke toolbar flow
- Progress update:
  - Toolbar hiện hiển thị `Import XML…`, `Export XML`, `Export PNG`.
  - `Mở JSON…`, `Lưu JSON`, `Export SVG` vẫn còn code path nền nhưng đã bị hạ khỏi surface UI.

#### TASK-062 - Harden lane/node geometry mapping cho import XML
- Priority: P2
- Status: Done
- Module: logicflow-canvas-model
- Problem: draw.io XML dùng nested parent geometry và absolute offsets rất khác với layout nội bộ hiện tại; import dễ làm node lệch lane hoặc `sync-bar` span sai.
- Why it matters: Nếu import topology không chắc, BRD generation sau import sẽ cho output sai hoặc khó hiểu.
- Implementation steps:
  1. Xử lý đúng parent-child coordinates của lane và node khi convert từ `mxGeometry`.
  2. Backfill metadata nội bộ như `laneId`, `laneOffsetX`/binding hiện tại, `nodeSize`, `syncBar` span.
  3. Chốt heuristic note-vs-activity nếu draw.io task shape được dùng cho cả sticky context note.
  4. Add warning/fallback path cho unsupported style hoặc cell orphan.
- Acceptance criteria:
  - Diagram import từ XML không làm node “rơi khỏi lane”.
  - `sync-bar`, decision, start/end giữ semantics đủ để editor và BRD pipeline tiếp tục dùng được.
- Dependencies: TASK-059
- Verification: import fixture + generate BRD smoke from imported XML
- Progress update:
  - Import đã normalize lane geometry về layout nội bộ, backfill `laneId`/`nodeSize`, và dùng heuristic `note` vs `activity` an toàn hơn cho draw.io task shape.
  - False-positive swimlane detection và draw.io multiline text encoding đã được harden bằng regression tests.

#### TASK-063 - Update docs và user workflow cho XML import/export
- Priority: P2
- Status: Done
- Module: docs-and-tests
- Problem: README và workflow hiện vẫn mô tả JSON/SVG là thao tác file chính ở [README.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/README.md:18).
- Why it matters: Nếu code đã chuyển sang XML-first mà docs không đổi, user sẽ đi sai luồng ngay từ README.
- Implementation steps:
  1. Cập nhật README feature list và local test flow.
  2. Cập nhật use case/import-export doc hiện có nếu repo đã có doc owner phù hợp.
  3. Nếu cần, thêm note rằng JSON/SVG đang bị ẩn khỏi toolbar chứ chưa bị loại hẳn khỏi codebase.
  4. Ghi changelog cho behavior change này.
- Acceptance criteria:
  - Docs user-facing mô tả đúng toolbar và file format mới.
  - Không còn chỗ nào nói JSON/SVG là hành động toolbar mặc định nếu UI đã đổi.
- Dependencies: TASK-061
- Verification: review chéo README + UI
- Progress update:
  - README, UC-05, và architecture overview đã được sync sang XML-first workflow.
  - Changelog và activity log đã ghi nhận behavior change.

#### TASK-064 - Thêm golden + E2E tests cho XML interchange
- Priority: P2
- Status: Done
- Module: docs-and-tests
- Problem: Import/export XML là feature dễ regress vì vừa có parser vừa có serializer, lại phụ thuộc style/text/geometry contract.
- Why it matters: Không có test, mỗi lần chỉnh layout/node style sẽ có nguy cơ làm XML round-trip hỏng âm thầm.
- Implementation steps:
  1. Thêm unit tests cho parser với fixture `examples/bomb.drawio.xml`.
  2. Thêm unit tests cho serializer để assert cấu trúc `mxfile`, `diagram`, `mxGraphModel`, `mxCell`.
  3. Thêm round-trip test `XML -> graph -> XML` ở mức supported subset.
  4. Nếu khả thi, thêm Playwright/browser smoke cho `Import XML…` và `Export XML`.
- Acceptance criteria:
  - Có automated coverage cho import fixture, export structure, và ít nhất một round-trip.
  - Regression ở XML adapter sẽ fail test thay vì chỉ lộ khi user mở file ngoài draw.io.
- Dependencies: TASK-059, TASK-060, TASK-061
- Verification: `npm run test:ui-mock` + browser/E2E smoke
- Progress update:
  - Đã thêm `src/io/drawio-xml.test.ts` cho fixture import, export structure, và round-trip.
  - Đã thêm Playwright flow `Import XML fixture and export XML from toolbar`.

#### TASK-065 - Chốt `formal_brd` document contract theo mẫu `examples/BRD.docx.md`
- Priority: P1
- Status: Pending
- Module: ai-brd-schema
- Problem: Output hiện tại là một process-summary draft 10 section, trong khi mục tiêu mới là một formal BRD/use-case document giống [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:1).
- Why it matters: Nếu không chốt contract mới trước, team sẽ tiếp tục polish sai lớp và không bao giờ đạt cảm giác “BRD thật”.
- Implementation steps:
  1. Định nghĩa output profile mới, ví dụ `template=formal_brd`, tách khỏi template reader-facing hiện tại.
  2. Chốt section contract tối thiểu cho `formal_brd`:
     - Mục đích tài liệu
     - Phạm vi nghiệp vụ
     - Actor
     - Danh sách user case sau khi gộp
     - Trạng thái nghiệp vụ
     - Các section UC chi tiết
  3. Chốt format table-first thay vì bullet-first cho các phần actor, scope, UC list, state catalog, preconditions, main flow, exceptions.
  4. Chốt policy Appendix/debug: không render mặc định trong `formal_brd`.
- Acceptance criteria:
  - Có contract `formal_brd` rõ ràng, đối chiếu được từng phần với mẫu `BRD.docx.md`.
  - Team biết chính xác output nào thuộc `summary_brd`, output nào thuộc `formal_brd`.
- Dependencies: None
- Verification: Review chéo contract với [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:5)

#### TASK-066 - Mở rộng schema từ process summary sang formal BRD document model
- Priority: P1
- Status: Pending
- Module: ai-brd-schema
- Problem: `DiagramBRDSpec` hiện không có các khái niệm first-class như business scope groups, actor role rows, UC catalog, business states, preconditions, step tables, exception tables.
- Why it matters: Renderer không thể sinh đúng format mẫu nếu schema chưa mang được các cấu trúc tài liệu đó.
- Implementation steps:
  1. Thiết kế các model mới hoặc sub-model mới cho:
     - `DocumentPurpose`
     - `BusinessScopeItem`
     - `ActorRoleItem`
     - `UseCaseCatalogItem`
     - `BusinessStateCatalog`
     - `FormalUseCaseSection`
     - `PreconditionRow`
     - `MainFlowRow`
     - `ExceptionRow`
     - `StateFlowSummary`
  2. Quyết định giữ `DiagramBRDSpec` rồi thêm nhánh `formal_brd`, hoặc tạo schema `FormalBRDDocument` riêng.
  3. Thêm support cho metadata document-level như project/module header nếu xác định được.
  4. Update validation + typings tương ứng.
- Acceptance criteria:
  - Schema mới biểu đạt được cấu trúc của mẫu BRD mà không cần hack ở renderer.
  - Type definitions frontend/backend đồng bộ với document model mới.
- Dependencies: TASK-065
- Verification: schema review + typecheck

#### TASK-067 - Xây UC segmentation layer từ semantic graph
- Priority: P1
- Status: Pending
- Module: ai-brd-spec-builder
- Problem: Builder hiện giả định một main spine duy nhất, trong khi mẫu BRD tổ chức nội dung thành danh sách UC và nhiều section UC chi tiết.
- Why it matters: Nếu không tách được các UC, output sẽ mãi chỉ là “một flow dài”, không thành formal BRD.
- Implementation steps:
  1. Thiết kế heuristic tách use case từ diagram:
     - cụm hành vi chính
     - nhánh quyết định lớn
     - end-state families
     - actor/domain transitions
  2. Build `use_case_catalog` từ các cụm đó.
  3. Với mỗi UC, derive:
     - objective
     - preconditions
     - main flow rows
     - exception rows
     - state transitions liên quan
  4. Giữ traceability ngược từ từng UC item về node/edge ids.
- Acceptance criteria:
  - Từ một semantic graph có thể sinh ra nhiều UC section thay vì chỉ một main workflow duy nhất.
  - Các UC sinh ra có mục tiêu và phạm vi khác nhau, không phải copy/paste cùng một flow.
- Dependencies: TASK-066
- Verification: golden review trên 2-3 diagram domain thực

#### TASK-068 - Suy business state catalog và state-flow từ diagram/spec
- Priority: P1
- Status: Pending
- Module: ai-brd-spec-builder
- Problem: Mẫu BRD dành riêng một phần lớn cho trạng thái nghiệp vụ và state transitions, còn output hiện tại chỉ có warnings/branches mà không có state catalog first-class.
- Why it matters: Với BRD nghiệp vụ thật, phần trạng thái là xương sống cho BA/Dev/QA cùng hiểu lifecycle.
- Implementation steps:
  1. Thiết kế cách suy state từ node text, decision labels, và domain heuristics.
  2. Tách tối thiểu 2 nhóm state khi phù hợp:
     - state của request/process
     - state của entity phụ (device, hồ sơ, ticket, v.v.)
  3. Sinh state catalog table + state flow summary cho từng UC liên quan.
  4. Gắn open question khi không đủ dữ kiện để chốt state chính xác.
- Acceptance criteria:
  - `formal_brd` có section `Trạng thái nghiệp vụ` và `Luồng trạng thái` dùng được.
  - State flow không chỉ là prose, mà đọc ra được lifecycle rõ ràng.
- Dependencies: TASK-066, TASK-067
- Verification: golden tests cho domain có lifecycle rõ như GPS/device, approval, incident

#### TASK-069 - Render `formal_brd` theo table-first template gần mẫu thật
- Priority: P1
- Status: Pending
- Module: ai-brd-renderer
- Problem: Renderer hiện chỉ biết sinh heading + bullet/numbered list; chưa render được format table-heavy và multi-UC structure của mẫu.
- Why it matters: Dù schema tốt hơn, nếu renderer vẫn bullet-first thì output vẫn không giống BRD mục tiêu.
- Implementation steps:
  1. Thêm renderer profile mới `formal_brd`.
  2. Render các phần table-first:
     - actor/role
     - business scope
     - use case catalog
     - preconditions
     - main flow rows
     - exception rows
     - state catalogs
  3. Render section numbering kiểu hierarchical như `6.1`, `6.2`, `6.3` cho mỗi UC.
  4. Ẩn Appendix/debug ở mode này, hoặc chỉ cho qua `template=formal_brd_debug`.
- Acceptance criteria:
  - Output `formal_brd` nhìn gần với [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:61) hơn rõ rệt so với draft hiện tại.
  - `summary_brd` hiện tại vẫn hoạt động, không bị regression.
- Dependencies: TASK-065, TASK-066, TASK-067, TASK-068
- Verification: golden markdown snapshot review

#### TASK-070 - Thêm system actor inference cho formal BRD
- Priority: P2
- Status: Pending
- Module: ai-brd-spec-builder
- Problem: Actor hiện chủ yếu bám lane, trong khi mẫu BRD có thêm actor hệ thống như `Portal`, `V-app` không nhất thiết là lane riêng.
- Why it matters: Formal BRD thực tế thường phải thể hiện cả con người lẫn hệ thống tham gia để tránh hiểu sai boundary trách nhiệm.
- Implementation steps:
  1. Thiết kế rule infer system actors từ:
     - keywords trong step title/action/result
     - event gửi thông báo
     - cập nhật trạng thái hệ thống
  2. Tách `business actor` và `system actor` trong actor-role table nếu cần.
  3. Cho phép một main-flow row có actor là system actor ngay cả khi lane gốc là con người.
  4. Gắn warning khi inference system actor còn mơ hồ.
- Acceptance criteria:
  - Formal BRD có thể biểu diễn actor hệ thống kiểu `Portal`, `V-app` khi logic diagram ngụ ý rõ.
  - Actor table không còn bị giới hạn cứng bởi lane list.
- Dependencies: TASK-066, TASK-067
- Verification: fixture review với mẫu GPS trong [examples/BRD.docx.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/examples/BRD.docx.md:22)

#### TASK-071 - Thêm golden acceptance suite cho tiêu chí “gần BRD thật”
- Priority: P2
- Status: Pending
- Module: docs-and-tests
- Problem: Nếu không có golden tests cho `formal_brd`, team sẽ lại regress về format mỗi lần sửa semantic hoặc prose.
- Why it matters: Mục tiêu bây giờ không chỉ là đúng logic, mà là đúng **document shape** và đủ gần mẫu BRD thật.
- Implementation steps:
  1. Tạo fixtures/snapshots cho `formal_brd` output.
  2. Assert presence và structure của:
     - document purpose
     - business scope table
     - actor table
     - use case catalog
     - business states
     - UC subsections
     - step tables
     - exception tables
  3. Thêm một acceptance checklist “không còn appendix debug trong export mặc định formal”.
  4. Nếu phù hợp, thêm example-based comparison test với subset shape của `examples/BRD.docx.md`.
- Acceptance criteria:
  - Regression về format formal BRD sẽ fail tự động.
  - Team có baseline rõ cho tiêu chí “gần BRD thật”.
- Dependencies: TASK-069, TASK-070
- Verification: backend pytest + snapshot review

#### TASK-072 - Chốt canonical artifact chain cho target `spec -> use case -> diagram -> BRD`
- Priority: P1
- Status: Done
- Module: product-architecture
- Problem: Target mới không còn là `diagram -> BRD` đơn lẻ. Hệ thống cần đi qua ít nhất 5 artifact loại khác nhau nhưng hiện chưa có canonical chain rõ ràng.
- Why it matters: Nếu không chốt chain này trước, mỗi feature mới sẽ tự chọn source of truth khác nhau và traceability sẽ đứt.
- Implementation steps:
  1. Định nghĩa artifact chain chuẩn:
     - `ProjectSpec`
     - `FeatureIntent`
     - `UseCaseDraft`
     - `DiagramDraft`
     - `FormalBRDDraft`
  2. Chốt field tối thiểu và quan hệ trace giữa các artifact.
  3. Chốt artifact nào là human-editable, artifact nào là generated, artifact nào là derived-only.
  4. Cập nhật docs kiến trúc/scope cho chain mới.
- Acceptance criteria:
  - Có một source-of-truth chain rõ ràng cho toàn pipeline.
  - Mọi task sau đó đều bám được vào artifact chain này.
- Dependencies: None
- Verification: review chéo roadmap với docs kiến trúc
- Progress update:
  - Đã chốt chain chuẩn `ProjectSpec -> FeatureIntent -> UseCaseDraft -> DiagramDraft -> FormalBRDDraft`.
  - Đã ghi canonical contract tại `docs/scope/artifact-chain.md` và sync lại `docs/scope/architecture.md`.

#### TASK-073 - Thiết kế và implement `ProjectSpec` + `FeatureIntent` ingestion contract
- Priority: P1
- Status: Done
- Module: spec-ingestion
- Problem: User target bắt đầu từ “input spec dự án và function muốn build”, nhưng repo hiện chưa có contract hoặc UI/backend flow cho đầu vào này.
- Why it matters: Không có ingress layer chuẩn thì use case generator sẽ phải đọc free-text thô, dễ drift và khó test.
- Implementation steps:
  1. Định nghĩa schema cho `ProjectSpec` và `FeatureIntent`.
  2. Chốt field tối thiểu:
     - project name
     - module/function name
     - business context
     - actor candidates
     - business rules / constraints
     - input/output expectations
  3. Thêm API/frontend form hoặc import file path cho ingestion.
  4. Thêm validation + normalization layer trước khi gọi AI.
- Acceptance criteria:
  - Hệ thống nhận được input spec/function dưới dạng schema ổn định, không chỉ raw text.
  - Có fixture/spec examples để test đường vào.
- Dependencies: TASK-072
- Verification: schema tests + request/response mock
- Progress update:
  - Đã thêm backend schema `ProjectSpec`, `FeatureIntent`, `UseCaseGenerationRequest`, `UseCaseGenerationResult`.
  - Đã thêm panel frontend cho ingestion với form edit trực tiếp và fixture mặc định usable ngay.
  - Đã có route `POST /api/usecases/generate` và backend tests tương ứng.

#### TASK-074 - Xây pipeline `spec -> use case list` và UI review cho use case draft
- Priority: P1
- Status: Done
- Module: use-case-generation
- Problem: Đây là lớp trung gian quan trọng nhất của target workflow nhưng hiện chưa tồn tại.
- Why it matters: Nếu không có use-case layer rõ ràng, diagram generation và formal BRD generation sẽ luôn thiếu trục tổ chức.
- Implementation steps:
  1. Thiết kế schema `UseCaseDraft` gồm:
     - UC id
     - title
     - objective
     - actors
     - preconditions
     - happy path summary
     - key exceptions
     - success outcome
  2. Implement generation service từ `ProjectSpec + FeatureIntent`.
  3. Thêm UI để review/edit/approve danh sách use case trước khi generate diagram.
  4. Gắn status `draft / reviewed / approved`.
- Acceptance criteria:
  - Từ một project spec có thể sinh ra list use case reviewable.
  - User có thể chỉnh/sắp/approve use case trước khi đi tiếp.
- Dependencies: TASK-073
- Verification: golden examples + UI smoke
- Progress update:
  - Đã implement `usecase_builder` deterministic sinh 2-3 `UseCaseDraft` từ `ProjectSpec + FeatureIntent`.
  - Đã nối `Use case drafts` panel vào editor shell với flow generate, edit, approve từng item, và `Approve all`.
  - Đã thêm unit test panel, backend route tests, và browser smoke cho flow generate/reopen panel.

#### TASK-080 - Siết validation và normalization cho `ProjectSpec` + `FeatureIntent`
- Priority: P1
- Status: Done
- Module: spec-ingestion
- Problem: Ingestion layer hiện đã có schema hình thức nhưng vẫn cho qua payload rỗng hoặc rất nghèo thông tin, dẫn tới việc hệ thống generate use case JSON hợp lệ nhưng vô nghĩa về nghiệp vụ.
- Why it matters: Nếu đầu vào không bị chặn từ sớm, `UseCaseDraft` sẽ trở thành rác có định dạng đẹp, và mọi bước downstream (`diagram`, `formal_brd`) sẽ drift ngay từ gốc.
- Implementation steps:
  1. Thêm server-side validation tối thiểu cho `project_name`, `project_summary`, `feature_name`, `feature_summary`.
  2. Thêm normalization trim/collapse whitespace và reject giá trị rỗng sau normalize.
  3. Thêm frontend pre-validation/disable-state cho nút `Generate use cases`.
  4. Trả lỗi user-facing rõ ràng khi thiếu dữ liệu cốt lõi.
- Acceptance criteria:
  - Không thể generate use case khi thiếu tên dự án, summary dự án, tên feature, hoặc summary feature.
  - Payload chỉ chứa whitespace bị reject nhất quán ở cả frontend và backend.
  - Có regression tests cho invalid ingestion path.
- Dependencies: TASK-073
- Verification: backend pytest + UI test cho generate button disabled/error state
- Progress update:
  - Đã thêm normalization/trim/dedup cho scalar fields và list fields ở backend schema.
  - Đã thêm local pre-validation ở frontend và disable `Generate use cases` khi thiếu field cốt lõi.
  - Đã thêm backend route test cho invalid request và unit test cho pre-validation helpers.

#### TASK-081 - Bảo vệ review state của use case draft khi generate lại
- Priority: P1
- Status: Done
- Module: use-case-generation
- Problem: Generate lại hiện đang overwrite thẳng `UseCaseDraft[]`, làm user mất toàn bộ edit/review/approve state mà không có cảnh báo hay recovery path.
- Why it matters: Đây là bug workflow trực tiếp trong lớp review use case; nếu không xử lý, panel mới chỉ phù hợp demo chứ chưa đáng tin để dùng thật.
- Implementation steps:
  1. Thêm dirty-state cho `UseCaseDraft` sau khi user edit hoặc đổi review status.
  2. Khi user generate lại trong lúc có dirty-state, hiển thị confirm rõ ràng hoặc cho phép duplicate/replace.
  3. Cân nhắc cache local frontend cho `ProjectSpec`, `FeatureIntent`, và last generated `UseCaseDraft[]`.
  4. Thêm E2E regression cho flow edit -> regenerate.
- Acceptance criteria:
  - User không thể vô tình mất use case draft đã chỉnh mà không được cảnh báo.
  - Có ít nhất một recovery path rõ ràng: confirm replace hoặc reopen cache cũ.
- Dependencies: TASK-074
- Verification: browser E2E cho overwrite warning/recovery
- Progress update:
  - Đã thêm dirty-state cho edit/review use case và outdated detection theo fingerprint của spec hiện tại.
  - Generate lại khi draft đã review hoặc spec đã đổi giờ sẽ hiện confirm replace trước khi overwrite.
  - Đã thêm browser E2E cho flow cancel/accept regenerate.

#### TASK-082 - Thay heuristic 2+1 use case bằng segmentation strategy linh hoạt hơn
- Priority: P2
- Status: Done
- Module: use-case-generation
- Problem: Builder hiện luôn sinh hai use case nền (`intake`, `execution`) và một use case ngoại lệ tùy điều kiện, nên chưa thật sự phản ánh list use case theo domain/spec thực.
- Why it matters: Nếu segmentation quá cơ học, các bước `UseCaseDraft -> DiagramDraft` và `FormalBRDDraft` sau này sẽ kế thừa một cấu trúc UC méo ngay từ đầu.
- Implementation steps:
  1. Chốt heuristic segmentation dựa trên feature intent, actor boundary, outcome family, và business rule clusters.
  2. Cho phép feature đơn giản chỉ sinh 1 use case nếu phù hợp.
  3. Cho phép feature nhiều capability sinh >3 use case khi spec thật sự gợi ý.
  4. Thêm golden fixtures cho ít nhất 3 loại feature: simple, branch-heavy, exception-heavy.
- Acceptance criteria:
  - Số lượng/use-case boundary không còn bị hard-code thành 2 hoặc 3.
  - Fixture domain thật cho ra UC list có vẻ “đúng bài” hơn, không còn tách/gộp cơ học.
- Dependencies: TASK-074
- Verification: golden review + pytest fixtures
- Progress update:
  - `usecase_builder` giờ có thể sinh từ 1 đến 4 use case dựa trên intake/coordination/exception signals thay vì cố định `2 + 1`.
  - Đã thêm builder tests cho case đơn giản, case giàu phối hợp, và case ngoại lệ-heavy.

#### TASK-083 - Suy lại `useCaseDirty` từ fingerprint/snapshot thay vì sticky boolean
- Priority: P1
- Status: Done
- Module: use-case-generation
- Problem: Review state protection hiện hoạt động được, nhưng `useCaseDirty` đang là cờ sticky nên có thể tạo cảnh báo overwrite giả ngay cả khi user đã hoàn tác spec/intent về đúng bản đã generate.
- Why it matters: Prompt cảnh báo nếu quá “ồn” sẽ nhanh chóng mất giá trị; đây là chỗ dễ làm user bỏ qua đúng lúc đáng ra cần dừng lại.
- Implementation steps:
  1. Lưu snapshot hoặc fingerprint canonical của lần generate gần nhất.
  2. Tách `draftEdited` khỏi `specChanged`, và derive từng cờ từ diff thực thay vì chỉ set `true`.
  3. Chỉ hiện confirm replace khi có khác biệt thực sự với snapshot gần nhất hoặc draft đã bị chỉnh/review.
  4. Thêm regression test cho flow edit rồi hoàn tác về trạng thái cũ.
- Acceptance criteria:
  - Nếu user sửa rồi hoàn tác spec/intent về đúng bản đã generate, cảnh báo overwrite không còn xuất hiện sai.
  - Dirty-state phản ánh đúng hai loại thay đổi: spec thay đổi và draft đã bị chỉnh/review.
- Dependencies: TASK-081
- Verification: UI unit test + browser E2E
- Progress update:
  - Đã bỏ `useCaseDirty` kiểu sticky boolean và chuyển sang derive state từ hai fingerprint: spec/intent snapshot và `UseCaseDraft[]` snapshot.
  - Đã thêm E2E cho case user sửa spec rồi hoàn tác về đúng snapshot cũ thì generate lại không còn hiện confirm oan.

#### TASK-084 - Chốt shared validation contract giữa frontend quick-guard và backend canonical validation
- Priority: P2
- Status: Done
- Module: spec-ingestion
- Problem: Frontend hiện mới chặn required-field path, còn backend mới là nơi canonical normalize/dedup nhiều field hơn. Nếu không chốt ranh giới rõ, hai phía sẽ rất dễ drift.
- Why it matters: Đây là lớp entrypoint của toàn pipeline `spec -> UC -> diagram -> BRD`; lệch contract ở đây sẽ làm lỗi xuất hiện muộn và khó giải thích.
- Implementation steps:
  1. Ghi rõ rule nào thuộc frontend quick-guard, rule nào thuộc backend canonical validation.
  2. Thêm UI coverage cho disabled/error state theo contract đã chốt.
  3. Bổ sung backend tests cho các path normalize/dedup quan trọng nếu chưa có.
  4. Sync lại UC/documentation để tránh hiểu nhầm “frontend và backend validate giống hệt nhau”.
- Acceptance criteria:
  - User-facing validation flow nhất quán với contract đã ghi trong docs.
  - Frontend quick-guard và backend canonical validation không drift âm thầm khi mở rộng schema.
- Dependencies: TASK-080
- Verification: route tests + UI tests + doc review
- Progress update:
  - Đã export contract constants ở frontend để chốt rõ quick-guard chỉ cover 4 field bắt buộc, còn canonical normalization ở backend bao phủ thêm text/list fields.
  - Đã thêm route test xác nhận payload trả về được normalize/dedup canonically, cùng UI test cho disabled/error state của quick-guard.
  - Đã sync UC-07 để ghi rõ ranh giới giữa frontend quick-guard và backend canonical validation.

#### TASK-085 - Thêm domain-grade golden fixtures cho segmentation `spec -> use case`
- Priority: P2
- Status: Done
- Module: use-case-generation
- Problem: Segmentation hiện đã linh hoạt hơn về số lượng, nhưng acceptance “fixture domain thật cho ra UC list đúng bài hơn” vẫn chưa được khóa bằng bộ fixture thực tế.
- Why it matters: Trước khi dùng `UseCaseDraft` làm nguồn generate diagram, mình cần biết boundaries của use case đủ tin cậy ở các domain thật chứ không chỉ ở fixture tổng hợp nhỏ.
- Implementation steps:
  1. Thu thập ít nhất 3 fixture domain thật từ backlog hiện có.
  2. Chốt expected boundaries hoặc review rubric cho từng fixture.
  3. Thêm golden tests hoặc review snapshots để khóa segmentation quality.
  4. Chỉ sau đó mới coi heuristic hiện tại đủ chín để đi tiếp sang `UseCaseDraft -> DiagramDraft`.
- Acceptance criteria:
  - Có bộ fixture domain thật cho lane `spec -> use case`.
  - Segmentation được kiểm tra theo quality expectation, không chỉ theo số lượng UC.
- Dependencies: TASK-082
- Verification: golden review + pytest fixtures
- Progress update:
  - Đã thêm fixture domain thật cho các case `GPS Device issuance`, `fire incident response`, và `swimlane theme update`.
  - Đã thêm pytest lane đọc fixture JSON và khóa expected segmentation boundary theo các kind `intake / execution / coordination / exception`.

#### TASK-086 - Thêm drift guard cho validation contract giữa frontend và backend
- Priority: P2
- Status: Pending
- Module: spec-ingestion
- Problem: Frontend hiện đã expose contract constants cho quick-guard/canonical fields, nhưng chúng vẫn là bản copy tay của backend schema validators.
- Why it matters: Nếu field coverage thay đổi ở backend mà frontend constants/docs không đổi theo, contract sẽ lệch ngay tại entrypoint của toàn pipeline.
- Implementation steps:
  1. Chọn một source of truth khả thi cho field coverage (shared artifact, generated snapshot, hoặc sync test).
  2. Thêm regression để fail khi frontend contract constants drift khỏi backend schema coverage đã chốt.
  3. Sync docs nếu contract representation thay đổi.
- Acceptance criteria:
  - Repo có cơ chế tự động phát hiện drift giữa frontend validation contract và backend canonical coverage.
  - Không còn phụ thuộc hoàn toàn vào việc developer nhớ cập nhật hai nơi bằng tay.
- Dependencies: TASK-084
- Verification: automated contract drift test

#### TASK-087 - Nâng domain fixtures thành segmentation goldens giàu nghĩa hơn
- Priority: P2
- Status: Pending
- Module: use-case-generation
- Problem: Fixture lane mới hiện chủ yếu khóa `count`, `primary_actor`, và `kind`, nên vẫn chưa đủ sâu để bảo vệ chất lượng boundary của `UseCaseDraft`.
- Why it matters: Downstream `UseCaseDraft -> DiagramDraft` cần nhiều hơn việc “đủ số lượng UC”; nó cần các UC đúng ranh giới và đủ nghĩa nghiệp vụ.
- Implementation steps:
  1. Với mỗi fixture domain, bổ sung expected signals cho title/objective/preconditions/success outcome hoặc boundary notes.
  2. Giảm phụ thuộc vào template phrase exact-match trong phân loại kind nếu có thể.
  3. Thêm review rubric ngắn cho các fixture khó như `fire incident response`.
- Acceptance criteria:
  - Golden fixtures khóa được nhiều hơn số lượng UC và label family.
  - Regression segmentation chất lượng thấp sẽ fail trước khi chảy xuống diagram generation.
- Dependencies: TASK-085
- Verification: pytest goldens + review snapshots

#### TASK-088 - Thêm regression cho flow “edit draft -> revert draft -> regenerate”
- Priority: P3
- Status: Pending
- Module: use-case-generation
- Problem: Dirty-state mới đã được test cho case revert spec, nhưng chưa có test riêng cho case revert chính `UseCaseDraft[]` về snapshot generate cũ.
- Why it matters: Đây là nhánh logic còn chưa được khóa, trong khi warning overwrite là UX guard quan trọng của panel review.
- Implementation steps:
  1. Thêm một test mô phỏng user sửa title/objective hoặc review status của draft.
  2. Hoàn tác chính sửa đó về đúng snapshot ban đầu.
  3. Verify generate lại không hiện confirm replace.
- Acceptance criteria:
  - Flow revert draft được khóa bằng regression test rõ ràng.
- Dependencies: TASK-083
- Verification: UI/E2E regression

#### TASK-089 - Tách `Use case drafts` thành workspace 3 lớp: `Input` / `Use cases` / `Diagrams`
- Priority: P1
- Status: Done
- Module: usecase-frontend-review
- Problem: UI hiện trộn form nhập liệu, trạng thái hệ thống, `Artifact chain`, và danh sách use case vào một panel dài duy nhất, khiến mental model của người dùng bị rối.
- Why it matters: User đang nghĩ theo workflow rất đơn giản: “tôi nhập spec + function intent”, “tôi nhận danh sách use case”, “mỗi use case dẫn tới một diagram”. Nếu UI không phản ánh đúng mô hình này, mọi bước sau sẽ đều cảm thấy khó dùng dù logic backend đúng.
- Implementation steps:
  1. Thiết kế lại shell thành 3 vùng rõ ràng:
     - `Input`
     - `Use cases`
     - `Diagrams`
  2. Quyết định layout phù hợp:
     - tabbed workspace
     - split pane
     - hoặc stepper 3 pha
  3. Giữ route/state hiện có nhưng đổi cấu trúc hiển thị trước, chưa cần build full persistence.
  4. Thêm empty state và transition copy rõ ràng giữa 3 vùng.
- Acceptance criteria:
  - User nhìn vào UI là phân biệt ngay đâu là input, đâu là output use case, đâu là nơi quản lý diagram.
  - Không còn phải cuộn một panel dài để hiểu workflow.
- Dependencies: TASK-074
- Verification: UX review + Playwright smoke

#### TASK-090 - Đổi tên và copy của workspace để phản ánh đúng job-to-be-done
- Priority: P2
- Status: Done
- Module: usecase-frontend-review
- Problem: Tên `Use case drafts` đang gây hiểu nhầm vì nó bao gồm cả form nhập liệu lẫn output generated.
- Why it matters: Naming sai làm user hiểu sai artifact model ngay từ đầu, rồi kéo theo confusion ở các bước review/generate tiếp theo.
- Implementation steps:
  1. Đổi tên toolbar entry và panel title sang một label rõ hơn như `Use case builder`, `Spec -> Use cases`, hoặc tương đương.
  2. Viết lại microcopy cho:
     - input section
     - generate action
     - review/approve state
  3. Kiểm tra lại labels/aria names trong tests.
- Acceptance criteria:
  - Tên màn hình và copy mới phản ánh rõ đây là nơi nhập spec và sinh ra use case.
  - User không còn nhầm `UseCaseDraft` là input gốc.
- Dependencies: TASK-089
- Verification: UI tests + UX review

#### TASK-091 - Ẩn `Artifact chain` khỏi primary flow và chuyển sang advanced disclosure
- Priority: P2
- Status: Done
- Module: artifact-chain-ux
- Problem: `Artifact chain` hiện nằm giữa luồng chính của panel và làm tăng cognitive load cho người dùng bình thường.
- Why it matters: Đây là thông tin hữu ích cho dev/BA nâng cao, nhưng không nên chen vào giữa input form và danh sách use case trong primary UX.
- Implementation steps:
  1. Chuyển `Artifact chain` vào:
     - collapsible `Advanced`
     - info drawer
     - hoặc help/inspector riêng
  2. Giữ nguyên dữ liệu và traceability, chỉ đổi vị trí và mức độ lộ ra.
  3. Cập nhật docs/screenshots nếu có.
- Acceptance criteria:
  - Primary flow không còn bị chặn giữa chừng bởi `Artifact chain`.
  - Người cần traceability vẫn mở được nó khi muốn.
- Dependencies: TASK-089
- Verification: UX review

#### TASK-092 - Thêm danh sách diagram gắn theo từng use case
- Priority: P1
- Status: Done
- Module: diagram-generation-entrypoint
- Problem: UI hiện chưa có surface nào hiển thị “mỗi use case có diagram nào, trạng thái ra sao, mở ở đâu”.
- Why it matters: Đây là mắt xích user-facing còn thiếu rõ nhất giữa `UseCaseDraft` và `DiagramDraft`.
- Implementation steps:
  1. Định nghĩa frontend state cho `diagram inventory` gắn với `use_case_id`.
  2. Hiển thị một list/table cho mỗi use case:
     - chưa có diagram
     - có draft
     - outdated/diverged (về sau)
  3. Thêm chỗ giữ action placeholder hoặc real action:
     - `Generate diagram`
     - `Open diagram`
  4. Nếu `TASK-075` chưa xong, ít nhất vẫn phải có UI contract rõ cho inventory này.
- Acceptance criteria:
  - User thấy được list diagram tương ứng với từng use case, kể cả khi trạng thái ban đầu là “chưa có”.
  - Approved use case không còn là dead end trong UI.
- Dependencies: TASK-075
- Verification: UI state tests + workflow review

#### TASK-093 - Thêm lifecycle action rõ ràng trên từng use case card/row
- Priority: P1
- Status: Done
- Module: usecase-frontend-review
- Problem: Card hiện hỗ trợ edit/review nhưng chưa cho thấy bước tiếp theo sau khi approve.
- Why it matters: Với workflow này, mỗi item cần có next action hiển nhiên để đi sang diagram, thay vì buộc user tự suy ra bước sau.
- Implementation steps:
  1. Thiết kế lại mỗi use case card hoặc row thành lifecycle item:
     - edit
     - review
     - approve
     - generate/open diagram
  2. Tách metadata, nội dung chỉnh sửa, và action cluster cho dễ scan.
  3. Đồng bộ labels/status với diagram inventory.
- Acceptance criteria:
  - Approved use case có next action rõ ràng.
  - User nhìn list là biết item nào còn chỉnh, item nào đã sẵn sàng sinh diagram.
- Dependencies: TASK-089, TASK-092
- Verification: UX review + component tests

#### TASK-094 - Cập nhật UC-07 và roadmap theo UI contract mới kiểu `Input -> Use cases -> Diagrams`
- Priority: P2
- Status: Done
- Module: workflow-docs
- Problem: Docs hiện mô tả đúng implementation cũ, nhưng chưa phản ánh mental model mới mà user đang hướng tới.
- Why it matters: Nếu code và docs lệch nhau ở giai đoạn redesign, team sẽ rất dễ tranh luận lại từ đầu khi implement `DiagramDraft`.
- Implementation steps:
  1. Sửa UC-07 để mô tả workspace mới.
  2. Nếu cần, tách hoặc thêm UC riêng cho `use case -> diagram workspace`.
  3. Sync lại roadmap/architecture note để diagram inventory trở thành artifact UI first-class.
- Acceptance criteria:
  - Docs mô tả đúng trải nghiệm mới.
  - Không còn ambiguity về chỗ nhập input, chỗ review use case, và chỗ quản lý diagram.
- Dependencies: TASK-089, TASK-092
- Verification: doc review

#### TASK-095 - Tự động invalid `approved` khi nội dung use case bị sửa sau review
- Priority: P1
- Status: Done
- Module: usecase-frontend-review
- Problem: Một item đã `approved` hiện vẫn cho phép sửa trực tiếp title/objective/actors/preconditions/outcome mà không làm mất trạng thái sẵn sàng đi sang diagram.
- Why it matters: Approval không còn đáng tin nếu nội dung có thể thay đổi sau đó mà UI vẫn coi item là `ready for diagram`.
- Implementation steps:
  1. Chặn hoặc intercept `onUseCaseChange` cho item đang `approved`.
  2. Quyết định policy rõ:
     - `approved -> reviewed`
     - hoặc `approved -> draft`
     - hoặc `approved + needs_re_review`
  3. Đồng bộ policy đó với button/action trên card và diagram inventory.
  4. Thêm copy giải thích ngắn khi item bị kéo về trạng thái cần review lại.
- Acceptance criteria:
  - Sửa nội dung một item đã `approved` không còn giữ nguyên trạng thái “sẵn sàng đi sang diagram”.
  - Diagram inventory phản ánh đúng việc item cần review lại.
- Dependencies: TASK-089, TASK-093
- Verification: component tests + E2E flow edit-after-approve
- Result: Implemented `approved -> reviewed` on content edit, with diagram inventory falling back to `needs_review` until the item is phê duyệt again.

#### TASK-096 - Hiển thị persistent active-use-case context khi mở canvas từ vùng `Diagrams`
- Priority: P1
- Status: Done
- Module: diagram-generation-entrypoint
- Problem: Sau khi user bấm `Open canvas`, workspace đóng lại và editor hiện chưa có dấu hiệu bền vững nào cho biết canvas đang gắn với use case nào.
- Why it matters: Đây là mắt xích chuyển từ `UseCaseDraft` sang `DiagramDraft`; nếu mất context ở chỗ này, user rất dễ chỉnh nhầm canvas mà không biết đang làm việc cho item nào.
- Implementation steps:
  1. Thêm một context chip hoặc inspector block trên editor shell.
  2. Hiển thị tối thiểu:
     - `use_case_id`
     - title
     - review / diagram state hiện tại
  3. Cho phép reopen nhanh vùng `Diagrams` từ context này.
  4. Chuẩn bị chỗ cắm thêm `outdated/diverged` khi `TASK-076` đến.
- Acceptance criteria:
  - Sau `Open canvas`, user luôn thấy canvas đang gắn với use case nào.
  - Từ editor shell có đường quay lại diagram inventory rõ ràng.
- Dependencies: TASK-092, TASK-093
- Verification: Playwright flow `Open in Diagrams -> Open canvas`
- Result: Added a persistent editor-shell context chip for the active canvas use case with `use_case_id`, title, review/diagram state, and a quick action back to the diagram inventory.

#### TASK-097 - Chuẩn hóa copy workspace theo VN-first UI
- Priority: P2
- Status: Done
- Module: usecase-frontend-review
- Problem: Workspace mới hiện trộn mạnh tiếng Việt và tiếng Anh (`Use Case Workspace`, `Input`, `Use cases`, `Diagrams`, `Open canvas`, `Needs approval`, ...).
- Why it matters: Flow này đang hướng tới BA / Solution Engineer Việt ngữ; copy nửa Việt nửa Anh làm UX kém tự nhiên và lệch với định hướng VN-first của repo.
- Implementation steps:
  1. Chốt glossary UI cho workspace:
     - label toolbar
     - tab labels
     - empty states
     - action buttons
     - status pills
  2. Giữ English chỉ ở nơi thật sự cần cho artifact/dev trace.
  3. Cập nhật lại tests và docs bị ảnh hưởng.
- Acceptance criteria:
  - Primary UX copy của workspace nhất quán theo một ngôn ngữ chính.
  - Không còn các label/action trạng thái lẫn Việt/Anh trong cùng luồng chính.
- Dependencies: TASK-089, TASK-090
- Verification: UI review + component/E2E selector update
- Result: Normalized the primary workspace headings, tabs, actions, statuses, empty states, and toolbar entry to Vietnamese-first copy while keeping artifact names in technical trace surfaces.

#### TASK-098 - Tách inventory focus khỏi active canvas use-case binding
- Priority: P1
- Status: Done
- Module: diagram-generation-entrypoint
- Problem: `selectedUseCaseIdForDiagram` và `activeCanvasUseCaseId` là hai state khác nhau, nhưng inventory đang render selected ID như use case đã được chọn trên canvas.
- Why it matters: User có thể đang làm canvas cho use case A nhưng inventory lại nói use case B đang selected, tạo nguy cơ mở/sinh diagram sai khi `TASK-075` được implement.
- Implementation steps:
  1. Đổi tên `selectedUseCaseIdForDiagram` thành state thể hiện đúng nghĩa focus/highlight trong inventory, hoặc bỏ state này nếu không cần.
  2. Chỉ derive trạng thái “đang active trên canvas” từ `activeCanvasUseCaseId`.
  3. Nếu cần focus B trong inventory khi canvas vẫn active A, dùng style/highlight trung tính, không dùng lifecycle status `selected`.
  4. Viết lại note/copy để phân biệt “đang xem trong inventory” và “canvas đang gắn với”.
  5. Thêm E2E: mở canvas A, mở inventory từ B, xác nhận context vẫn A và B chưa được coi là active; chỉ đổi sang B sau `Mở canvas`.
- Acceptance criteria:
  - Tại mọi thời điểm chỉ có tối đa một use case được mô tả là active trên canvas.
  - Context shell và diagram inventory không thể hiển thị hai active use case khác nhau.
- Dependencies: TASK-096
- Verification: unit test lifecycle derivation + Playwright A-active/B-focused/B-active transition
- Result: Renamed the navigation state to `focusedUseCaseId`, removed `selected` from diagram lifecycle, derived active inventory state only from `activeCanvasUseCaseId`, added a neutral `Đang xem trong danh sách` marker, and covered the A-active/B-focused/B-active transition in Playwright.

#### TASK-099 - Chốt một source of truth cho diagram status và quyền `Mở canvas`
- Priority: P1
- Status: Done
- Module: usecase-lifecycle-contract
- Problem: UI hiển thị label theo `diagram_status` nhưng cho phép `Mở canvas` theo `review_status`, trong khi type hiện cho phép hai field tạo tổ hợp mâu thuẫn.
- Why it matters: Khi thêm `outdated / diverged / generating / failed` ở `TASK-075` và `TASK-076`, item có thể trông bị block nhưng vẫn mở canvas được.
- Implementation steps:
  1. Định nghĩa helper hoặc discriminated contract cho diagram lifecycle.
  2. Derive `canOpenCanvas` từ diagram lifecycle thay vì check trực tiếp `review_status`.
  3. Dùng `diagram_status` cho cả label, style, note, và action permission.
  4. Thêm test cho tổ hợp blocked/outdated nhưng review đã approved.
  5. Document invariant trong `src/usecases/types.ts` hoặc UC-07.
- Acceptance criteria:
  - Không có item nào hiển thị trạng thái blocked nhưng vẫn expose `Mở canvas`.
  - Mọi lifecycle combination được type/helper kiểm soát và có test.
- Dependencies: TASK-098; phải hoàn tất trước TASK-075/TASK-076
- Verification: unit tests cho lifecycle matrix + component tests cho action visibility
- Result: Added a pure diagram lifecycle contract supporting current and upcoming states, with label, note, styling, and `canOpenCanvas` derived from `diagram_status`; approved-but-outdated/diverged states remain blocked by unit and component regressions.

#### TASK-100 - Hoàn tất glossary VN-first cho primary use-case workspace
- Priority: P2
- Status: Pending
- Module: usecase-frontend-review
- Problem: TASK-097 đã Việt hóa phần lớn heading/action/status, nhưng primary form vẫn trộn `intent`, `feature`, `function`, `actor`, `trigger`, `input/output`, `Request`, và `activity diagram`.
- Why it matters: Không có glossary rõ ràng thì mỗi lần thêm field hoặc lifecycle state, copy sẽ quay lại trạng thái nửa Việt nửa Anh.
- Implementation steps:
  1. Chốt danh sách term được giữ nguyên có chủ đích, ví dụ `use case`, `BRD`, và tên artifact kỹ thuật.
  2. Việt hóa các label còn lại trong primary flow; giữ raw type names trong `Trace kỹ thuật`.
  3. Đồng bộ validation copy từ `prevalidate.ts` với glossary mới.
  4. Cập nhật component/E2E selectors và UC-07.
- Acceptance criteria:
  - Primary form, actions, status, empty states, và validation messages dùng một glossary VN-first nhất quán.
  - English ngoài glossary chỉ xuất hiện trong technical disclosure.
- Dependencies: TASK-097
- Verification: UI copy audit + component/E2E tests

#### TASK-101 - Extract và test pure use-case lifecycle derivation
- Priority: P2
- Status: Done
- Module: usecase-frontend-review
- Problem: Component test hiện copy lại logic `approved -> reviewed`, còn production lifecycle derivation nằm private trong `App.tsx`.
- Why it matters: Test có thể xanh dù production handler regress; các state mới của TASK-075/TASK-076 sẽ làm duplication này khó bảo trì hơn.
- Implementation steps:
  1. Tách content-change detection và approval invalidation sang helper thuần trong `src/usecases/`.
  2. Tách diagram inventory/lifecycle derivation khỏi `App.tsx`.
  3. Cho production handler và test harness dùng cùng helper.
  4. Thêm unit tests cho title, objective, actors, preconditions, happy path, exceptions, outcome, và review-only changes.
  5. Thêm regression cho active-vs-focused transition từ TASK-098.
- Acceptance criteria:
  - Test không còn reimplement lifecycle policy.
  - Mọi field nghiệp vụ edit sau approve đều demote đúng; đổi review status đơn thuần không bị coi là content edit.
- Dependencies: TASK-098, TASK-099
- Verification: focused Vitest lifecycle suite + existing E2E
- Result: Extracted content-change detection, approval invalidation, diagram lifecycle, and inventory derivation into `src/usecases/lifecycle.ts`; production and component harness now share the helpers, with field-by-field lifecycle tests and active-vs-focused coverage.

#### TASK-102 - Nâng `UseCaseDraft` thành contract chi tiết đủ để sinh diagram
- Priority: P1
- Status: Done
- Module: use-case-generation-contract
- Problem: `UseCaseDraft` hiện chỉ có `happy_path_summary` và `key_exceptions` dạng chuỗi, không có actor theo step, branch condition, target/rejoin, hoặc stable trace IDs.
- Why it matters: Diagram generator sẽ phải đoán lane và decision từ prose, tạo graph generic và làm TASK-076 round-trip traceability khó sửa về sau.
- Implementation steps:
  1. Bổ sung structured main-flow step với tối thiểu:
     - `step_id`
     - `actor_ref`
     - `action`
     - optional `input_or_trigger`
     - `expected_result`
  2. Bổ sung alternate/exception flow với:
     - stable ID
     - source step
     - condition
     - ordered steps
     - target/rejoin hoặc terminal outcome
  3. Giữ summary fields hiện tại làm reader-facing projection hoặc compatibility layer.
  4. Cập nhật backend schema, frontend type, builder, fixtures, form editor, và normalization.
  5. Thêm validation để mọi actor/step/branch reference đều resolve được.
- Acceptance criteria:
  - Mỗi bước nghiệp vụ có actor và stable trace ID.
  - Mỗi exception/alternate path có điểm rẽ và outcome rõ ràng.
  - Contract đủ để map deterministically sang lane/node/edge mà không parse prose tự do.
- Dependencies: TASK-074, TASK-087
- Verification: backend/frontend contract tests + domain goldens + editor component tests
- Result: Added stable main-flow steps and alternate flows with actor/source/rejoin validation across backend and frontend contracts. The editor now exposes the structured flow while keeping summary fields synchronized for reader-facing compatibility.

#### TASK-103 - Sửa CTA diagram để phân biệt `Tạo` với `Mở`
- Priority: P1
- Status: Done
- Module: diagram-generation-entrypoint
- Problem: Item `ready_to_generate` hiện expose `Mở canvas`, nhưng handler chỉ bind use case vào canvas hiện có và giữ nguyên sample graph.
- Why it matters: User tưởng diagram đã được tạo hoặc nạp; sample graph có thể bị hiểu nhầm là diagram của use case vừa chọn.
- Implementation steps:
  1. Tách lifecycle `not_started/ready_to_generate` khỏi `ready_to_open`.
  2. Với diagram chưa tồn tại, hiển thị `Tạo sơ đồ`; không expose `Mở canvas`.
  3. Chỉ hiển thị `Mở canvas` khi inventory có `DiagramDraft` thật.
  4. Trước khi TASK-075 hoàn tất, disable `Tạo sơ đồ` với copy minh bạch hoặc cung cấp action riêng `Dựng thủ công trên canvas`.
  5. Nếu dựng thủ công, khởi tạo canvas trống với lane theo actor và hỏi trước khi thay graph hiện tại.
  6. Thêm E2E xác nhận sample graph không được trình bày như diagram của use case.
- Acceptance criteria:
  - Diagram chưa tồn tại không có action `Mở canvas`.
  - Bấm action manual/generate không giữ sample không liên quan dưới context của use case.
  - CTA phản ánh đúng artifact state tại mọi thời điểm.
- Dependencies: TASK-099; tích hợp hoàn chỉnh cùng TASK-075
- Verification: lifecycle matrix + component tests + Playwright handoff regression
- Result: `not_started` now exposes `Tạo sơ đồ`; only an existing ready draft exposes `Mở canvas`. E2E verifies that generation replaces the initial sample instead of rebinding it to a use case.

#### TASK-075 - Implement `UseCaseDraft -> DiagramDraft` generation
- Priority: P1
- Status: Done
- Module: diagram-generation
- Problem: Editor hiện mạnh ở chỉnh tay, nhưng chưa có bước sinh diagram graph từ use case đã approved.
- Why it matters: Đây là mắt xích trực tiếp để đạt mục tiêu “mỗi use case có activity diagram tương ứng”.
- Implementation steps:
  1. Định nghĩa graph-generation contract từ `UseCaseDraft`.
  2. Sinh lane candidates từ actor list.
  3. Sinh node/edge skeleton cho:
     - start/end
     - activity chain
     - decision branches
     - note/context blocks
  4. Render diagram draft vào editor với trace link ngược về UC.
- Acceptance criteria:
  - Một use case approved có thể generate ra diagram draft mở được trong editor.
  - Diagram sinh ra vẫn chỉnh tay tiếp được.
- Dependencies: TASK-074, TASK-102, TASK-103
- Verification: fixture generation + editor smoke
- Result: Added deterministic `POST /api/diagrams/generate`, actor lanes, start/end, activities, decisions, alternate paths, traceable edges, and frontend conversion/rendering into LogicFlow. Generated drafts remain fully editable.

#### TASK-076 - Thêm round-trip contract giữa `UseCaseDraft` và `DiagramDraft`
- Priority: P1
- Status: Done
- Module: diagram-editor-and-roundtrip
- Problem: Sau khi diagram được generate, user chắc chắn sẽ sửa tay. Nếu không có round-trip contract, link giữa UC và diagram sẽ gãy.
- Why it matters: Formal BRD cuối cùng phải dựa trên artifact đã được user review, không phải chỉ draft generated ban đầu.
- Implementation steps:
  1. Gắn trace metadata từ node/edge về UC step/exception/source block.
  2. Thiết kế policy khi user sửa diagram:
     - minor layout change
     - semantic step rename
     - branch thêm/bớt
  3. Hiển thị `outdated / diverged` khi UC và diagram không còn khớp.
  4. Cho phép regenerate có kiểm soát.
- Acceptance criteria:
  - Diagram edit không làm mất trace về UC.
  - Hệ thống biết khi nào UC/diagram lệch nhau đáng kể.
- Dependencies: TASK-075
- Verification: integration tests + UX review
- Result: Node/edge trace metadata survives editor snapshots. Layout-only edits preserve readiness, semantic edits mark the draft `diverged`, use-case edits mark it `outdated`, and controlled regeneration asks before replacing a semantically edited graph. Draft workspaces are retained per `use_case_id` for the current frontend session.

#### TASK-077 - Synthesize `formal_brd` từ use-case portfolio đã approved
- Priority: P1
- Status: Pending
- Module: formal-brd-generation
- Problem: Formal BRD nên được build từ tập use case + diagrams đã được review, không phải trực tiếp từ một diagram đơn lẻ như hiện nay.
- Why it matters: Đây mới là pipeline đúng với target end-state của bạn.
- Implementation steps:
  1. Đổi source input của `formal_brd` từ `single diagram` sang:
     - `ProjectSpec`
     - approved `UseCaseDraft[]`
     - linked `DiagramDraft[]`
  2. Map use-case portfolio sang:
     - purpose
     - business scope
     - actor table
     - UC catalog
     - business state catalog
     - per-UC sections
  3. Giữ `diagram -> summary_brd` cũ như mode phụ nếu cần.
  4. Thêm acceptance rules cho multi-UC compilation.
- Acceptance criteria:
  - Formal BRD không còn phụ thuộc vào một diagram đơn lẻ.
  - Output gần với mẫu BRD thật ở mức portfolio/use-case document.
- Dependencies: TASK-065, TASK-066, TASK-067, TASK-068, TASK-069, TASK-074, TASK-075, TASK-076
- Verification: golden document snapshots

#### TASK-078 - Thêm latest-state persistence cho project spec, use case, diagram, BRD
- Priority: P2
- Status: Pending
- Module: persistence-latest-state
- Problem: Khi pipeline có nhiều artifact nối tiếp, local/frontend-only state sẽ trở thành bottleneck rất sớm.
- Why it matters: Không có persistence thì review, diff, approve, regenerate sẽ không đáng tin cậy.
- Implementation steps:
  1. Dùng [database architecture](./scope/database-architecture.md) làm canonical design.
  2. Implement theo các task con `TASK-129` đến `TASK-147`.
  3. Chỉ lưu phiên bản mới nhất của từng artifact.
  4. Dùng explicit Save cho project, spec, feature, use cases, diagram và BRD.
  5. Không thêm revision/workspace/audit/realtime trong MVP.
- Acceptance criteria:
  - Có thể lưu và nạp lại trọn chain `spec -> UC -> diagram -> BRD`.
  - Mỗi phần lưu đúng phiên bản mới nhất và được scope theo user/project.
- Dependencies: TASK-072, TASK-073, TASK-074, TASK-075; TASK-077 có thể triển khai trên schema BRD đã thiết kế
- Verification: Hoàn tất acceptance criteria của `TASK-129` đến `TASK-147`

#### TASK-079 - Xây eval lane cho toàn pipeline AI
- Priority: P2
- Status: Pending
- Module: eval-and-qa
- Problem: Mỗi lớp AI mới (spec -> UC, UC -> diagram, diagram/usecases -> BRD) sẽ nhân bội khả năng regress.
- Why it matters: Nếu không có eval lane từ sớm, bạn sẽ rất khó biết lỗi nằm ở tầng nào.
- Implementation steps:
  1. Tạo dataset nhỏ cho từng stage:
     - project spec -> use case
     - use case -> diagram
     - portfolio -> formal BRD
  2. Chốt tiêu chí chấm điểm/acceptance cho từng stage.
  3. Tách smoke tests và goldens cho từng layer thay vì chỉ end-to-end.
  4. Ghi log kết quả eval cho mỗi lần đổi heuristic/prompt/schema.
- Acceptance criteria:
  - Có baseline chất lượng cho từng tầng pipeline.
  - Regression có thể khoanh vùng theo stage thay vì chỉ fail E2E.
- Dependencies: TASK-074, TASK-075, TASK-077
- Verification: eval reports + CI lane

#### TASK-104 - Chặn phê duyệt use case có detailed contract không hợp lệ
- Priority: P1
- Status: Done
- Module: use-case-editor-contract
- Problem: Edit actor hoặc danh sách bước có thể để lại `actor_ref`, `source_step_id`, hoặc `rejoin_step_id` không còn resolve, nhưng UI vẫn cho approve.
- Why it matters: Trạng thái `approved` không còn bảo đảm use case thực sự diagram-ready; lỗi chỉ xuất hiện khi gọi API tạo sơ đồ.
- Implementation steps:
  1. Tạo pure validator cho toàn bộ `UseCaseDraft` chi tiết ở frontend.
  2. Validate actor references, stable IDs, branch source/rejoin, outcome mode, và text bắt buộc.
  3. Khi đổi actor, tự migrate reference chỉ khi mapping rõ ràng; trường hợp mơ hồ phải báo lỗi.
  4. Khi thêm/xóa/reorder main step, reconcile hoặc yêu cầu user sửa branch reference.
  5. Disable `Phê duyệt`, `Phê duyệt tất cả`, và `Tạo sơ đồ` khi contract còn lỗi.
  6. Hiển thị lỗi sát field/flow liên quan.
- Acceptance criteria:
  - Không thể đưa use case có dangling reference sang `approved`.
  - Mọi use case approved từ UI đều được backend schema chấp nhận.
  - Edit actor và xóa step có regression tests.
- Dependencies: TASK-102
- Verification: focused Vitest/component tests + Playwright actor/step edit flow
- Result: Frontend có pure contract validator, migrate primary actor khi mapping rõ ràng, hiển thị dangling-reference errors và chặn review/approve/generate khi contract chưa diagram-ready.

#### TASK-105 - Siết invariant backend cho use-case và diagram IDs
- Priority: P1
- Status: Done
- Module: use-case-generation-contract
- Problem: Backend chấp nhận main flow rỗng, duplicate alternate-step IDs, outcome mơ hồ, và graph ID collision sau slug.
- Why it matters: API có thể trả graph thiếu nghiệp vụ hoặc duplicate node IDs làm LogicFlow hoạt động không xác định.
- Implementation steps:
  1. Yêu cầu `main_flow_steps` có ít nhất một bước.
  2. Normalize và validate text bắt buộc của use case, step, flow, condition, và outcome.
  3. Enforce uniqueness toàn cục cho main-step IDs, alternate-step IDs, và flow IDs.
  4. Yêu cầu alternate flow có đúng một hướng kết thúc hợp lệ: rejoin hoặc terminal outcome.
  5. Detect collision sau khi chuyển source ID sang graph node/edge ID.
  6. Trả lỗi validation có path cụ thể và thêm route regression.
- Acceptance criteria:
  - Empty main flow và duplicate/colliding IDs bị reject 422.
  - Không có `DiagramDraft` nào chứa duplicate node/edge ID.
  - Alternate flow luôn có outcome xác định.
- Dependencies: TASK-102
- Verification: Pydantic contract tests + diagram-builder property/golden tests
- Result: Pydantic schema đã enforce main flow, required text, global stable-ID uniqueness, alternate outcome mode và projected graph-ID collision; builder kiểm tra duplicate node/edge IDs trước khi trả draft.

#### TASK-106 - Bảo vệ diagram workspace trước các thao tác regenerate
- Priority: P1
- Status: Done
- Module: artifact-workspace-lifecycle
- Problem: Sinh lại use case xóa toàn bộ diagram workspace dù confirm chỉ nói thay danh sách use case; diagram regenerate thất bại lại che bản hiện tại.
- Why it matters: User có thể mất diagram đã chỉnh tay hoặc không truy cập được bản còn nguyên sau lỗi mạng/backend.
- Implementation steps:
  1. Trước khi regenerate use case, thống kê workspace ready/outdated/diverged bị ảnh hưởng.
  2. Đổi confirm copy để nêu rõ diagram nào sẽ bị orphan/xóa.
  3. Cho phép cancel hoặc giữ orphan workspace cho tới khi user discard có chủ đích.
  4. Tách operation state khỏi artifact availability.
  5. Khi diagram regenerate fail mà có workspace cũ, hiển thị `Mở bản hiện tại` cùng `Thử lại`.
  6. Thêm E2E cho cả use-case regenerate và diagram regenerate failure.
- Acceptance criteria:
  - Không có diagram workspace bị xóa mà không có cảnh báo cụ thể.
  - Failed regeneration không làm mất đường mở bản hiện tại.
  - Diverged workspace vẫn nguyên vẹn sau cancel/failure.
- Dependencies: TASK-076
- Verification: lifecycle unit tests + Playwright destructive-flow regressions
- Result: Regenerate use case giữ workspace không còn khớp dưới dạng orphan draft; operation failure không che artifact hiện tại, và orphan chỉ bị bỏ sau confirm discard riêng.

#### TASK-107 - Gom mọi canvas mutation vào một workspace commit path
- Priority: P1
- Status: Done
- Module: diagram-editor-and-roundtrip
- Problem: Snapshot logic nằm rải rác theo event; lane resize, custom shape resize, và sync-bar move chưa được capture.
- Why it matters: Layout edit có thể biến mất sau khi đổi sang use case khác rồi mở lại.
- Implementation steps:
  1. Tạo helper/hook commit workspace nhận change kind `layout | semantic`.
  2. Chuyển node/edge add-delete-text-move-resize, lane add-delete-rename-reorder-resize, sync-bar move/resize, import/reset/clear, undo/redo sang helper này.
  3. Bảo đảm commit đọc graph sau khi LogicFlow hoàn tất mutation.
  4. Loại các call `markDiagramChanged`/`captureActiveUseCaseDiagram` trùng hoặc thiếu.
  5. Thêm switch-away/switch-back tests cho lane resize, shape resize, normal node move, và sync-bar move.
- Acceptance criteria:
  - Mọi mutation được lưu vào đúng workspace trước khi switch.
  - Layout-only mutation không đánh dấu `diverged`.
  - Semantic mutation luôn đánh dấu `diverged`.
- Dependencies: TASK-076
- Verification: focused integration tests + Playwright multi-use-case switch tests
- Result: Canvas mutation đi qua commit path phân biệt `layout` và `semantic`; lane/shape resize, sync-bar, edge text và các event graph chính đều capture lại đúng workspace.

#### TASK-108 - Render terminal alternate flow thành outcome riêng
- Priority: P1
- Status: Done
- Module: diagram-generation
- Problem: Alternate flow không rejoin đang nối vào success end chung và bỏ qua `terminal_outcome`.
- Why it matters: Nhánh từ chối/hủy/lỗi có thể bị biểu diễn như hoàn tất thành công, làm sai nghĩa nghiệp vụ.
- Implementation steps:
  1. Với terminal flow, tạo end/outcome node riêng.
  2. Render `terminal_outcome` thành text đọc được.
  3. Gắn trace node/edge về alternate flow và terminal source.
  4. Chỉ main success path được nối vào success end chung.
  5. Xử lý nhiều terminal flow không overlap và có stable IDs.
  6. Thêm golden tests cho rejoin, terminal, và mixed flows.
- Acceptance criteria:
  - Terminal branch không bao giờ kết thúc ở success end chung.
  - Outcome text và trace xuất hiện trong `DiagramDraft`.
  - Graph mixed branch giữ đúng topology.
- Dependencies: TASK-075, TASK-105
- Verification: diagram-builder goldens + Browser visual smoke
- Result: Terminal alternate flow tạo activity outcome và end riêng có trace `terminal_outcome`; chỉ success path nối vào success end chung.

#### TASK-109 - Chuẩn hóa provenance và giữ trace qua manual edit/import-export
- Priority: P2
- Status: Done
- Module: diagram-traceability
- Problem: Trace hiện chỉ tồn tại trên generated graph trong memory; Draw.io round-trip bỏ trace và element tạo tay không có provenance.
- Why it matters: Không thể audit/merge chắc chắn hoặc tổng hợp formal BRD có trace sau workflow chỉnh sửa thực tế.
- Implementation steps:
  1. Định nghĩa provenance envelope versioned cho node/edge: generated source, manual, modified-from.
  2. Gắn provenance `manual` khi DnD node hoặc tạo edge mới.
  3. Giữ source trace khi rename/move/resize generated element.
  4. Serialize provenance trong Draw.io XML bằng namespaced attributes hoặc metadata cell tương thích.
  5. Parse/validate provenance khi import; dữ liệu ngoài hệ thống mặc định là manual/untrusted.
  6. Thêm trace coverage report cho workspace.
- Acceptance criteria:
  - Export rồi import lại diagram generated vẫn giữ source trace.
  - Element tạo tay có provenance rõ ràng.
  - Invalid provenance không được tin cậy âm thầm.
- Dependencies: TASK-076, TASK-107
- Verification: XML round-trip tests + editor integration tests + trace coverage assertions
- Result: Node/edge dùng provenance envelope versioned cho generated/manual/imported, Draw.io round-trip giữ trace, invalid metadata trở thành imported-untrusted, và canvas context báo trace coverage.

#### TASK-110 - Tinh gọn đầu vào use case theo essential-first
- Priority: P2
- Status: Done
- Module: use-case-input-ux
- Problem: Primary form hiển thị `Bối cảnh nghiệp vụ`, `Rule nghiệp vụ`, và `Thuật ngữ` như các input ngang hàng dù chúng optional, trùng semantic hoặc chưa được builder sử dụng.
- Why it matters: User phải hoàn thiện một form dài và phân biệt các khái niệm nội bộ trước khi có thể thử workflow sinh use case; điều này làm tăng cognitive load và giảm niềm tin vào output.
- Implementation steps:
  1. Tách project context khỏi form generate; tên/mô tả dự án được chọn hoặc thiết lập một lần.
  2. Giữ primary generate form gồm tên chức năng, mô tả chức năng, actor chính và kết quả mong muốn optional.
  3. Gộp `project_summary` và UX của `business_context` thành một field project description; giữ compatibility mapping ở request layer nếu cần.
  4. Gộp UX của `business_rules` và `feature_intent.constraints` thành `Quy tắc và ràng buộc` trong vùng optional.
  5. Gộp target users và systems thành `Bên tham gia`; đưa trigger và input/output vào `Thông tin bổ sung` đóng mặc định.
  6. Bỏ `Thuật ngữ` và `Tên function` khỏi UI; chỉ giữ schema field tạm thời cho backward compatibility.
  7. Xóa dữ liệu mẫu dài khiến form trông như template bắt buộc; dùng ví dụ ngắn hoặc empty defaults phù hợp.
  8. Thêm component/E2E tests chứng minh user có thể sinh use case chỉ với primary fields.
- Acceptance criteria:
  - User hoàn thành flow generate đầu tiên mà không nhìn thấy hoặc điền các field advanced.
  - Không còn hai field UI khác nhau cho cùng khái niệm bối cảnh hoặc rule/ràng buộc.
  - `glossary` không xuất hiện trong primary workspace khi chưa có consumer.
  - Payload tối thiểu vẫn được backend chấp nhận và sinh diagram-ready use case.
- Dependencies: None
- Verification: focused component tests + API minimal-payload test + Playwright minimal-input flow
- Result: Primary flow chỉ còn tên/mô tả chức năng, actor chính và kết quả mong muốn; project context và enrichment được đưa vào disclosure, field dead bị bỏ khỏi UI và request adapter giữ backward compatibility.

#### TASK-111 - Làm rõ contract giữa input enrichment và use-case output
- Priority: P2
- Status: Done
- Module: use-case-generation-contract
- Problem: Một số optional input có tác động heuristic không minh bạch, trong khi `glossary` được thu thập nhưng không ảnh hưởng output.
- Why it matters: Product không thể giải thích vì sao cần một field hoặc đánh giá regression khi builder thay đổi.
- Implementation steps:
  1. Lập mapping canonical giữa từng optional input và phần output được phép ảnh hưởng.
  2. Quyết định deprecate `glossary` hoặc implement terminology-preservation behavior có trace/test.
  3. Chốt boundary giữa project-level rules và feature-level constraints; nếu không có consumer khác nhau, hợp nhất contract ở version tiếp theo.
  4. Thêm paired tests so sánh output khi có/không có từng enrichment signal.
  5. Document mapping trong UC-07 và artifact-chain contract.
- Acceptance criteria:
  - Mọi field còn hiển thị đều có consumer và observable behavior.
  - Không có input được thu thập chỉ để pass-through.
  - Tests mô tả rõ field nào thay đổi segmentation, exception hoặc terminology.
- Dependencies: TASK-110
- Verification: builder contract tests + UC-07 review
- Result: Đã chốt consumer map cho project context, participants, trigger, input/output, constraints và success outcome; `function_name`, `glossary`, `assumptions` được deprecate khỏi generation flow và có paired backend tests.

#### TASK-112 - Chọn structured flow làm nguồn chỉnh sửa canonical
- Priority: P1
- Status: Done
- Module: use-case-review-editor
- Problem: `happy_path_summary/main_flow_steps` và `key_exceptions/alternate_flows` đều editable, tạo hai nguồn dữ liệu cho cùng một flow và rebuild theo index.
- Why it matters: User có thể vô tình làm expected result, branch source/rejoin hoặc stable IDs mang nghĩa cũ sau khi sửa summary; contract vẫn có thể hợp lệ về cấu trúc nhưng sai nghiệp vụ.
- Implementation steps:
  1. Chọn `main_flow_steps` và `alternate_flows` làm canonical editable model.
  2. Bỏ textarea editable `Luồng chính tóm tắt` và `Ngoại lệ chính`.
  3. Derive `happy_path_summary` và `key_exceptions` trước serialization hoặc hiển thị read-only khi cần.
  4. Thêm thao tác add/remove/reorder main step giữ stable ID và reconcile branch references.
  5. Xây alternate-flow editor cho condition, ordered steps, source step và đúng một outcome mode rejoin/terminal.
  6. Giữ technical IDs ẩn khỏi primary surface nhưng không tái tạo khi chỉ reorder.
  7. Thêm migration cho draft in-memory hiện có và regression tests cho reorder/delete/branch references.
- Acceptance criteria:
  - Mỗi business concept chỉ có một editable source.
  - User sửa đầy đủ main/alternate flow mà không cần chạm raw IDs.
  - Reorder không đổi stable IDs; delete step có branch reference phải được reconcile hoặc block rõ ràng.
  - Diagram generation dùng trực tiếp canonical structured flow.
- Dependencies: TASK-104, TASK-105
- Verification: pure editor-model tests + component tests + Playwright edit-to-diagram flow
- Result: `main_flow_steps` và `alternate_flows` là nguồn chỉnh sửa duy nhất; summary được derive, editor giữ stable ID, block xóa reference, hỗ trợ add/reorder và outcome rejoin/terminal, diagram sinh trực tiếp từ structured flow.

#### TASK-113 - Thiết kế progressive disclosure cho use-case review
- Priority: P2
- Status: Done
- Module: use-case-review-ux
- Problem: Mục tiêu, preconditions, expected result từng bước và technical IDs cùng chiếm primary hierarchy với actor/action dù tần suất chỉnh thấp hơn.
- Why it matters: Một use case bốn bước đã tạo ra form rất dài; review hàng loạt trở nên khó scan và approval dễ biến thành thao tác bỏ qua.
- Implementation steps:
  1. Giữ title, actors, step actor/action, alternate topology và success outcome ở primary surface.
  2. Đưa objective/preconditions vào `Thông tin chung` có thể collapse.
  3. Đưa input/trigger và expected result vào details của từng step.
  4. Đưa request ID, use-case ID, step/flow IDs và trace metadata vào disclosure kỹ thuật.
  5. Thêm summary header cho số bước, số nhánh và số lỗi contract để review nhanh.
  6. Kiểm tra keyboard/accessibility cho các vùng collapse.
- Acceptance criteria:
  - User scan được title, actors và topology mà không cuộn qua toàn bộ metadata.
  - Technical IDs không nằm trong visual hierarchy chính.
  - Không field canonical nào bị ẩn đến mức không thể sửa khi cần.
- Dependencies: TASK-112
- Verification: component accessibility tests + Browser desktop/mobile review
- Result: Primary hierarchy tập trung vào title, actors, topology và success outcome; metadata chung, chi tiết bước và trace kỹ thuật được collapse. Mobile panel dùng full viewport, một cột và không tràn ngang.

#### TASK-114 - Hiển thị trung thực nguồn sinh use case
- Priority: P1
- Status: Done
- Module: use-case-generation-ux
- Problem: UI dùng ngôn ngữ “Sinh use case” trong một sản phẩm AI nhưng không cho biết kết quả hiện đến từ builder deterministic.
- Why it matters: User kỳ vọng AI hiểu nghiệp vụ và đánh giá output generic như một lỗi AI, trong khi hệ thống chưa gọi model.
- Implementation steps:
  1. Mở rộng generation result với `generation_source: ai | deterministic_fallback`.
  2. Hiển thị badge `AI draft` hoặc `Bản nháp theo rule` trong workspace.
  3. Khi fallback xảy ra, giải thích ngắn rằng user cần rà soát chi tiết nghiệp vụ.
  4. Thêm component/E2E coverage cho cả hai source.
- Acceptance criteria:
  - User luôn biết use case được sinh bởi AI hay fallback.
  - Không có copy nào ngụ ý AI đã phân tích khi provider chưa được gọi.
- Dependencies: None
- Verification: Component tests + Playwright source-label assertions
- Result: Workspace hiển thị `Bản nháp AI` hoặc `Bản nháp theo rule`, kèm lý do fallback và prompt version khi có.

#### TASK-115 - Tách shared structured-generation provider khỏi BRD
- Priority: P1
- Status: Done
- Module: ai-provider-platform
- Problem: OpenRouter provider hiện được cấu hình và đặt tên theo `BRD_*`, chưa có boundary dùng chung cho use-case synthesis.
- Why it matters: Nối use case trực tiếp vào provider BRD sẽ tạo coupling cấu hình, retry và observability khó duy trì.
- Implementation steps:
  1. Chuyển provider primitives sang package trung lập `app/ai/providers`.
  2. Tách config dùng chung (`AI_PROVIDER`, base URL, API key) khỏi config theo capability (`BRD_MODEL_*`, `USECASE_MODEL_*`), giữ compatibility alias cho env cũ.
  3. Tách factory chọn `mock/openrouter` khỏi route.
  4. Giữ strict JSON schema, bounded retry, usage/cost metadata và error mapping.
  5. Chuyển BRD path sang shared adapter mà không đổi response contract.
  6. Thêm provider contract tests.
- Acceptance criteria:
  - BRD và use case dùng cùng transport boundary nhưng schema/prompt riêng.
  - Mock và OpenRouter đều thực thi được qua interface chung.
- Dependencies: None
- Verification: Existing BRD suite + provider adapter unit tests
- Result: Provider primitives/factory nằm dưới `app/ai/providers`; BRD và use case dùng chung transport, config `AI_*` có alias tương thích `BRD_*`.

#### TASK-116 - Sinh UseCaseDraft bằng AI structured output có fallback
- Priority: P1
- Status: Done
- Module: ai-usecase-generation
- Problem: Sau khi có provider, prompt và synthesis contract, hệ thống vẫn cần một orchestration path đáng tin để chọn AI, retry, validate và fallback.
- Why it matters: Diagram sinh sau đó có thể đúng kỹ thuật nhưng chỉ trực quan hóa một use case chung chung.
- Implementation steps:
  1. Implement `UseCaseGenerationService` nhận canonical input và generation policy.
  2. Render prompt version đã pin, gọi shared provider bằng strict structured output.
  3. Hydrate output semantic thành canonical `UseCaseDraft[]`.
  4. Chạy structural validator, grounding guard và quality precheck.
  5. Retry tối đa một lần với validation feedback đã sanitize.
  6. Fallback về deterministic builder khi provider unavailable, timeout hoặc output không đạt contract.
  7. Trả source, fallback reason, prompt version, model, latency, attempt, token và cost metadata.
  8. Giữ route mỏng: rate limit, request envelope và mapping HTTP error.
- Acceptance criteria:
  - Hai domain khác nhau tạo ra luồng nghiệp vụ khác nhau, không chỉ thay tên feature trong cùng template.
  - Output luôn qua cùng contract validator trước khi đến frontend.
  - Provider failure không làm mất khả năng tạo draft fallback.
- Dependencies: TASK-114, TASK-115, TASK-118, TASK-119, TASK-120, TASK-121
- Verification: Mock provider tests + live smoke có guard cost + API fallback tests
- Result: `UseCaseGenerationService` gọi strict structured output, retry tối đa một lần, hydrate/validate và fallback rule không làm gián đoạn workflow.

#### TASK-117 - Thêm quality gate cho AI-generated use cases
- Priority: P1
- Status: Done
- Module: use-case-quality-eval
- Problem: Schema hợp lệ không bảo đảm use case cụ thể, đầy đủ hoặc bám input.
- Why it matters: Model có thể trả flow trôi chảy nhưng generic, trùng lặp, bịa rule hoặc thiếu decision quan trọng.
- Implementation steps:
  1. Tạo golden fixtures cho ít nhất GPS issuance, fire incident và một feature CRUD đơn giản.
  2. Định nghĩa rubric: input trace coverage, specificity, actor correctness, step completeness, branch quality, duplication và unsupported claims.
  3. Thêm deterministic post-check cho generic filler phrases và duplicate flows.
  4. Thêm eval so sánh AI path với deterministic baseline.
  5. Chặn rollout mặc định nếu quality threshold chưa đạt.
- Acceptance criteria:
  - Suite fail khi output chỉ lặp template generic hiện tại.
  - Mỗi step/exception quan trọng trace được về input hoặc được đánh dấu assumption cần review.
  - Có báo cáo quality theo fixture và model.
- Dependencies: TASK-116, TASK-122
- Verification: Golden eval suite + reviewed snapshots + bounded live evaluation
- Result: Quality gate chặn filler generic, flow trùng và flow quá ngắn; golden domains GPS, fire incident và CRUD có regression coverage.

#### TASK-118 - Tách use-case generation thành pipeline có ownership rõ
- Priority: P1
- Status: Done
- Module: use-case-generation-architecture
- Problem: Route, deterministic segmentation, schema output và provider integration chuẩn bị bị gom vào cùng module, trong khi `usecase_builder.py` hiện đã sở hữu quá nhiều trách nhiệm.
- Why it matters: Thêm AI trực tiếp vào route/builder sẽ làm fallback, validation và test setup khó hiểu; mỗi lần đổi prompt có thể vô tình đổi ID hoặc contract diagram.
- Implementation steps:
  1. Tạo package `app/usecases` hoặc tương đương cho generation domain.
  2. Di chuyển deterministic builder thành `deterministic_builder.py` nhưng giữ public compatibility import tạm thời.
  3. Tạo interface `UseCaseGenerator` nhận canonical `ProjectSpec + FeatureIntent` và trả semantic result cùng metadata.
  4. Tạo `generation_service.py` làm orchestration owner; route không được chứa prompt/provider/domain logic.
  5. Tách structural validation và ID hydration thành module độc lập.
  6. Thêm architecture tests hoặc import-boundary tests để route chỉ phụ thuộc generation service.
- Acceptance criteria:
  - Route use case không import trực tiếp OpenRouter hoặc prompt builder.
  - Deterministic fallback chạy độc lập qua cùng generator/service contract.
  - Existing API contract và 58 backend tests không regress trong refactor-only PR.
- Dependencies: TASK-115
- Verification: Full API suite + import-boundary/unit tests + unchanged deterministic golden fixtures
- Result: Domain generation nằm dưới `app/usecases`; route chỉ điều phối HTTP và gọi service, import cũ được giữ qua compatibility module.

#### TASK-119 - Chuẩn hóa prompt thành artifact có version và registry
- Priority: P1
- Status: Done
- Module: ai-prompt-engineering
- Problem: Prompt BRD hiện là chuỗi inline không có ID/version; use-case prompt chưa tồn tại và nếu thêm cùng kiểu này sẽ không audit hoặc rollback được.
- Why it matters: Không thể biết output được sinh bởi prompt nào, review diff prompt độc lập, chạy eval theo version hoặc rollback khi chất lượng giảm.
- Implementation steps:
  1. Định nghĩa `PromptDefinition` gồm `id`, `version`, `capability`, system template, input schema/version và changelog ngắn.
  2. Tạo prompt registry bằng code/file local version-controlled; chưa cần database hoặc Langfuse để hoàn thành Phase 1.
  3. Di chuyển prompt BRD hiện tại sang registry mà không đổi nội dung/runtime behavior.
  4. Tạo `usecase_synthesis_v1` bằng tiếng Việt rõ ràng: nhiệm vụ, input authority, output constraints, grounding, segmentation, actors, main/alternate flow, terminal/rejoin semantics.
  5. Dùng delimiter/JSON envelope để mọi user text được coi là data, không phải instruction.
  6. Không nhúng JSON schema hai lần nếu provider đã gửi strict `response_format`; user content chỉ chứa canonical business input và generation hints cần thiết.
  7. Viết snapshot tests cho rendered system/user messages và prompt metadata.
- Acceptance criteria:
  - Mỗi model call có prompt ID/version xác định.
  - Prompt không còn nằm inline trong route.
  - Prompt diff có thể review độc lập và snapshot test phát hiện thay đổi ngoài ý muốn.
  - BRD path vẫn tạo cùng prompt semantics sau migration.
- Dependencies: TASK-115, TASK-118
- Verification: Prompt snapshot tests + BRD regression suite + manual prompt review
- Result: Registry local có prompt ID/version/fingerprint cho BRD và use case; business input nằm trong envelope untrusted và schema không bị nhúng hai lần.

#### TASK-120 - Tạo semantic synthesis schema và deterministic ID hydrator
- Priority: P1
- Status: Done
- Module: use-case-generation-contract
- Problem: `UseCaseDraft` chứa stable technical IDs và cross-reference; yêu cầu model tạo trực tiếp các ID này làm tăng lỗi dangling reference và nondeterminism.
- Why it matters: AI nên chịu trách nhiệm nội dung nghiệp vụ, còn hệ thống phải sở hữu identity, compatibility fields và graph-safe references.
- Implementation steps:
  1. Tạo `UseCaseSynthesisResult`/`SynthesizedUseCase` không chứa `use_case_id`, `step_id`, `flow_id`.
  2. Cho alternate flow tham chiếu main step bằng ordinal/key semantic giới hạn trong cùng output.
  3. Yêu cầu đúng một outcome mode: rejoin ordinal hoặc terminal outcome.
  4. Implement hydrator sinh stable IDs từ project/feature/use-case order và map references sang canonical IDs.
  5. Derive `happy_path_summary` và `key_exceptions` từ structured flow.
  6. Validate hydrated output bằng canonical `UseCaseDraft` Pydantic model.
  7. Thêm property/unit tests cho duplicate title, reorder, invalid ordinal, terminal/rejoin và graph slug collision.
- Acceptance criteria:
  - Model không tạo technical IDs.
  - Cùng semantic result luôn hydrate thành cùng canonical IDs.
  - Invalid references bị reject trước khi response tới frontend.
- Dependencies: TASK-118
- Verification: Hydrator unit/property tests + existing diagram contract tests
- Result: Model chỉ trả semantic content/evidence; hydrator sở hữu stable use-case/step/flow IDs, cross-reference và summary compatibility.

#### TASK-121 - Thêm grounding và prompt-injection guard cho use-case AI
- Priority: P1
- Status: Done
- Module: ai-usecase-safety
- Problem: Project/feature text là dữ liệu user-controlled có thể chứa instruction giả hoặc khiến model bịa actor/rule không có nguồn.
- Why it matters: Use case bịa nghiệp vụ sau đó sẽ được phê duyệt và chuyển thành diagram, làm sai artifact chain ở tầng đầu.
- Implementation steps:
  1. Gắn rõ trust boundary: mọi project/feature field là untrusted business data.
  2. Prompt cấm thực thi instruction nằm trong input và cấm bịa rule, actor, system hoặc approval không có căn cứ.
  3. Yêu cầu synthesized use case trả `evidence_refs` hoặc source keys cho title, actor, step/branch quan trọng.
  4. Post-check actor phải thuộc input participants hoặc generic system actor được policy cho phép.
  5. Post-check rule/constraint claim phải trace tới canonical input; unsupported claim trở thành review warning hoặc reject theo severity.
  6. Tạo adversarial fixtures chứa prompt injection, fake system instruction và conflicting rules.
- Acceptance criteria:
  - Input kiểu “ignore previous instructions” không thay đổi task/schema.
  - Actor/rule không có nguồn không được đi qua âm thầm.
  - Warning/evidence không chứa raw secret hoặc prompt body.
- Dependencies: TASK-119, TASK-120
- Verification: Adversarial unit/API tests + prompt-injection fixture suite
- Result: Prompt đặt trust boundary rõ, evidence refs được kiểm tra theo canonical catalog và actor/evidence không có nguồn bị reject.

#### TASK-122 - Gắn observability cho model, prompt và fallback
- Priority: P2
- Status: Done
- Module: ai-generation-observability
- Problem: Metadata hiện chỉ có provider/model/cost cơ bản; không có prompt version, generation source, fallback reason hoặc quality result cho use case.
- Why it matters: Khi output giảm chất lượng, team không thể phân biệt lỗi prompt, model, provider, hydrator hay fallback.
- Implementation steps:
  1. Mở rộng response metadata với capability, generation source, prompt ID/version, model, attempts, latency, token/cost và fallback reason.
  2. Thêm structured logs chỉ chứa IDs/counts/status, không log prompt body hoặc business payload mặc định.
  3. Wire `AI_LOG_PROMPT_BODY` chỉ cho local debug và bảo đảm production default false; ghi cảnh báo startup nếu bật.
  4. Thêm counters cho AI success, validation retry, fallback và quality rejection.
  5. Chuẩn bị adapter interface cho Langfuse nhưng không bắt buộc connector trong Phase 1.
- Acceptance criteria:
  - Một response đủ dữ liệu để xác định prompt/model/source đã sinh artifact.
  - Không có prompt hoặc payload nhạy cảm trong production logs mặc định.
  - Fallback rate và validation failure có thể đo được.
- Dependencies: TASK-115, TASK-116, TASK-119
- Verification: Metadata/log redaction tests + API assertions
- Result: Response chứa capability/source/mode/prompt/model/attempt/token/cost/quality/fallback; structured counters/logs loại prompt body và payload.

#### TASK-123 - Rollout AI use-case generation theo feature flag
- Priority: P1
- Status: Done
- Module: ai-usecase-rollout
- Problem: Chuyển thẳng từ deterministic sang AI mặc định có thể gây drift chất lượng, tăng latency/cost và làm hỏng flow ổn định.
- Why it matters: Artifact đầu nguồn kém sẽ lan sang diagram và formal BRD; cần rollback tức thì mà không deploy lại.
- Implementation steps:
  1. Thêm mode `deterministic | ai_shadow | ai_opt_in | ai_default` qua config.
  2. Ở shadow mode, chạy AI cho eval nhưng không trả output AI cho user và không lưu raw payload.
  3. Ở opt-in mode, cho user chọn `Tạo bằng AI`; fallback vẫn tự động.
  4. Chỉ bật default khi TASK-117 đạt threshold về quality, latency và fallback rate.
  5. Thêm kill switch về deterministic không cần đổi frontend contract.
  6. Document cost budget, timeout và rollback criteria.
- Acceptance criteria:
  - Có thể bật/tắt AI runtime mà không deploy code mới.
  - Shadow/opt-in/default đều được test.
  - Deterministic fallback luôn còn hoạt động.
- Dependencies: TASK-114, TASK-116, TASK-117, TASK-122
- Verification: Config matrix tests + Playwright source badge + controlled live smoke
- Result: Runtime hỗ trợ deterministic, shadow, opt-in và default; UI có lựa chọn ưu tiên AI/theo rule, kill switch mặc định vẫn là deterministic.

#### TASK-124 - Enforce claim-to-evidence grounding cho use-case AI
- Priority: P1
- Status: Todo
- Module: ai-usecase-safety
- Problem: `validate_grounding()` chỉ kiểm evidence ref tồn tại, chưa kiểm claim nghiệp vụ quan trọng có thật sự được hỗ trợ bởi source được cite.
- Why it matters: Model có thể bịa rule/approval/outcome, cite một source key hợp lệ nhưng không liên quan, rồi đi qua quality gate và hydrate thành `UseCaseDraft`.
- Implementation steps:
  1. Mở rộng `apps/api/app/usecases/grounding.py` với policy field-type: actor phải trace tới participant/system, constraint/rule phải trace tới business rule hoặc constraint, input/output claim phải trace tới input/output tương ứng.
  2. Thêm detector deterministic cho high-risk unsupported terms như approval/phê duyệt, reject/từ chối, permission/quyền, payment/thanh toán, SLA, integration/tích hợp, inventory/kho.
  3. Khi claim high-risk không có source content tương ứng, trả `UNSUPPORTED_BUSINESS_CLAIM` thay vì chỉ warning im lặng.
  4. Cập nhật `UseCaseGenerationService` để retry một lần với validation feedback đã sanitize và fallback nếu vẫn còn unsupported claim.
  5. Thêm adversarial fixtures có valid evidence key nhưng unrelated source content.
- Acceptance criteria:
  - Payload bịa `Tự động phê duyệt yêu cầu dù thiết bị không còn trong kho` với `evidence_refs=["feature.inputs.0"]` bị reject.
  - Payload có claim đúng và evidence đúng vẫn pass.
  - Error/telemetry không log raw prompt body hoặc business payload.
- Dependencies: TASK-121, TASK-117
- Verification: `cd apps/api && python3 -m pytest tests/test_usecase_synthesis.py tests/test_usecase_generation_service.py -q`

#### TASK-125 - Fallback an toàn khi prompt/provider config use-case sai
- Priority: P1
- Status: Todo
- Module: ai-usecase-generation
- Problem: `USECASE_PROMPT_VERSION` không tồn tại hiện raise `KeyError` trước fallback path; một lỗi config có thể biến `/api/usecases/generate` thành 500.
- Why it matters: Rollout AI được thiết kế có deterministic kill switch/fallback; config prompt sai là tình huống vận hành thường gặp và không được làm user mất workflow.
- Implementation steps:
  1. Bọc prompt lookup trong `UseCaseGenerationService.generate()` bằng error handling trước provider call.
  2. Map unknown prompt version thành fallback reason `prompt_unavailable` hoặc `provider_unavailable` có warning rõ.
  3. Chuẩn hóa invalid provider name, missing key, and unknown prompt thành deterministic fallback metadata nhất quán.
  4. Thêm route/service tests cho unknown `USECASE_PROMPT_VERSION`, invalid `USECASE_PROVIDER`, và missing OpenRouter key.
  5. Cập nhật source-label copy nếu thêm fallback reason mới.
- Acceptance criteria:
  - Unknown prompt version trả HTTP 200 với `generation_source=deterministic_fallback`, không raise 500.
  - Metadata có `fallback_reason` đủ rõ để vận hành debug.
  - Existing deterministic/AI/shadow behavior không regress.
- Dependencies: TASK-116, TASK-119, TASK-122
- Verification: `cd apps/api && python3 -m pytest tests/test_usecase_generation_service.py tests/test_usecase_routes.py -q`

#### TASK-126 - Thêm mock AI route path cho use-case generation
- Priority: P2
- Status: Todo
- Module: ai-provider-platform
- Problem: Default use-case service gọi `build_provider("mock")` không truyền `mock_payload_factory`, nên `USECASE_PROVIDER=mock` ở `ai_default/ai_shadow/ai_opt_in` fallback `provider_unavailable` trước khi thử AI.
- Why it matters: Local/mock mode không kiểm được route-level AI synthesis, shadow metadata hoặc source label AI nếu không monkeypatch service trong test.
- Implementation steps:
  1. Tạo deterministic semantic synthesis mock payload factory cho use-case AI path.
  2. Truyền factory này khi `UseCaseGenerationService` build provider mặc định cho capability `usecase_synthesis`.
  3. Giữ BRD mock behavior hiện có không đổi.
  4. Thêm route tests cho `USECASE_PROVIDER=mock` + `ai_default`, `ai_shadow`, `ai_opt_in` với preference `ai/auto/deterministic`.
  5. Document rõ `mock` AI path dùng cho local/test, không đại diện chất lượng model thật.
- Acceptance criteria:
  - `USECASE_PROVIDER=mock` + `USECASE_GENERATION_MODE=ai_default` trả `generation_source=ai`.
  - `ai_shadow` vẫn trả deterministic draft nhưng có `shadow_status=passed`.
  - `deterministic` vẫn không attempt AI.
- Dependencies: TASK-115, TASK-116, TASK-123
- Verification: `cd apps/api && python3 -m pytest tests/test_usecase_routes.py tests/test_usecase_generation_service.py -q`

#### TASK-127 - Biến rollout quality threshold thành eval executable
- Priority: P2
- Status: Todo
- Module: use-case-quality-eval
- Problem: Live smoke hiện chấp nhận cả `ai` lẫn `deterministic_fallback`, còn golden tests chưa tạo report threshold cho quality, fallback rate, latency và cost.
- Why it matters: `ai_default` có thể được bật bằng config trước khi team có bằng chứng quality/cost đủ ổn định.
- Implementation steps:
  1. Tạo command hoặc pytest marker eval đọc golden fixtures GPS, fire incident, CRUD và các adversarial cases.
  2. Ghi report gồm source, fallback reason, quality status/score, latency, estimated cost và attempt count theo fixture.
  3. Fail eval nếu fallback rate, unsupported claim, quality rejection, latency hoặc cost vượt ngưỡng documented.
  4. Cập nhật live smoke để có mode bắt buộc AI success khi chạy eval có key/model production.
  5. Link report/checklist trong docs rollout trước khi cho phép `ai_default`.
- Acceptance criteria:
  - Có một verification command để chứng minh đủ điều kiện bật `ai_default`.
  - Suite fail nếu mọi live call đều fallback nhưng smoke vẫn 200.
  - Threshold khớp với docs `UC-07`.
- Dependencies: TASK-117, TASK-122, TASK-123, TASK-124
- Verification: `cd apps/api && python3 -m pytest tests/test_usecase_synthesis.py tests/test_live_smoke.py -q -rs` với env live khi cần.

#### TASK-128 - Bỏ phân cấp actor chính/phụ và bỏ `Thông tin bổ sung`
- Priority: P1
- Status: Done
- Module: use-case-input-ux-contract
- Problem: Use-case input hiện bắt `Actor chính`, giấu các actor còn lại trong `Thông tin bổ sung`, rồi backend/schema tiếp tục phân biệt `primary_actor` và `supporting_actors`. Với swimlane/use-case workflow này, tất cả actor do user nhập đều là actor chính của quy trình; chia chính/phụ làm user nhập thiếu actor và khiến AI/heuristic bịa role hoặc gom trách nhiệm sai.
- Why it matters: Actor là nền để sinh lane, step ownership, handoff và diagram. Nếu actor bị ẩn hoặc phân cấp giả, artifact đầu nguồn sai ngay từ use-case draft và lan sang diagram/BRD.
- Implementation steps:
  1. Thay field `Actor chính` trong `src/usecases/UseCasePanel.tsx` bằng multiline field `Actors / swimlanes` nằm ở primary input, mỗi dòng một actor.
  2. Xóa disclosure `Thông tin bổ sung` khỏi generate input; đưa các field thật sự cần thiết còn lại lên primary flow hoặc bỏ khỏi UI nếu chưa có consumer rõ.
  3. Cập nhật `src/usecases/prevalidate.ts`: required field là `actors` có ít nhất một dòng, không còn required `feature_intent.primary_actor` theo UI.
  4. Cập nhật request adapter tạm thời: map danh sách actors vào canonical participant list; nếu backend contract cũ còn cần `primary_actor`, dùng actor đầu tiên chỉ như compatibility field và không hiển thị khái niệm chính/phụ trong UI.
  5. Cập nhật backend generation/prompt/grounding để coi mọi actor trong participant list là ngang hàng; AI không được tự thêm actor ngoài danh sách user nhập.
  6. Cập nhật `UseCaseDraft` review UI copy: hiển thị `Actors` thay vì `Actor chính` / `Actor hỗ trợ`; nếu schema cũ vẫn có `primary_actor/supporting_actors`, render chúng như một danh sách hợp nhất.
  7. Cập nhật UC-07, artifact-chain docs, component tests, prevalidation tests, route tests, and Playwright mobile test.
- Acceptance criteria:
  - Vùng `Input` không còn text `Actor chính`, `Actor hỗ trợ`, hoặc `Thông tin bổ sung`.
  - User nhập nhiều actor trực tiếp trong primary form, mỗi dòng một actor.
  - Generated use cases/diagrams chỉ dùng actor thuộc danh sách user nhập hoặc policy system actor rõ ràng.
  - Không có copy nào ngụ ý actor phụ là ít quan trọng hơn actor chính.
  - Existing backend compatibility không làm UI quay lại phân cấp chính/phụ.
- Dependencies: None
- Verification: `npm run test:ui-mock -- --run src/usecases/UseCasePanel.test.tsx src/usecases/prevalidate.test.ts`, `cd apps/api && python3 -m pytest tests/test_usecase_routes.py tests/test_usecase_synthesis.py -q`, `npm run test:e2e-mock -- e2e/brd-flow.spec.ts`
- Result: Use-case input dùng một danh sách `Actors / swimlanes` ngang hàng trong primary form; disclosure `Thông tin bổ sung` bị bỏ khỏi generate input; review UI gộp `primary_actor/supporting_actors` thành một field `Actors`, còn backend contract cũ chỉ là compatibility mapping.

## Current Project Database Implementation

Canonical design:
[Database Architecture](./scope/database-architecture.md) and
[review snapshot](./reviews/2026-06-07-current-project-database-design-review.md).

### Now

#### TASK-129 - Rotate database credential và chuẩn hóa env contract
- Priority: P0
- Status: Partial (2026-06-07; repo contract complete, Railway credential rotation blocked by expired CLI session)
- Module: secrets-railway-config
- Problem: PostgreSQL password đã bị chia sẻ plaintext; `.env` local chứa Railway reference
  `${{ ... }}` mà loader hiện tại không resolve, đồng thời trộn biến của Postgres service vào API
  service.
- Why it matters: Credential hiện tại phải coi là compromised; sau đó application vẫn không kết nối
  local đúng nếu dùng URL/private hostname chưa resolve.
- Implementation steps:
  1. Rotate password trong Railway Postgres Credentials.
  2. Redeploy mọi Railway service phụ thuộc vào database URL/password cũ.
  3. Xóa khỏi `apps/api/.env` các biến chỉ dành cho Postgres container như `PGDATA`,
     `POSTGRES_*`, `SSL_CERT_DAYS`; FastAPI chỉ cần canonical `DATABASE_URL`.
  4. Cho local direct run dùng public TCP proxy URL đã resolve và `sslmode=require`, hoặc document
     `railway run`; không để `${{ ... }}` trong file `.env` mà custom loader đọc trực tiếp.
  5. Cho Railway API service dùng reference có namespace tới DB service, ví dụ
     `${{Postgres.DATABASE_URL}}`, không copy password thủ công.
  6. Thêm `DATABASE_URL` placeholder vào `.env.example`; bảo đảm config/error log không in URL thật.
- Acceptance criteria:
  - Credential cũ không còn authenticate được.
  - `apps/api/.env` vẫn bị Git ignore và không có secret trong tracked diff.
  - Local config nhận một URL đã resolve; Railway config dùng private reference giữa services.
  - Không có password/connection URL trong docs, test output hoặc application log.
- Dependencies: None
- Verification: `git check-ignore -v apps/api/.env`; config tests với URL giả; `pg_isready`/read-only
  connection bằng credential mới sau rotate; kiểm Railway Variables không lặp secret thủ công.

#### TASK-130 - Tạo deployment contract cho FastAPI trên Railway
- Priority: P0
- Status: Partial (2026-06-07; manifest/readiness complete, staging deploy not verified)
- Module: api-deployment
- Problem: Repo chưa có Railway manifest, start command production, pre-deploy migration command hoặc
  readiness check cho database.
- Why it matters: Monorepo deploy có thể start sai thư mục, không listen `$PORT`, hoặc đưa code mới
  lên trước khi schema tương ứng tồn tại.
- Implementation steps:
  1. Chốt Railway API service root/build strategy cho monorepo và commit `railway.toml` hoặc
     `railway.json` tương ứng.
  2. Cấu hình start command production chạy Uvicorn từ `apps/api`, bind `0.0.0.0:$PORT`, không dùng
     `--reload`.
  3. Cấu hình pre-deploy command `alembic upgrade head` sau khi TASK-131 có Alembic.
  4. Giữ `/healthz` cho liveness và thêm `/readyz` kiểm tra database bằng query nhẹ.
  5. Cấu hình Railway healthcheck path/timeout và production CORS origin variables.
  6. Document API service và Postgres service phải cùng project/environment để dùng private network.
- Acceptance criteria:
  - Railway build/start từ repo root thành công.
  - App listen đúng injected `PORT`.
  - Migration failure chặn deployment mới.
  - `/healthz` trả 200 khi process sống; `/readyz` fail khi DB unavailable.
- Dependencies: TASK-129; pre-deploy hoàn tất sau TASK-131
- Verification: Validate manifest; deploy staging; kiểm pre-deploy log, healthcheck và readiness khi
  tạm dùng invalid DB URL.

#### TASK-131 - Scaffold PostgreSQL, SQLAlchemy và Alembic latest-state
- Priority: P0
- Status: Done (2026-06-07)
- Module: persistence-foundation
- Problem: Backend chưa có database driver, ORM, migrations hoặc request-scoped session.
- Why it matters: Mọi flow Save phụ thuộc vào schema, transaction và constraint chung.
- Implementation steps:
  1. Thêm SQLAlchemy 2.x synchronous, `psycopg` và Alembic vào `apps/api/pyproject.toml`.
  2. Mở rộng `Settings` với `database_url`, pool sizing/timeout tối thiểu và validation fail-fast.
  3. Tạo engine với `pool_pre_ping`, session factory và FastAPI dependency rollback/close an toàn.
  4. Tạo models/migration cho `app_users`, `projects`, `specs`, `feature_intents`, `use_cases`,
     `diagrams`, `brd_docs`.
  5. Enforce FK cascade, unique 1-1, role/review/template checks, JSONB defaults và indexes trong
     canonical design.
  6. Tạo migration/constraint tests chạy trên PostgreSQL test database, không dùng SQLite thay thế.
- Acceptance criteria:
  - Fresh PostgreSQL database migrate tới `head`.
  - Upgrade/downgrade/upgrade chạy được.
  - Cardinality và check constraints bị database reject đúng.
  - Session rollback transaction lỗi và không leak connection.
- Dependencies: TASK-129
- Verification: Alembic up/down/up; pytest migration/model constraints; smoke `SELECT 1`.

#### TASK-132 - Thêm backend Clerk auth, `app_users` và CORS đúng contract
- Priority: P1
- Status: Partial (2026-06-07; runtime complete, live invalid/expired-token matrix remains)
- Module: identity-authorization
- Problem: Clerk mới bảo vệ UI; backend routes public và CORS không cho `Authorization`,
  `PUT/PATCH/DELETE`.
- Why it matters: Browser không gọi được authenticated CRUD, và server không có trust boundary để
  bảo vệ dữ liệu theo user.
- Implementation steps:
  1. Thêm Clerk Python backend SDK hoặc verified JWT/JWKS dependency có cache/key rotation.
  2. Chỉ chấp nhận Clerk `session_token`; validate signature, expiry/not-before, issuer và
     `authorized_parties`.
  3. Bảo vệ mọi `/api/*` business route; để `/healthz` và `/readyz` public.
  4. Thêm `GET /api/me` và get-or-create `app_users` theo verified JWT `sub`, role mặc định `user`.
  5. Không nhận role từ client; email/display name để nullable nếu token không có claim đáng tin cậy.
  6. Mở CORS chính xác cho production/local origins, required methods và headers
     `Authorization/Content-Type/Idempotency-Key/X-Schema-Version`.
- Acceptance criteria:
  - Missing/invalid/expired token bị 401.
  - User mới có role `user`.
  - Client không thể tự nâng role.
  - Browser preflight cho authenticated `PUT` và `DELETE` thành công.
- Dependencies: TASK-131
- Verification: Auth dependency tests với mocked Clerk keys/claims; CORS OPTIONS tests; `/api/me`
  integration test.

#### TASK-133 - Tạo repository/service ownership boundary và CRUD response contract
- Priority: P1
- Status: Partial (2026-06-07; ownership helpers/DTOs complete, service transaction refactor remains)
- Module: persistence-api-foundation
- Problem: Nếu mỗi route tự join ownership và tự serialize model, IDOR/error/transaction behavior sẽ
  bị lặp và dễ lệch.
- Why it matters: Mọi child resource phải chứng minh ownership qua
  `resource -> ... -> project.app_user_id`, kể cả khi caller biết UUID.
- Implementation steps:
  1. Tạo repository/service boundary cho project tree, không expose raw SQLAlchemy model ra route.
  2. Tạo helpers `require_owned_project/spec/feature/use_case/diagram/brd` dùng current `app_user.id`.
  3. Chuẩn hóa DTO Pydantic cho resource IDs, timestamps và payload latest-state.
  4. Chuẩn hóa `404` cho resource không tồn tại hoặc không thuộc user để tránh leak existence.
  5. Chuẩn hóa error envelope cho validation, conflict, payload-too-large và database unavailable.
  6. Đặt transaction boundary ở service/use-case; route không commit nhiều lần giữa một operation.
- Acceptance criteria:
  - Child lookup luôn đi qua ownership chain.
  - User A và user B nhận cùng semantics 404 khi A thử UUID của B.
  - Không route persistence nào trả SQLAlchemy object trực tiếp.
  - Multi-row operation rollback toàn bộ khi một bước fail.
- Dependencies: TASK-131, TASK-132
- Verification: Repository/service unit tests + cross-user IDOR integration matrix.

#### TASK-134 - Tạo authenticated frontend API client và protected routing
- Priority: P1
- Status: Done (2026-06-07)
- Module: frontend-application-shell
- Problem: Frontend fetch clients đang tách rời, không gửi Clerk token, không có protected project
  routes hoặc route-level loading/error state.
- Why it matters: CRUD mới sẽ lặp auth/error logic; không có project ID trong URL thì refresh/deep
  link và chuyển project không ổn định.
- Implementation steps:
  1. Thêm React Router và routes tối thiểu `/`, `/projects`, `/projects/:projectId`.
  2. Tạo protected shell dùng `useAuth()` và chờ `isLoaded` trước khi quyết định signed-in state.
  3. Tạo một API client nhận token provider từ `getToken()`, tự gắn `Authorization: Bearer`,
     content/schema headers và parse error envelope.
  4. Di chuyển BRD/use-case generation clients lên shared transport nhưng giữ typed functions theo
     capability.
  5. Xử lý 401 bằng session-aware UI; không retry write tự động khi chưa có idempotency policy.
  6. Thêm route-level loading/not-found/error boundaries cơ bản.
- Acceptance criteria:
  - Signed-out user không vào project workspace.
  - Mọi API business request có Clerk session token.
  - Refresh `/projects/:projectId` giữ đúng route.
  - Existing generation client tests vẫn pass sau khi dùng shared transport.
- Dependencies: TASK-132
- Verification: Vitest API client tests; router component tests; Playwright signed-out redirect và
  authenticated request-header assertion.

### Next

#### TASK-135 - Implement Project và Spec backend API
- Priority: P1
- Status: Done (2026-06-07)
- Module: project-spec-backend
- Problem: Chưa có CRUD cho user projects hoặc single Spec của project.
- Why it matters: Đây là root persistence boundary cho toàn bộ artifact chain.
- Implementation steps:
  1. Implement `POST/GET /api/projects`, `GET/PUT/DELETE /api/projects/{id}` qua ownership service.
  2. Tạo `specs` default cùng transaction khi tạo project.
  3. Implement `GET/PUT /api/projects/{id}/spec`.
  4. Validate/normalize name, description, project context và JSONB string arrays.
  5. Trả Project và Spec DTO với UUID/timestamps; không nhận `app_user_id` từ client.
  6. Xóa project cascade toàn chain trong một transaction.
- Acceptance criteria:
  - User CRUD được nhiều project của chính mình.
  - Mỗi project có đúng một spec.
  - User không đọc/sửa/xóa project hoặc spec của user khác.
  - Project delete xóa child rows theo FK policy.
- Dependencies: TASK-133
- Verification: API CRUD/validation/ownership/cascade tests trên PostgreSQL.

#### TASK-136 - Implement Project dashboard và Spec frontend flow
- Priority: P1
- Status: Partial (2026-06-07; core flow complete, independent project/spec save timestamps remain)
- Module: project-spec-frontend
- Problem: UI hiện mở thẳng editor; project name nằm trong `ProjectSpec` của use-case panel.
- Why it matters: User chưa thể tạo/chọn nhiều project hoặc hiểu ranh giới Project và Spec.
- Implementation steps:
  1. Tạo Project Dashboard list/create/open/delete với empty/loading/error states.
  2. Tạo Project Workspace shell/header có tên project, đổi project và edit project metadata.
  3. Chuyển `project_name` khỏi Spec form; giữ adapter generation dựng ProjectSpec từ project + spec.
  4. Tạo tab `Bối cảnh dự án` cho Spec fields và nút `Lưu bối cảnh`.
  5. Thêm `Lưu project`, delete confirmation và dirty state riêng cho project/spec.
  6. Load project + spec theo route param; hiển thị 404/forbidden-safe state.
- Acceptance criteria:
  - User tạo/chọn/đổi/xóa project từ dashboard.
  - `Tên dự án` không còn nằm trong Spec card.
  - Save/reload giữ project metadata và context.
  - Project và Spec có save state độc lập.
- Dependencies: TASK-134, TASK-135
- Verification: Component tests + Playwright create/open/save/reload/delete project/spec.

#### TASK-137 - Nâng FeatureIntent contract và implement backend CRUD
- Priority: P1
- Status: Done (2026-06-07)
- Module: feature-intent-backend
- Problem: Backend contract còn `primary_actor`; database cần nhiều FeatureIntent và first-class
  `actors`, tách khỏi `specs.target_users`.
- Why it matters: Nếu giữ compatibility mapping làm canonical, actor của feature tiếp tục bị trộn
  với context dự án và generation không có nguồn dữ liệu rõ.
- Implementation steps:
  1. Nâng Pydantic/frontend-compatible generation contract của FeatureIntent sang `actors: string[]`;
     giữ adapter đọc legacy `primary_actor` ngắn hạn nếu cần.
  2. Implement list/create/get/update/delete FeatureIntent theo owned Spec.
  3. Normalize/dedupe actor và string-list fields; enforce required name/summary.
  4. Trả feature UUID và timestamps; không nhận `spec_id` khác qua update payload.
  5. Khi xóa feature, cascade use cases/diagrams/BRDs trong transaction.
  6. Cập nhật deterministic/AI generation, grounding và tests để dùng peer actors.
- Acceptance criteria:
  - Một Spec có nhiều FeatureIntent.
  - `actors` là canonical; feature save không sửa `specs.target_users`.
  - Legacy request compatibility có test và được đánh dấu deprecate.
  - Cross-project feature access bị chặn.
- Dependencies: TASK-133, TASK-135
- Verification: Feature CRUD/ownership/cascade tests + generation contract suites.

#### TASK-138 - Implement FeatureIntent selector và editor frontend
- Priority: P1
- Status: Done (2026-06-07)
- Module: feature-intent-frontend
- Problem: `App.tsx` chỉ có một `featureIntent`; Spec và Feature đang chung một input section.
- Why it matters: User không thể quản lý nhiều feature độc lập hoặc chuyển context mà không trộn
  use cases/diagram.
- Implementation steps:
  1. Tạo tab `Chức năng` với feature list, active feature ID và create/select/delete actions.
  2. Di chuyển toàn bộ feature fields khỏi mixed Input panel vào editor riêng.
  3. Bind Actors textarea vào `feature.actors`, không ghi vào ProjectSpec.
  4. Thêm `Lưu chức năng`, dirty state và delete confirmation.
  5. Reset/load child use-case state khi active feature đổi; guard nếu feature hiện tại dirty.
  6. Chặn `Sinh use case` cho đến khi Spec và active Feature đã save.
- Acceptance criteria:
  - Tạo/chọn/sửa/xóa được nhiều feature trong một project.
  - Chuyển feature không trộn use cases hoặc diagrams.
  - Actors của feature và target users của Spec hiển thị/lưu độc lập.
  - Refresh load đúng feature theo route/query/local selection policy đã document.
- Dependencies: TASK-136, TASK-137
- Verification: Feature editor/selector component tests + multi-feature Playwright flow.

#### TASK-139 - Implement UseCase persistence và saved-parent generation backend
- Priority: P1
- Status: Done (2026-06-07)
- Module: use-case-backend
- Problem: Use cases chỉ được generate từ browser payload và chưa có resource UUID/persistence.
- Why it matters: Diagram phải tham chiếu một saved approved use case thuộc đúng user/project.
- Implementation steps:
  1. Tạo `UseCaseResource` DTO tách DB UUID `id` khỏi `use_case_key/content.use_case_id`.
  2. Implement GET và bulk PUT upsert theo owned FeatureIntent; validate canonical `UseCaseDraft`.
  3. Bulk PUT không xóa item bị thiếu; implement explicit `DELETE /api/use-cases/{id}`.
  4. Đồng bộ `title`, `use_case_key`, `review_status` columns với `content` trong service.
  5. Thay generation boundary bằng
     `POST /api/feature-intents/{id}/use-cases/generate`, server load Project + Spec + Feature.
  6. Generation trả drafts chưa persist; only bulk Save writes database.
- Acceptance criteria:
  - Use-case portfolio save/reload giữ structured flow và review status.
  - UUID database không đổi khi update cùng `use_case_key`.
  - Missing item trong bulk payload không bị xóa ngầm.
  - Generation dùng saved parent của current user, không tin arbitrary ProjectSpec/Feature payload.
- Dependencies: TASK-137
- Verification: Bulk upsert/explicit delete/ownership tests + saved-parent generation tests.

#### TASK-140 - Implement UseCase Save và resource identity frontend
- Priority: P1
- Status: Partial (2026-06-07; Save/UUID/downstream guard complete, explicit item delete UI remains)
- Module: use-case-frontend
- Problem: Use-case state chỉ có generated business ID và bị giữ trong `App.tsx`; generate/edit chưa
  có Save boundary.
- Why it matters: Frontend cần biết item nào đã persist để tạo diagram và delete đúng row.
- Implementation steps:
  1. Tạo frontend `UseCaseResource` type với `id`, `use_case_key`, `content`, timestamps.
  2. Generate qua active saved feature ID và map draft result thành unsaved resources.
  3. Thêm `Lưu danh sách use case`, dirty/saving/error state và replace local resources bằng server
     response sau success.
  4. Thêm explicit delete confirmation gọi resource UUID; không suy delete từ array diff.
  5. Giữ review/approve editing hiện tại nhưng đánh dirty; approve chưa có nghĩa là saved.
  6. Chỉ enable tạo diagram khi resource có UUID, approved và latest edit đã save.
- Acceptance criteria:
  - Generate không ghi DB trước khi user bấm Save.
  - Save/reload giữ portfolio và status.
  - Unsaved hoặc dirty approved use case không tạo được diagram.
  - Delete một use case không xóa nhầm item khác khi key được regenerate.
- Dependencies: TASK-138, TASK-139
- Verification: Component tests + generate/edit/approve/save/reload/delete Playwright flow.

#### TASK-141 - Implement Diagram persistence và saved-use-case generation backend
- Priority: P1
- Status: Done (2026-06-07)
- Module: diagram-backend
- Problem: Diagram generation nhận full UseCase payload và diagram workspace không được persist.
- Why it matters: Một diagram phải thuộc đúng saved use case UUID và BRD phải có parent ổn định.
- Implementation steps:
  1. Định nghĩa Diagram DTO/validator cho graph, lanes, lane height, provenance và semantic flag.
  2. Implement GET/PUT/DELETE diagram theo owned UseCase với unique `use_case_id`.
  3. Validate payload size, node/edge/lane structure và normalized graph invariants trước Save.
  4. Thay generation boundary bằng `POST /api/use-cases/{id}/diagram/generate`; server load saved
     approved `UseCase.content`.
  5. Set `source_use_case_updated_at` từ row use case khi generate/save source draft.
  6. Giữ generation là draft; only PUT persists latest diagram.
- Acceptance criteria:
  - Một use case có tối đa một diagram.
  - Generation reject unsaved/not-approved/not-owned use case.
  - Graph Save/load round-trip không mất lane/provenance/size data.
  - Outdated được tính từ source timestamp.
- Dependencies: TASK-139
- Verification: Diagram API/constraint/ownership/payload-limit tests + canonical round-trip fixtures.

#### TASK-142 - Implement Diagram Save/Load frontend
- Priority: P1
- Status: Partial (2026-06-07; Save/load complete, context-switch guard and adapter tests remain)
- Module: diagram-frontend
- Problem: Canvas state nằm trong LogicFlow + React maps và mất khi reload.
- Why it matters: Diagram là artifact trung tâm; serializer thiếu field có thể làm hỏng sơ đồ đã chỉnh.
- Implementation steps:
  1. Tạo pure adapters `serializeDiagramWorkspace` và `hydrateDiagramWorkspace`.
  2. Key diagram state bằng saved UseCase UUID, không chỉ `UC-01`.
  3. Generate diagram qua saved use-case ID, review draft trên canvas nhưng không auto-save.
  4. Thêm toolbar `Lưu sơ đồ` với `idle/dirty/saving/saved/failed`.
  5. Mark dirty cho mọi graph/lane/resize/import mutation; load server diagram khi mở use case.
  6. Confirm khi đổi use case/project hoặc rời page với diagram dirty.
- Acceptance criteria:
  - Save/reload/open lại giữ graph tương đương.
  - Generated draft chỉ persist sau `Lưu sơ đồ`.
  - Chuyển use case không trộn diagram workspaces.
  - Existing lane/node/provenance invariants vẫn pass.
- Dependencies: TASK-140, TASK-141
- Verification: Adapter unit tests, LogicFlow round-trip tests, browser Save/reload/navigation guard.

#### TASK-143 - Implement BRD persistence và saved-diagram generation backend
- Priority: P1
- Status: Done (2026-06-07)
- Module: brd-backend
- Problem: BRD generation nhận diagram payload tùy ý và chưa có `brd_docs` CRUD.
- Why it matters: BRD phải thuộc một saved diagram đã authorize, và user cần mở lại markdown đã chỉnh.
- Implementation steps:
  1. Định nghĩa BRD DTO cho structured spec, markdown, warnings, template và source timestamp.
  2. Implement GET/PUT/DELETE BRD theo owned Diagram với unique `diagram_id`.
  3. Thêm resource-scoped validate/generate routes theo diagram ID; server load saved graph/lanes.
  4. Reuse existing validate/generate services và response metadata; generation không auto-persist.
  5. Set `source_diagram_updated_at` từ diagram row khi user Save generated/edited BRD.
  6. Validate markdown/JSON payload limits và template enum.
- Acceptance criteria:
  - Một diagram có tối đa một BRD.
  - BRD generation không nhận diagram của user khác hoặc unsaved graph.
  - Save/reload giữ markdown user edit và structured spec.
  - Diagram update làm saved BRD được đánh outdated.
- Dependencies: TASK-141
- Verification: BRD CRUD/ownership/outdated tests + existing generation pipeline regression suite.

#### TASK-144 - Implement BRD Save/Load frontend và scoped recovery cache
- Priority: P1
- Status: Partial (2026-06-07; server Save/load complete, scoped recovery cache remains)
- Module: brd-frontend
- Problem: BRD hiện chỉ dùng một global localStorage cache và panel không có server Save.
- Why it matters: Cache có thể hiển thị draft của diagram/project trước; server phải là nguồn chính.
- Implementation steps:
  1. Load BRD theo active saved diagram ID khi mở panel.
  2. Generate/validate qua saved diagram resource routes.
  3. Thêm `Lưu BRD` với dirty/save/error state; edit markdown đánh dirty.
  4. Scope local recovery cache theo Clerk user ID + diagram UUID, không dùng một global artifact.
  5. Sau server Save thành công, cập nhật baseline/cache; server data thắng khi load bình thường.
  6. Hiển thị outdated khi diagram timestamp mới hơn source timestamp nhưng vẫn cho mở bản saved.
- Acceptance criteria:
  - Edit/Save/reload markdown không mất dữ liệu.
  - Draft của project/diagram khác không xuất hiện sai context.
  - Generate không auto-save.
  - Diagram thay đổi hiển thị BRD outdated đúng.
- Dependencies: TASK-142, TASK-143
- Verification: BrdPanel/cache tests + multi-diagram Save/reload/outdated Playwright flow.

#### TASK-145 - Chuẩn hóa Save UX và unsaved-change guards toàn chain
- Priority: P1
- Status: Partial (2026-06-07; shared states/beforeunload/downstream guards complete, full navigation matrix remains)
- Module: save-ux-integration
- Problem: Sáu Save scope dễ có state, copy và guard không nhất quán.
- Why it matters: Latest-only không có undo history; UI phải nói rõ phần nào durable trước khi user
  chuyển context hoặc tạo child artifact.
- Implementation steps:
  1. Tạo shared save-state contract `idle/dirty/saving/saved/failed` và reusable status/button UI.
  2. Hiển thị saved timestamp/error/retry theo từng Project, Spec, Feature, UseCase portfolio,
     Diagram và BRD.
  3. Thêm guard cho route/project/feature/use-case/canvas/panel switch khi scope hiện tại dirty.
  4. Chặn downstream CTA bằng persisted parent ID + clean saved baseline, không chỉ bằng dữ liệu local.
  5. Không đánh dirty khi hydrate; chỉ đánh dirty sau user/canvas mutation.
  6. Chuẩn hóa confirm copy cho delete cascade và unsaved navigation.
- Acceptance criteria:
  - Mỗi phần hiển thị chính xác trạng thái Save riêng.
  - User không vô tình mất dirty edits khi đổi context.
  - Generate và Save luôn là hai action khác nhau.
  - Downstream artifact không được tạo từ parent chưa save.
- Dependencies: TASK-136, TASK-138, TASK-140, TASK-142, TASK-144
- Verification: Save-state unit tests + navigation matrix Playwright.

#### TASK-146 - Thêm full-chain persistence, auth và isolation test suite
- Priority: P1
- Status: Partial (2026-06-07; PostgreSQL full-chain/ownership test complete, authenticated Clerk browser E2E remains)
- Module: persistence-e2e-security
- Problem: Existing tests chủ yếu cover mock generation; chưa chứng minh migration, authenticated
  CRUD, ownership isolation hoặc full reload chain.
- Why it matters: Sai auth/FK/serializer có thể mất hoặc lộ toàn bộ project data.
- Implementation steps:
  1. Tạo PostgreSQL integration test fixture riêng, migrate schema trước suite và isolate transaction.
  2. Thêm API matrix cho unauthenticated, invalid token, user A/user B IDOR và cascade constraints.
  3. Thêm Clerk Playwright test setup với test keys/token và reusable authenticated storage state.
  4. Thêm E2E: sign in -> create project -> Save Spec -> Feature -> UseCases -> Diagram -> BRD.
  5. Reload browser và verify toàn chain; edit từng scope và verify latest-state overwrite.
  6. Thêm failure cases: DB unavailable, 401 mid-session, oversized graph, Save error và retry.
- Acceptance criteria:
  - Full chain tồn tại sau browser refresh.
  - Cross-user access fail ở mọi resource level.
  - Test chứng minh generation không auto-save.
  - Migration + API + UI persistence suites chạy bằng một documented command.
- Dependencies: TASK-131 through TASK-145
- Verification: PostgreSQL pytest suite + Vitest + authenticated Playwright full-chain suite.

### Later

#### TASK-147 - Hoàn thiện Railway release, backup và observability checklist
- Priority: P2
- Status: Partial (2026-06-07; runbook complete, Railway backup/deploy/restore execution blocked)
- Module: persistence-operations
- Problem: Latest-only storage không có in-app history; Railway Postgres là unmanaged service và repo
  chưa có release/backup/DB telemetry checklist.
- Why it matters: Migration lỗi hoặc accidental overwrite cần recovery path ngoài application.
- Implementation steps:
  1. Enable scheduled Railway volume backups trước production launch; document restore drill owner.
  2. Thêm structured logs cho request ID, route, user/resource IDs đã hash/redact, latency và DB error
     class; không log payload/secret.
  3. Thêm connection-pool metrics hoặc tối thiểu health/readiness/error-rate dashboard.
  4. Chạy staging migration + full-chain smoke trước production deploy.
  5. Document rollback: application rollback, migration compatibility và database restore decision.
  6. Đặt alert cho readiness/deploy failure và database connection saturation.
- Acceptance criteria:
  - Có backup schedule và một restore drill đã ghi nhận.
  - Production deploy checklist yêu cầu migration + authenticated persistence smoke.
  - Logs/metrics đủ phân biệt auth, validation và DB failures mà không lộ dữ liệu.
  - Rollback procedure có owner và verification command.
- Dependencies: TASK-130, TASK-146
- Verification: Railway staging release rehearsal, backup restore drill và log redaction review.

## Post-Implementation Review: TASK-131 to TASK-145

Review snapshot:
[2026-06-07 TASK-131 to TASK-145 implementation review](./reviews/2026-06-07-task-131-145-implementation-review.md).

### Now

#### TASK-148 - Chuẩn hóa Python runner cho backend scripts
- Priority: P1
- Status: Done
- Module: test-runtime-tooling
- Problem: `npm run test:api-mock` và `npm run dev:api` dùng `python3` hệ thống, trong khi dependency mới như `clerk_backend_api`, SQLAlchemy và Alembic nằm trong `apps/api/.venv`.
- Why it matters: Developer/CI có thể fail trước khi chạy test, làm các task persistence trông hỏng dù code đúng.
- Implementation steps:
  1. Chọn một runner chính thức cho backend: `apps/api/.venv/bin/python`, `uv run`, hoặc script bootstrap tương đương.
  2. Cập nhật `package.json` cho `dev:api`, `test:api-mock`, `test:api-live`, `db:migrate`, `db:downgrade`.
  3. Cập nhật `playwright.config.ts` để dùng cùng runner, không hard-code một đường khác.
  4. Cập nhật README/setup nếu cần cài venv trước khi chạy scripts.
  5. Thêm smoke command kiểm `python -c "import clerk_backend_api, sqlalchemy, alembic"`.
- Acceptance criteria:
  - `npm run test:api-mock` chạy pass trên máy không cài dependency backend global.
  - `npm run dev:api` start được backend với dependency mới.
  - README chỉ dẫn đúng một đường chạy backend local.
- Dependencies: None
- Verification: `npm run test:api-mock`, `npm run dev:api`, `npm run test:e2e-mock`.
- Completion notes: Standardized npm backend commands on `apps/api/.venv/bin/python`, added `api:python:smoke`, and verified `npm run api:python:smoke`, `npm run test:api-mock`, `npm run test:e2e-mock`.

#### TASK-149 - Sửa UseCasePanel input trong persisted workspace thành read-only/CTA
- Priority: P1
- Status: Done
- Module: project-workspace-ux
- Problem: Trong `/projects/:projectId`, `UseCasePanel` vẫn render input ProjectSpec/Feature nhưng `App.tsx` bỏ qua mọi edit và chỉ set status.
- Why it matters: User có cảm giác đang sửa dữ liệu nhưng Save không thể ghi thay đổi; flow Spec/Feature tách riêng bị mâu thuẫn.
- Implementation steps:
  1. Thêm mode prop cho `UseCasePanel`, ví dụ `sourceMode="standalone" | "persisted"`.
  2. Khi `persisted`, thay input Feature/ProjectSpec bằng summary read-only.
  3. Thêm CTA `Sửa Project Spec` và `Sửa Feature Intent` gọi callback từ `ProjectWorkspace` để chuyển tab.
  4. Ẩn hoặc disable những field đang gọi `onProjectSpecChange`/`onFeatureIntentChange`.
  5. Cập nhật copy để nói rõ UseCase được sinh từ parent đã lưu.
- Acceptance criteria:
  - Trong persisted workspace, không có field giả editable cho ProjectSpec/Feature.
  - User có đường rõ ràng để quay về tab Spec/Features.
  - Standalone `/demo` vẫn giữ flow nhập liệu cũ cho regression.
- Dependencies: TASK-148 không bắt buộc nhưng nên làm trước khi rerun full suite.
- Verification: Vitest `UseCasePanel` mode tests; Playwright project workspace smoke.
- Completion notes: Added persisted `sourceMode` with read-only Feature/ProjectSpec summaries and CTAs back to workspace tabs; standalone mode remains editable. Verified with `npm run test:ui-mock` and `npm run test:e2e-mock`.

#### TASK-150 - Tách save-state theo từng resource scope và reset khi đổi context
- Priority: P1
- Status: Done
- Module: save-ux-integration
- Problem: `ProjectWorkspace` dùng chung `shellSaveState` cho Spec và Feature, đồng thời không reset `useCaseSaveState`, `diagramSaveState`, `brdSaveState` khi chọn feature khác.
- Why it matters: Dirty state của feature/use case/diagram này có thể leak sang feature khác, block action sai hoặc hiển thị banner sai.
- Implementation steps:
  1. Tách `projectSaveState`, `specSaveState`, `featureSaveState`.
  2. Key child save-state theo resource ID: feature ID, use case key/UUID, diagram ID.
  3. Khi active feature đổi, reset/hydrate child states theo feature mới.
  4. Khi active use case/diagram đổi, guard dirty state trước rồi mới switch.
  5. Hiển thị save timestamp/error theo đúng scope.
- Acceptance criteria:
  - Spec save không đổi trạng thái Save của Feature.
  - Dirty UseCase/Diagram/BRD của Feature A không hiển thị ở Feature B.
  - Đổi feature khi child dirty luôn hỏi confirm hoặc chặn rõ.
- Dependencies: TASK-149
- Verification: Component tests cho save-state reducer/context; Playwright multi-feature dirty-state matrix.
- Completion notes: Split Project/Spec/Feature save states and keyed UseCase/Diagram/BRD states by active resource scope with dirty guards on feature switches. Verified by build, UI tests and E2E suite.

#### TASK-151 - Siết validator cho saved Diagram graph payload
- Priority: P1
- Status: Done
- Module: diagram-backend
- Problem: `DiagramSave` chỉ kiểm `nodes/edges` là array và payload size, nhưng BRD generation sau đó assume node type, id, coordinate, lane and edge endpoint hợp lệ.
- Why it matters: Một diagram malformed có thể lưu thành công rồi làm `/api/diagrams/{id}/brd/generate` trả 500 thay vì 422.
- Implementation steps:
  1. Tạo Pydantic models cho saved graph node/edge tối thiểu.
  2. Enforce supported node types: `start`, `end`, `activity`, `decision`, `note`, `sync-bar`, `lane`.
  3. Enforce node IDs unique và edge endpoints tồn tại.
  4. Enforce activity/decision/note lane binding hợp lệ khi có lanes.
  5. Cập nhật `stored_generate_request` dùng adapter đã validate, không cast ad hoc.
  6. Trả 422 envelope thay vì 500 cho malformed graph.
- Acceptance criteria:
  - Malformed graph không được lưu hoặc bị reject có kiểm soát.
  - Saved valid graph vẫn round-trip và generate BRD như hiện tại.
  - Không còn `float(...)`/field assumptions có thể throw ngoài validator path.
- Dependencies: None
- Verification: Pytest payload-limit/malformed graph cases + full-chain persistence test.
- Completion notes: Added saved diagram graph validation for supported node types, unique node/edge IDs, finite coordinates, edge endpoint existence and lane binding. Malformed graph save now returns `422`.

#### TASK-152 - Thêm Clerk auth matrix tests cho backend
- Priority: P1
- Status: Done
- Module: identity-authorization
- Problem: Persistence tests đang dựa vào `AUTH_DISABLED=true` và dependency override, chưa chứng minh missing/invalid/wrong-party Clerk token bị xử lý đúng.
- Why it matters: Auth là trust boundary chính của toàn bộ project data.
- Implementation steps:
  1. Refactor `auth.py` để có seam testable quanh `authenticate_request`.
  2. Test missing Authorization trả 401 khi `AUTH_DISABLED=false`.
  3. Test invalid token, wrong authorized party và missing subject.
  4. Test user mới được tạo role `user`, client không gửi role.
  5. Test cross-user access ở Project, Spec, Feature, UseCase, Diagram, BRD đều trả `404`.
- Acceptance criteria:
  - Auth-disabled tests vẫn tồn tại cho fast local flow.
  - Có suite riêng chạy auth thật/mocked SDK state với `AUTH_DISABLED=false`.
  - Không route business nào public trừ health/readiness.
- Dependencies: TASK-148
- Verification: `npm run test:api-mock` hoặc backend pytest command mới.
- Completion notes: Added a Clerk auth seam and matrix tests for missing/invalid/wrong-party/subjectless tokens, default role hydration and cross-user `404` across the resource chain.

### Next

#### TASK-153 - Extract persistence service layer khỏi route monolith
- Priority: P2
- Status: Done
- Module: persistence-api-foundation
- Problem: `routes/persistence.py` đang chứa route handlers, serializers, generation adapters và transaction commits trong một file lớn.
- Why it matters: Các fix tiếp theo cho delete/guards/validation sẽ khó review và dễ tạo transaction behavior lệch nhau.
- Implementation steps:
  1. Tách serializers sang `app/persistence/serializers.py`.
  2. Tách Project/Spec/Feature/UseCase/Diagram/BRD operations sang service modules.
  3. Đặt transaction boundary trong service function, route chỉ parse dependency và trả DTO.
  4. Tách resource-scoped generation adapters khỏi CRUD service.
  5. Giữ public route paths không đổi.
- Acceptance criteria:
  - Route file còn chủ yếu endpoint wiring.
  - Service tests có thể gọi operations không cần TestClient.
  - Full-chain API test vẫn pass.
- Dependencies: TASK-151, TASK-152 nên làm trước để tránh refactor trên nền thiếu guard.
- Verification: Backend pytest + diff review route size/commit ownership.
- Completion notes: Extracted serializers, CRUD services and generation adapters into `app.services.persistence_*`; route file now primarily wires dependencies and endpoint contracts.

#### TASK-154 - Implement explicit UseCase delete UI bằng resource UUID
- Priority: P2
- Status: Done
- Module: use-case-frontend
- Problem: API có `DELETE /api/use-cases/{id}` nhưng UI chưa expose delete theo DB UUID trong persisted workspace.
- Why it matters: User không thể quản lý portfolio latest-state rõ ràng; xóa bằng array diff bị tránh đúng nhưng chưa có action thay thế.
- Implementation steps:
  1. Map `UseCaseResource.id` vào UI inventory/card state.
  2. Thêm delete action per use case với confirmation nêu cascade diagram/BRD.
  3. Gọi `api.deleteUseCase(id)` và update local resources/drafts.
  4. Nếu deleted use case đang active canvas, clear canvas binding hoặc chuyển sang orphan state có copy rõ.
  5. Add empty-state sau khi xóa hết.
- Acceptance criteria:
  - Xóa một use case không ảnh hưởng use case khác.
  - Child diagram/BRD cascade rõ trong copy và test.
  - Refresh sau delete không load lại item.
- Dependencies: TASK-150
- Verification: Playwright use-case delete/reload/cascade smoke + API cascade test.
- Completion notes: Added persisted UseCase delete action backed by `DELETE /api/use-cases/{id}`, with cascade copy and local canvas/BRD cleanup. Added backend cascade coverage.

#### TASK-155 - Scope BRD recovery cache theo user/project/diagram
- Priority: P2
- Status: Done
- Module: brd-frontend
- Problem: Legacy BRD localStorage cache vẫn global trong standalone editor và chưa có recovery cache trong persisted workspace.
- Why it matters: Latest-only server Save không bảo vệ unsaved markdown nếu user hard-reload trước khi bấm Save.
- Implementation steps:
  1. Thêm cache key format gồm Clerk user ID, project ID, diagram ID.
  2. Trong persisted workspace, hydrate cache chỉ khi diagram ID khớp active diagram.
  3. Server saved BRD thắng cache bình thường; cache chỉ là recovery draft.
  4. Sau Save thành công, clear hoặc baseline scoped cache.
  5. Ẩn legacy `Open last BRD draft` trong persisted workspace nếu không có scoped cache.
- Acceptance criteria:
  - Draft của diagram/project khác không xuất hiện sai context.
  - Hard reload trước Save có thể recover đúng draft hiện tại.
  - Server Save/reload vẫn là nguồn chính.
- Dependencies: TASK-150
- Verification: Brd cache unit tests + Playwright multi-diagram recovery flow.
- Completion notes: Scoped BRD recovery cache by Clerk user, project and diagram, hydrates only for the active persisted diagram, and clears scoped cache after successful server Save.

#### TASK-156 - Thêm active feature identity vào URL hoặc route
- Priority: P2
- Status: Done
- Module: frontend-application-shell
- Problem: Project workspace luôn chọn feature đầu tiên theo `updated_at`; active feature không deep-link được.
- Why it matters: Refresh/share link có thể mở nhầm feature sau khi một feature khác vừa update.
- Implementation steps:
  1. Chọn route/query contract: `/projects/:projectId/features/:featureId` hoặc `?feature=`.
  2. Khi user chọn feature, update URL bằng navigate/replace phù hợp.
  3. Khi route có feature ID không thuộc project, hiển thị not-found-safe hoặc fallback rõ.
  4. Khi chưa có feature ID, redirect/chọn feature đầu tiên có chủ đích.
  5. Cập nhật tests cho refresh/deep-link.
- Acceptance criteria:
  - Refresh giữ đúng active feature.
  - URL không leak resource existence của user khác.
  - Dashboard/open project behavior vẫn có default hợp lý.
- Dependencies: TASK-150
- Verification: Router/component tests + Playwright refresh active feature.
- Completion notes: Added `/projects/:projectId/features/:featureId` route, feature selection URL sync and default redirect to the selected feature.

### Later

#### TASK-157 - Rehearse Docker/Railway API deploy path
- Priority: P2
- Status: Partial
- Module: api-deployment
- Problem: Repo có Dockerfile/Railway manifest nhưng Docker build/Railway deploy chưa được xác nhận end-to-end trong review.
- Why it matters: Runtime contract mới chỉ đáng tin khi image build, pre-deploy migration và health/readiness đều chạy trên staging.
- Implementation steps:
  1. Build Docker image local hoặc CI từ repo root.
  2. Run container với test `DATABASE_URL` và hit `/healthz`.
  3. Run Alembic inside same image against staging/test DB.
  4. Re-auth Railway CLI, link project/environment.
  5. Deploy staging và ghi log pre-deploy/start/healthcheck.
- Acceptance criteria:
  - Docker image build không copy `.env` và start được.
  - Railway staging deploy chạy migration trước start.
  - `/healthz` và `/readyz` pass trên staging.
- Dependencies: TASK-148, Railway credential rotation.
- Verification: Docker build/run logs + Railway staging smoke.
- Completion notes: Fixed Python package discovery for Docker, built `swimlane-api:task-157`, ran the container and verified `/healthz`. Railway live staging deploy remains blocked because `railway status` reports expired OAuth token and no linked project.

#### TASK-158 - Split full-chain persistence test thành scenario matrix
- Priority: P2
- Status: Done
- Module: persistence-e2e-security
- Problem: `test_persistence_chain.py` chứng minh happy path lớn, nhưng ít scenario nhỏ cho conflict, not-owned child levels, generation-not-auto-save và malformed payloads.
- Why it matters: Một test lớn dễ pass mà vẫn bỏ sót regression ở từng boundary.
- Implementation steps:
  1. Tạo fixture factory cho user/project/spec/feature/usecase/diagram.
  2. Split happy path, generation-not-auto-save, ownership matrix, cascade, outdated timestamp thành test riêng.
  3. Add malformed diagram/BRD payload tests sau TASK-151.
  4. Add no-leak 404 assertions cho every child endpoint.
  5. Keep one full-chain smoke as final integration.
- Acceptance criteria:
  - Test failure chỉ ra boundary cụ thể.
  - Full-chain smoke vẫn tồn tại nhưng không chứa toàn bộ assertion matrix.
  - Ownership coverage đủ Project, Spec, Feature, UseCase, Diagram, BRD.
- Dependencies: TASK-151, TASK-152
- Verification: Backend pytest suite runtime and coverage review.
- Completion notes: Added scenario matrix coverage for auth, ownership, generation-not-auto-save, malformed diagram payloads and UseCase cascade while keeping the existing full-chain smoke.

## Post-Implementation Review: TASK-148 to TASK-158

Review snapshot:
[2026-06-07 TASK-148 to TASK-158 implementation review](./reviews/2026-06-07-task-148-158-implementation-review.md).

### Now

#### TASK-159 - Track dirty state across all persisted resource scopes
- Priority: P1
- Status: Done
- Module: save-ux-integration
- Problem: `ProjectWorkspace` keys Save states by resource scope, but the global unsaved-change guard only checks the currently active Feature/UseCase/Diagram/BRD scope.
- Why it matters: User can dirty Diagram A, switch to Diagram B, and lose the beforeunload warning even though Diagram A is still dirty in `scopedSaveStates`.
- Implementation steps:
  1. Replace `Record<string, SaveState>` with a small save-state registry/reducer module.
  2. Track scope metadata: type, resource ID, label, active flag, and state.
  3. Expose helpers for `isActiveDirty`, `isAnyDirty`, `dirtyScopes`, `setScopeState`, and `clearScope`.
  4. Use `isAnyDirty` for `beforeunload` and leaving workspace.
  5. Use active-scope helpers for button labels so the toolbar still reflects the current artifact.
  6. Clear deleted resource scopes when UseCase/Diagram/BRD is deleted.
- Acceptance criteria:
  - Dirty state of inactive Diagram/BRD still triggers leave/reload warning.
  - Active toolbar still shows the current resource state, not a random inactive dirty state.
  - Deleting a resource clears its dirty scopes.
  - Feature and diagram switching do not silently hide unsaved work.
- Dependencies: TASK-150, TASK-154
- Verification: Add reducer unit tests plus Playwright flow: dirty Diagram A, switch to B, attempt leave/reload and confirm warning still appears.
- Completion notes: Added `src/persistence/save-state.ts` registry with dirty scope helpers, wired `ProjectWorkspace` to use aggregate dirty state for leave/reload guards, and added registry unit tests.

#### TASK-160 - Guard diagram/use-case context switches with scoped dirty prompts
- Priority: P1
- Status: Done
- Module: editor-save-state
- Problem: `handleOpenUseCaseDiagramCanvas` switches active canvas after persisting the current graph locally, but it does not check whether the current persisted Diagram/BRD has unsaved server changes.
- Why it matters: Local editor state may survive, but latest-state server Save intent is unclear; user can move away from a dirty artifact without an explicit decision.
- Implementation steps:
  1. Add `canSwitchDiagramScope(nextUseCaseId)` helper using the save-state registry from TASK-159.
  2. Before opening another use-case diagram, prompt if current Diagram or BRD scope is dirty.
  3. Offer clear choices: stay and save, discard local unsaved changes, or continue while keeping dirty state tracked.
  4. Preserve current local graph before switch only after the user confirms the chosen path.
  5. Add status copy that names the previous and next use case IDs.
- Acceptance criteria:
  - Switching away from dirty Diagram/BRD prompts the user.
  - Cancel keeps the current canvas binding unchanged.
  - Continue keeps the previous dirty scope visible in the global unsaved-change summary.
- Dependencies: TASK-159
- Verification: Playwright multi-use-case matrix for dirty diagram switch, dirty BRD switch, cancel, continue and save paths.
- Completion notes: Added `WorkspacePersistence.canSwitchDiagramScope` and guarded `handleOpenUseCaseDiagramCanvas` so switching away from dirty Diagram/BRD asks for confirmation and preserves the previous dirty scope.

### Next

#### TASK-161 - Make invalid active feature deep-links explicit
- Priority: P2
- Status: Done
- Module: frontend-routing
- Problem: `/projects/:projectId/features/:featureId` silently falls back to the first feature when the feature ID is not in the project.
- Why it matters: A stale or mistyped URL can open a different feature without explanation, which is confusing during review/share flows.
- Implementation steps:
  1. Detect `routeFeatureId && !routedFeature` after features load.
  2. Show a not-found-safe banner: "Feature không tồn tại trong project này hoặc bạn không có quyền."
  3. Provide CTA to open the first feature or return to the feature list.
  4. Avoid revealing whether the feature exists under another user/project.
  5. Add route tests for valid feature, missing feature and no feature ID default.
- Acceptance criteria:
  - Valid feature URLs refresh to the same feature.
  - Invalid feature URLs do not silently open another feature.
  - Copy does not leak cross-user resource existence.
- Dependencies: TASK-156
- Verification: Router/component tests and Playwright refresh/deep-link smoke.
- Completion notes: Invalid `/projects/:projectId/features/:featureId` links now show a safe not-found banner with CTAs instead of silently opening another feature.

#### TASK-162 - Handle persisted BRD load failures without losing recovery drafts
- Priority: P2
- Status: Done
- Module: brd-frontend
- Problem: The persisted BRD load effect calls `workspace.loadBrd(diagramId).then(...)` without an error path.
- Why it matters: A transient backend failure can leave stale panel state or create an unhandled promise rejection while switching diagrams.
- Implementation steps:
  1. Add `.catch` or async/await error handling around persisted BRD load.
  2. Preserve scoped local recovery cache when server load fails.
  3. Set BRD panel/status copy that tells the user server load failed and local draft is still recoverable.
  4. Avoid overwriting an existing dirty BRD draft with partial/failed server state.
  5. Add a unit or component test by mocking `loadBrd` rejection.
- Acceptance criteria:
  - Failed BRD load is visible to the user and does not crash.
  - Scoped cache is still available after a load failure.
  - Successful retry/server load still wins over cache when not dirty.
- Dependencies: TASK-155
- Verification: Vitest mocked workspace test plus manual Browser smoke if available.
- Completion notes: Persisted BRD load now catches backend errors, preserves scoped recovery cache, marks the BRD panel failed/retryable when appropriate, and avoids overwriting the local draft on load failure.

### Later

#### TASK-163 - Complete Railway staging deploy rehearsal
- Priority: P2
- Status: Partial
- Module: api-deployment
- Problem: Docker build and `/healthz` pass locally, but Railway live deployment, Alembic pre-deploy and `/readyz` remain unverified because Railway CLI is not logged in and the repo is not linked.
- Why it matters: Production readiness depends on the actual Railway environment resolving credentials, running migrations and serving health checks.
- Implementation steps:
  1. Run `railway login` with the project owner account.
  2. Run `railway link` to attach the repository to the correct project/environment.
  3. Confirm rotated PostgreSQL credentials are in Railway and local `.env` does not contain stale exposed secrets.
  4. Deploy staging using `railway.toml`.
  5. Verify pre-deploy `python -m alembic upgrade head` logs.
  6. Hit `/healthz` and `/readyz` on the staging service.
  7. Record deploy result in `docs/operations/railway-persistence-release.md`.
- Acceptance criteria:
  - Railway staging deployment completes from the current Dockerfile.
  - Alembic migration runs before app start.
  - `/healthz` and `/readyz` pass in staging.
  - Release runbook contains timestamped evidence.
- Dependencies: Railway account access, credential rotation, TASK-157 partial completion
- Verification: Railway deploy logs, staging HTTP checks and runbook update.
- Completion notes: Rechecked Railway CLI. `railway status` still fails with expired OAuth token and no linked project, so staging deploy/pre-deploy/ready checks remain externally blocked until the project owner runs `railway login` and `railway link`.

## Post-Implementation Review: TASK-159 to TASK-163

Review snapshot:
[2026-06-07 TASK-159 to TASK-163 implementation review](./reviews/2026-06-07-task-159-163-implementation-review.md).

### Now

#### TASK-164 - Clear stale dirty scopes on feature discard and cascade delete
- Priority: P1
- Status: Done
- Module: save-ux-integration
- Problem: `TASK-159` preserves inactive dirty scopes, but `selectFeature`, `startNewFeature` and
  `deleteFeature` do not clear scopes after the user confirms discard or deletes the owning feature.
- Why it matters: The global unsaved-change guard can remain stuck on invisible or intentionally
  discarded artifacts, making the persisted workspace feel unsafe and confusing.
- Implementation steps:
  1. Add parent metadata to `SaveScopeEntry` or add helper predicates that can identify all scopes
     owned by a feature/use case/diagram.
  2. Create a `clearFeatureScopes(featureId)` helper around `clearScopesByPredicate`.
  3. Call the helper when feature changes are explicitly discarded in `selectFeature` and
     `startNewFeature`.
  4. Call the helper after `deleteFeature` succeeds, including known diagram and BRD scopes for the
     deleted feature.
  5. Keep "continue while tracking dirty state" from diagram switching unchanged; only clear when
     the user selected a discard/delete path.
- Acceptance criteria:
  - Confirming feature discard removes dirty warnings for the previous feature's use cases,
    diagrams and BRD scopes.
  - Deleting a feature clears all dirty scopes owned by that feature.
  - Continuing from a dirty diagram switch still preserves the previous dirty scope.
- Dependencies: TASK-159
- Verification: Add save-state/ProjectWorkspace tests for feature discard, new feature, feature
  delete and diagram switch continue.
- Completion notes: Added feature ownership metadata to every persisted Save scope,
  `clearFeatureScopes`, cleanup on feature discard/new/delete paths, and regression tests proving
  other features' dirty scopes remain tracked.

#### TASK-165 - Clear active editor context for invalid feature routes
- Priority: P1
- Status: Done
- Module: frontend-routing
- Problem: Invalid `/projects/:projectId/features/:featureId` URLs show a banner but can leave the
  previous `activeFeatureId` and editor provider context mounted when navigating from a valid feature
  to an invalid feature in the same project.
- Why it matters: The URL says the feature is missing, but the editor can still show another
  feature, which violates the explicit deep-link behavior expected by `TASK-161`.
- Implementation steps:
  1. In the project load effect, add an explicit `routeFeatureId && !routedFeature` branch.
  2. Clear `activeFeatureId`, `featureDraftId`, `activeDiagram` and `activeDiagramBusinessKey` in
     that branch.
  3. Route the user to a safe tab or render a not-found-only state that cannot mount `App` with a
     stale `WorkspacePersistenceProvider`.
  4. Keep the banner copy non-enumerating: do not reveal whether the feature exists under another
     user or project.
  5. Preserve the CTA that opens the first visible feature after user action.
- Acceptance criteria:
  - Navigating from a valid feature URL to an invalid feature URL unmounts the old editor context.
  - Invalid URLs never silently show another feature.
  - The "open first feature" CTA still works and updates the URL.
- Dependencies: TASK-161
- Verification: Add router/component tests for valid refresh, invalid initial load and valid-to-
  invalid navigation.
- Completion notes: Invalid feature routes now clear active feature/draft/diagram context, move to
  the safe feature tab, unmount the stale editor provider and preserve the explicit first-feature
  CTA.

#### TASK-166 - Make persisted diagram load and scope switching transactional
- Priority: P1
- Status: Done
- Module: editor-save-state
- Problem: `handleOpenUseCaseDiagramCanvas` does not catch `workspace.loadDiagram` failures, and
  `ProjectWorkspace.loadDiagram` sets `activeDiagramBusinessKey` before the backend load succeeds.
- Why it matters: A transient load failure can leave the active save scope half-switched and produce
  an uncaught async error from the click handler.
- Implementation steps:
  1. Move `setActiveDiagramBusinessKey(businessKey)` in `loadDiagram` until after `api.getDiagram`
     succeeds, or add an explicit loading/pending scope state.
  2. Wrap `workspace.loadDiagram(useCaseId)` in `handleOpenUseCaseDiagramCanvas` with `try/catch`.
  3. On failure, keep the previous canvas binding and active save scope unchanged.
  4. Surface a status message that names the use case that failed to load.
  5. Preserve the dirty-switch confirmation behavior from `TASK-160`.
- Acceptance criteria:
  - Failed persisted diagram load does not change `activeDiagramBusinessKey`.
  - Failed persisted diagram load does not throw an unhandled promise rejection.
  - The user sees a clear retryable status message.
- Dependencies: TASK-160
- Verification: Add mocked `loadDiagram` rejection test and a Playwright mock flow for switching
  from dirty Diagram A to Diagram B when B load fails.
- Completion notes: Diagram generation/load commits the active business key only after success,
  App catches persisted load failures without rebinding the canvas, and both open and generate paths
  now run the scoped dirty-switch guard.

### Next

#### TASK-167 - Protect BRD recovery cache from server-load overwrite
- Priority: P2
- Status: Done
- Module: brd-frontend
- Problem: The persisted BRD load effect hydrates scoped recovery cache, but a successful server
  load immediately overwrites component state and can overwrite the local cache with the server
  version.
- Why it matters: A local unsaved recovery draft can disappear when the server has an older saved
  BRD, despite the UI implying the recovery draft was preserved.
- Implementation steps:
  1. Track whether a scoped BRD recovery cache was restored for the active diagram.
  2. Treat restored local recovery as dirty unless it matches the server payload fingerprint.
  3. On server success with dirty local recovery, keep the local draft visible and expose an action to
     load the server version.
  4. Only overwrite local recovery automatically when there is no local draft or the draft is not
     dirty.
  5. Clear the restored-cache marker after a successful explicit Save.
- Acceptance criteria:
  - Server success does not overwrite a dirty local BRD recovery draft.
  - User can deliberately replace local recovery with the server BRD.
  - Saving BRD clears the local recovery cache and returns the BRD save state to saved.
- Dependencies: TASK-162
- Verification: Add a mocked `loadBrd` success test with existing scoped cache, plus the existing
  load failure test.
- Completion notes: Scoped BRD cache now records dirty recovery state, only persists unsaved
  workspace drafts, keeps dirty local recovery when a server BRD loads, exposes an explicit
  `Dùng bản server` action, retries server load correctly and clears recovery after Save.

#### TASK-168 - Add route and dirty-switch regression coverage
- Priority: P2
- Status: Done
- Module: frontend-tests
- Problem: The new behavior from `TASK-159` through `TASK-162` is mostly covered by registry helper
  tests, not by component or E2E tests for actual user transitions.
- Why it matters: The highest-risk failures are state-machine regressions that helper tests will not
  catch.
- Implementation steps:
  1. Add ProjectWorkspace tests for aggregate dirty guard, invalid route banner and stale context
     clearing.
  2. Add App/workspace tests for `canSwitchDiagramScope` cancel/continue behavior.
  3. Add App/workspace tests for persisted diagram load rejection.
  4. Add BRD recovery tests for `PERSISTED_BRD_LOAD_FAILED` and dirty cache preservation.
  5. Add one Playwright mock scenario that dirties Diagram A, opens Diagram B, then attempts to leave
     and sees the global unsaved warning.
- Acceptance criteria:
  - Regression tests fail against the current reviewed gaps before fixes.
  - `npm run test:ui-mock` covers the component-level route/switch/recovery cases.
  - `npm run test:e2e-mock` covers one full dirty-switch flow.
- Dependencies: TASK-164, TASK-165, TASK-166, TASK-167
- Verification: Run `npm run test:ui-mock`, `npm run test:e2e-mock` and `npm run build`.
- Completion notes: Added `ProjectWorkspace` integration tests for valid-to-invalid routing,
  discard cleanup and failed diagram load scope retention; expanded save-state/cache/BRD panel
  tests for switch decisions and recovery conflict actions. Full UI suite, existing 17-scenario
  Playwright suite and production build pass. Real hosted Clerk E2E remains outside this mock
  persistence batch.

#### TASK-169 - Add Clerk backend config preflight and local auth setup guard
- Priority: P1
- Status: Pending
- Module: identity-authorization
- Problem: Current local testing can still hit `503 Clerk backend authentication is not configured.`
  after adding `CLERK_SECRET_KEY` if the backend process is not restarted, runs from an environment
  that does not load `apps/api/.env`, or the frontend/backend Clerk env names drift.
- Why it matters: This blocks every authenticated backend route and makes the system look broken
  even though the auth code path is working as written.
- Implementation steps:
  1. Treat real Clerk local mode as configured when `apps/api/.env` has `CLERK_SECRET_KEY` or
     `CLERK_JWT_KEY`, and root `.env.local` has `VITE_CLERK_PUBLISHABLE_KEY`.
  2. Add a backend auth config preflight command, for example `npm run api:auth:smoke`, that prints
     only redacted presence checks for `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `AUTH_DISABLED` and
     `CLERK_AUTHORIZED_PARTIES`.
  3. Add a startup or `/readyz` diagnostic that reports an actionable redacted message when auth is
     enabled but no backend Clerk key is configured.
  4. Update README setup with explicit restart guidance: after editing `apps/api/.env`, restart the
     FastAPI process because settings are read at import time.
  5. Update env docs to clarify that `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not consumed by this
     Vite app; use `VITE_CLERK_PUBLISHABLE_KEY` for the frontend.
  6. Keep secrets out of docs and logs; never print actual `CLERK_SECRET_KEY`, `CLERK_JWT_KEY` or
     publishable key values.
- Acceptance criteria:
  - In real Clerk mode, a fresh backend process reports backend Clerk auth configured without
    exposing the key.
  - Authenticated API calls no longer return `Clerk backend authentication is not configured.`
    after the backend is restarted with the updated env.
  - In fast dev mode, `AUTH_DISABLED=true` produces the deterministic test user path.
  - Missing Clerk backend key produces a clear setup/preflight failure, not a confusing runtime
    blocker during the product flow.
  - `.env.example`, root `.env.local` guidance and README explain the required variables without
    containing real secrets.
- Dependencies: TASK-132, TASK-152
- Verification: Run `npm run api:auth:smoke`, backend auth/config tests, `npm run test:api-mock`,
  and one local authenticated API smoke after restarting the backend.
- Current notes: 2026-06-07 config smoke confirms a new backend Python process sees
  `CLERK_SECRET_KEY=<set>` and `AUTH_DISABLED=False`; if the running server still returns 503,
  restart it or confirm it is launched from this repository with `apps/api/.env` visible.

## Artifact Tree And Real Data UI Review

Review snapshot:
[2026-06-07 artifact tree and real data UI review](./reviews/2026-06-07-artifact-tree-real-data-ui-review.md).

### Now

#### TASK-170 - Add owned project artifact-tree read contract
- Priority: P1
- Status: Done
- Module: backend-persistence
- Problem: The frontend can only list one persistence level at a time, so a complete project tree
  would require N+1 requests for features, use cases, diagrams, and BRD existence.
- Why it matters: The left tree needs one consistent snapshot of real resource identities without
  downloading every Diagram graph and BRD body.
- Implementation steps:
  1. Add Pydantic summary schemas for project/spec, feature, use case, optional diagram, and optional
     BRD tree nodes.
  2. Add `GET /api/projects/{project_id}/artifact-tree` protected by the existing ownership rules.
  3. Query the project hierarchy with bounded eager loading and deterministic feature/use-case
     ordering.
  4. Return IDs, titles, review/outdated status, timestamps, and child existence only; exclude
     `graph_data`, `lanes_data`, `structured_spec`, and `markdown_content`.
  5. Add service, serializer, ownership, empty-project, partial-chain, and full-chain tests.
- Acceptance criteria:
  - One authenticated request returns the complete metadata hierarchy for an owned project.
  - Cross-user and unknown project requests return the same safe not-found response.
  - Response size does not include Diagram graph or BRD document bodies.
  - Empty and partially generated projects produce valid tree structures.
- Dependencies: TASK-133, TASK-137, TASK-139, TASK-141, TASK-143
- Verification: Run backend persistence/auth tests and inspect query count for a project with
  multiple features and use cases.
- Completion notes: Added the owned, eagerly loaded metadata-only tree endpoint plus full, partial,
  empty, and cross-user auth coverage. Graph and BRD bodies are excluded from the response.

#### TASK-171 - Define canonical artifact selection and deep-link routes
- Priority: P1
- Status: Done
- Module: frontend-routing
- Problem: Current navigation stores only `spec | features | editor` plus one feature ID, so Use
  Case, Diagram, and BRD nodes cannot be addressed or refreshed independently.
- Why it matters: A tree without a canonical selected-artifact identity will drift from the URL and
  can reopen the wrong editor after refresh or browser navigation.
- Implementation steps:
  1. Introduce a discriminated `ActiveArtifact` model for project spec, feature, use case, diagram,
     and BRD selections.
  2. Define nested project routes that preserve project, feature, and use-case ancestry.
  3. Parse the route against the artifact-tree response before mounting an editor.
  4. Preserve safe invalid-route behavior without revealing cross-project ownership.
  5. Support browser back/forward and direct refresh for every artifact type.
- Acceptance criteria:
  - Every selectable tree node has a stable URL.
  - Refresh and browser history restore the same artifact.
  - Invalid or stale artifact URLs do not silently select another artifact.
  - Selection state has one source of truth shared by router and tree.
- Dependencies: TASK-156, TASK-161, TASK-165, TASK-170
- Verification: Router/component matrix for each artifact type, invalid ancestry, refresh, back, and
  forward.
- Completion notes: Added the `ActiveArtifact` route model and stable routes for Spec, Feature,
  Use Case portfolio, Use Case, Diagram, and BRD with explicit invalid-route handling.

#### TASK-172 - Build the accessible left artifact tree shell
- Priority: P1
- Status: Done
- Module: frontend-workspace-shell
- Problem: The workspace uses top tabs and a separate feature list instead of one hierarchy matching
  the persisted artifact chain.
- Why it matters: Users cannot understand or navigate the project as
  Project Spec -> Feature -> Use Case -> Diagram -> BRD.
- Implementation steps:
  1. Extract an `ArtifactTree` component driven only by the tree read model and active route.
  2. Render Project Spec, Features, Feature Intent, Use Cases, Diagram, and BRD with clear nesting,
     active state, expand/collapse, status badges, and create affordances.
  3. Replace `.workspace-tabs` and `.feature-list` with a two-column workspace shell.
  4. Implement keyboard navigation and semantic tree/treeitem states.
  5. Add a collapsible drawer behavior for narrow screens while keeping the active artifact visible.
- Acceptance criteria:
  - The left sidebar presents the complete real project hierarchy.
  - Tabs and the duplicate feature navigation are removed.
  - Tree selection is keyboard usable and visibly focused.
  - Mobile users can open, select, and collapse the tree.
- Dependencies: TASK-170, TASK-171
- Verification: Component tests, accessibility assertions, responsive Browser smoke, and screenshot
  comparison for empty/partial/full trees.
- Completion notes: Replaced tabs/feature navigation with the collapsible artifact tree, semantic
  tree roles, active/focus states, create affordance, mobile layout, and arrow/Home/End navigation.

#### TASK-173 - Connect Project Spec and Feature editors to tree selection
- Priority: P1
- Status: Done
- Module: frontend-project-feature
- Problem: Project Spec and Feature editors are currently mounted through local tabs and feature
  draft state that assumes a single active feature workflow.
- Why it matters: The first usable tree increment must edit and save real Project/Spec/Feature data
  without retaining the old tab navigation.
- Implementation steps:
  1. Render Project Spec content when the Project Spec node is active.
  2. Render the selected Feature Intent editor from its resource UUID.
  3. Keep create/save/delete operations using existing persistence APIs and latest-state semantics.
  4. Refresh or patch tree metadata after feature create, rename, save, and delete.
  5. Preserve Project/Spec/Feature dirty state and invalid-route handling.
- Acceptance criteria:
  - Selecting Project Spec or any Feature opens the correct real editor.
  - Feature create/rename/delete updates the tree without stale labels or IDs.
  - No top-tab or hidden feature-list state is required.
  - Existing Save behavior and unsaved warnings still work.
- Dependencies: TASK-172
- Verification: ProjectWorkspace integration tests for select, create, save, rename, delete, reload,
  and dirty cancel/continue.
- Completion notes: Project Spec and Feature Intent now render by route identity, retain explicit
  Save/delete behavior, and patch or reload tree metadata after mutations.

### Next

#### TASK-174 - Connect Use Case, Diagram, and BRD nodes to persisted editors
- Priority: P1
- Status: Done
- Module: frontend-artifact-editors
- Problem: Use Case, Diagram, and BRD are currently reached through controls inside the editor
  monolith rather than selected directly from the project hierarchy.
- Why it matters: The requested tree is incomplete unless each real child artifact opens its own
  persisted context and correct resource UUID.
- Implementation steps:
  1. Focus the selected persisted Use Case in `UseCasePanel` by resource UUID.
  2. Load a Diagram only after its tree node is selected; preserve the previous canvas until load
     succeeds.
  3. Load a BRD only after its tree node is selected and keep scoped recovery behavior.
  4. Add explicit tree actions for generating a missing Diagram and generating a missing BRD.
  5. Refresh diagram/BRD identity, outdated state, and timestamps in the tree after generate, save,
     or delete.
  6. Extract orchestration from `App.tsx` where needed so tree selection does not depend on opening
     nested panels manually.
- Acceptance criteria:
  - Selecting a Use Case, Diagram, or BRD opens exactly that persisted artifact.
  - Heavy Diagram/BRD payloads are lazy-loaded.
  - Missing children expose valid CTAs and never display another artifact.
  - Save/delete/generate operations update the selected node and tree metadata.
- Dependencies: TASK-173, TASK-166, TASK-167
- Verification: Component tests plus mocked API scenarios for partial and full artifact chains.
- Completion notes: Use Case, Diagram, and BRD routes now focus/load real persisted resources.
  Diagram/BRD payloads remain lazy, save operations refresh the tree, and direct BRD deep-links
  hydrate the saved Diagram before generation.

#### TASK-175 - Remove runtime sample data and user-visible demo behavior
- Priority: P1
- Status: Done
- Module: editor-runtime
- Problem: `App` always renders `buildInitialData()`, initializes sample Project Spec/Feature Intent,
  exposes `Reset mẫu`, and is reachable at `/demo` in development.
- Why it matters: Sample content can be mistaken for persisted project data and violates the rule
  that the product only displays real data.
- Implementation steps:
  1. Replace `buildInitialData()` runtime bootstrap with an explicit blank graph state.
  2. Remove `buildDefaultProjectSpec()` and `buildDefaultFeatureIntent()` from normal runtime state.
  3. Remove the `Reset mẫu` toolbar action and sample-specific status copy.
  4. Remove the user-visible `/demo` route.
  5. Move any fire-incident graph needed by tests into a test-only fixture module that production
     code cannot import.
  6. Keep reusable lane builders separate from sample fixtures.
- Acceptance criteria:
  - Opening any normal route never renders hardcoded sample labels or graph nodes.
  - A project with no Diagram shows no Diagram data.
  - Production/runtime source has no sample reset action or default domain content.
  - Test fixtures remain available only through the test environment.
- Dependencies: TASK-174
- Verification: Search runtime source for removed sample labels, run production build, and Browser
  smoke a new project plus a project with a saved Diagram.
- Completion notes: Normal runtime starts empty, `/demo` and `Reset mẫu` are removed, and the fire
  graph/default inputs moved into test-only fixtures injected through a gated test harness.

#### TASK-176 - Add truthful persisted loading, empty, and error states
- Priority: P2
- Status: Done
- Module: frontend-state-ux
- Problem: The sample graph currently masks the distinction between “not created”, “loading”,
  “load failed”, and “loaded empty”.
- Why it matters: After sample removal, users need explicit feedback and valid next actions for each
  resource state.
- Implementation steps:
  1. Define per-artifact states for loading, absent, ready, outdated, failed, and dirty.
  2. Add empty states for no features, no use cases, no Diagram, and no BRD.
  3. Map each empty state to the correct create/generate CTA and prerequisite explanation.
  4. Keep failed lazy loads retryable without replacing the previous selected content.
  5. Ensure tree badges and content status are derived from the same state.
- Acceptance criteria:
  - Missing data is never represented by fixture or data from another resource.
  - Every absent artifact has a clear, valid next action.
  - Loading and failure states are distinguishable and retryable.
  - Tree and content panel show consistent status.
- Dependencies: TASK-174, TASK-175
- Verification: State matrix tests and Browser smoke with mocked slow, absent, failed, outdated, and
  successful responses.
- Completion notes: Added project/artifact loading and error states plus truthful missing
  Feature/Use Case/Diagram/BRD labels and CTAs derived from persisted metadata.

#### TASK-177 - Route all tree transitions through scoped dirty guards
- Priority: P1
- Status: Done
- Module: save-ux-integration
- Problem: Existing dirty guards are attached to feature and diagram-specific handlers; a new tree
  introduces additional transitions that could bypass them.
- Why it matters: Clicking another Project Spec, Feature, Use Case, Diagram, or BRD node must not
  silently discard unsaved work.
- Implementation steps:
  1. Centralize tree selection in one guarded transition function.
  2. Resolve which Save scopes are being left before changing URL or editor context.
  3. On cancel, keep the current route, active tree node, and loaded editor unchanged.
  4. On confirmed discard, clear only scopes owned by the abandoned context.
  5. On successful save/delete/generate, patch or reload the tree without clearing unrelated dirty
     scopes.
  6. Preserve `beforeunload` and project-exit aggregate warnings.
- Acceptance criteria:
  - Every tree-node switch respects the relevant dirty scopes.
  - Cancel is transactional and does not partially update URL or content.
  - Confirmed discard clears only abandoned scopes.
  - Mutations do not erase unrelated dirty state.
- Dependencies: TASK-159, TASK-160, TASK-164, TASK-166, TASK-171, TASK-174
- Verification: Transition matrix covering each artifact pair, cancel/continue/save, failed load,
  delete cascade, browser back, and project exit.
- Completion notes: Tree selection now uses one guarded transition, preserves same-Use-Case Diagram
  context for Diagram-to-BRD navigation, resets abandoned scopes, and retains aggregate unload/exit
  protection.

### Later

#### TASK-178 - Migrate regression coverage away from sample runtime
- Priority: P2
- Status: Done
- Module: frontend-e2e-docs
- Problem: The main Playwright editor suite depends on `/demo`, hardcoded fire labels, and
  `Reset mẫu`.
- Why it matters: Removing the sample path must not reduce canvas, generation, import/export, Save,
  or BRD regression coverage.
- Implementation steps:
  1. Replace `/demo` scenarios with authenticated mocked persisted project fixtures or an explicit
     test-only harness unavailable in normal development/production.
  2. Move sample graphs into E2E/unit fixture files and inject them through test setup.
  3. Add scenarios for empty project, partial chain, full chain, invalid deep-link, and lazy load.
  4. Add a negative assertion that normal project routes never show known sample labels.
  5. Update stale use-case/architecture/roadmap references that describe sample startup or
     `Reset mẫu` as product behavior.
  6. Run the full UI, E2E, and production build suites.
- Acceptance criteria:
  - Existing editor capabilities retain automated coverage without a user-visible sample route.
  - Normal runtime has a regression proving no sample data leakage.
  - Documentation describes persisted artifact-tree behavior as canonical.
- Dependencies: TASK-170 through TASK-177
- Verification: Run `npm run test:ui-mock`, `npm run test:e2e-mock`, `npm run build`, and inspect the
  production route table.
- Completion notes: Existing editor E2E now runs through a test-only harness; a new full persisted
  Project-to-BRD E2E proves real-data navigation and negative sample leakage. Canonical runtime docs
  no longer instruct users to open/reset sample data.

## Feature Intent to Use Case Sidebar Flow Update

Review snapshot:
[2026-06-07 Feature Intent to Use Case sidebar flow review](./reviews/2026-06-07-feature-intent-usecase-sidebar-flow-review.md).

## Module Directions

### frontend-workspace-shell

- Current state: The left artifact tree and deep-links exist, but Use Case routes still mount the
  canvas app and open the old use-case workspace overlay.
- Main risks:
  - Route identity says "Use Case" while the visible UX still behaves like one diagram editor with a
    side panel.
  - Generated use cases may not appear in the left tree until a separate save/refresh path runs.
- Recommended direction: Refactor in place.
- Why now: The database-backed artifact tree is already implemented; the remaining work is to make it
  the primary UX for Feature Intent -> Use Case -> Diagram.

### usecase-generation-ux

- Current state: Use case generation works, but persisted mode still stages generated drafts inside
  `App`/`UseCasePanel` before they become sidebar resources.
- Main risks:
  - User expectation after filling Feature Intent is immediate sidebar inventory; current state can
    leave results hidden in a panel.
  - Regenerate/replace semantics can drift between local drafts, saved use cases, and tree metadata.
- Recommended direction: Redesign interface.
- Why now: The new requested flow depends on generated use cases becoming navigable database
  artifacts, not only local editor cards.

### usecase-editor-surface

- Current state: The structured editor is useful but list-oriented and overlay-mounted.
- Main risks:
  - Editing one use case lacks a clean resource page, save boundary, and diagram action placement.
  - Focused use-case routing still renders the whole list.
- Recommended direction: Split responsibilities.
- Why now: The field editors can be reused, but list, single-use-case editor, and diagram inventory
  should have separate ownership.

### diagram-handoff

- Current state: Per-use-case diagram generation and persistence APIs exist, but the main CTA is
  buried in the old panel's diagram inventory.
- Main risks:
  - Users have to understand an extra workspace section before creating the requested diagram.
  - Missing Diagram tree nodes do not yet behave like first-class generate surfaces.
- Recommended direction: Refactor in place.
- Why now: The backend contract is already available; the work is mostly orchestration and CTA
  placement.

## Prioritized Tasks

### Now

#### TASK-179 - Persist generated use cases and refresh the left tree immediately
- Priority: P1
- Status: Done
- Module: usecase-generation-ux
- Problem: In persisted mode, `handleGenerateUseCases` stores generated drafts in local `App` state
  and marks the use-case scope dirty; the left artifact tree only renders persisted
  `tree.features[].use_cases`.
- Why it matters: The requested UX is that after the user fills Feature Intent, AI creates the use
  case list and the list appears in the left bar. A hidden local draft list keeps the product feeling
  like the old no-database diagram screen.
- Implementation steps:
  1. Decide the persisted-mode generate contract: either `Sinh use case` creates/replaces persisted
     `UseCase` rows in one confirmed action, or it is renamed to `Sinh và lưu use cases` so the
     persistence side effect is explicit.
  2. Update the frontend generate path to call the generate API, canonicalize results, then save the
     generated list through `saveUseCases` before presenting them as navigable resources.
  3. Preserve the existing replace confirmation when current saved/staged use cases or diagrams would
     be affected.
  4. After save succeeds, refresh or patch the artifact tree and route to the `Use Cases` node or the
     first generated Use Case.
  5. Keep standalone/test-harness generation behavior separate so non-persisted tests can still stage
     local drafts.
  6. Surface partial failures clearly: generation failure must not alter saved use cases; save failure
     must keep generated drafts visible with a retry-to-save action.
- Acceptance criteria:
  - From a saved Feature Intent, clicking the generate action creates visible Use Case nodes in the
    left sidebar without requiring a separate hidden panel save.
  - The tree count, labels, review status, and active route reflect the newly generated list.
  - Canceling a replace prompt leaves existing saved use cases and diagrams unchanged.
  - Failed generate/save paths do not silently drop prior saved use cases.
- Dependencies: TASK-170, TASK-171, TASK-172, TASK-173
- Verification: Add a `ProjectWorkspace` integration test for generate -> persisted save -> tree
  refresh, plus a failure test for generate success/save failure. Run `npm run test:ui-mock`.
- Completion notes: `PersistedUseCaseWorkspace` now generates, canonicalizes, saves, and refreshes
  the artifact tree in one persisted action; save failures keep generated drafts visible with retry
  affordance instead of dropping the result.

#### TASK-180 - Split Use Case list and single Use Case editor out of the canvas overlay
- Priority: P1
- Status: Done
- Module: usecase-editor-surface
- Problem: `ProjectWorkspace` mounts `App` for Use Case routes, and `App` responds by opening
  `UseCasePanel`; selecting one Use Case still renders the whole card list inside an overlay.
- Why it matters: Use Cases are now database artifacts in the left bar. They need first-class content
  pages, not a modal/panel nested inside the diagram editor.
- Implementation steps:
  1. Extract reusable structured editor pieces from `UseCasePanel` into route-friendly components,
     for example `UseCaseListView`, `UseCaseEditor`, and shared flow field groups.
  2. Render `UseCaseListView` directly in `ProjectWorkspace` for the `use-cases` route, driven by
     `useCaseResources`.
  3. Render `UseCaseEditor` directly in `ProjectWorkspace` for the `use-case` route, selecting by
     resource UUID and editing only that use case.
  4. Keep per-use-case dirty tracking with the existing save-state registry; avoid one dirty flag for
     the whole list when only one use case is being edited.
  5. Preserve review lifecycle rules: editing approved business content moves the item back to
     `reviewed`, contract errors block approval, and delete warns about Diagram/BRD cascade.
  6. Remove `Use Case` route dependence on `useCasePanelOpen`; keep `UseCasePanel` only for
     standalone/test-harness or delete it after replacement if no runtime path needs it.
- Acceptance criteria:
  - Selecting the `Use Cases` tree node shows a list page in the main content area.
  - Selecting a single Use Case tree node shows only that Use Case editor.
  - The diagram canvas is not mounted for Use Case list/editor routes.
  - Save, approval, delete, and dirty-cancel behavior still work by persisted resource identity.
- Dependencies: TASK-179
- Verification: Add route/component tests for `use-cases` and `use-case` selections, focused editing,
  dirty cancel/continue, approve, delete, and invalid resource ID. Run `npm run test:ui-mock`.
- Completion notes: persisted `use-cases` and `use-case` routes now render
  `PersistedUseCaseWorkspace` directly in `ProjectWorkspace`, while the canvas app stays mounted only
  for Diagram/BRD routes.

#### TASK-181 - Put `Tạo diagram` on each approved Use Case and missing Diagram route
- Priority: P1
- Status: Done
- Module: diagram-handoff
- Problem: Per-use-case diagram generation exists, but its primary CTA is in the old use-case panel's
  diagram inventory rather than on the selected Use Case and missing Diagram content surfaces.
- Why it matters: The new flow is "edit each use case, then click a button to create its diagram."
  Users should not have to open a separate diagram inventory panel to find that action.
- Implementation steps:
  1. Add a primary `Tạo diagram` action to the single `UseCaseEditor` when the use case is saved,
     approved, valid, and has no current diagram.
  2. Add `Mở diagram`, `Tạo lại diagram`, and outdated/diverged handling based on the same lifecycle
     rules currently used by `buildDiagramInventory`.
  3. For the `diagram` route with no saved diagram, render a missing-state page with the same
     prerequisite-aware `Tạo diagram` action instead of trying to open a blank/sample canvas.
  4. After generation succeeds, save or mark the diagram consistently, refresh the artifact tree, and
     navigate to the created Diagram node.
  5. Keep dirty-scope prompts before replacing an active canvas or regenerating over semantic edits.
- Acceptance criteria:
  - An approved Use Case page exposes `Tạo diagram` without opening the old panel.
  - A non-approved or invalid Use Case explains the missing prerequisite and disables generation.
  - A generated diagram appears under the correct Use Case in the left tree and opens on the canvas.
  - Regenerate paths preserve the existing confirm behavior for outdated/diverged diagrams.
- Dependencies: TASK-180, TASK-166, TASK-177
- Verification: Add tests for approved/not-approved/invalid/missing-diagram/generated-diagram states
  and tree refresh after generation. Run `npm run test:ui-mock` and the relevant E2E scenario.
- Completion notes: approved Use Case pages and missing-Diagram states now expose the persisted
  `Tạo diagram` handoff, save the generated graph immediately, refresh the tree, and navigate to the
  created Diagram node.

### Next

#### TASK-182 - Remove the old "Không gian use case" as the primary persisted workflow
- Priority: P2
- Status: Done
- Module: frontend-workspace-shell
- Problem: The toolbar still presents `Không gian use case` from the canvas app, which reinforces the
  old single-screen workflow even after the left tree exists.
- Why it matters: As long as the old panel remains the main call to action, users can bypass the
  intended database-backed artifact flow.
- Implementation steps:
  1. Remove or demote the canvas toolbar `Không gian use case` button in persisted workspace mode.
  2. Replace it with contextual navigation actions: go to Feature Intent, go to Use Cases, or go to
     active Use Case depending on the selected artifact.
  3. Keep the button only in standalone/test-harness mode if those flows still need it.
  4. Audit status copy and empty states for wording that describes a separate use-case workspace.
  5. Ensure Project Spec, Feature Intent, Use Case, Diagram, and BRD all have tree-first navigation
     paths with no hidden required panel.
- Acceptance criteria:
  - Persisted users can complete Feature Intent -> Use Cases -> Diagram without opening
    `UseCasePanel`.
  - No primary toolbar action points to the deprecated use-case workspace in persisted mode.
  - Standalone/test-only behavior remains isolated and clearly gated.
- Dependencies: TASK-180, TASK-181
- Verification: Browser smoke the persisted flow and search runtime copy for `Không gian use case`
  usages that remain user-facing.
- Completion notes: persisted workspace mode no longer surfaces the old toolbar entry as a primary
  action; navigation now routes through Feature Intent, Use Cases, and each Use Case artifact.

#### TASK-183 - Lock the new Feature Intent -> Use Case -> Diagram flow with tests and docs
- Priority: P2
- Status: Done
- Module: regression-docs
- Problem: The documentation and tests still include wording and scenarios from the old
  `UseCasePanel` workspace, including local draft and Phase 1 no-persistence assumptions.
- Why it matters: Without tests and canonical workflow docs, future changes can drift back toward
  the old "one diagram canvas plus side panel" UX.
- Implementation steps:
  1. Finalize `docs/use-cases/UC-07-sinh-usecase-tu-spec.md` after implementation so button labels,
     route behavior, and persisted Use Case resources match the shipped flow exactly.
  2. Update `docs/scope/artifact-chain.md` only if the artifact chain or persistence rules change
     beyond the current latest-state model.
  3. Add or update E2E coverage for saved Feature Intent -> generate persisted Use Cases -> left-tree
     selection -> edit one Use Case -> approve -> generate Diagram -> route to Diagram.
  4. Add negative coverage that normal persisted routes do not require `UseCasePanel` to be open.
  5. Update `README.md` workflow steps if button labels or route behavior change.
- Acceptance criteria:
  - UC-07 describes the same flow users see in the product.
  - Automated coverage fails if generated Use Cases do not appear in the left tree.
  - Automated coverage fails if Use Case routes mount the canvas as the primary editor.
  - README local test instructions remain accurate.
- Dependencies: TASK-179, TASK-180, TASK-181, TASK-182
- Verification: Run `npm run test:ui-mock`, `npm run test:e2e-mock`, and `npm run build`.
- Completion notes: route/component regressions, the persisted artifact-tree E2E, README, and UC-07
  now describe and enforce the shipped Feature Intent -> Use Case -> Diagram workflow.

## Post-Implementation Follow-up

Review snapshot:
[2026-06-07 TASK-179 to TASK-183 implementation review](./reviews/2026-06-07-task-179-183-implementation-review.md).

### Now

#### TASK-184 - Make persisted use-case bulk save honor replace semantics
- Priority: P1
- Status: Done
- Module: backend-bulk-save
- Problem: The persisted generate flow warns that it will replace the current Use Case list, but the
  backend `save_owned_use_cases` path only upserts submitted rows and never deletes or retires
  omitted Use Cases.
- Why it matters: Regenerating with fewer or different `use_case_id`s leaves stale Use Cases,
  Diagrams, and BRDs in the database and left tree, so TASK-179's "tree reflects the generated list"
  contract is false after the first replacement scenario.
- Implementation steps:
  1. Decide the canonical behavior for omitted persisted Use Cases during regenerate: hard delete,
     soft supersede, or explicit outdated archive.
  2. Encode that behavior in `save_owned_use_cases` as one transactional operation rather than
     frontend-only copy.
  3. Update the artifact tree serializer so replaced or retired children surface the intended state.
  4. Align the replace confirmation copy in the frontend with the real backend behavior.
  5. Add backend and UI coverage for regenerate-from-2-to-1 and rename/rekey scenarios.
- Acceptance criteria:
  - Regenerating a persisted Use Case list does not leave hidden stale rows that reappear after tree
    refresh.
  - The left tree matches the canonical post-regenerate backend state.
  - Diagram/BRD descendants of omitted Use Cases follow the documented retention or deletion policy.
- Dependencies: TASK-179
- Verification: Add a backend test for omitted-row handling and a persisted workspace/E2E scenario
  that regenerates from an existing list to a smaller replacement set.
- Completion notes:
  - `save_owned_use_cases` now treats the payload as the canonical replacement set, deletes omitted
    persisted Use Cases transactionally, and updates `use_case_key` on retained rows.
  - Added backend coverage for omit-and-delete descendants plus retained-row rekey behavior.

#### TASK-185 - Add retry-to-save recovery for generate success / persist failure
- Priority: P1
- Status: Done
- Module: persisted-usecase-surface
- Problem: When `generateUseCases` succeeds and `saveUseCases` fails, the page keeps the drafts
  visible but offers no direct retry-to-save action, despite the TASK-179 completion notes claiming
  a retry affordance.
- Why it matters: On a first-time generate failure, the user cannot persist the current drafts
  without re-running generation and changing the content they were about to review.
- Implementation steps:
  1. Keep the latest generated drafts and generation metadata in stable local state after save
     failure.
  2. Add a dedicated `Lưu danh sách` / `Thử lưu lại` action that retries `saveUseCases` with the
     existing drafts instead of calling generate again.
  3. Make the failure state explicit when no persisted resources exist yet.
  4. Add a regression for first-time generate success followed by save failure and successful retry.
- Acceptance criteria:
  - Users can retry persistence without regenerating content.
  - The retry path works when zero persisted Use Cases currently exist.
  - Success after retry refreshes the tree and enables normal `Sửa Use Case` navigation.
- Dependencies: TASK-179
- Verification: Run targeted UI tests for generate-success/save-failure/retry and the persisted E2E
  happy path.
- Completion notes:
  - Generated drafts now stay in stable local state after save failure.
  - The list route exposes `Lưu danh sách` / `Thử lưu lại` so the user can persist the current
    drafts without re-running AI generation.

#### TASK-186 - Unify persisted diagram CTA logic with the canonical lifecycle model
- Priority: P1
- Status: Done
- Module: frontend-workspace-shell
- Problem: `PersistedUseCaseWorkspace` derives diagram actions from `diagramExists` and
  `is_outdated` only, so it ignores `diverged` and does not share one lifecycle source of truth with
  the older diagram inventory logic.
- Why it matters: The new persisted surface is now the primary flow. Missing `diverged` handling and
  ambiguous post-generate routing create UX drift exactly where users move from Use Case to Diagram.
- Implementation steps:
  1. Reuse or extract the lifecycle decision logic so persisted editor and standalone inventory derive
     the same CTA set from the same status model.
  2. Include `diverged` in regenerate eligibility and preserve confirm behavior for both `outdated`
     and `diverged`.
  3. Decide whether `Tạo diagram` should auto-open the canvas or stay on the Use Case page with an
     explicit `Mở diagram` step, then align docs and tests to that one contract.
  4. Add browser coverage for `ready`, `outdated`, and `diverged` persisted states.
- Acceptance criteria:
  - Persisted editor CTAs match the documented lifecycle for `ready`, `outdated`, and `diverged`.
  - The shipped post-generate route behavior is explicit and proven by E2E.
  - Users do not lose access to regenerate after semantic diagram edits.
- Dependencies: TASK-181
- Verification: Run `npm run test:ui-mock`, a browser scenario covering diverged regenerate, and the
  persisted artifact-tree E2E.
- Completion notes:
  - Persisted editor CTAs now derive from the shared lifecycle model, including `diverged`.
  - Shipped contract is explicit: `Tạo diagram` saves the downstream artifact and keeps the user on
    the Use Case page, where `Mở diagram` appears as the next step.

### Next

#### TASK-187 - Make artifact-tree E2E assertions artifact-specific instead of positional
- Priority: P2
- Status: Done
- Module: regression-docs
- Problem: `e2e/artifact-tree.spec.ts` still uses positional `.last()` selection for BRD nodes, so
  the test can attach to the wrong Use Case subtree when multiple BRD placeholders are visible.
- Why it matters: TASK-183 is supposed to lock the new flow, but flaky selectors weaken CI signal and
  obscure whether a failure is a product bug or a test bug.
- Implementation steps:
  1. Scope BRD assertions to the specific generated Use Case subtree or persisted route under test.
  2. Replace broad `.filter({ hasText: 'BRD' }).last()` style selectors with stable role/name or
     subtree locators.
  3. Keep the test validating the real persisted chain, not a simplified one-item tree.
  4. Re-run the spec multiple times locally to check for ordering-related flakes.
- Acceptance criteria:
  - The artifact-tree E2E identifies the BRD node created by the scenario, not any BRD node in the
    tree.
  - Repeated local runs do not fail because of tree ordering.
- Dependencies: TASK-183
- Verification: Run `npm run test:e2e-mock -- e2e/artifact-tree.spec.ts` multiple times and confirm
  stable pass behavior.
- Completion notes:
  - The persisted full-chain E2E now scopes Diagram/BRD assertions to the selected Use Case subtree
    instead of positional `.last()` locators.

## Use Case Presentation Review

Review snapshot:
[2026-06-07 persisted Use Case presentation review](./reviews/2026-06-07-usecase-presentation-review.md).

### Now

#### TASK-188 - Redesign the persisted Use Case route as a read-first artifact page
- Priority: P1
- Status: Done
- Module: persisted-usecase-route
- Problem: The persisted `use-case` route renders nearly the entire structured model as one long raw
  form stack, so AI-generated Use Cases are hard to scan before the user even decides what to edit.
- Why it matters: This route is now the primary review surface after AI generation. If it looks like
  a raw payload editor, the whole Feature Intent -> Use Case flow feels noisy and low-confidence.
- Implementation steps:
  1. Split the page into read-first sections: overview, actors, objective/preconditions, main flow,
     alternate flows, success outcome, and next actions.
  2. Make the default state optimized for reading, with summary rows and collapsed detail blocks
     instead of every field being fully open at once.
  3. Keep edit affordances local to each section so the user can focus on one slice at a time.
  4. Preserve existing review/approval/generate behavior while changing only the presentation model.
- Acceptance criteria:
  - A newly generated Use Case is readable at a glance without opening every nested field.
  - The page clearly separates artifact content from edit controls.
  - Users can still edit every required field without losing structured fidelity.
- Dependencies: TASK-180, TASK-181
- Verification: Browser-check the route with realistic AI-generated content on desktop and mobile,
  then run `npm run test:ui-mock`.
- Completion notes:
  - The route now presents sections for actors, general information, main flow, alternate flows,
    and next actions before exposing edit controls.

#### TASK-189 - Create dedicated layout primitives for persisted Use Case steps and sections
- Priority: P1
- Status: Done
- Module: shared-usecase-card-styles
- Problem: The persisted editor reuses generic `usecase-card` styles that were not designed for a
  full-page structured editor, so headings, metadata, controls, and step content have weak visual
  hierarchy.
- Why it matters: The current layout makes every row feel equally important, which is why the page
  looks cramped and hard to parse in real AI output.
- Implementation steps:
  1. Introduce a persisted-editor-specific style namespace rather than extending shared
     `usecase-card` classes indefinitely.
  2. Give the page a stable section grid and dedicated artifact title styling.
  3. Turn each main/alternate step into a two-zone layout: content body plus compact action rail.
  4. Define consistent widths, spacing, textarea sizing, and control alignment for long Vietnamese
     text.
  5. Keep legacy `UseCasePanel` visuals isolated so this redesign does not accidentally regress the
     standalone workspace.
- Acceptance criteria:
  - Step rows read as structured content first and controls second.
  - Title, metadata, and section headings have clear hierarchy.
  - Long generated text does not visually collide with labels or action buttons.
- Dependencies: TASK-188
- Verification: Review the route at multiple viewport widths and run targeted visual/browser smoke.
- Completion notes:
  - Added a dedicated `persisted-usecase__*` style namespace and moved the full-page editor away
    from generic `usecase-card` layout assumptions.

### Next

#### TASK-190 - Add progressive disclosure and compact summaries for main and alternate flows
- Priority: P2
- Status: Done
- Module: persisted-usecase-route
- Problem: Every main-flow and alternate-flow item currently opens as a full editor block, even when
  the user only needs to review or compare steps.
- Why it matters: The step list is the densest part of the page and currently creates the strongest
  sense of clutter.
- Implementation steps:
  1. Render each step with a compact summary line by default.
  2. Move low-frequency fields such as `input_or_trigger` and `expected_result` behind expandable
     detail panels.
  3. Let users expand only the steps they are editing while preserving order and drag/reorder
     controls.
  4. Apply the same pattern to alternate flows and branch steps.
- Acceptance criteria:
  - The step list is scannable without expanding every item.
  - Secondary fields remain accessible but do not dominate the default page.
  - Editing one step does not visually explode the whole screen.
- Dependencies: TASK-188, TASK-189
- Verification: Browser smoke with a Use Case that has 4+ main steps and multiple alternate flows.
- Completion notes:
  - Main steps, alternate flows, and branch steps now default to compact summary rows with local
    expand-to-edit panels for secondary fields.

#### TASK-191 - Add visual regression checks for the persisted Use Case route
- Priority: P2
- Status: Done
- Module: regression-layer
- Problem: Current tests validate behavior only; they do not protect against the visual clutter the
  user is reporting.
- Why it matters: Once the route is redesigned, the team needs a guardrail to stop future CSS or
  markup changes from collapsing hierarchy again.
- Implementation steps:
  1. Add a browser test fixture that opens a realistic persisted Use Case with long AI-generated text.
  2. Assert key layout properties such as visible section headings, non-overlapping controls, and
     stable action placement across desktop and mobile.
  3. Capture screenshots or use structured layout assertions for the overview and step sections.
  4. Keep the fixture deterministic so CI failures are actionable.
- Acceptance criteria:
  - The persisted Use Case route has automated coverage for readability-critical layout.
  - Desktop and mobile regressions fail the suite when hierarchy collapses or controls overlap.
- Dependencies: TASK-188, TASK-189, TASK-190
- Verification: Run the targeted Playwright scenario and confirm failures when layout constraints are
  intentionally broken.
- Completion notes:
  - Added a deterministic Playwright scenario that opens a long persisted Use Case on desktop and
    mobile, verifies section visibility, and guards against step-copy/action overlap.

## TASK-184 to TASK-191 Re-review

Review snapshot:
[2026-06-08 TASK-184..191 and use-case prompt review](./reviews/2026-06-08-task-184-191-and-usecase-prompt-review.md).

### Next

#### TASK-192 - Surface the active use-case generation mode and fallback more explicitly
- Priority: P2
- Status: Done
- Module: usecase-generation-observability
- Problem: Users can still believe they are reviewing an AI-generated use case when the service has
  actually fallen back to deterministic generation or is running under a non-AI rollout mode.
- Why it matters: This ambiguity slows down debugging of prompt quality, provider health, and domain
  grounding because reviewers do not know which generation path they are evaluating.
- Implementation steps:
  1. Persist and display the latest generation source, fallback reason, provider, model, and prompt
     version in the Use Case list/editor surfaces, not only the transient post-generate toast/state.
  2. Add a visible hint when the current rollout mode is `deterministic` or when the latest result
     is `deterministic_fallback`.
  3. Document the recommended `apps/api/.env` settings for AI-first workflows such as camera re-id.
  4. Add regression coverage for the new source/fallback visibility in the persisted route.
- Acceptance criteria:
  - A reviewer can tell from the persisted UI whether a Use Case came from AI or deterministic
    fallback without re-running generation.
  - The prompt version shown in UI matches the persisted metadata.
  - Local AI-first setup guidance is discoverable from project docs.
- Dependencies: TASK-184, TASK-185
- Verification: `npm run test:ui-mock`, `npm run test:api-mock`, and one manual generate pass that
  exercises both AI and deterministic-fallback states.
- Completion notes:
  - Persisted the latest use-case generation metadata on `Feature Intent` and surfaced it on both
    the persisted Use Case list and single-item editor routes, including source, fallback note,
    provider/model, generation mode, and prompt version when available.
