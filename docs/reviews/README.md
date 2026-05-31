# Code Review Archive

Thư mục này lưu các lần review theo dạng snapshot. Mỗi lần review mới nên tạo một file riêng, không ghi đè review cũ.

## Quy ước file

Đặt tên theo format:

```text
YYYY-MM-DD-<scope>.md
```

Ví dụ:

```text
2026-05-30-full-source-review.md
2026-06-03-import-export-review.md
2026-06-10-lane-rendering-regression-review.md
```

## Khi nào lưu ở đâu?

- `docs/reviews/YYYY-MM-DD-<scope>.md`: lưu nội dung review đầy đủ tại thời điểm review, gồm module map, findings, evidence, reasoning và recommendation.
- `docs/review-task-list.md`: chỉ lưu backlog implementation đang hoạt động, đã được chắt lọc từ một hoặc nhiều review.
- `docs/progress/known-issues.md`: chỉ lưu bug cụ thể có reproduction, root cause, status và verification.

## Quy trình đề xuất

1. Mỗi lần review mới, tạo một file snapshot trong thư mục này.
2. Nếu review sinh ra việc cần làm, copy hoặc tổng hợp thành task trong `docs/review-task-list.md`.
3. Nếu phát hiện bug cụ thể, tạo hoặc cập nhật entry trong `docs/progress/known-issues.md`.
4. Khi task đã implement xong, cập nhật trạng thái trong `docs/review-task-list.md` hoặc xoá task khỏi backlog sau khi đã ghi vào changelog.

