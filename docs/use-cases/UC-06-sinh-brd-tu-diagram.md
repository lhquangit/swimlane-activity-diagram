# UC-06 — Sinh BRD từ diagram
 
| Field        | Value                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| **Mã**       | UC-06                                                                                  |
| **Tên**      | Sinh BRD draft từ swimlane activity diagram                                            |
| **Actor**    | BA / Solution Engineer (chính); Operation Lead / QA (review)                            |
| **Mục tiêu** | Có bản BRD draft tiếng Việt + structured spec + warning list từ diagram đang vẽ.       |
| **Trigger**  | User bấm `Generate BRD` trên toolbar của editor sau khi đã hoàn thiện diagram cơ bản.  |
 
## Tiền điều kiện
 
- Diagram đang mở có tối thiểu 1 lane và 1 node `start` + 1 node `end`.
- Backend `POST /api/brd/validate` và `POST /api/brd/generate` đang sẵn sàng (xem `docs/scope/architecture-brd-backend.md`).
- `BRD_OPENROUTER_API_KEY` đã cấu hình ở backend; **frontend không cầm key**.
- User chấp nhận policy privacy hiện tại (xem Section 14 của `docs/product/ai-brd-description-feature.md`).
 
## Bước thực hiện
 
1. User hoàn thiện diagram trên canvas (đặt lane, activity, decision, sync-bar, sticky note tuỳ ý).
2. User bấm `Generate BRD` trên toolbar chính.
3. Frontend chạy validate sơ bộ ngay trong browser:
   - tối thiểu 1 start + 1 end
   - mọi node activity / decision đều thuộc 1 lane
   - mọi edge có source + target hợp lệ
4. Nếu validate sơ bộ fail → frontend hiển thị dialog lỗi, chưa gọi backend.
5. Nếu pass, frontend normalize graph thành `DiagramSemanticRequest` (Section 9.1 của feature doc) và gọi `POST /api/brd/validate`.
6. Backend chạy Step 1-3 của pipeline (Extract, Normalize, Validate) và trả:
   - `warnings[]` cấp deep semantic (cycle, decision unlabeled, sync-bar span thiếu, orphan note...)
   - blocking issues nếu có
7. Nếu có blocking issue → panel mở tab `Warnings`, user phải sửa diagram trước khi tiếp tục.
8. Nếu không có blocking, frontend gọi tiếp `POST /api/brd/generate` với `template: 'default'`.
9. Backend chạy Step 4-7 của pipeline:
   - Interpret graph thành canonical structure
   - Gọi model sinh `DiagramBRDSpec` (structured spec) theo schema cố định
   - Render BRD markdown từ structured spec
   - Post-check rule-based (actor lạ, step không trace được, decision bịa outcome)
10. Frontend mở side panel với 3 tab:
    - `Warnings` — bao gồm warnings + open questions + assumptions
    - `Structured Spec` — JSON view, read-only
    - `BRD Draft` — markdown editor, **có thể chỉnh sửa**
11. User review, chỉnh sửa BRD markdown trực tiếp trong tab `BRD Draft` nếu cần.
12. User bấm `Export markdown` để tải file `.md`, hoặc `Copy` để copy vào clipboard.
 
## Kết quả mong đợi
 
- Panel hiển thị BRD draft với đầy đủ 10 section của template Phase 1 (process overview → assumptions / open questions).
- Mọi actor trong BRD map được về `lane_id` trong diagram.
- Mọi main flow step có `node_id` reference (traceability đầy đủ).
- Decision không có label trên edge xuất hiện ở mục `open_questions`, không bị model tự bịa `Có/Không`.
- Loop được render trong `Exceptions / warnings`, không tạo section `Loops` riêng ở Phase 1.
- Sticky note không tạo step mới; nội dung note được map vào `Assumptions / open questions`.
- Status: `Draft · Needs review · Warnings present` (hoặc `No blocking warnings` nếu graph sạch).
 
## Use case mở rộng
 
### UC-06a — Diagram có cycle (retry / escalation flow)
 
- Backend detect cycle ở Step 3 và ghi vào `loops[]` thay vì fail.
- BRD output đưa thông tin loop vào `Exceptions / warnings`, mô tả các node tham gia vòng lặp và lý do (note đính kèm nếu có).
- Không ép topo sort — main flow render dạng linear theo entry point gần `start` nhất.
 
### UC-06b — Decision không có label trên edge
 
- Step 3 phát hiện edge từ `decision` không có label.
- Output `outcomes[].status = 'unlabeled'` cho mỗi nhánh không label.
- BRD draft thêm mục vào `open_questions[]` dạng "Quyết định tại bước X chưa rõ tiêu chí phân nhánh; cần xác nhận."
- Post-check (Step 7) reject nếu model tự sinh nội dung `Có/Không` cho nhánh unlabeled.
 
### UC-06c — Sticky note không gần node nào
 
- Step 4 (Interpret) phân loại note thành `global_note` thay vì `anchored_note`.
- BRD draft đưa nội dung note vào `Assumptions / open questions`, không gắn vào bất kỳ step cụ thể nào.
- `assumptions[]` ghi: "Note '<text>' không xác định được vị trí trong flow."
 
### UC-06d — Model timeout hoặc trả invalid JSON
 
- Backend retry tối đa N lần (Section 15 feature doc).
- Nếu vẫn fail, backend trả `502 Bad Gateway` với `retryable: true`.
- Frontend hiển thị toast: "Sinh BRD thất bại. Bấm để thử lại." kèm `Idempotency-Key` cũ.
 
### UC-06e — User chỉnh sửa BRD draft rồi export
 
- User chỉnh sửa markdown trong tab `BRD Draft` (Phase 1 không sync ngược vào structured spec).
- Khi export, file `.md` chứa nội dung user đã chỉnh sửa, **không phải** nội dung gốc model trả về.
- Phase 2 sẽ bổ sung warning "BRD draft khác với structured spec" nếu user chỉnh sửa quá nhiều.
 
### UC-06f — Diagram đã đổi sau khi generate
 
- Sau khi đã có BRD draft, user tiếp tục chỉnh sửa diagram (thêm node, đổi label edge).
- Panel hiển thị badge `Outdated — diagram changed since last generate`.
- User phải bấm `Regenerate` để cập nhật, hoặc bấm `Keep this draft` để xác nhận giữ bản cũ.
 
## Out of scope cho UC-06 ở Phase 1
 
- Multi-diagram → 1 BRD (Phase 3).
- Regenerate từng section riêng từ structured spec đã sửa (Phase 2).
- Highlight node trên canvas khi hover lên step trong BRD (Phase 2).
- Output ngôn ngữ khác tiếng Việt trong cùng 1 lần generate (Phase 2).
 
## Source liên quan
 
- Feature definition: [../product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md)
- Backend architecture: [../scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md)
- Feature backlog entry: [../scope/features.md#9-ai-assistance](../scope/features.md#9-ai-assistance)
- Pipeline 7 bước: feature doc Section 8.
- Schema chi tiết: feature doc Section 9 (request) + Section 10 (spec).
 
