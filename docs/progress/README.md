# Tiến độ hiện tại

> Cập nhật: 2026-05-29

## Sprint hiện tại

| Sprint | Bắt đầu | Mục tiêu | Trạng thái |
|---|---|---|---|
| Sprint 0 (Bootstrap) | 2026-05-29 | Khởi tạo PoC, demo cho stakeholder | ✅ Hoàn tất (PR #1) |
| Sprint 1 (Stability) | 2026-05-29 → 2026-06-12 | Fix bug, tài liệu, automation test | 🟡 Đang chạy |

## Status dashboard

| Hạng mục | % hoàn thành | Note |
|---|---|---|
| Phase 1 — MVP | ~90% | Còn validation, resize, copy/paste, i18n |
| Tài liệu nội bộ | 100% (initial) | `docs/` mới được khởi tạo, cần duy trì update |
| Test tự động | 0% | Chưa có Playwright/Vitest setup |
| CI/CD | Lint + build trong PR | Chưa có deploy pipeline |
| Production deploy | Chưa | App đang chỉ chạy local dev |

## Burn-down (sprint hiện tại)

| Hạng mục | Estimate | Trạng thái |
|---|---|---|
| Fix bug shape biến mất khi thả vào lane | 1d | ✅ Done |
| Tạo docs/ folder + initial content | 0.5d | ✅ Done |
| Playwright test cho UC-01..05 | 2d | 📋 Pending |
| Validation: cảnh báo orphan node | 0.5d | 📋 Pending |
| Resize node bằng kéo góc | 0.5d | 📋 Pending |
| Hoàn thiện tooltip + UX nhỏ | 0.5d | 📋 Pending |

## Issues đang mở

Xem chi tiết tại [known-issues.md](known-issues.md).

| ID | Severity | Tên | Status |
|---|---|---|---|
| (none right now) | — | — | — |

Tất cả issue đã biết đã được fix hoặc đang trong roadmap. Nếu phát hiện mới → thêm vào `known-issues.md`.

## Quick links

- [Changelog](changelog.md)
- [Known issues](known-issues.md)
- [Phase 1 detail](../roadmap/phase-1-mvp.md)
- [Features](../scope/features.md)

## Quy tắc cập nhật file này

- Đầu mỗi sprint: cập nhật bảng "Sprint hiện tại" và "Burn-down".
- Cuối sprint: di chuyển hạng mục đã xong vào `changelog.md`, cập nhật phần trăm phase.
- Khi có issue mới: thêm vào `known-issues.md`, link trong bảng "Issues đang mở".
