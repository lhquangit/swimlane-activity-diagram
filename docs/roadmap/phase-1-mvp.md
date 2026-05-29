# Phase 1 — MVP: Single-user Editor

| Field | Value |
|---|---|
| **Trạng thái** | 🟢 Đang triển khai (≈90%) |
| **Bắt đầu** | 2026-05 |
| **Mục tiêu** | Editor đủ dùng trên một máy: vẽ, chỉnh sửa, lưu / mở file. |
| **Definition of Done** | Tất cả hạng mục trong bảng "Hạng mục" có ✅ + bug critical = 0. |

## Hạng mục

| # | Hạng mục | Trạng thái | PR / Note |
|---|---|---|---|
| 1.1 | Khởi tạo project (Vite + React + TS + LogicFlow) | ✅ | PR #1 |
| 1.2 | Render diagram mẫu khi mở app | ✅ | PR #1 |
| 1.3 | Palette sidebar (Start, Activity, Decision, Sync, End, Note) | ✅ | PR #1 |
| 1.4 | Drag-and-drop từ palette vào canvas | ✅ | PR #1 |
| 1.5 | Snap-to-lane khi thả node | ✅ | PR #1 |
| 1.6 | Vẽ edge giữa các node + label | ✅ | PR #1 (LogicFlow default) |
| 1.7 | Quản lý lane (thêm / đổi tên / xoá) | ✅ | PR #1 |
| 1.8 | Bảo vệ lane khỏi DEL / drag / select | ✅ | PR #1 + PR fix bug drop |
| 1.9 | Undo / Redo / Zoom / Fit | ✅ | PR #1 (LogicFlow default) |
| 1.10 | Export PNG / SVG / JSON | ✅ | PR #1 |
| 1.11 | Import JSON | ✅ | PR #1 |
| 1.12 | Reset mẫu / Xoá nội dung | ✅ | PR #1 |
| 1.13 | Fix bug shape biến mất khi thả vào lane | ✅ | PR fix bug drop (2026-05) |
| 1.14 | Tài liệu nội bộ (`docs/`) | ✅ | PR fix bug drop (2026-05) |
| 1.15 | Resize node bằng kéo góc | 📋 | Backlog |
| 1.16 | Copy / Paste / Duplicate | 📋 | Backlog |
| 1.17 | Validation cơ bản (≥1 Start, ≥1 End, no orphan) | 📋 | Backlog |
| 1.18 | Keyboard shortcut full (Ctrl+S, Ctrl+O, Ctrl+D…) | 📋 | Backlog |
| 1.19 | i18n EN/VN | 📋 | Backlog |

## Acceptance criteria

1. **Performance**: Render diagram ≤ 30 node trong < 200ms trên máy trung bình.
2. **Stability**: Drag-drop, snap, save/load không gây runtime error trong console (kiểm bằng QA manual).
3. **Compatibility**: Hoạt động trên Chrome 110+, Firefox 110+, Safari 16+.
4. **Export integrity**: PNG xuất ra hiển thị đúng diagram (không crop, không mất element).
5. **JSON roundtrip**: Save → Load lại cùng file → diagram giống hệt.

## Rủi ro hiện tại

| Rủi ro | Mức độ | Mitigation |
|---|---|---|
| LogicFlow là engine bên thứ 3, có thể có bug khó workaround | M | Đã có ví dụ fix bug zIndex; sẵn sàng fork nếu cần. |
| Chưa có test tự động | H | Thêm Playwright cho 5 use case chính trong sprint tới. |
| State đồng bộ React ↔ LogicFlow dễ sai | M | Mọi update đi qua handler trong `useEffect` mount; review code kỹ. |

## Việc cần làm tiếp (sprint hiện tại)

1. Thêm Playwright tests cho UC-01 → UC-05.
2. Thêm validation: cảnh báo khi save JSON mà có node orphan.
3. Resize node bằng drag corner (LogicFlow đã hỗ trợ, bật flag).
4. Hoàn thiện i18n.
