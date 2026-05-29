# UC-01 — Tạo diagram từ mẫu mặc định

| Field | Value |
|---|---|
| **Mã** | UC-01 |
| **Tên** | Tạo diagram từ mẫu mặc định |
| **Actor** | BA / Operation Lead / Bất kỳ user nào lần đầu mở app |
| **Mục tiêu** | Có một diagram khởi điểm với 4 lane + sample flow để bắt đầu chỉnh sửa. |
| **Trigger** | User mở `index.html` (hoặc `http://localhost:5173`). |

## Tiền điều kiện

- App build thành công và phục vụ qua HTTP/HTTPS hoặc chạy `npm run dev`.
- Trình duyệt hỗ trợ SVG, ES2019+.

## Bước thực hiện

1. User mở URL của ứng dụng.
2. React bootstrap → `App.tsx` chạy `useEffect` mount lần đầu.
3. `lf.render(buildInitialData())` được gọi — diagram mẫu hiện ra ngay:
   - 4 lane: *Nguồn phát hiện đầu tiên*, *Nhân sự vận hành liên lạc (VOC)*, *Trưởng điều phối khán giả (VOC)*, *Nhân viên hiện trường*.
   - ~17 node mẫu mô phỏng quy trình xử lý sự cố.
   - Edge nối các node theo thứ tự.
4. `lf.fitView(20, 20)` căn diagram vào khung hình.
5. Status bar hiển thị: `4 lane · Sẵn sàng — 4 lane đã được tạo`.

## Kết quả mong đợi

- Diagram mẫu hiển thị đầy đủ, không có node nào bị che / mất.
- Toolbar và sidebar palette hoạt động.
- Console không có error / warning.

## Use case mở rộng

### UC-01a — Reset về mẫu sau khi đã chỉnh sửa

- User bấm nút **Reset mẫu** trên toolbar.
- Confirm dialog xuất hiện.
- Khi OK → `lf.render(buildInitialData())` chạy lại, mọi thay đổi của user bị mất.
- Status bar: `4 lane · Đã reset về diagram mẫu`.

### UC-01b — Xoá nội dung nhưng giữ lane

- User bấm **Xoá nội dung**.
- Toàn bộ node logic (không phải lane) và edge bị xoá.
- Lane vẫn nguyên (cả config trong React state).
- Status bar: `4 lane · Đã xoá nội dung (giữ lại lane)`.

## Source liên quan

- `src/lf-config.ts` — hàm `buildInitialData()`.
- `src/App.tsx` — `useEffect` khởi tạo (line ~120 trở đi).
