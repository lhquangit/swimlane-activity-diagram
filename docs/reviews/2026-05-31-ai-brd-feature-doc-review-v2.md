# Review v2 — `docs/product/ai-brd-description-feature.md`

## Scope

- Project: swimlane-activity-diagram
- Reviewer: Devin (Cognition)
- Date: 2026-05-31 (review v2)
- Artifact reviewed: `docs/product/ai-brd-description-feature.md` (627 dòng, snapshot tại commit `38601de`)
- So sánh với review v1: `docs/reviews/2026-05-31-ai-brd-feature-doc-review.md` và meta-review `docs/reviews/2026-05-31-ai-brd-feature-doc-review-meta-review.md`
- Goal: đánh giá doc sau khi đã rewrite, xác định những điểm còn lại trước khi vào implementation.

## Executive summary

Bản v2 đã giải quyết phần lớn các điểm trong review v1. Doc bây giờ đủ chi tiết để chuyển sang implementation design cho Phase 1. Các điểm còn lại chủ yếu là **fine-tune** và một số **chỗ schema / API contract** cần làm rõ trước khi viết code.

So với review v1:

- 14/16 nhóm "thiếu" (A1-A16) đã được bổ sung.
- 9/11 nhóm "bất hợp lý / mâu thuẫn" (B1-B11) đã được sửa.
- 2 blocker product (backend strategy A4, privacy A5) đã có quyết định rõ.

Đồng ý với meta-review của Codex: các fine-tune cấp API (`reasoning_effort`, snapshot id, structured outputs strict, nano model) nên di chuyển sang **implementation design** chứ không cần ép vào product spec.

## Những điểm v1 đã được v2 xử lý (acknowledgement)


| v1 ID                        | v2 đã giải quyết tại                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| A1 Scope/Out-of-scope        | Section 3                                                                                 |
| A2 User journey              | Section 5 (chưa tạo file UC-06 riêng)                                                     |
| A3 UX/Trigger                | Section 6                                                                                 |
| A4 Backend strategy          | Section 4.3 (FastAPI Python) — **decision chốt**                                          |
| A5 Privacy                   | Section 14                                                                                |
| A6 i18n                      | Section 4.2 (VN-first Phase 1)                                                            |
| A7 Input/Output schema       | Section 9 + 10 (TS interface)                                                             |
| A8 Eval                      | Section 17                                                                                |
| A9 Error handling            | Section 15                                                                                |
| A10 Prompt injection         | Section 14.2                                                                              |
| A11 Storage lifecycle        | Section 16 + invalidation rule                                                            |
| A13 DoD per phase            | Section 18                                                                                |
| A15 Cross-links              | Section 20                                                                                |
| A16 Document metadata        | Section 10 `metadata` trong spec                                                          |
| B1 Pipeline mismatch         | Section 8 (7 bước nhất quán, Normalize tách riêng)                                        |
| B2 Naming actor/role         | Đã dùng `actor` xuyên suốt trong spec, "Roles" chỉ là tên section trong Option B template |
| B3 Sticky note semantic      | Section 9.3 (`anchored_note` / `global_note`)                                             |
| B4 Decision unlabeled        | Section 9.2 + 8.7 ("không được tự bịa outcome")                                           |
| B5 Cycle handling            | Section 9.2 + spec field `loops[]`                                                        |
| B6 Handoff definition        | Section 9.2 ("transition giữa 2 node thuộc 2 lane khác nhau")                             |
| B7 Parallel block definition | Section 9.2 ("segment bắt đầu ở sync-bar fork và kết thúc ở sync-bar join")               |
| B8 Option A/B reasoning      | Section 11.3 (template = render layer, spec = canonical)                                  |
| B10 URL nguồn model          | Section 21 References                                                                     |
| B11 Phase 3 dependency       | Section 19                                                                                |


## Còn lại — phân loại theo Now / Next / Implementation-design

### Now (cần fix trong product spec trước khi bắt đầu)

#### N1. Schema thiếu vài field đã có trong code hiện tại

`DiagramSemanticRequest` (Section 9.1) chưa khớp 100% với metadata thực tế trong code sau `TASK-002` / `TASK-006`:

- `node.size` hoặc `node.width` / `node.height` — code đã persist manual resize, nếu schema không transport thì backend không biết chiều rộng thực tế (ảnh hưởng tới detect handoff khi shape tràn lane).
- `sync-bar.span` topology — code đã có `span` metadata (lane đầu, lane cuối) sau TASK-002. Schema hiện chỉ có generic `metadata?: Record<string, unknown>`. Đề xuất add field cụ thể `span: { from_lane_id, to_lane_id }` cho `node.type === 'sync-bar'`.
- `note.anchor` — Section 9.3 nói note có anchor, nhưng schema chưa có field. Nếu anchor được tính ở backend thì OK, nhưng nên ghi rõ "anchor được derive ở backend, không truyền từ frontend".
- `lane.width`, `lane.height` — không có trong schema. Nếu backend không cần thì OK, nhưng nên ghi rõ.

Fix: thêm 1 câu sau Section 9.1 nói rõ "Các field x/y/width/height có thể bị backend ignore — chỉ là hint, không quyết định semantic" hoặc bổ sung field cần thiết.

#### N2. API contract chưa đủ để implement client

Section 13 mới mô tả input/output cấp dữ liệu, nhưng thiếu:

- HTTP status codes (200, 400 cho validation error, 422 cho ambiguous-but-acceptable, 5xx cho model fail).
- Shape của error response (`{ code, message, related_node_ids[] }`?).
- Auth: Phase 1 có require auth không? BYOK header? Anonymous?
- Idempotency key cho `/generate` (vì call có thể tốn $ và slow → user retry có nguy cơ double-charge).
- Streaming format: Section 6 mention "loading step-by-step" và Section 7.1 noi frontend "render warnings / spec / BRD" — backend trả 1 response hay SSE stream từng phase?

Fix: thêm subsection `13.4 Error response & status codes` và `13.5 Streaming policy`.

#### N3. Phase 1 DoD thiếu performance target

Section 18 DoD chỉ có functional criteria. So với `docs/roadmap/phase-1-mvp.md` mục "Acceptance criteria" có:

- "Render diagram ≤ 30 node trong < 200ms"

BRD feature nên có analog:

- Latency p50 / p95 cho generate (ví dụ p50 < 30s, p95 < 90s với diagram ≤ 30 node)
- Cost cap per generation (ví dụ < $0.20 với gpt-5.5)
- Validate-only request p95 < 2s

Fix: thêm 2-3 bullet performance vào DoD Phase 1.

#### N4. Bảng rủi ro + mitigation thiếu

Convention `docs/roadmap/phase-1-mvp.md` có bảng "Rủi ro hiện tại" 3 cột. Doc này chỉ có Privacy + Error handling rời rạc, chưa gom thành bảng.

Đề xuất bảng `## Rủi ro & mitigation` với entries tối thiểu:


| Rủi ro                        | Mức | Mitigation                                                                |
| ----------------------------- | --- | ------------------------------------------------------------------------- |
| Model drift theo phiên bản    | M   | Pin model snapshot trong implementation (Section 12.3) + eval set định kỳ |
| Hallucinate với diagram mơ hồ | H   | Post-check rule (Section 8.7) + `ambiguity_score` trong spec              |
| Cost vượt budget              | M   | 2-model strategy + per-user quota + cap per generation                    |
| Privacy leak qua provider     | M   | Section 14 + tùy chọn self-hosted Phase 3                                 |
| Provider outage               | L   | Provider abstraction (Section 7.3) — graceful degrade                     |


#### N5. Decision/wording fixes nhỏ

- **Section 12.4** "Không khuyến nghị: không generate prose trực tiếp..." — double negative. Đổi `Tránh: generate prose trực tiếp từ raw diagram JSON trong một pass` cho rõ hơn.
- **Section 11.3** "tốt hơn việc duy trì hai data model song song" — viết lại "tốt hơn duy trì hai data model song song" (bỏ "việc" cho gọn). Nit.
- **Section 19** "có thể bắt đầu ở **Phase 1 mở rộng**" — cụm "Phase 1 mở rộng" mới xuất hiện, chưa định nghĩa trước đó. Đề xuất gắn rõ với roadmap: "Tạo Phase 1 sub-track riêng cho AI BRD, song song với MVP editor".

### Next (cần làm sớm nhưng có thể sau khi unblock implementation)

#### NX1. Tạo `UC-06-sinh-brd-tu-diagram.md`

Section 5 đã cover luồng, nhưng chưa có file UC riêng theo convention UC-01..UC-05. Khi implement, cần file này để link từ `docs/scope/features.md` (F-901).

Có thể chỉ là stub trích từ Section 5 + 6 hiện có, không cần viết lại từ đầu.

#### NX2. Bảng cost / token estimation

Section 12 chốt model nhưng chưa có ước lượng:

- Token estimate cho diagram trung bình (~10-30 node): input ~ 3-5k tokens? Output spec ~ 2-3k? Output prose ~ 1-2k?
- Cost ước lượng (gpt-5.5: $5/$30 per 1M I/O) → khoảng $0.05-0.20/diagram?
- Quota policy: ai có quota, reset thế nào.

Có thể defer sang implementation design nếu chưa có data thật. Nhưng cần có **upper bound** để decide có gate access hay không.

#### NX3. Deployment topology

Section 4.3 chốt FastAPI nhưng không nói:

- Backend deploy ở đâu (cùng repo? mono repo `apps/api/`? separate repo?)
- Hosting (Fly.io / Vercel functions / VPS?)
- CORS policy cho frontend → backend

Cần resolve trước khi vào implementation. Có thể là 1 file riêng `docs/scope/architecture-brd-backend.md`.

#### NX4. Section 11.2 Phase 2 template — nên link sang Phase 2 doc

Section 11.2 liệt kê 16-section template "enterprise", nhưng không nói khi nào dùng / config thế nào. Phase 2 roadmap chưa cập nhật.

Fix Phase 2: trong `docs/roadmap/phase-2-collaboration.md`, add hạng mục "Full BRD template + language selector".

### Implementation-level (defer khỏi product spec — theo meta-review)

Các điểm sau từ review v1 nên di chuyển sang implementation design doc khi bắt đầu Phase 1 build:

- `reasoning_effort` setting cho từng step
- Pin model snapshot ID cụ thể (vd `gpt-5.5-2026-04-24`)
- Structured outputs strict transport thay vì parse-and-retry
- Cân nhắc thêm `gpt-5.4-nano` cho validate-only step
- Sanitization concrete cho prompt injection (escape chars, separator format)
- Schema chi tiết cho `metadata?: Record<string, unknown>` cho từng node type

## Đánh giá tổng thể

- **Sẵn sàng cho implementation kickoff**: gần xong. Cần xử lý N1 + N2 + N3 + N4 + N5 trước khi bắt đầu code.
- **NX block**: có thể bắt đầu Phase 1 với UC stub trong Section 5, tạo UC-06 song song.
- **Implementation-level items**: đưa vào `docs/scope/architecture-brd-backend.md` hoặc một implementation design doc riêng khi mở Phase 1 build branch.

## Đề xuất disposition

1. Merge PR #4 (review v1 + v2 snapshot).
2. Mở 1 PR nhỏ riêng để fix nhóm Now (N1-N5) ngay trên doc gốc.
3. Khi bắt đầu code, tạo:
  - `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`
  - `docs/scope/architecture-brd-backend.md` (hoặc tích hợp vào `architecture.md` hiện có)
  - Task list trong `docs/review-task-list.md` cho từng step trong pipeline 7 bước.

