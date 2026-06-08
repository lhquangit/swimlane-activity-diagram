# Phase 2 — Collaboration & Persistence


| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| **Trạng thái** | ⏳ Chưa bắt đầu, đang lên kế hoạch                              |
| **Phụ thuộc**  | Phase 1 đạt Definition of Done.                                |
| **Mục tiêu**   | MVP lưu phiên bản mới nhất theo user/project; collaboration để sau. |


## Hạng mục dự kiến

### 2A — Backend & persistence


| #   | Hạng mục | Ghi chú |
| --- | --- | --- |
| 2.1 | PostgreSQL + SQLAlchemy 2.x + Alembic trên FastAPI hiện có | Đã chốt; tránh thêm backend stack thứ hai |
| 2.2 | Clerk JWT verification + `app_users` | Role mặc định `user`; `admin` để sau |
| 2.3 | Project dashboard và project CRUD | Một user có nhiều project |
| 2.4 | CRUD latest-state cho full artifact chain | Project -> Spec -> Feature -> UC -> Diagram -> BRD |
| 2.5 | Explicit Save + dirty-state UX | Không autosave, không revision history |
| 2.6 | Full reload integration test | Lưu và nạp lại toàn chain |


### 2B — Realtime collaboration


| #   | Hạng mục                                     | Ghi chú                   |
| --- | -------------------------------------------- | ------------------------- |
| 2.7 | Tích hợp Yjs (CRDT) hoặc Liveblocks          | Deferred; không thuộc persistence MVP |
| 2.8 | Hiển thị cursor / selection của user khác    | Avatar màu khác nhau      |
| 2.9 | Conflict resolution khi 2 user sửa cùng node | CRDT tự lo                |
| 2.10 | Presence indicator (ai đang online)         | Sidebar list user         |


### 2C — Comments & review


| #    | Hạng mục                                     | Ghi chú               |
| ---- | -------------------------------------------- | --------------------- |
| 2.11 | Comment trên node (pin sticky note vào node) | Threading like Figma  |
| 2.12 | Mention @user → notification                 | Email / Slack webhook |
| 2.13 | Resolve / unresolve comment                  | Filter view           |


## Acceptance criteria

1. User đăng nhập và chỉ thấy project của mình.
2. User lưu/nạp lại được full chain qua refresh.
3. Mỗi use case có tối đa một diagram và mỗi diagram có tối đa một BRD.
4. Mọi phần có trạng thái thay đổi chưa lưu và action `Lưu` rõ ràng.

## Mở rộng

- Mobile-friendly view-only mode.
- Webhook khi diagram thay đổi (CI/CD trigger nếu diagram-as-code).

## Câu hỏi cần trả lời trước khi bắt đầu

- Storage cap mỗi diagram (1MB JSON?)
- Khi xóa use case, có cascade xóa diagram/BRD ngay hay soft-delete?

Chi tiết schema và rollout:
[Database Architecture](../scope/database-architecture.md).
