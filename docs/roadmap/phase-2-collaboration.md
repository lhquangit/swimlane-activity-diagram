# Phase 2 — Collaboration & Persistence


| Field          | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| **Trạng thái** | ⏳ Chưa bắt đầu, đang lên kế hoạch                              |
| **Phụ thuộc**  | Phase 1 đạt Definition of Done.                                |
| **Mục tiêu**   | Nhiều người sửa cùng 1 diagram realtime + lưu trữ trên server. |


## Hạng mục dự kiến

### 2A — Backend & persistence


| #   | Hạng mục                                             | Ghi chú                                |
| --- | ---------------------------------------------------- | -------------------------------------- |
| 2.1 | Chọn backend stack (Node + Postgres? hoặc Supabase?) | Quyết định trước khi code              |
| 2.2 | API CRUD diagram (REST hoặc GraphQL)                 | Lưu cấu trúc JSON như phase 1          |
| 2.3 | Authentication (email + OAuth?)                      | NextAuth / Auth0 / Clerk               |
| 2.4 | Versioning: mỗi save tạo 1 snapshot                  | Dùng git-like DAG hoặc linear timeline |
| 2.5 | Share link readonly (token)                          | URL có thể public hoặc require login   |


### 2B — Realtime collaboration


| #   | Hạng mục                                     | Ghi chú                   |
| --- | -------------------------------------------- | ------------------------- |
| 2.6 | Tích hợp Yjs (CRDT) hoặc Liveblocks          | Map LF graphModel ↔ Y.Doc |
| 2.7 | Hiển thị cursor / selection của user khác    | Avatar màu khác nhau      |
| 2.8 | Conflict resolution khi 2 user sửa cùng node | CRDT tự lo                |
| 2.9 | Presence indicator (ai đang online)          | Sidebar list user         |


### 2C — Comments & review


| #    | Hạng mục                                     | Ghi chú               |
| ---- | -------------------------------------------- | --------------------- |
| 2.10 | Comment trên node (pin sticky note vào node) | Threading like Figma  |
| 2.11 | Mention @user → notification                 | Email / Slack webhook |
| 2.12 | Resolve / unresolve comment                  | Filter view           |


## Acceptance criteria

1. 2+ user mở cùng URL → thấy thay đổi của nhau trong < 500ms.
2. Mất kết nối tạm thời → reconnect không mất change.
3. Lưu lịch sử thay đổi đủ để revert về version bất kỳ.

## Mở rộng

- Mobile-friendly view-only mode.
- Webhook khi diagram thay đổi (CI/CD trigger nếu diagram-as-code).

## Câu hỏi cần trả lời trước khi bắt đầu

- Self-host vs SaaS?
- Storage cap mỗi diagram (1MB JSON?)
- Số user concurrent / diagram tối đa?
- Cần audit log không?

