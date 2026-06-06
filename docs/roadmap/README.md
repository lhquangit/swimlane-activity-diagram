# Roadmap

Roadmap chia theo 3 phase. Mỗi phase có file riêng mô tả chi tiết các hạng mục, deliverable, và acceptance criteria.

| Phase | Tên | Trạng thái | Mục tiêu |
|---|---|---|---|
| 1 | [MVP — Single-user Editor](phase-1-mvp.md) | 🟢 Đang triển khai (≈90%) | Editor đầy đủ trên 1 máy: vẽ, chỉnh sửa, import/export. |
| 2 | [Collaboration & Persistence](phase-2-collaboration.md) | ⏳ Lên kế hoạch | Backend lưu trữ + realtime multi-cursor. |
| 3 | [Domain Extensions](phase-3-domain-extensions.md) | ⏳ Backlog | Stencil riêng cho từng nghiệp vụ (VOC, an ninh sự kiện…). |

## Tổng quan đường đi

```
    ┌──────────────────────┐
    │  Phase 1 — MVP        │
    │  Editor đơn người     │
    │  Export JSON/SVG/PNG  │
    └──────────┬───────────┘
               │ JSON-as-source-of-truth
               ▼
    ┌──────────────────────┐
    │  Phase 2 — Collab     │
    │  Backend + multi-user │
    │  Versioning + share   │
    └──────────┬───────────┘
               │ Stencil & template
               ▼
    ┌──────────────────────┐
    │  Phase 3 — Domain     │
    │  Stencil VOC/security │
    │  Template thư viện    │
    └──────────────────────┘
```

## Nguyên tắc ưu tiên

1. **Hoàn thiện trước, mở rộng sau** — phase 1 phải solid (không bug critical) trước khi sang phase 2.
2. **Diagram-as-code first** — JSON luôn là source of truth, mọi tính năng đều phải xuất ra JSON tương thích ngược.
3. **Single page app** — không thêm dependency nặng (framework lớn, build tool khác) trừ khi thật cần.
4. **VN-first UI** — tiếng Việt là primary, EN có thể đến sau.

## Liên kết

- Tính năng đã có: [../scope/features.md](../scope/features.md)
- Tiến độ thực tế: [../progress/README.md](../progress/README.md)

## Hướng AI kế tiếp

Sau khi editor + `diagram -> BRD draft` đã đủ ổn, hướng mở rộng được ưu tiên là:

1. `project spec + function intent`
2. `use-case list`
3. `activity diagram draft cho từng use case`
4. `formal BRD` tổng hợp từ portfolio use case + diagram đã review

Về UX, chain này giờ được phản ánh ngay trong editor bằng một workspace 3 vùng:

1. `Input` — nơi user điền `ProjectSpec` và `FeatureIntent`
2. `Use cases` — nơi user review/edit/approve output use case
3. `Diagrams` — nơi user thấy inventory diagram gắn theo từng use case và bước tiếp theo đi sang canvas

Thứ tự này được review chi tiết tại:

- [../reviews/2026-06-04-spec-to-usecase-diagram-brd-roadmap-review.md](../reviews/2026-06-04-spec-to-usecase-diagram-brd-roadmap-review.md)
- [../reviews/2026-06-04-ai-brd-formal-template-review.md](../reviews/2026-06-04-ai-brd-formal-template-review.md)
