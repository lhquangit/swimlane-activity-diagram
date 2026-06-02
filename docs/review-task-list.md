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
