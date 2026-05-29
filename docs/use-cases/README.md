# Use Cases

Mỗi use case mô tả một flow end-to-end mà người dùng có thể thực hiện trên editor. Format chuẩn:

- **Mã**: `UC-XX`
- **Tên**: ngắn gọn, theo nhiệm vụ.
- **Actor**: ai thực hiện (BA, Operation, Dev, Stakeholder…).
- **Tiền điều kiện**: state ban đầu trước khi bắt đầu.
- **Bước thực hiện**: bullet hoặc bảng các bước cụ thể.
- **Kết quả mong đợi**: state cuối sau khi hoàn tất.
- **Use case mở rộng** (optional): biến thể, error path.

## Danh sách use case hiện tại

| Mã | Tên | File |
|---|---|---|
| UC-01 | Tạo diagram từ mẫu mặc định | [UC-01-tao-diagram-tu-mau.md](UC-01-tao-diagram-tu-mau.md) |
| UC-02 | Thêm shape vào lane | [UC-02-them-shape-vao-lane.md](UC-02-them-shape-vao-lane.md) |
| UC-03 | Quản lý lane (thêm / đổi tên / xoá) | [UC-03-quan-ly-lane.md](UC-03-quan-ly-lane.md) |
| UC-04 | Nối edge và đặt label | [UC-04-noi-edge-va-label.md](UC-04-noi-edge-va-label.md) |
| UC-05 | Import / Export diagram | [UC-05-import-export.md](UC-05-import-export.md) |

## Cách thêm use case mới

1. Tạo file `UC-XX-ten-tom-tat.md` (kebab-case tiếng Việt không dấu).
2. Copy template từ file UC-01 và đổi nội dung.
3. Thêm dòng vào bảng "Danh sách use case hiện tại" trong file này.
4. Nếu use case này thay đổi tính năng → cập nhật cả `scope/features.md`.
