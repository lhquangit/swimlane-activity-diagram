# UC-07 — Sinh use case draft từ project spec

| Field | Value |
| --- | --- |
| **Mã** | UC-07 |
| **Tên** | Sinh danh sách use case draft từ `ProjectSpec` và `FeatureIntent` |
| **Actor** | BA / Solution Engineer (chính); Product Owner / QA (review) |
| **Mục tiêu** | Có một workspace rõ ràng để nhập `ProjectSpec + FeatureIntent`, review/edit danh sách use case output, rồi nhìn thấy ngay inventory diagram tương ứng cho từng use case. |
| **Trigger** | User lưu `Feature Intent`, bấm sinh use case từ artifact đang chọn, rồi review từng Use Case xuất hiện trong left artifact tree. |

## Cập nhật flow 2026-06-07

- Flow canonical trong workspace persisted là:
  `Project Spec -> Feature Intent -> Use Cases trong left bar -> Use Case editor -> Generate Diagram`.
- Sau khi sinh từ `Feature Intent`, danh sách `Use Case` phải trở thành resource thật hoặc được lưu trong cùng một hành động rõ ràng để left bar refresh ngay.
- Người dùng sửa từng `Use Case` bằng route/editor riêng; overlay `Use case workspace` không còn là primary UX cho persisted mode.
- Nút `Tạo diagram` nằm trên Use Case đã lưu/phê duyệt và trên missing Diagram state tương ứng.
- Persisted `Use Case` route là một trang đọc-trước-sửa-sau: actors, thông tin chung, luồng chính, luồng thay thế, và next actions đều có summary riêng trước khi bung editor chi tiết.

## Tiền điều kiện

- Frontend đang mở editor chính.
- Backend `POST /api/usecases/generate` sẵn sàng.
- Schema version frontend/backend khớp `2026-05-31`.

## Bước thực hiện

1. User mở hoặc tạo `Feature Intent` từ left artifact tree.
2. User điền và lưu tên chức năng, mô tả chức năng, danh sách `Actors / swimlanes` và kết quả mong muốn. Tất cả actor user nhập đều là actor chính của quy trình; UI không phân cấp actor chính/phụ và không giấu actor trong `Thông tin bổ sung`.
3. User bấm action sinh use case bằng AI trên `Feature Intent` hoặc vùng `Use Cases` của feature đang chọn.
4. Frontend chạy `quick guard` cục bộ cho các field bắt buộc:
   - `project_name`
   - `project_summary`
   - `feature_name`
   - `feature_summary`
   - `actors` có ít nhất một dòng
5. Nếu `quick guard` fail, frontend giữ user ở vùng `Input`, disable action generate, và hiển thị lỗi ngay trong workspace.
6. Nếu đang có `UseCaseDraft` đã review/chỉnh sửa hoặc spec hiện tại khác fingerprint lần generate gần nhất, frontend phải so snapshot hiện tại với snapshot generate gần nhất trước khi quyết định có hiện confirm replace hay không.
7. Frontend gửi `POST /api/usecases/generate` với payload schema ổn định, không dùng raw prompt tự do.
8. Frontend chỉ yêu cầu **AI authoring**. Nếu runtime không cho phép authoring, CTA phải bị disable
   từ trước và route generate phải fail closed thay vì trả về scaffold. Backend:
   - validate `X-Schema-Version`
   - canonical normalize/trim/dedup ingestion payload
   - áp dụng rate limit
   - build `artifact_chain`
   - giữ `FeatureIntent.actors` làm participant set canonical, không hạ cấp actor kỹ thuật như
     camera, AI model, service, pipeline hoặc gateway thành actor con người chung chung
   - kiểm tra runtime availability nội bộ (`deterministic`, `ai_shadow`, `ai_opt_in`,
     `ai_default`) để quyết định **có cho phép AI authoring hay không**
   - nếu được phép gọi AI: render prompt version đã pin từ asset markdown versioned, synthesize
     semantic output, kiểm tra schema/evidence/quality và hydrate stable IDs
   - retry tối đa một lần với validation codes đã sanitize
   - nếu provider lỗi, auth lỗi, hoặc output không đạt quality/grounding, route trả lỗi rõ ràng và
     **không** trả về portfolio scaffold thay thế
9. Frontend lưu hoặc cập nhật danh sách `Use Case` theo contract persisted, refresh left artifact tree, rồi hiển thị:
   - nguồn sinh `Bản nháp AI` cho lần generate thành công
   - nếu lần gọi AI thất bại, giữ nguyên portfolio đã lưu trước đó và hiển thị lỗi retry/config
     thay vì hiển thị scaffold fallback như artifact mới
   - metadata lần sinh gần nhất trên persisted list/editor đủ để phân biệt AI success, AI failed,
     và legacy degraded drafts còn sót từ contract cũ
   - danh sách use case đã persist và có thể mở từng item để chỉnh sửa
   - trạng thái review `draft / reviewed / approved`
   - next action rõ ràng trên từng item
10. User chọn từng `Use Case` trong left artifact tree và chỉnh trực tiếp structured main/alternate flow; `happy_path_summary` và `key_exceptions` được derive, không phải nguồn edit thứ hai.
11. Frontend validate detailed contract sau mỗi edit và chỉ cho phép `Đánh dấu đã rà soát`, `Phê duyệt`, hoặc `Tạo diagram` khi actor/step/branch references, stable IDs, outcome mode và text bắt buộc đều hợp lệ.
12. Khi use case đã `approved`, editor của Use Case hiển thị action `Tạo diagram`, `Mở diagram`, hoặc `Tạo lại diagram` tương ứng từ cùng một lifecycle model với diagram inventory.
13. Missing Diagram state và/hoặc diagram inventory phải cho thấy:
   - use case nào chưa sẵn sàng đi sang diagram
   - use case nào đã `approved` và sẵn sàng cho bước diagram
   - use case nào đang được xem trong inventory, tách biệt với use case đang gắn thật với canvas
   - `Tạo diagram` khi use case đã approved nhưng chưa có draft
   - `Mở diagram` chỉ khi đã có `DiagramDraft` thật
   - `Tạo lại diagram` khi draft đã outdated/diverged
14. `Artifact chain` không còn nằm giữa primary flow; nó được chuyển vào `Advanced traceability`.
15. Khi user chọn `Tạo diagram`, frontend gửi use case approved sang endpoint generate diagram tương ứng, chuyển `DiagramDraft` trả về thành LogicFlow graph, lưu workspace theo `use_case_id`, refresh tree, giữ user ở lại Use Case page, rồi hiển thị action `Mở diagram` như bước tiếp theo rõ ràng.
16. Mọi node/edge generated mang provenance versioned và source trace; element tạo tay mang provenance `manual`, còn metadata import không hợp lệ được đánh dấu `imported/untrusted`.

## Kết quả mong đợi

- Có một flow tách bạch giữa Feature Intent input, left-bar Use Case inventory, từng Use Case editor, và Diagram artifact.
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
- Use Case editor và missing Diagram state hiển thị trạng thái tối thiểu gắn theo `use_case_id`, kể cả khi trạng thái ban đầu mới chỉ là “ready for diagram” hoặc “needs approval”.
- Workspace vẫn duy trì artifact chain:
  - `ProjectSpec`
  - `FeatureIntent`
  - `UseCaseDraft`
  - `DiagramDraft`
  - `FormalBRDDraft`
- Response metadata đủ để trace capability, source, mode, provider/model, prompt ID/version/fingerprint, attempt, latency, token/cost, quality và failure reason.

## AI authoring contract

- BA-facing authoring là **AI-only**. Không còn lựa chọn scaffold/rule trên màn `Use Case`.
- `deterministic` và `ai_shadow` là trạng thái môi trường nội bộ làm authoring **unavailable** cho
  user; chúng không được quảng bá như một chất lượng output thay thế.
- `ai_opt_in` và `ai_default` là các trạng thái môi trường cho phép AI authoring; UI chỉ cần biết
  `available / degraded / unavailable`, không expose rollout flag raw cho BA.
- Khi AI call fail hoặc output bị quality gate reject, response phải fail closed. Không sinh ra
  portfolio scaffold mới và không overwrite danh sách Use Case đã lưu trước đó.
- Chỉ bật các runtime cho phép authoring khi golden quality pass, failure rate nằm trong budget,
  p95 latency nằm trong budget sản phẩm và cost/request nằm trong budget vận hành đã duyệt.
- Rollback khi AI failure hoặc quality rejection vượt threshold theo dõi, có unsupported-business-fact nghiêm trọng, hoặc latency/cost vượt budget hai cửa sổ liên tiếp.
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

### UC-07d2 — User mở diagram inventory từ một use case đã approved

- Trên mỗi use case item đã `approved`, action chính là `Tạo diagram` nếu chưa có draft.
- Khi đã có draft hiện hành, user bấm `Mở diagram`; editor shell hiển thị context cố định gồm `use_case_id`, title, trạng thái review/diagram, và action quay lại `Use Cases`.
- Khi draft đã outdated/diverged, user có thể `Mở diagram` để xem bản hiện có hoặc `Tạo lại diagram` với confirm riêng.
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
- Prompt use-case phải được quản lý như asset versioned trong `apps/api/app/ai/prompts/assets/usecase_synthesis/*`
  thay vì hard-code trong Python module để BA/AI reviewer có thể audit và iterate độc lập.
- Default policy hiện tại cho BA-facing AI synthesis là `USECASE_PROMPT_VERSION=1.2.0` và
  `USECASE_MODEL_PRIMARY=openai/gpt-5.5`; prompt này ép mạnh hơn việc tách ranh giới business,
  tránh “một flow lớn rồi đổi câu chữ”, và được khóa bằng complaint-domain golden suite.
- Validation guardrails (`schema`, `grounding`, `quality`, `hydrator`) vẫn là một phần bắt buộc của
  pipeline AI-only. “AI-only authoring” không có nghĩa là chấp nhận free-form output chưa qua
  contract enforcement.
- `function_name`, `glossary`, và `assumptions` không còn được thu thập hoặc forward trong generation flow; schema vẫn giữ tạm để đọc payload cũ.

## Out of scope cho UC-07 ở Phase 1

- Diff/version history giữa các lần generate
- Tự động generate diagram ngay khi approve; user vẫn chủ động bấm `Tạo diagram`
- Merge hai chiều ở cấp field giữa semantic edit trên diagram và `UseCaseDraft`; Phase 1 giữ trace và phát hiện divergence, không tự ghi ngược vào use case
- Diff/version history hoặc semantic merge tự động cho `DiagramDraft` đã persist

## Source liên quan

- Artifact chain: [../scope/artifact-chain.md](../scope/artifact-chain.md)
- Kiến trúc tổng quan: [../scope/architecture.md](../scope/architecture.md)
- Roadmap review: [../reviews/2026-06-04-spec-to-usecase-diagram-brd-roadmap-review.md](../reviews/2026-06-04-spec-to-usecase-diagram-brd-roadmap-review.md)
