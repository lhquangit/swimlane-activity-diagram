# Danh sách tính năng

Trạng thái:
- ✅ Đã có — chạy được trong main branch.
- 🚧 Đang làm — branch / PR đang mở.
- 📋 Backlog — đã lên kế hoạch, chưa bắt đầu.

> Cập nhật mỗi khi merge PR ảnh hưởng tính năng người dùng.

## 1. Canvas & lane (Diagram surface)

| # | Tính năng | Trạng thái | Ghi chú |
|---|---|---|---|
| F-101 | Khởi tạo 4 lane mặc định (cấu hình ở `DEFAULT_LANES`) | ✅ | `src/nodes.ts` |
| F-102 | Thêm lane mới (+ Lane) | ✅ | Auto chỉnh layout |
| F-103 | Đổi tên lane (double-click) | ✅ | `window.prompt()` |
| F-104 | Xoá lane (right-click + confirm) | ✅ | Bảo vệ: tối thiểu 1 lane |
| F-105 | Snap-to-lane khi kéo node | ✅ | `snapToLane()` trong `lf-config.ts` |
| F-106 | Grid & dotted background | ✅ | `grid.type = 'dot'` |
| F-107 | Drag-pan canvas | ✅ | LF default |
| F-108 | Zoom +/− & Fit view | ✅ | Toolbar |
| F-109 | Pinch-zoom / wheel-zoom | ✅ | LF default |

## 2. Palette & node types

| # | Node | Trạng thái |
|---|---|---|
| F-201 | Start (filled circle) | ✅ |
| F-202 | Activity (rounded rect, vàng) | ✅ |
| F-203 | Decision (diamond) | ✅ |
| F-204 | Sync Bar (fork/join) | ✅ |
| F-205 | End (concentric circles) | ✅ |
| F-206 | Sticky Note | ✅ |
| F-207 | Drag-and-drop từ palette vào canvas | ✅ |
| F-208 | Custom domain stencil (Khán giả, Trưởng VOC, CCTV...) | 📋 [phase-3](../roadmap/phase-3-domain-extensions.md) |

## 3. Edge & connection

| # | Tính năng | Trạng thái |
|---|---|---|
| F-301 | Vẽ edge polyline giữa 2 node (kéo từ anchor) | ✅ |
| F-302 | Đặt label cho edge (Có / Không / text bất kỳ) | ✅ |
| F-303 | Drag điểm đầu / cuối edge sang node khác | ✅ |
| F-304 | Multi-select node + edge (kéo vùng chọn) | ✅ Plugin `SelectionSelect` |
| F-305 | Auto-route edge qua nhiều lane | ✅ |

## 4. Editing

| # | Tính năng | Trạng thái |
|---|---|---|
| F-401 | Sửa text node (double-click) | ✅ |
| F-402 | Sửa text edge (double-click) | ✅ |
| F-403 | Undo / Redo (Ctrl+Z / Ctrl+Y + toolbar) | ✅ |
| F-404 | Xoá node/edge (DEL key) | ✅ — chặn xoá lane |
| F-405 | Resize node (drag corner) | 📋 backlog |
| F-406 | Copy / paste / duplicate | 📋 backlog |

## 5. Import / Export

| # | Tính năng | Trạng thái |
|---|---|---|
| F-501 | Export PNG (Snapshot plugin) | ✅ |
| F-502 | Export SVG (serialize svg element) | ✅ |
| F-503 | Export JSON (graph data) | ✅ |
| F-504 | Import JSON (load lại diagram) | ✅ |
| F-505 | Reset về diagram mẫu | ✅ |
| F-506 | Xoá nội dung (giữ lane) | ✅ |
| F-507 | Lưu lên backend (REST API) | 📋 [phase-2](../roadmap/phase-2-collaboration.md) |

## 6. UX & Quality of life

| # | Tính năng | Trạng thái |
|---|---|---|
| F-601 | Status bar (số lane + thông báo cuối) | ✅ |
| F-602 | Hướng dẫn nhanh trong sidebar | ✅ |
| F-603 | Keyboard shortcuts (Ctrl+Z, Ctrl+Y, DEL) | ✅ |
| F-604 | Confirm dialog khi xoá lane | ✅ |
| F-605 | Tooltip cho toolbar button | ✅ một phần |
| F-606 | Dark mode | 📋 backlog |
| F-607 | i18n (EN / VN) | 📋 backlog — hiện chỉ VN |

## 7. Collaboration

| # | Tính năng | Trạng thái |
|---|---|---|
| F-701 | Realtime multi-cursor (Yjs/CRDT) | 📋 [phase-2](../roadmap/phase-2-collaboration.md) |
| F-702 | Comment / annotation trên node | 📋 backlog |
| F-703 | Version history server-side | 📋 [phase-2](../roadmap/phase-2-collaboration.md) |
| F-704 | Share link readonly | 📋 backlog |

## 8. Validation & lint

| # | Tính năng | Trạng thái |
|---|---|---|
| F-801 | Cảnh báo node mồ côi (orphan) | 📋 backlog |
| F-802 | Bắt buộc ≥1 Start, ≥1 End | 📋 backlog |
| F-803 | Cảnh báo edge không có nguồn / đích | 📋 backlog |

## Lịch sử cập nhật danh sách

- 2026-05-29 — Khởi tạo danh sách. Mọi feature ✅ đều đã chạy trong PR #1 + PR fix bug drop.
