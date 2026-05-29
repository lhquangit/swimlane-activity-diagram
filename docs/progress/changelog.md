# Changelog

Định dạng: theo [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) + ngày + link PR.

## [Unreleased]

### Added
- `docs/` — Tài liệu dự án đầy đủ: scope, use cases, roadmap, progress. (PR fix bug drop)

### Fixed
- **Shape biến mất khi thả vào lane**: node mới được DnD vào lane đôi khi bị che bởi lane background, chỉ hiện khi click sang lane khác. Sửa bằng cách (1) hạ `zIndex` của lane xuống `-1000`, (2) gọi `setElementZIndex(id, 'top')` cho node mới sau `node:dnd-add`, (3) tắt `isShowAnchor` cho lane để tránh anchor giả khi hover lane. Xem `src/App.tsx`, `src/nodes.ts`, `src/lf-config.ts`.

---

## 2026-05-29

### Added
- **PR #1** — Khởi tạo dự án Swimlane Activity Diagram:
  - Setup Vite + React 18 + TypeScript + LogicFlow.
  - Custom nodes: lane, start, end, activity, decision, sync-bar, note.
  - Palette sidebar có thể kéo-thả.
  - Lane mặc định 4 cột (VOC operations).
  - Snap-to-lane khi kéo node.
  - Quản lý lane: thêm, đổi tên, xoá lane qua toolbar + dbl-click + right-click.
  - Bảo vệ lane khỏi DEL key.
  - Export PNG / SVG / JSON.
  - Import JSON.
  - Undo / Redo / Zoom / Fit / Reset / Xoá nội dung.

---

## Quy tắc thêm entry

1. Mỗi PR có thay đổi hành vi user-facing → thêm entry mới.
2. Phân nhóm: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
3. Có link PR / commit khi có thể.
4. Khi release: di chuyển "Unreleased" thành version + ngày.
