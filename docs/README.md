# Tài liệu dự án — Swimlane Activity Diagram

Thư mục này chứa toàn bộ tài liệu kỹ thuật và sản phẩm của **Swimlane Activity Diagram Editor**. Mục tiêu là mọi người (dev mới, PM, stakeholder) đều có thể nhanh chóng nắm được phạm vi, cách dùng, kế hoạch phát triển và tình trạng hiện tại.

## Cấu trúc thư mục

```
docs/
├── README.md                ← Bạn đang ở đây — index toàn bộ tài liệu
├── scope/                   ← Phạm vi & kiến trúc dự án
│   ├── overview.md          ← Tổng quan, mục tiêu, đối tượng dùng
│   ├── architecture.md      ← Stack công nghệ & thiết kế tổng thể
│   ├── database-architecture.md ← PostgreSQL, artifact revisions, auth và provenance
│   └── features.md          ← Danh sách tính năng hiện có
├── use-cases/               ← Các kịch bản sử dụng end-to-end
│   ├── README.md
│   ├── UC-01-tao-diagram-tu-mau.md
│   ├── UC-02-them-shape-vao-lane.md
│   ├── UC-03-quan-ly-lane.md
│   ├── UC-04-noi-edge-va-label.md
│   └── UC-05-import-export.md
├── review-task-list.md      ← Code review + task list để triển khai
├── reviews/                 ← Archive các lần code review theo ngày/scope
│   └── README.md            ← Quy ước lưu review snapshot
├── activity-log/            ← Nhật ký nhẹ cho mọi request theo tháng
│   ├── README.md            ← Quy tắc phân loại và routing log
│   └── YYYY-MM.md           ← Log request theo tháng
├── roadmap/                 ← Kế hoạch phát triển theo giai đoạn
│   ├── README.md            ← Tóm tắt roadmap
│   ├── phase-1-mvp.md       ← Giai đoạn hiện tại
│   ├── phase-2-collaboration.md
│   └── phase-3-domain-extensions.md
└── progress/                ← Tiến độ thực tế & vấn đề đang mở
    ├── README.md            ← Status dashboard
    ├── changelog.md         ← Log thay đổi theo PR
    └── known-issues.md      ← Bug & limitation
```

## Quy ước cập nhật tài liệu

1. **Mọi feature mới** → cập nhật `scope/features.md` + thêm use case vào `use-cases/` nếu là flow end-to-end.
2. **Mọi PR có thay đổi hành vi** → ghi vào `progress/changelog.md` với link PR + ngày.
3. **Bug phát hiện** → thêm vào `progress/known-issues.md`, gắn label severity (P0/P1/P2). Khi fix → đánh dấu `[FIXED in #PR]`.
4. **Thay đổi roadmap** → cập nhật `roadmap/README.md` + file phase tương ứng.
5. **Tài liệu là code review obligation** → review PR phải xem cả file `.md` thay đổi.

## Liên kết nhanh

- [Tổng quan dự án](scope/overview.md)
- [Kiến trúc kỹ thuật](scope/architecture.md)
- [Kiến trúc database](scope/database-architecture.md)
- [Danh sách tính năng](scope/features.md)
- [Code review task list](review-task-list.md)
- [Code review archive](reviews/README.md)
- [Activity log rules](activity-log/README.md)
- [Roadmap](roadmap/README.md)
- [Tiến độ hiện tại](progress/README.md)
- [Known issues](progress/known-issues.md)
- [Changelog](progress/changelog.md)
