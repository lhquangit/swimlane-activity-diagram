# UC-02 — Thêm shape vào lane

| Field | Value |
|---|---|
| **Mã** | UC-02 |
| **Tên** | Thêm shape (node) vào một lane bằng drag-and-drop |
| **Actor** | BA / Operation Lead |
| **Mục tiêu** | Tạo một node logic mới trong lane mong muốn, không cần kéo thật chính xác. |
| **Trigger** | User chọn 1 shape trong palette sidebar và kéo vào canvas. |

## Tiền điều kiện

- Đã có ít nhất 1 lane trong diagram.
- App đang chạy bình thường, canvas đã render.

## Bước thực hiện

1. User di chuột vào item trong palette (ví dụ "Activity").
2. User nhấn giữ chuột trái (`mousedown`) → handler `onMouseDown` của `<DndPanel />` gọi `lf.dnd.startDrag({ type: 'activity' })`.
3. LogicFlow hiển thị faker node (preview) đi theo con trỏ.
4. User di chuột vào lane mong muốn rồi thả (`mouseup`/`drop`).
5. LogicFlow phát event `node:dnd-add` với `data = { id, type, x, y, ... }`.
6. Handler trong `App.tsx`:
   - Bỏ qua nếu type là `lane`.
   - Với type khác `sync-bar`: gọi `snapToLane(data.x, lanes)` → đặt lại node vào tâm lane gần nhất.
   - Với `sync-bar`: giữ vị trí drop (sync-bar xuyên qua nhiều lane).
   - Gọi `lf.graphModel.setElementZIndex(id, 'top')` để node luôn nằm trên lane.
7. Diagram được render lại, shape mới hiện ngay tại vị trí snap.

## Kết quả mong đợi

- Shape mới hiển thị tại tâm X của lane gần nhất, Y ≈ vị trí thả chuột.
- Shape có anchor circles ở 4 cạnh (top/left/right/bottom) → có thể nối edge ngay.
- Shape **không bị che** bởi lane background (sửa bug bằng `setElementZIndex(id, 'top')` — xem [known-issues.md](../progress/known-issues.md)).
- Có thể double-click để đặt text.

## Use case mở rộng

### UC-02a — Thả sync-bar
- Sync-bar không snap X, giữ vị trí drop để có thể đặt xuyên qua nhiều lane.

### UC-02b — Thả ngoài canvas
- Nếu thả ngoài vùng SVG → `node:dnd-add` không phát, faker node bị huỷ.

### UC-02c — Snap với lane mới thêm
- Sau khi user `+ Lane`, lane mới được push vào `lanes` state.
- `lanesRef.current` luôn được cập nhật trong `useEffect` đi kèm, nên handler `node:dnd-add` luôn dùng list lane mới nhất khi snap.

## Edge case đã xử lý

- **Drop chồng lên 1 node có sẵn** → node mới vẫn được thêm, có thể chồng lên — user tự kéo dịch.
- **Drop vào vùng header lane** → snap X vào lane đó, Y giữ nguyên (gần đầu lane).
- **Drop khi `lanes` rỗng** (đã xoá hết): hiện tại app bảo vệ tối thiểu 1 lane (UC-03), nên trường hợp này không xảy ra.

## Source liên quan

- `src/App.tsx` event `node:dnd-add` (≈ line 134–150).
- `src/lf-config.ts` `snapToLane()`.
- `src/DndPanel.tsx` palette UI.
