# UC-07 — Sinh use case draft từ project spec

| Field | Value |
| --- | --- |
| **Mã** | UC-07 |
| **Tên** | Sinh danh sách use case draft từ `ProjectSpec` và `FeatureIntent` |
| **Actor** | BA / Solution Engineer (chính); Product Owner / QA (review) |
| **Mục tiêu** | Có một workspace rõ ràng để nhập `ProjectSpec + FeatureIntent`, review/edit danh sách use case output, rồi nhìn thấy ngay inventory diagram tương ứng cho từng use case. |
| **Trigger** | User mở `Use case workspace` và bắt đầu điền Input hoặc generate lại từ input hiện có. |

## Tiền điều kiện

- Frontend đang mở editor chính.
- Backend `POST /api/usecases/generate` sẵn sàng.
- Schema version frontend/backend khớp `2026-05-31`.

## Bước thực hiện

1. User mở `Use case workspace` từ toolbar.
2. Workspace hiển thị 3 vùng rõ ràng:
   - `Input`
   - `Use cases`
   - `Diagrams`
3. Ở vùng `Input`, primary flow yêu cầu tên chức năng, mô tả chức năng, danh sách `Actors / swimlanes` và kết quả mong muốn. Tất cả actor user nhập đều là actor chính của quy trình; UI không phân cấp actor chính/phụ và không giấu actor trong `Thông tin bổ sung`.
4. Frontend chạy `quick guard` cục bộ cho các field bắt buộc:
   - `project_name`
   - `project_summary`
   - `feature_name`
   - `feature_summary`
   - `actors` có ít nhất một dòng
5. Nếu `quick guard` fail, frontend giữ user ở vùng `Input`, disable action generate, và hiển thị lỗi ngay trong workspace.
6. Nếu đang có `UseCaseDraft` đã review/chỉnh sửa hoặc spec hiện tại khác fingerprint lần generate gần nhất, frontend phải so snapshot hiện tại với snapshot generate gần nhất trước khi quyết định có hiện confirm replace hay không.
7. Frontend gửi `POST /api/usecases/generate` với payload schema ổn định, không dùng raw prompt tự do.
8. User chọn cách sinh: theo cấu hình hệ thống, ưu tiên AI, hoặc theo rule. Backend:
   - validate `X-Schema-Version`
   - canonical normalize/trim/dedup ingestion payload
   - áp dụng rate limit
   - build `artifact_chain`
   - áp dụng rollout mode `deterministic / ai_shadow / ai_opt_in / ai_default`
   - nếu gọi AI: render prompt version đã pin, synthesize semantic output, kiểm tra schema/evidence/quality và hydrate stable IDs
   - retry tối đa một lần với validation codes đã sanitize
   - fallback về deterministic builder khi provider hoặc output không đạt yêu cầu
9. Frontend chuyển trọng tâm sang vùng `Use cases` và hiển thị:
   - nguồn sinh `Bản nháp AI` hoặc `Bản nháp theo rule`, cùng lý do fallback
   - danh sách use case draft có thể chỉnh sửa trực tiếp
   - trạng thái review `draft / reviewed / approved`
   - next action rõ ràng trên từng item
10. User chỉnh trực tiếp structured main/alternate flow; `happy_path_summary` và `key_exceptions` được derive, không phải nguồn edit thứ hai.
11. Frontend validate detailed contract sau mỗi edit và chỉ cho phép `Đánh dấu đã rà soát`, `Phê duyệt`, `Phê duyệt tất cả`, hoặc `Tạo sơ đồ` khi actor/step/branch references, stable IDs, outcome mode và text bắt buộc đều hợp lệ.
12. Khi use case đã `approved`, user có thể mở vùng `Diagrams` để xem inventory diagram gắn với từng `use_case_id`.
13. Vùng `Diagrams` phải cho thấy:
   - use case nào chưa sẵn sàng đi sang diagram
   - use case nào đã `approved` và sẵn sàng cho bước diagram
   - use case nào đang được xem trong inventory, tách biệt với use case đang gắn thật với canvas
   - `Tạo sơ đồ` khi use case đã approved nhưng chưa có draft
   - `Mở canvas` chỉ khi đã có `DiagramDraft` thật
   - `Mở bản hiện tại` và `Tạo lại sơ đồ` khi draft đã outdated/diverged
14. `Artifact chain` không còn nằm giữa primary flow; nó được chuyển vào `Advanced traceability`.
15. Khi user chọn `Tạo sơ đồ`, frontend gửi use case approved sang `POST /api/diagrams/generate`, chuyển `DiagramDraft` trả về thành LogicFlow graph, lưu workspace theo `use_case_id`, rồi render graph đó vào canvas.
16. Mọi node/edge generated mang provenance versioned và source trace; element tạo tay mang provenance `manual`, còn metadata import không hợp lệ được đánh dấu `imported/untrusted`.

## Kết quả mong đợi

- Có một workspace tách bạch giữa input, use case output, và diagram inventory.
- User có thể sinh lần đầu mà không cần mở các field nâng cao hoặc hiểu raw schema.
- Có danh sách use case draft đủ rõ để review mà không cần mở diagram trước.
- Mỗi use case draft có tối thiểu:
  - `use_case_id`
  - `title`
  - `objective`
  - `actors` / participant list đủ để sinh lane và actor refs
  - `preconditions`
  - `happy_path_summary`
  - `key_exceptions`
  - `main_flow_steps[]` với stable `step_id`, `actor_ref`, action, trigger/input và expected result
  - `alternate_flows[]` với stable flow ID, source step, condition, ordered steps và rejoin/terminal outcome
  - `success_outcome`
  - `review_status`
- `Artifact chain` vẫn tồn tại cho traceability, nhưng được đặt trong `Advanced traceability` thay vì chen vào luồng chính.
- Vùng `Diagrams` hiển thị inventory tối thiểu gắn theo `use_case_id`, kể cả khi trạng thái ban đầu mới chỉ là “ready for diagram” hoặc “needs approval”.
- Workspace vẫn duy trì artifact chain:
  - `ProjectSpec`
  - `FeatureIntent`
  - `UseCaseDraft`
  - `DiagramDraft`
  - `FormalBRDDraft`
- Response metadata đủ để trace capability, source, mode, provider/model, prompt ID/version/fingerprint, attempt, latency, token/cost, quality và fallback reason.

## AI rollout contract

- `deterministic`: kill switch và default an toàn; không gọi provider.
- `ai_shadow`: chạy AI để đo quality nhưng trả deterministic draft, không lưu raw payload.
- `ai_opt_in`: chỉ gọi AI khi user chọn `Ưu tiên AI`.
- `ai_default`: gọi AI trừ khi user chọn `Theo rule`.
- Bật `ai_default` chỉ khi golden quality pass, fallback rate dưới 10%, p95 latency nằm trong budget sản phẩm và cost/request nằm trong budget vận hành đã duyệt.
- Rollback khi quality rejection/fallback vượt 20% trong cửa sổ theo dõi, có unsupported-business-fact nghiêm trọng, hoặc latency/cost vượt budget hai cửa sổ liên tiếp.
- Prompt body và business payload không được ghi log mặc định; `AI_LOG_PROMPT_BODY` chỉ dành cho local debug có kiểm soát.

## Use case mở rộng

### UC-07a — Thiếu schema version hoặc schema version sai

- Backend trả `400 INVALID_SCHEMA_VERSION`.
- Frontend hiển thị lỗi trong panel, không ghi đè danh sách use case hiện có.

### UC-07b — Rate limit generate use case

- Backend trả `429 RATE_LIMITED`.
- Frontend giữ nguyên form hiện tại và hiển thị lỗi retryable.

### UC-07c — User chỉnh tay use case sau khi generate

- Frontend cho phép edit trực tiếp nội dung `UseCaseDraft`.
- Chỉnh sửa tay không gọi backend ngay; đây là lớp review thủ công.
- Khi có edit/review mới, draft được coi là đã lệch snapshot generate gần nhất.
- Nếu item đang `approved` mà user sửa nội dung nghiệp vụ, frontend tự chuyển item về `reviewed` để bắt buộc phê duyệt lại trước khi đi sang diagram.
- Khi đổi danh sách actors, frontend migrate `actor_ref` chỉ khi mapping cũ-mới rõ ràng; actor hoặc step reference bị dangling sẽ tạo lỗi sát flow và khóa approval.

### UC-07d — User approve toàn bộ

- Frontend đổi toàn bộ `review_status` hiện có sang `approved`.
- Đây là state tạm ở frontend cho Phase 1; chưa có persistence backend/database.

### UC-07d2 — User mở diagram inventory từ một use case đã approved

- Trên mỗi use case item đã `approved`, action chính đổi thành `Mở ở vùng sơ đồ`.
- Frontend chuyển workspace sang vùng `Diagrams` và chỉ focus/highlight item đang được xem; thao tác này không đổi canvas binding.
- Khi chưa có draft, action chính là `Tạo sơ đồ`; action này sinh và render graph thật thay vì gắn use case vào sample canvas.
- Khi đã có draft, user bấm `Mở canvas`; editor shell hiển thị context cố định gồm `use_case_id`, title, trạng thái review/diagram, và action quay lại vùng `Diagrams`.
- Chỉ `activeCanvasUseCaseId` được phép biểu thị use case đang gắn với canvas; inventory focus không phải lifecycle status.
- Label, note, style, và quyền action đều derive từ cùng một `diagram_status`. `outdated/diverged` cho phép mở bản hiện tại để bảo toàn chỉnh sửa, nhưng regenerate là action riêng có confirm; `needs_review/generating/failed` không được giả là draft sẵn sàng.
- Nếu use case đang gắn với canvas bị sửa sau approve, diagram inventory không còn coi item đó là sẵn sàng mở canvas cho tới khi user phê duyệt lại.

### UC-07g — User sửa diagram đã sinh

- Frontend giữ graph snapshot và trace metadata theo từng `use_case_id`.
- Di chuyển/resize node hoặc lane là layout edit và không tự đánh dấu lệch ngữ nghĩa.
- Đổi text, thêm/xóa node hoặc edge, đổi actor lane, import/reset/xóa graph là semantic edit và chuyển trạng thái sang `diverged`.
- Nếu use case nguồn đổi sau lần sinh gần nhất, draft chuyển sang `outdated`; nếu graph cũng đã sửa ngữ nghĩa, trạng thái ưu tiên là `diverged`.
- `Tạo lại sơ đồ` hỏi xác nhận trước khi thay một graph đã diverged.
- Mọi mutation canvas commit graph snapshot về workspace hiện tại; layout mutation giữ semantic status, còn semantic mutation chuyển draft sang `diverged`.
- Generated provenance giữ source trace khi move/resize/rename; node/edge tạo mới được đánh dấu manual. Context canvas hiển thị tổng phần tử traced, manual và untrusted.
- Draw.io export serialize provenance; import chỉ tin metadata đúng version/shape, còn file ngoài hệ thống mặc định là imported-untrusted.

### UC-07h — Regenerate use case hoặc diagram khi đã có workspace

- Sinh lại use case không xóa âm thầm diagram không còn khớp; chúng được giữ trong mục bản nháp đã lưu cho tới khi user discard có xác nhận.
- Nếu tạo lại diagram thất bại, operation hiển thị lỗi nhưng bản hiện tại vẫn mở được.
- Terminal alternate flow tạo outcome/end riêng; không dùng success end của main path.

### UC-07e — User review từng item trước khi approve

- Khi item đang ở `draft`, action chính chuyển nó sang `reviewed`.
- Khi item đang ở `reviewed`, action chính chuyển nó sang `approved`.
- User vẫn có thể `Reset review` để đưa item về `draft` nếu muốn xem lại từ đầu.

### UC-07f — User đổi spec rồi generate lại

- Nếu spec/intent hiện tại hoặc `UseCaseDraft[]` hiện tại khác snapshot generate gần nhất, frontend phải hiện confirm replace.
- Nếu user chọn huỷ, draft hiện tại được giữ nguyên.
- Nếu user xác nhận, danh sách `UseCaseDraft` mới sẽ thay thế danh sách cũ.

## Validation contract Phase 1

- Frontend `quick guard` chỉ chặn các field bắt buộc:
  - `project_name`
  - `project_summary`
  - `feature_name`
  - `feature_summary`
  - `actors` có ít nhất một dòng
- Backend là lớp `canonical validation`:
  - trim/collapse whitespace cho text fields
  - đổi optional text rỗng thành `null`
  - dedup + bỏ dòng rỗng cho list fields
  - reject required field rỗng sau normalize
- Khi hai lớp khác nhau về độ sâu kiểm tra, backend vẫn là source of truth cuối cùng cho ingestion contract.

## Input enrichment contract

| Input hiển thị | Consumer được phép ảnh hưởng |
| --- | --- |
| Project description | use-case ID context, preconditions, segmentation |
| Actors / swimlanes | actor refs, lanes, handoffs, coordination |
| Trigger | intake segmentation, preconditions, first-step trace |
| Dữ liệu vào | intake segmentation và preconditions |
| Dữ liệu đầu ra | workflow steps, coordination, success outcome |
| Quy tắc và ràng buộc | preconditions, exceptions, exception segmentation |
| Kết quả mong muốn | use-case success outcome và expected result cuối |

- `business_context` được gộp vào project description.
- `business_rules` được gộp vào feature constraints.
- `target_users`, `systems_involved`, và compatibility `primary_actor/supporting_actors` chỉ là chi tiết contract tạm thời; UI canonical phải là một danh sách actor ngang hàng.
- `function_name`, `glossary`, và `assumptions` không còn được thu thập hoặc forward trong generation flow; schema vẫn giữ tạm để đọc payload cũ.

## Out of scope cho UC-07 ở Phase 1

- Persistence database cho `ProjectSpec`, `FeatureIntent`, hoặc `UseCaseDraft`
- Diff/version history giữa các lần generate
- Tự động generate diagram ngay khi approve; user vẫn chủ động bấm `Tạo sơ đồ`
- Merge hai chiều ở cấp field giữa semantic edit trên diagram và `UseCaseDraft`; Phase 1 giữ trace và phát hiện divergence, không tự ghi ngược vào use case
- Persistence `DiagramDraft` qua reload; workspace hiện được giữ trong frontend session

## Source liên quan

- Artifact chain: [../scope/artifact-chain.md](../scope/artifact-chain.md)
- Kiến trúc tổng quan: [../scope/architecture.md](../scope/architecture.md)
- Roadmap review: [../reviews/2026-06-04-spec-to-usecase-diagram-brd-roadmap-review.md](../reviews/2026-06-04-spec-to-usecase-diagram-brd-roadmap-review.md)
