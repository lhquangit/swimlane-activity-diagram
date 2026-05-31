# Phase 3 — Domain Extensions

| Field | Value |
|---|---|
| **Trạng thái** | ⏳ Backlog |
| **Phụ thuộc** | Phase 1 ổn định, Phase 2 đã có lưu trữ. |
| **Mục tiêu** | Editor không chỉ là tool generic — có stencil & template riêng cho từng domain. |

## Hạng mục dự kiến

### 3A — Domain stencil

| # | Hạng mục | Ghi chú |
|---|---|---|
| 3.1 | Stencil "VOC Operation" | Icons: CCTV, Bộ đàm, Hotline, Khán giả, Trưởng vận hành… |
| 3.2 | Stencil "An ninh sự kiện" | Icons: Cổng vào, Y tế, Cứu hộ, PCCC… |
| 3.3 | Stencil "Vận hành thiết bị" | Icons: Sensor, Camera, Cảnh báo… |
| 3.4 | Stencil picker UI | Cho user chọn stencil pack đang active |

### 3B — Template library

| # | Hạng mục | Ghi chú |
|---|---|---|
| 3.5 | Library template diagram (10–20 mẫu) | Mỗi mẫu là 1 file JSON, render preview thumb |
| 3.6 | "New from template" wizard | Hỏi tên diagram + chọn template |
| 3.7 | Save current as template | Cho phép user contribute template mới |

### 3C — Domain-specific validation

| # | Hạng mục | Ghi chú |
|---|---|---|
| 3.8 | Rule engine (ví dụ "mỗi flow VOC phải có Báo cáo") | Cấu hình per-stencil |
| 3.9 | Lint warnings hiển thị trong sidebar | Click → highlight node liên quan |

### 3D — Export tích hợp

| # | Hạng mục | Ghi chú |
|---|---|---|
| 3.10 | Export ra Markdown SOP có table + diagram | Hữu dụng cho docs handoff |
| 3.11 | Export ra Confluence / Notion qua API | Tích hợp |
| 3.12 | Export ra PDF (multi-page, header/footer) | Cho báo cáo chính thức |

## Cách tổ chức stencil

Mỗi stencil pack là 1 folder `src/stencils/<pack-name>/`:

```
src/stencils/voc-operation/
├── index.ts            # export pack registry
├── icons/              # SVG icons
├── nodes.ts            # custom node types riêng cho domain
└── templates/          # JSON template
    ├── escalation.json
    └── handover.json
```

Pack registry interface:

```ts
interface StencilPack {
  id: string;
  name: string;
  description: string;
  paletteItems: PaletteItem[];      // hiện trong sidebar khi pack active
  nodeRegistrations: NodeReg[];     // register vào LogicFlow
  templates: TemplateMeta[];        // dùng cho "New from template"
  validators?: ValidationRule[];    // optional lint rules
}
```

## Acceptance criteria

1. Có thể cài/gỡ stencil pack mà không restart app.
2. JSON export vẫn tương thích với phase 1 (graceful degradation nếu mở ở instance không có stencil tương ứng).
3. Mỗi stencil pack có hướng dẫn sử dụng riêng trong `docs/stencils/<pack-name>.md`.
