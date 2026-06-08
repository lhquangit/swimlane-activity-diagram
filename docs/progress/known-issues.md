# Known Issues

Format mỗi issue:

```
## [STATUS] <Tên bug> (severity: P0/P1/P2/P3)
- ID: KI-NN
- Phát hiện: YYYY-MM-DD by <ai>
- Severity: ...
- Reproduction: ...
- Root cause: ...
- Fix: ...
- Verified: <date> by <ai>
```

Severity:
- **P0**: chặn user, không có workaround.
- **P1**: ảnh hưởng lớn, có workaround.
- **P2**: khó chịu nhưng không cản trở.
- **P3**: cosmetic, edge case.

---

## [FIXED] Project Spec list textarea không giữ Space và Enter (severity: P1) {#fixed-project-spec-list-input-space-enter}

- **ID**: KI-33
- **Phát hiện**: 2026-06-07 by Codex (user report)
- **Severity**: P1 — chặn nhập tự nhiên các danh sách nhiều dòng như `Người dùng mục tiêu`; user không thể gõ tên có nhiều từ hoặc tạo dòng mới.
- **Reproduction**: Trong Project Spec, nhập vào `Người dùng mục tiêu`; dấu cách cuối từ hoặc dòng trống vừa tạo bằng Enter biến mất ngay.
- **Root cause**: `ListField` derive trực tiếp textarea value từ `string[]` và chạy `trim().filter(Boolean)` trên mỗi keystroke, làm mất whitespace tạm thời trước khi user nhập ký tự tiếp theo.
- **Fix**: Giữ raw textarea draft trong local component state, đồng thời parse danh sách normalized để cập nhật persistence draft; chỉ đồng bộ lại raw draft khi giá trị danh sách thực sự thay đổi từ bên ngoài.
- **Verified**: 2026-06-07 by Codex — ProjectWorkspace integration regression, full 74-test UI suite và production build.

---

## [OPEN] Backend trả 503 khi thiếu hoặc chưa reload Clerk backend key (severity: P1) {#open-clerk-backend-auth-not-configured}

- **ID**: KI-32
- **Phát hiện**: 2026-06-07 by Codex (user report)
- **Severity**: P1 — chặn toàn bộ authenticated API trong local/current system; có workaround bằng cách cấu hình Clerk backend key rồi restart backend, hoặc bật auth-disabled cho dev.
- **Reproduction**: Chạy backend với `AUTH_DISABLED=false` hoặc unset, gọi business API có auth dependency; response trả `503` với detail `Clerk backend authentication is not configured.`
- **Root cause**: `apps/api/app/auth.py` yêu cầu ít nhất một trong `CLERK_SECRET_KEY` hoặc `CLERK_JWT_KEY`. User đã bổ sung `CLERK_SECRET_KEY` trong `apps/api/.env`, nhưng backend process đã import settings trước đó sẽ không tự reload; frontend Vite cũng chỉ đọc `VITE_CLERK_PUBLISHABLE_KEY`, không đọc `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- **Fix**: Todo — TASK-169 thêm preflight config, docs local modes, restart guidance và test/dev guard để lỗi cấu hình được phát hiện rõ trước khi user vào flow chính.
- **Verified**: 2026-06-07 by Codex — backend config smoke thấy `CLERK_SECRET_KEY=<set>` trong process mới; runtime flow vẫn cần restart backend và auth smoke.

---

## [FIXED] Kéo shape từ vùng text chỉ di chuyển label (severity: P1) {#fixed-node-text-drag-hijacks-shape}

- **ID**: KI-29
- **Phát hiện**: 2026-06-06 by Codex (user report)
- **Severity**: P1 — vùng text chiếm phần lớn nhiều shape nên thao tác sắp xếp canvas thường xuyên kéo nhầm label thay vì kéo node.
- **Reproduction**: Đặt chuột lên text bên trong Activity, Decision hoặc Note rồi kéo; LogicFlow nhận thao tác là kéo node text độc lập, shape không di chuyển theo.
- **Root cause**: Cấu hình editor bật `nodeTextDraggable: true`, biến label của node thành một drag target riêng dù UX mong đợi toàn bộ nội dung shape là cùng một bề mặt kéo.
- **Fix**: Tắt `nodeTextDraggable` ở cấu hình LogicFlow, giữ `edgeTextDraggable` và khả năng double-click sửa text; thêm unit test cấu hình và Playwright regression kéo trực tiếp từ label.
- **Verified**: 2026-06-06 by Codex — focused Vitest, focused Playwright, production build và Browser QA kéo từ label + double-click edit text.

---

## [FIXED] Shape bị tự căn giữa lane khi kéo/thả gây chồng lấn (severity: P2) {#fixed-shape-auto-center-lane}

- **ID**: KI-30
- **Phát hiện**: 2026-06-06 by Codex (user report)
- **Severity**: P2 — làm thao tác sắp xếp canvas khó dùng vì nhiều shape trong cùng lane dễ bị dồn vào một cột và chồng lấn nhau.
- **Reproduction**: Kéo thả nhiều activity vào cùng lane ở các vị trí ngang khác nhau hoặc kéo một activity đang có sang vị trí khác trong lane; node bị đưa về giữa lane thay vì giữ vị trí người dùng chọn.
- **Root cause**: Handler `node:dnd-add` và `node:drop` tính `snappedX = lane.x` rồi `moveTo(snappedX, y)`, tức luôn ép shape về center của lane.
- **Fix**: Bind node vào lane theo boundary gần nhất nhưng giữ `x` hiện tại của người dùng; chỉ clamp khi shape vượt mép lane. Cập nhật hướng dẫn sidebar và thêm Playwright regression.
- **Verified**: 2026-06-06 by Codex — focused Playwright regression, Browser QA kéo/thả 2 activity trong cùng lane có `deltaX=151`, kéo node hiện có giữ `movedX=90`, và production build.

---

## [FIXED] Shape text không tự wrap theo giới hạn shape (severity: P2) {#fixed-shape-text-auto-wrap}

- **ID**: KI-32
- **Phát hiện**: 2026-06-06 by Codex (user report)
- **Severity**: P2 — text dài có thể tràn/khó đọc trong activity, decision, note dù shape có giới hạn kích thước rõ.
- **Reproduction**: Tạo hoặc sinh activity/note/decision có mô tả dài; text không wrap ổn định theo width shape, newline thủ công cũng dễ bị render như một dòng liền.
- **Root cause**: Các custom node chỉ set `textWidth`; chưa bật `overflowMode: autoWrap` và chưa chuẩn hóa text style cho `foreignObject` auto-wrap renderer.
- **Fix**: Bật auto-wrap cho activity/decision/note, tính wrap width theo từng loại shape, preserve newline bằng `white-space: pre-wrap`, cho phép break-word và tách text sizing helper để test.
- **Verified**: 2026-06-06 by Codex — focused Vitest, production build, và Browser QA xác nhận text dài render nhiều dòng, line-height đúng, không overflow width.

---

## [FIXED] Actor textarea không giữ dòng mới khi bấm Enter (severity: P2) {#fixed-actor-textarea-enter}

- **ID**: KI-28
- **Phát hiện**: 2026-06-06 by Codex (user report)
- **Severity**: P2 — chặn thao tác nhập nhiều actor theo đúng hướng dẫn field, nhưng có workaround bằng paste nhiều dòng.
- **Reproduction**: Mở `Không gian use case > Đầu vào`, focus `Actors / swimlanes (mỗi dòng một actor)`, nhập một actor rồi bấm Enter; textarea không giữ dòng mới nên không thể gõ actor tiếp theo theo cách tự nhiên.
- **Root cause**: Textarea dùng controlled value từ `joinLines(splitLines(value))`; dòng trống tạm thời sau phím Enter bị `splitLines()` filter mất và React render lại value cũ.
- **Fix**: Giữ raw input value riêng cho actor textarea trong khi vẫn normalize thành danh sách actor sạch cho state chính.
- **Verified**: 2026-06-06 by Codex — focused Vitest, production build, và Browser QA nhập `Ban quản lý`, Enter, `Cư dân`, Enter, `Kỹ thuật viên`.

---

## [OPEN] AI use-case grounding chấp nhận claim không được source hỗ trợ (severity: P1) {#open-ai-usecase-unsupported-claim}

- **ID**: KI-26
- **Phát hiện**: 2026-06-06 by Codex (TASK-114..123 implementation review)
- **Severity**: P1 — có thể tạo use case sai nghiệp vụ và lan lỗi sang diagram/BRD dù schema hợp lệ.
- **Reproduction**: Cho synthesized step chứa claim kiểu `Tự động phê duyệt yêu cầu dù thiết bị không còn trong kho` nhưng cite `evidence_refs=["feature.inputs.0"]`; `validate_grounding()` không báo issue và `evaluate_synthesis()` trả `passed`.
- **Root cause**: Grounding chỉ kiểm actor/evidence ref key tồn tại, chưa kiểm claim text có được source content hỗ trợ; quality gate chỉ bắt duplicate/generic/short-flow.
- **Fix**: Todo — TASK-124 thêm claim-to-evidence policy và adversarial fixtures.
- **Verified**: Pending.

---

## [OPEN] Prompt version sai làm use-case generation bypass fallback (severity: P1) {#open-usecase-prompt-version-hard-failure}

- **ID**: KI-27
- **Phát hiện**: 2026-06-06 by Codex (TASK-114..123 implementation review)
- **Severity**: P1 — một lỗi config prompt có thể làm endpoint fail cứng thay vì trả deterministic fallback.
- **Reproduction**: Khởi tạo `UseCaseGenerationService(Settings(usecase_generation_mode="ai_default", usecase_provider="mock", usecase_prompt_version="404"))` rồi gọi `generate()`; service raise `KeyError 'Unknown prompt: usecase_synthesis@404'`.
- **Root cause**: `get_prompt()` được gọi trước provider/fallback error handling trong `UseCaseGenerationService.generate()`.
- **Fix**: Todo — TASK-125 map unknown prompt/config errors thành deterministic fallback metadata.
- **Verified**: Pending.

---

## [OPEN] Persisted use-case provenance stays stale after Feature Intent edits (severity: P2) {#open-persisted-usecase-provenance-drift}

- **ID**: KI-40
- **Phát hiện**: 2026-06-08 by Codex (`TASK-192` implementation review)
- **Severity**: P2 — provenance persisted vẫn có thể mô tả input cũ, làm reviewer hiểu nhầm prompt/provider metadata đang áp vào Feature Intent hiện tại.
- **Reproduction**:
  1. Generate và lưu thành công một bộ Use Cases từ persisted route.
  2. Sửa `Feature Intent` ở các field ảnh hưởng generation như actors, trigger, inputs, constraints.
  3. Reload rồi mở lại persisted Use Case list/editor.
  4. Panel `Lần sinh gần nhất` vẫn hiển thị metadata prompt/provider cũ như thể nó mô tả source input hiện tại.
- **Root cause**: update `Feature Intent` chưa invalidate hoặc mark stale cho `latest_usecase_generation` đã commit.
- **Fix**: Todo — `TASK-194` clear hoặc mark stale provenance khi Feature Intent thay đổi ở các field ảnh hưởng generation.
- **Verified**: 2026-06-08 by Codex — `TASK-193` đã chặn nhánh unsaved-generate drift; stale-after-edit path vẫn còn mở.

---

## [FIXED] Use case được kỳ vọng là AI-generated nhưng thực tế là template deterministic (severity: P1) {#fixed-usecase-generation-not-ai}

- **ID**: KI-25
- **Phát hiện**: 2026-06-06 by Codex (use-case generation quality review)
- **Severity**: P1 — không làm hỏng contract nhưng output quá chung chung so với kỳ vọng sản phẩm và có thể dẫn tới diagram đúng cấu trúc nhưng sai/thiếu nghiệp vụ.
- **Reproduction**: Nhập hai feature thuộc domain khác nhau rồi sinh use case; các luồng chính vẫn chủ yếu lặp template mở thông tin, xử lý, cập nhật và thông báo.
- **Root cause**: `/api/usecases/generate` không gọi provider AI; builder chọn loại use case bằng keyword/count heuristics và điền fixed templates.
- **Fix**: TASK-114 đến TASK-123 thêm source label, shared AI platform, versioned prompt, grounded semantic synthesis, deterministic hydrator, retry/fallback, quality gate, observability và feature-flag rollout.
- **Verified**: API/UI suites, config mode matrix và Playwright source-label assertion ngày 2026-06-06.

---

## [FIXED] Camera / AI actor bị rơi khỏi use case synthesis nên flow bị lệch về "Ban quản lý" (severity: P1) {#fixed-usecase-technical-actor-collapse}

- **ID**: KI-28
- **Phát hiện**: 2026-06-08 by Codex (TASK-184..191 re-review + camera re-id defect report)
- **Severity**: P1 — output có thể hợp schema nhưng sai actor nghiệp vụ, kéo lệch cả diagram và BRD ở các feature AI/vision.
- **Reproduction**: Nhập `FeatureIntent` cho bài toán camera re-id với actor có `Camera AI`, `Dịch vụ Re-ID` hoặc system tương tự; generate use case và quan sát hầu hết main-flow step bị gán cho `Ban quản lý / Portal`.
- **Root cause**: Grounding và deterministic fallback chỉ ưu tiên `target_users`, `primary_actor`, `systems_involved`, trong khi `FeatureIntent.actors` không được đối xử như participant canonical. Đồng thời prompt synthesis cũ bị hard-code và chưa ép coverage cho actor kỹ thuật trong domain camera/AI/re-id.
- **Fix**: Giữ `FeatureIntent.actors` trong grounding catalog, actor allowlist, deterministic builder và quality gate; thêm rule bắt technical-actor coverage; chuyển prompt use-case sang markdown assets versioned và tăng cường prompt `usecase_synthesis@1.1.0` cho domain camera/AI/re-id.
- **Verified**: 2026-06-08 by Codex — targeted pytest (`test_prompt_registry`, `test_usecase_synthesis`, `test_usecase_generation_service`, `test_usecase_builder`), full `npm run test:api-mock`, `npm run test:ui-mock`, `npm run build`.

---

## [FIXED] Form đầu vào use case phơi raw schema và thu field không tạo giá trị (severity: P2) {#fixed-usecase-input-overcollection}

- **ID**: KI-24
- **Phát hiện**: 2026-06-06 by Codex (use-case input necessity review)
- **Severity**: P2 — không chặn chức năng nhưng tạo ma sát đáng kể ở workflow chính.
- **Reproduction**: Mở `Không gian use case > Đầu vào`; ba field `Bối cảnh nghiệp vụ`, `Rule nghiệp vụ`, và `Thuật ngữ` xuất hiện như input chính dù đều optional.
- **Root cause**: UI render gần như trực tiếp raw input/output contracts thay vì thiết kế theo minimum information needed; input concepts chồng lấn, `function_name/glossary` không có consumer, và use-case review giữ hai editable representations cho cùng flow.
- **Fix**: TASK-110 đến TASK-113 đưa input về essential-first, deprecate field không có consumer, chọn structured flow làm canonical editor và dùng progressive disclosure cho metadata.
- **Verified**: 2026-06-06 by Codex — Vitest, 58 API tests, Playwright edit-to-diagram regressions, production build và Browser QA desktop/mobile.

---

## [FIXED] Detailed use case có thể được approve dù reference đã hỏng (severity: P1) {#fixed-usecase-detail-dangling-references}

- **ID**: KI-20
- **Phát hiện**: 2026-06-06 by Codex (TASK-102/103/075/076 implementation review)
- **Severity**: P1 — workflow chính bị chặn ở bước tạo sơ đồ dù UI đã báo approved.
- **Reproduction**: Đổi primary/supporting actor hoặc xóa một dòng main flow đang được alternate flow tham chiếu, approve lại, rồi bấm `Tạo sơ đồ`.
- **Root cause**: Editor không reconcile/validate detailed references trước approval; backend chỉ phát hiện khi parse request generate diagram.
- **Fix**: TASK-104 thêm frontend contract validator và approval/generation guards; TASK-105 enforce cùng invariant ở Pydantic schema và diagram builder.
- **Verified**: 2026-06-06 by Codex — Vitest contract/component tests và `54` API tests.

---

## [FIXED] Regenerate use case có thể xóa diagram workspace đã chỉnh tay (severity: P1) {#fixed-usecase-regenerate-drops-diagrams}

- **ID**: KI-21
- **Phát hiện**: 2026-06-06 by Codex (TASK-102/103/075/076 implementation review)
- **Severity**: P1 — có nguy cơ mất toàn bộ diagram in-session, gồm cả bản diverged.
- **Reproduction**: Tạo và sửa semantic một diagram, đổi spec/use case, xác nhận sinh lại use case; toàn bộ `diagramWorkspaces` bị clear.
- **Root cause**: Confirmation chỉ mô tả replace use-case drafts, trong khi success handler reset cả diagram artifact state.
- **Fix**: TASK-106 giữ diagram không còn khớp dưới dạng orphan workspace, tách operation failure khỏi artifact availability và yêu cầu discard có chủ đích.
- **Verified**: 2026-06-06 by Codex — lifecycle unit tests và Playwright destructive-flow regressions.

---

## [FIXED] Một số layout edit không được giữ khi đổi use case (severity: P1) {#fixed-usecase-layout-edit-not-captured}

- **ID**: KI-22
- **Phát hiện**: 2026-06-06 by Codex (TASK-102/103/075/076 implementation review)
- **Severity**: P1 — canvas hiển thị đã sửa nhưng workspace mở lại dùng snapshot cũ.
- **Reproduction**: Resize lane/shape bằng handle hoặc move sync-bar, chuyển sang use case khác, rồi mở lại use case ban đầu.
- **Root cause**: Các handler này không gọi workspace capture sau mutation.
- **Fix**: TASK-107 đưa canvas mutations qua một commit path có `layout | semantic`, gồm lane/shape resize và sync-bar changes.
- **Verified**: 2026-06-06 by Codex — Playwright switch-away/switch-back lane resize regression.

---

## [FIXED] Terminal alternate flow bị nối vào success end chung (severity: P1) {#fixed-terminal-flow-renders-as-success}

- **ID**: KI-23
- **Phát hiện**: 2026-06-06 by Codex (TASK-102/103/075/076 implementation review)
- **Severity**: P1 — diagram có thể truyền đạt sai kết quả nghiệp vụ.
- **Reproduction**: Generate diagram từ alternate flow có `terminal_outcome` và không có `rejoin_step_id`.
- **Root cause**: Generator bỏ qua terminal outcome và nối branch vào end node mang trace `success_outcome`.
- **Fix**: TASK-108 render terminal outcome và terminal end riêng, giữ source trace và không nối branch vào success end.
- **Verified**: 2026-06-06 by Codex — diagram-builder golden tests và Browser visual smoke.

## [FIXED] `Mở canvas` chỉ gắn context nhưng giữ nguyên diagram mẫu (severity: P1) {#fixed-open-usecase-canvas-keeps-sample}

- **ID**: KI-19
- **Phát hiện**: 2026-06-05 by Codex (current use-case-to-diagram flow review)
- **Severity**: P1 — không mất dữ liệu, nhưng primary workflow truyền đạt sai rằng diagram của use case đã được mở.

### Reproduction

1. Sinh và phê duyệt một use case.
2. Bấm `Mở ở vùng sơ đồ`, sau đó bấm `Mở canvas`.
3. **Triệu chứng**: context shell đổi sang use case đã chọn nhưng canvas vẫn hiển thị diagram mẫu sự cố cháy từ lúc khởi tạo.

### Root cause

`handleOpenUseCaseDiagramCanvas()` chỉ cập nhật `focusedUseCaseId` và `activeCanvasUseCaseId`; chưa có `UseCaseDraft -> DiagramDraft` generation hoặc graph load. Canvas ban đầu luôn được render từ `buildInitialData()`.

### Fix

1. Không expose `Mở canvas` khi diagram chưa tồn tại; dùng trạng thái/action `Tạo sơ đồ`.
2. Implement TASK-075 để generate và render graph thật.
3. Nếu cho phép dựng thủ công, mở canvas trống với lane theo actor thay vì giữ sample không liên quan.
4. Xem TASK-102 và TASK-103.

### Verified

- 2026-06-05 by Codex — item chưa có draft chỉ hiển thị `Tạo sơ đồ`; `Mở canvas` chỉ xuất hiện sau khi `DiagramDraft` thật đã tồn tại.
- 2026-06-05 by Codex — Playwright và Browser QA xác nhận graph sinh từ use case thay thế sample graph, giữ workspace riêng theo `use_case_id`, và semantic edit chuyển trạng thái sang `diverged`.

---

## [FIXED] Diagram inventory có thể báo active use case khác với canvas context (severity: P1) {#fixed-usecase-inventory-active-context-drift}

- **ID**: KI-18
- **Phát hiện**: 2026-06-05 by Codex (TASK-095–097 implementation review)
- **Severity**: P1 — có workaround là chỉ bấm `Mở canvas` từ đúng item, nhưng state mâu thuẫn có thể dẫn tới thao tác nhầm use case khi diagram generation được nối thật.

### Reproduction

1. Phê duyệt use case A và B.
2. Từ inventory của A, bấm `Mở canvas`; shell context hiển thị canvas đang gắn với A.
3. Mở lại danh sách use case và bấm `Mở ở vùng sơ đồ` trên B, nhưng chưa bấm `Mở canvas`.
4. **Triệu chứng**: shell context vẫn nói canvas active A, trong khi inventory đánh dấu B là `Đang chọn cho sơ đồ` và note nói B được chọn trên canvas.

### Root cause

`selectedUseCaseIdForDiagram` điều khiển trạng thái `selected` trong inventory, còn `activeCanvasUseCaseId` điều khiển context shell. `handleOpenUseCaseDiagramWorkspace()` đổi selected ID nhưng không đổi active ID, dù copy của inventory diễn đạt selected như active canvas binding.

### Fix

1. Tách rõ inventory focus khỏi active canvas binding.
2. Chỉ derive trạng thái active-on-canvas từ `activeCanvasUseCaseId`.
3. Thêm E2E cho transition A active -> B focused -> B active.
4. Xem `TASK-098`.

### Verified

- 2026-06-05 by Codex — `focusedUseCaseId` chỉ điều khiển highlight inventory, còn trạng thái `active_on_canvas` chỉ derive từ `activeCanvasUseCaseId`.
- 2026-06-05 by Codex — lifecycle/component tests pass và Playwright regression `A active -> B focused -> B active` pass.

---

## [FIXED] AI BRD suy main flow theo topology graph thay vì tọa độ canvas (severity: P1) {#fixed-ai-brd-main-flow-by-coordinates}

- **ID**: KI-07
- **Phát hiện**: 2026-05-31 by Codex (implementation review)
- **Severity**: P1 — BRD draft có thể mô tả sai luồng chính dù diagram và edge đều đúng.

### Reproduction

1. Tạo diagram có branch hoặc node rời, trong đó vị trí `y/x` của node không phản ánh đúng thứ tự đi theo edge.
2. Bấm `Generate BRD`.
3. Mở tab `Structured Spec` hoặc `BRD Draft`.
4. **Triệu chứng**: `main_flow_steps` đi theo thứ tự tọa độ canvas thay vì thứ tự topology từ `start` qua các edge.

### Root cause

`apps/api/app/services/interpret.py` hiện tạo `main_flow_nodes` bằng cách sort toàn bộ `activity`, `decision`, `end` theo `(y, x, id)` rồi dùng danh sách đó làm luồng chính. Logic này không hề traverse graph từ `start`, không tách node reachable khỏi node rời, và không phân biệt main path với branch/parallel path.

### Fix

1. Đổi `interpret_request()` sang traversal theo edge từ `start`, không còn sort toàn bộ flow node theo `(y, x)`.
2. Tách `reachable_ids` khỏi `preferred_path_ids`: main flow ưu tiên spine hợp lý trước, rồi mới append các node reachable còn lại theo distance.
3. Ghi `open_questions` cho node flow không reachable từ `start`.
4. Thêm regression test cho graph có topology khác với vị trí canvas.

### Verified

- 2026-06-02 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass (`35 passed`) sau khi thêm regression test cho provider transport error.
- 2026-06-02 by Codex — `npm run test:api-live` pass (`2 passed`), xác nhận live path vẫn generate được với OpenRouter sau khi harden transport handling.

- 2026-05-31 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass.
- 2026-05-31 by Codex — browser local: sample `Generate BRD` sinh main flow theo spine topology (nhánh `Có` đi trước trong sample), không còn phụ thuộc vị trí canvas.

---

## [FIXED] AI BRD không còn tự gán lane gần nhất cho node ngoài lane (severity: P1) {#fixed-ai-brd-nearest-lane-inference}

- **ID**: KI-08
- **Phát hiện**: 2026-05-31 by Codex (implementation review)
- **Severity**: P1 — node đặt lệch lane vẫn được generate như hợp lệ, dẫn tới sai actor/handoff trong BRD.

### Reproduction

1. Kéo một `activity` hoặc `decision` lệch khỏi mọi lane nhưng vẫn gần một lane nào đó hơn lane khác.
2. Bấm `Generate BRD`.
3. **Triệu chứng**: frontend vẫn gửi `lane_id` cho node đó, backend không block `NODE_MISSING_LANE`, và BRD tiếp tục map node vào actor gần nhất.

### Root cause

`src/brd/normalize.ts` dùng `inferLaneId()` để chọn lane có `center x` gần nhất nếu `properties.laneId` không còn hợp lệ. Backend chỉ block khi `lane_id` bị thiếu, nên việc auto-gán này làm mất hoàn toàn tín hiệu lỗi placement.

### Fix

1. `inferLaneId()` chỉ còn infer khi `x` của node nằm trong biên thực của đúng 1 lane.
2. Nếu node nằm ngoài tất cả lane, hoặc đúng vào ranh giới giữa hai lane, frontend trả `undefined` thay vì map âm thầm sang lane gần nhất.
3. Explicit `properties.laneId` chỉ được giữ nếu vẫn còn hợp lệ theo boundary mới.
4. Thêm regression test cho case ngoài lane và case đúng biên lane.

### Verified

- 2026-05-31 by Codex — `npm run test:ui-mock` pass với case ngoài lane và case đứng đúng biên lane.
- 2026-05-31 by Codex — `npm run test:brd-mock` pass sau khi đổi lane inference.

---

## [OPEN] AI BRD live-provider path chưa khớp contract Phase 1 đã chốt (severity: P1) {#open-ai-brd-live-contract-gap}

- **ID**: KI-09
- **Phát hiện**: 2026-05-31 by Codex (implementation review)
- **Severity**: P1 — mock/demo path chạy được, nhưng live path chưa đủ điều kiện để coi là hoàn thiện cho real generation.

### Reproduction

1. Đối chiếu implementation hiện tại của `/validate`, `/generate`, và `OpenRouterProvider` với `docs/product/ai-brd-description-feature.md` + `docs/scope/architecture-brd-backend.md`.
2. **Triệu chứng**:
   - `X-Schema-Version` chưa được enforce.
   - `BRD_REQUEST_RATE_LIMIT` mới chỉ là config, chưa có runtime behavior `429`.
   - Live provider chưa có controlled retry.
   - OpenRouter path mới dùng `response_format: { type: "json_object" }`, chưa ưu tiên strict schema output như doc đã chốt.
   - `estimated_cost_usd` đang hard-code.

### Root cause

Implementation hiện ưu tiên dựng vertical slice mock-first và mới scaffold nhánh live, nên nhiều cam kết contract/operability của Phase 1 chưa được hiện thực hóa trong runtime.

### Fix

1. Enforce `X-Schema-Version` trên cả `/validate` và `/generate`.
2. Implement rate-limit Phase 1.
3. Nâng `OpenRouterProvider` lên structured output strict mode + bounded retry.
4. Ghi metadata attempt/cost từ response thật thay vì constant.

### Verified

- 2026-05-31 by Codex — source inspection tại `apps/api/app/routes/brd_validate.py`, `apps/api/app/routes/brd_generate.py`, `apps/api/app/providers/openrouter_provider.py`, `apps/api/app/config.py`.

---

## [FIXED] AI BRD retry không còn bị kẹt `in_progress` sau lỗi generate (severity: P1) {#open-ai-brd-idempotency-stuck-on-failure}

- **ID**: KI-10
- **Phát hiện**: 2026-05-31 by Codex (completion review)
- **Severity**: P1 — user retry đúng contract nhưng request có thể bị treo logic đến hết TTL idempotency.

### Reproduction

1. Gọi `POST /api/brd/generate` với `Idempotency-Key` cố định.
2. Để request đầu tiên rơi vào một trong các nhánh:
   - `422 VALIDATION_BLOCKING`
   - `502 MODEL_TIMEOUT`
   - `503 PROVIDER_UNAVAILABLE`
3. Retry lại cùng payload và cùng `Idempotency-Key`.
4. **Triệu chứng**: backend có thể trả `202 in_progress` thay vì xử lý lại hoặc trả terminal response phù hợp.

### Root cause

`IdempotencyStore.begin()` luôn tạo entry mới với `state="in_progress"`, nhưng `routes/brd_generate.py` chỉ gọi `idempotency_store.complete(...)` ở nhánh success `200 completed`. Các nhánh `422`, `502`, `503` return sớm mà không đóng hoặc reset trạng thái nên key bị giữ ở trạng thái đang xử lý cho đến khi TTL hết.

### Fix

1. Định nghĩa terminal policy rõ cho non-success outcomes:
   - cache/replay được,
   - release để retry lại,
   - hoặc mark failed với metadata riêng.
2. Implement API phù hợp trong `IdempotencyStore` (`complete`, `fail`, hoặc `release`).
3. Áp policy đó cho mọi exit path của `/generate`.
4. Thêm regression tests cho retry sau `422`, `502`, và `503`.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass, gồm retry cùng `Idempotency-Key` sau `422`, `502`, `503`.

---

## [FIXED] AI BRD post-check không còn false-positive với branch target hợp lệ ngoài main flow (severity: P1) {#open-ai-brd-branch-target-false-positive}

- **ID**: KI-11
- **Phát hiện**: 2026-05-31 by Codex (completion review)
- **Severity**: P1 — output warning có thể báo sai “decision bịa target” dù target là node thật trong graph.

### Reproduction

1. Tạo diagram có decision với một nhánh phụ hợp lệ, nhưng node target của nhánh đó không nằm trên preferred main path.
2. Generate BRD thành `DiagramBRDSpec`.
3. Chạy `postcheck_spec()` hoặc xem warnings trả về từ `/generate`.
4. **Triệu chứng**: branch target hợp lệ vẫn bị gắn `BRANCH_TARGET_UNKNOWN`.

### Root cause

`postcheck_spec()` chỉ xây `seen_node_ids` từ `spec.main_flow_steps`, rồi warn cho mọi `branch.outcomes[].target_node_id` không thuộc tập này. Điều kiện đó không phân biệt target “không có trong canonical graph” với target “có thật nhưng thuộc branch/parallel path”.

### Fix

1. Đổi post-check sang traceability set rộng hơn `main_flow_steps`, ví dụ:
   - canonical registry của mọi node đã được interpret,
   - hoặc pass thêm `normalized/interpreted context` vào post-check.
2. Giữ warning chỉ cho target thật sự không trace được.
3. Thêm regression test cho:
   - branch target hợp lệ ngoài main path,
   - branch target lạ thật sự.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass, gồm case branch target hợp lệ ngoài main flow không còn sinh `BRANCH_TARGET_UNKNOWN`.

---

## [FIXED] Sticky note semantics của AI BRD đã phân biệt note gắn step và note toàn cục (severity: P2) {#open-ai-brd-note-anchoring-gap}

- **ID**: KI-12
- **Phát hiện**: 2026-05-31 by Codex (completion review)
- **Severity**: P2 — BRD vẫn generate được, nhưng phần assumption/open question thiếu độ chính xác nghiệp vụ.

### Reproduction

1. Tạo một sticky note rất xa mọi step nhưng vẫn trong cùng lane với một activity nào đó.
2. Generate BRD.
3. **Triệu chứng**:
   - backend không coi note là orphan/global note,
   - output không phân biệt note đang bám vào step hay chỉ là ghi chú toàn cục.

### Root cause

`validate.py` chỉ kiểm tra note có chung `lane_id` với node flow nào đó hay không, không kiểm tra khoảng cách/anchor. `interpret.py` thì đưa toàn bộ note vào `annotations` và `assumptions` bằng cùng một policy.

### Fix

1. Thêm proximity/anchor rule cho note ở Step 3-4.
2. Phân loại `anchored_note` và `global_note`.
3. Render/record assumption khác nhau cho hai loại note.
4. Thêm tests cho note gần step và note xa toàn cục.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass, gồm case global note xa flow được map vào `assumptions` và sinh `NOTE_ORPHAN`.

---

## [FIXED] AI BRD reader-facing output từng đúng schema nhưng vô nghĩa khi đọc (severity: P1) {#fixed-ai-brd-reader-facing-quality-gap}

- **ID**: KI-13
- **Phát hiện**: 2026-06-01 by Quân (user report) / Codex (review xác nhận)
- **Severity**: P1 — feature generate được BRD, nhưng output có thể khó đọc đến mức gần như không usable cho BA review.

### Reproduction

1. Tạo hoặc import một diagram có:
   - decision branch rõ ràng,
   - cross-lane transitions,
   - sync-bar hoặc nhiều terminal path.
2. Bấm `Generate BRD`.
3. Đọc `BRD Draft`.
4. **Triệu chứng**:
   - `Main workflow` là một list phẳng, khó hiểu if/else ở đâu.
   - `Handoffs` chứa các cặp node-id hoặc edge cross-lane không mang nghĩa business.
   - `Actors` / `Decision logic` / `Parallel activities` có thể lộ raw `lane_id` và `node_id`.

### Root cause

1. `interpret.py` đang flatten gần như toàn bộ node reachable vào `main_flow_nodes` thay vì giữ spine chính và các nhánh riêng.
2. `interpret.py` suy `handoffs` từ mọi edge cross-lane, không phân biệt business handoff với edge điều hướng.
3. `render.py` dùng raw ids trực tiếp trong markdown reader-facing thay vì tách trace/debug khỏi prose.

### Fix

1. `interpret.py` chỉ giữ `preferred path` làm `main spine`; branch/alternate path được capture riêng qua `path_summary` và `rejoin_node_text`.
2. `handoff` được định nghĩa lại theo nghĩa nghiệp vụ: chỉ emit khi có chuyển giao thật giữa các actor, loại edge từ decision/sync-bar/start/end.
3. `render.py` loại raw ids khỏi 10 section BRD chính và dồn trace sang `Appendix A. Traceability (debug)`.
4. `parallel_blocks` được enrich thành summary đọc hiểu được (`actor_names`, `branch_summaries`, `join_summary`).
5. Thêm golden quality tests + route-level harmonization test để chặn regression “schema pass nhưng BRD reader-facing vô nghĩa”.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass (`26 passed`).
- 2026-06-01 by Codex — `npm run test:brd-mock` pass, gồm Vitest + backend mock suite + Playwright E2E.
- 2026-06-01 by Codex — regression route test xác nhận live provider output thô vẫn bị harmonize trước khi render BRD.

---

## [FIXED] AI BRD từng sinh `Parallel activities` giả cho `sync-bar` không phân nhánh (severity: P1) {#fixed-ai-brd-false-positive-parallel}

- **ID**: KI-14
- **Phát hiện**: 2026-06-01 by Quân (draft review) / Codex (review xác nhận)
- **Severity**: P1 — BRD có thể invent cơ chế phối hợp song song không tồn tại trong diagram.

### Reproduction

1. Dùng sample cháy mặc định của app.
2. Bấm `Generate BRD`.
3. Đọc section `Parallel activities`.
4. **Triệu chứng**: BRD mô tả có nhánh song song/dồng bộ dù graph thực tế chỉ có `n-a4 -> n-sync -> n-b1`.

### Root cause

1. `analyze_sync_bars()` vẫn emit `parallel_block` cho `role == "sync"` hoặc `role == "join"` ở [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:428).
2. Với sample mặc định, `n-sync` không có fan-out thật nhưng vẫn được render thành câu `Các nhánh song song được đồng bộ trước bước ...`.

### Fix

1. `interpret.py` không còn emit `parallel_block` cho `role == "sync"` tuyến tính.
2. Chỉ các sync-bar có bằng chứng join/fork thật mới còn lên section `Parallel activities`.
3. Thêm regression fixture cho case sync-bar tuyến tính.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py` pass với fixture `test_non_branching_sync_bar_does_not_create_parallel_block`.
- 2026-06-01 by Codex — `npm run test:brd-mock` pass sau khi bỏ false-positive parallel.

---

## [FIXED] AI BRD từng gán sai `context note` thành annotation của một step cụ thể (severity: P1) {#fixed-ai-brd-context-note-misclassified}

- **ID**: KI-15
- **Phát hiện**: 2026-06-01 by Quân (draft review) / Codex (review xác nhận)
- **Severity**: P1 — BRD gán sai ngữ nghĩa của note, khiến người đọc hiểu sai rằng đó là comment của một step cụ thể.

### Reproduction

1. Dùng sample cháy mặc định của app.
2. Bấm `Generate BRD`.
3. Đọc section `Assumptions / open questions`.
4. **Triệu chứng**: note liệt kê “1 trong 4 nhóm phát hiện dấu hiệu cháy” được render thành `Note cho bước "Bắt đầu quy trình" ...`.

### Root cause

1. `resolve_note_anchor()` auto-anchor note vào node gần nhất cùng lane tại [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:341).
2. `format_anchored_note_annotation()` luôn render note đã anchor thành step annotation tại [apps/api/app/services/interpret.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/interpret.py:361).
3. Sample note trong [src/lf-config.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/lf-config.ts:25) thực chất là process-entry context, không phải note của riêng step `start`.

### Fix

1. Thêm semantic phân loại note: `step_annotation`, `context_note`, `global_note`.
2. Đổi heuristic anchoring để note dạng list/context gần `start` hoặc gần đầu quy trình được hạ xuống `context_note`.
3. Render `context_note` vào section `Assumptions / open questions` với prefix `Context:`.
4. Thêm regression test reader-facing cho sample cháy và fixture note dạng list gần start.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests/test_pipeline.py` pass với fixture `test_interpret_context_note_near_start_is_not_step_annotation`.
- 2026-06-01 by Codex — `npm run test:api-live` pass sau khi schema/spec được bổ sung `context_notes`.

---

## [FIXED] AI BRD section `Assumptions / open questions` không còn tự mâu thuẫn khi chỉ có `context note` (severity: P1) {#open-ai-brd-context-note-empty-state-contradiction}

- **ID**: KI-16
- **Phát hiện**: 2026-06-01 by Quân (draft review) / Codex (review xác nhận)
- **Severity**: P1 — BRD reader-facing có thể tự phủ định chính nó, làm giảm niềm tin vào output dù semantic đã đúng hơn.

### Reproduction

1. Dùng sample cháy mặc định sau khi đã fix `context note`.
2. Bấm `Generate BRD`.
3. Đọc section `Assumptions / open questions`.
4. **Triệu chứng**: draft vừa có dòng `Context: ...`, vừa có dòng `Không có assumption/open question.`

### Root cause

1. `render.py` đã render `spec.context_notes` vào section 10 tại [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:78).
2. Nhưng điều kiện empty-state ở [apps/api/app/services/render.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/render.py:85) chỉ check `annotations`, `assumptions`, và `open_questions`, không tính `context_notes`.

### Fix

1. Tính `context_notes` như một loại content hợp lệ của section 10 khi quyết định có render empty-state hay không.
2. Thêm regression test cho case section 10 chỉ có `context_notes`.

### Verified

- 2026-06-01 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass (`32 passed`) sau khi thêm regression renderer.
- 2026-06-01 by Codex — `npm run test:brd-mock` pass; sample reader-facing không còn đồng thời hiện `Context:` và `Không có assumption/open question.`

---

## [FIXED] AI BRD live provider không còn văng `500` khi OpenRouter trả chunked response bị đứt (severity: P1) {#fixed-ai-brd-openrouter-incomplete-read}

- **ID**: KI-17
- **Phát hiện**: 2026-06-02 by Quân (user report) / Codex (review xác nhận)
- **Severity**: P1 — live generate thất bại bằng `500 Internal Server Error`, phá vỡ retry contract và làm frontend không thể xử lý graceful.

### Reproduction

1. Chạy backend với `BRD_PROVIDER=openrouter` và key thật.
2. Gửi `POST /api/brd/generate`.
3. Trong lúc OpenRouter trả response, kết nối chunked bị ngắt giữa chừng.
4. **Triệu chứng**: backend văng `http.client.IncompleteRead` ra ngoài và trả `500 Internal Server Error`.

### Root cause

1. `openrouter_provider.py` đọc `response.read()` trực tiếp tại [apps/api/app/providers/openrouter_provider.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/providers/openrouter_provider.py:65).
2. Khi stream chunked bị đứt, Python ném `IncompleteRead`.
3. Exception này không được map sang `OpenRouterProviderError`, nên route `/generate` không thể áp retry/502 contract hiện có.

### Fix

1. Bắt các lỗi transport như `IncompleteRead`, `RemoteDisconnected`, và `HTTPException` trong `OpenRouterProvider`.
2. Map chúng sang `OpenRouterProviderError(retryable=True)` với message rõ ràng.
3. Thêm regression test trực tiếp cho provider để case `IncompleteRead` luôn được hạ xuống retryable provider error thay vì văng `500`.

### Verified

- 2026-06-02 by Codex — `apps/api/.venv/bin/python -m pytest apps/api/tests` pass (`35 passed`).
- 2026-06-02 by Codex — regression `apps/api/tests/test_openrouter_provider.py` xác nhận `IncompleteRead` được map thành `OpenRouterProviderError(retryable=True)`.

---

## [FIXED] Lane resize/reorder giữ node trong lane theo binding mới (severity: P1) {#fixed-lane-layout-node-containment}

- **ID**: KI-05
- **Phát hiện**: 2026-05-30 by Quân (user report) / Codex (review xác nhận)
- **Severity**: P1 — khi lane đổi width hoặc đổi thứ tự, node có thể lệch khỏi phạm vi lane thay vì được giữ trong lane một cách có nghĩa.

### Reproduction

1. Mở app `npm run dev`.
2. Resize lane hẹp lại hoặc reorder lane qua `←` / `→`.
3. Quan sát node đã gắn với lane đó.
4. **Triệu chứng**: runtime có di chuyển node theo `x`, nhưng không có guard đảm bảo node vẫn nằm trong biên lane sau khi width thay đổi mạnh.

### Root cause

1. `laneOffsetX` đang được lưu như offset tuyệt đối theo pixel (`model.x - lane.x`), không phải relative placement.
2. Khi commit layout, app chỉ reapply `nextLane.x + binding.offsetX`.
3. Không có bước clamp theo `lane.width` và kích thước thực của node sau resize/reorder.

### Fix

1. Đổi contract binding từ `laneOffsetX` tuyệt đối sang `lanePosition` / `relativeX` và persist lại cùng `laneId`.
2. Trong `realignNodesToLaneLayout()`, tính lại `x` của node theo binding mới rồi clamp theo `lane.width` và `node.width`.
3. Khi user drag/drop hoặc resize shape, binding được cập nhật lại theo contract mới thay vì reset về offset cũ.
4. Khi user resize lane, runtime chặn lane co nhỏ hơn shape rộng nhất đang thuộc lane đó, để node không thể bị ép tràn biên vì hình học không còn đủ chỗ chứa.

### Verified

- 2026-05-31 by Codex — `npm run build` pass.
- 2026-05-31 by Codex — browser local: reorder lane rồi kéo lane hẹp lại; `a4` và `b1` vẫn nằm trọn trong lane mới, lane được chặn ở width `284` thay vì co tiếp xuống dưới shape rộng nhất.

---

## [FIXED] `sync-bar` đi theo lane layout và resize được bằng tay (severity: P1) {#fixed-sync-bar-layout-and-resize}

- **ID**: KI-06
- **Phát hiện**: 2026-05-30 by Quân (user report) / Codex (review xác nhận)
- **Severity**: P1 — junction fork/join không đi theo lane layout mới, kéo theo edge lệch logic; đồng thời user không thể đổi kích thước `sync-bar`.

### Reproduction

1. Mở app `npm run dev`.
2. Reorder hoặc resize lane có liên quan tới flow qua `sync-bar`.
3. Click trực tiếp vào `sync-bar`.
4. **Triệu chứng**:
   - `sync-bar` đứng yên khi node hai bên đổi vị trí theo lane.
   - Không có resize handle nào hiện ra cho `sync-bar`.

### Root cause

1. `hydrateNodeLaneBindings()` và `realignNodesToLaneLayout()` skip `sync-bar`.
2. `sync-bar` không được snap/bind theo lane khi drag/drop.
3. Runtime chỉ mở resize handle cho `activity`, `decision`, `note`; `sync-bar` không bao giờ trở thành `activeNode`.
4. Seed graph lại dùng `sync-bar` như junction thật với các edge `e5`, `e6`, nên khi nó đứng yên thì edge không còn giữ topology mong muốn.

### Fix

1. Đưa `sync-bar` vào flow realign riêng trong `commitLaneLayout()` thay vì skip hoàn toàn.
2. Persist metadata `syncBarFromLaneId`, `syncBarToLaneId`, `syncBarLeftInset`, `syncBarRightInset` để runtime giữ được span qua reorder/resize lane.
3. Chuẩn hóa span của `sync-bar` theo cả metadata đã lưu lẫn lane của các node đang nối vào nó, để junction vẫn phủ đúng miền logic sau khi reorder lane.
4. Mở manual `width-only` resize cho `sync-bar` và cập nhật lại metadata span sau khi user kéo.
5. Đồng bộ lại edge endpoints cho các edge nối vào `sync-bar` sau lane commit, drag/drop, và resize.

### Verified

- 2026-05-31 by Codex — `npm run build` pass.
- 2026-05-31 by Codex — browser local:
  - reorder lane rồi resize lane, `sync-bar` được realign lại từ `x=460.01`, `width=824` để vẫn phủ qua các lane có node đang nối vào nó;
  - click `sync-bar` hiện `shape-resize-handle`;
  - kéo handle đổi `sync-bar` từ `width=824` lên `width=944.57`, edge count vẫn giữ `14` và edge `e5`, `e6` cập nhật endpoints theo bar mới.

---

## [FIXED] Lane resize / lane reorder / manual shape resize đã được implement (severity: P1) {#fixed-lane-resize-reorder-manual-shape-resize}

- **ID**: KI-03
- **Phát hiện**: 2026-05-30 by Quân (user retest)
- **Severity**: P1 — user không thể chủ động bố cục diagram khi lane hoặc shape cần đổi kích thước ngoài auto-grow theo text.

### Reproduction

1. Mở app `npm run dev`.
2. Thử đổi kích thước lane bằng kéo chuột hoặc thao tác trực tiếp trên lane.
3. Thử đổi thứ tự lane sang trái / phải.
4. Thử đổi kích thước shape bằng kéo góc hoặc cạnh shape.
5. **Triệu chứng**: không có control hoặc interaction nào cho 3 thao tác trên.

### Root cause

Capability thiếu ở cả runtime lẫn UX:

1. Lane chỉ auto-tăng **chiều cao** theo node thấp nhất và chưa có cơ chế user-driven cho width hoặc reorder.
2. Thứ tự lane phụ thuộc vào mảng `lanes` + `withPositions()` nhưng chưa có control đổi vị trí trực tiếp.
3. Shape chỉ auto-size theo text, chưa có handle resize tay nên user không thể tinh chỉnh layout.

### Fix

1. Thêm lane toolbar hiển thị khi click lane, gồm `Rename`, `Delete`, `←`, `→`.
2. Thêm lane resize handle ở góc phải dưới để đổi `width` lane đang chọn và `height` toàn bộ swimlane.
3. Thêm shape resize handle cho `activity`, `decision`, `note` thông qua overlay riêng, không phụ thuộc resize control mặc định của LogicFlow.
4. Persist `laneId`, `laneOffsetX`, `width`, `height`, `nodeSize` để lane reorder/resize và shape resize sống qua export/import.
5. Giữ rule hiện tại: auto-size theo text vẫn tồn tại như mức sàn; resize tay của user không bị text update kéo nhỏ lại.

### Verified

- 2026-05-30 by Codex — `npm run build` pass.
- 2026-05-30 by Codex — verify browser local: click lane hiện toolbar; rename lane thành `Lane Alpha`; move lane sang phải; kéo resize handle đổi lane từ `320 × 1100` thành `468 × 1218`; click shape hiện handle và kéo shape từ `102 × 21` thành `172 × 56`.

---

## [FIXED] Lane actions khó discover và tài liệu lệch runtime (severity: P2) {#fixed-lane-actions-discoverability-and-doc-drift}

- **ID**: KI-04
- **Phát hiện**: 2026-05-30 by Quân (user retest)
- **Severity**: P2 — tính năng tồn tại nhưng tester dễ hiểu là đang hỏng.

### Reproduction

1. Mở app và chỉ làm theo phần hướng dẫn trong sidebar.
2. Thử xoá lane bằng thao tác hiển nhiên như chọn lane rồi nhấn `DEL`.
3. Đối chiếu tài liệu `docs/use-cases/UC-03-quan-ly-lane.md` với runtime hiện tại.
4. **Triệu chứng**: lane không selectable nên `DEL` không xoá được; sidebar không nói lane xoá bằng right-click; use case và architecture vẫn ghi event cũ `node:dbl-click`.

### Root cause

1. Runtime ban đầu chỉ có gesture ẩn (`node:dbclick`, `node:contextmenu`) nên tester không nhìn ra đường thao tác chính.
2. Sidebar guide và use case cũ chưa mô tả toolbar lane, resize handle, hoặc event rename đúng.

### Fix

1. Thêm lane toolbar rõ ràng khi click lane, để rename/delete/reorder không còn là hidden gesture.
2. Giữ tương thích ngược với `double-click` và `right-click` cho desktop flow cũ.
3. Cập nhật sidebar guide, feature list, use case, changelog, và activity log theo runtime mới.

### Verified

- 2026-05-30 by Codex — verify browser local: click lane hiện toolbar và control rõ ràng cho rename/delete/reorder/resize.
- 2026-05-30 by Codex — review docs/source: `src/App.tsx`, `src/DndPanel.tsx`, `docs/scope/features.md`, `docs/use-cases/UC-03-quan-ly-lane.md`.

---

## [FIXED] Lane rename và kích thước lane/shape bị cố định (severity: P1) {#fixed-lane-rename-va-auto-size}

- **ID**: KI-02
- **Phát hiện**: 2026-05-30 by Quân (user report)
- **Severity**: P1 — ảnh hưởng trực tiếp tới thao tác chỉnh sửa diagram khi lane/shape có nội dung dài.

### Reproduction

1. Mở app `npm run dev`.
2. Double-click một lane và nhập tên mới.
3. **Triệu chứng**: tên lane không đổi hoặc đổi xong bị quay lại tên cũ.
4. Tạo nhiều shape theo chiều dọc hoặc nhập text dài vào Activity / Decision / Note.
5. **Triệu chứng**: lane không cao thêm theo nội dung, shape giữ kích thước cũ và text có thể tràn khỏi shape.

### Root cause

Có 3 nguyên nhân kết hợp:

1. Handler rename lane đang lắng nghe sai event LogicFlow (`node:dbl-click`) thay vì event thực tế `node:dbclick`, nên double-click lane không kích hoạt đúng luồng đổi tên.
2. Khi sync lane sau rename, code xoá lane cũ rồi add lane mới. Handler bảo vệ `node:delete` lại re-add lane vừa xoá bằng dữ liệu cũ, làm rename bị ghi đè hoặc render lẫn state cũ.
3. `LANE_HEIGHT` và kích thước các node Activity / Decision / Note được set cố định, không có bước đo text sau khi tạo hoặc sau `text:update`, nên diagram không mở rộng theo nội dung.

### Fix

1. Đổi event rename lane sang `node:dbclick`.
2. Thêm guard `isSyncingLanesRef` để handler `node:delete` không re-add lane trong lúc app chủ động sync lại lane.
3. Thêm đo kích thước text và resize Activity / Decision / Note khi node được tạo và khi text được cập nhật.
4. Thêm tính toán lane height dựa trên node thấp nhất trong diagram, rồi cập nhật lại toàn bộ lane hiện có.
5. Thêm `textWidth` cho text style của Activity / Decision / Note để text dài wrap trong vùng shape.
6. Phạm vi fix này chỉ bao phủ rename lane + auto-grow theo nội dung + text wrap; không bao gồm resize lane/shape bằng tay hoặc đổi thứ tự lane.

### Verified

- 2026-05-30 by Codex — `npm run build` pass.
- 2026-05-30 by Codex — kiểm tra browser local: double-click lane mở prompt và tên lane đổi thành công; kéo activity xuống thấp làm 4 lane tăng từ 1100 lên 1372; note mẫu có text nằm trong rect sau auto-size/wrap.

---

## [FIXED] Drop shape vào lane bị biến mất (severity: P0) {#fixed-drop-shape-vao-lane-bi-bien-mat}

- **ID**: KI-01
- **Phát hiện**: 2026-05-29 by Quân (user report)
- **Severity**: P0 — không thể tạo diagram mới một cách trực quan.

### Reproduction

1. Mở app `npm run dev`.
2. Kéo bất kỳ shape nào (Start / Activity / Decision / End / Note) từ palette sidebar vào canvas (vào một lane bất kỳ).
3. **Triệu chứng**: shape biến mất, không hiển thị trong canvas.
4. Click sang một lane khác (hoặc bất kỳ vùng nào trên canvas) → các shape vừa thả mới hiện ra.

### Root cause

LogicFlow render thứ tự SVG element trong `<g>` theo thứ tự append: element thêm sau sẽ vẽ đè lên element thêm trước. Lane trong diagram là một node có `<rect fill="#ffffff" ...>` phủ kín toàn bộ vùng lane (để có nền trắng).

Khi user thả shape mới:

1. LogicFlow phát event `node:dnd-add`.
2. Handler trong `App.tsx` gọi `moveTo(snappedX, data.y)` để snap node vào tâm lane.
3. Tuy nhiên LogicFlow có cơ chế "auto bring lane to front" khi user hover lane (mặc dù `selectable=false`), khiến lane bị **append cuối DOM** trong một số tình huống render race.
4. Khi lane nằm sau node mới trong DOM → lane vẽ đè lên node mới → **node biến mất**.
5. Khi user click vùng khác → LogicFlow trigger re-render, sắp xếp lại theo `zIndex`, lane (z = `-10`) được đẩy về phía trước trong DOM, node mới hiện ra.

`zIndex = -10` của lane không đủ lùi sâu khi LogicFlow tăng dần `zIndex` của node được mang ra trước.

### Fix

3 thay đổi cộng dồn:

1. **`src/nodes.ts` → `LaneModel.initNodeData`**: hạ `this.zIndex = -1000` (thay vì `-10`) và thêm `this.isShowAnchor = false`. Lane không bao giờ có thể bị tăng zIndex lên ngang tầm node thường.
2. **`src/lf-config.ts` → `buildLaneNodes`**: set `zIndex: -1000` ngay trong data init (để khi import JSON cũng đảm bảo lane luôn nằm dưới).
3. **`src/App.tsx` → handler `node:dnd-add`**: sau khi `moveTo`, gọi `lf.graphModel.setElementZIndex(data.id, 'top')` → ép node mới luôn lên top stacking.

```ts
// src/App.tsx
lf.on('node:dnd-add', ({ data }) => {
  if (!data || !data.type) return;
  if (data.type === 'lane') return;
  const model = lf.graphModel.getNodeModelById(data.id);
  if (!model) return;
  if (data.type !== 'sync-bar') {
    const snappedX = snapToLane(data.x, lanesRef.current);
    model.moveTo(snappedX, data.y);
  }
  // Bring new node above any lane in the stacking order.
  lf.graphModel.setElementZIndex(data.id, 'top');
});
```

### Verified

- 2026-05-29 by Devin — drag thử 5 lần với mỗi loại shape, qua các lane khác nhau, drop ở header / body / cạnh lane: shape luôn hiển thị ngay lập tức, không cần click sang lane khác.
- DOM SVG kiểm tra qua dev console: lanes luôn đứng đầu danh sách `g.lf-node`, node mới ở cuối → render order chuẩn.

---

## Quy tắc

- Mọi bug user-report → tạo entry ngay, không chờ tới khi fix.
- Một bug fix → mọi field phải đủ (đặc biệt **Root cause** để học hỏi).
- Khi đóng issue → đổi status `[OPEN]` → `[FIXED]` + ghi ngày verify.
- Issue P0/P1 → ưu tiên đưa vào sprint hiện tại.
