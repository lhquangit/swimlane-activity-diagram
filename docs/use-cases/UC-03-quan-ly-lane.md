# UC-03 — Quản lý lane (thêm / đổi tên / xoá / đổi thứ tự / resize)

| Field | Value |
|---|---|
| **Mã** | UC-03 |
| **Tên** | Quản lý lane |
| **Actor** | BA / Operation Lead |
| **Mục tiêu** | Tuỳ chỉnh cấu trúc lane theo quy trình thực tế. |
| **Trigger** | User tương tác với toolbar chính hoặc click trực tiếp vào lane trên canvas. |

## Tiền điều kiện

- App đang chạy.
- Có ít nhất 1 lane trong diagram.

---

## A. Thêm lane mới

1. User bấm nút **+ Lane** trên toolbar.
2. Handler `handleAddLane()` được gọi:
   - Tạo lane mới với `width = 320`.
   - Thêm lane vào cuối mảng.
   - Gọi `withPositions()` để tính lại `x` cho toàn bộ lane.
   - Đồng bộ lại node lane trong LogicFlow.
3. Lane mới hiện bên phải lane cuối.
4. Lane mới tự được chọn để hiện toolbar lane.
5. Status bar: `N lane · Đã thêm lane "X"`.

---

## B. Đổi tên lane

1. User click lane để hiện lane toolbar.
2. User bấm `Rename` hoặc double-click lane.
3. Handler hiển thị `window.prompt('Đổi tên lane:', currentTitle)`.
4. Nếu user nhập giá trị mới (không rỗng):
   - Cập nhật state `lanes` bất biến.
   - Gọi `withPositions()` để giữ layout chuẩn.
   - Đồng bộ text lane vào LogicFlow bằng `updateText()`.
5. Header lane hiển thị tên mới ngay lập tức.
6. Status bar: `N lane · Đã đổi tên lane → "X"`.

---

## C. Xoá lane

1. User click lane để hiện toolbar rồi bấm `Delete`, hoặc right-click lane.
2. Handler hiển thị `window.confirm('Xoá lane "X"?')`.
3. Nếu user xác nhận:
   - Kiểm tra `lanes.length > 1` (không cho xoá lane cuối cùng).
   - Xoá lane khỏi state `lanes`.
   - Recompute `x` cho các lane còn lại bằng `withPositions()`.
   - Realign node thường theo `laneId` / `laneOffsetX`.
   - Các node logic bên trong lane **không bị xoá**; chúng được giữ vị trí tương đối theo lane mới gần nhất sau khi layout được commit.
4. Status bar: `N lane · Đã xoá lane "X"`.

---

## D. Đổi thứ tự lane

1. User click lane để hiện toolbar.
2. User bấm `←` hoặc `→`.
3. Handler đổi vị trí lane trong mảng `lanes`.
4. `withPositions()` tính lại `x` cho toàn bộ lane.
5. App realign node thường theo `laneId` và `laneOffsetX`, nên node đi cùng lane khi thứ tự thay đổi.
6. Status bar: `N lane · Đã đổi vị trí lane "X"`.

---

## E. Resize lane

1. User click lane để hiện toolbar và resize handle ở góc phải dưới.
2. User kéo handle.
3. Trong lúc kéo:
   - `width` của lane đang chọn thay đổi trong khoảng cho phép.
   - `height` của toàn bộ swimlane thay đổi cùng lúc.
   - App recompute `x` của toàn bộ lane và realign node thường theo lane tương ứng.
4. Khi thả chuột:
   - `height` không được nhỏ hơn chiều cao tối thiểu cần để chứa node hiện có.
   - Layout lane mới được giữ lại trong state và export JSON.
5. Status bar hiển thị kích thước đang resize và trạng thái hoàn tất.

---

## F. Bảo vệ (guard)

- **DEL key trên lane**: handler `node:delete` bắt event, re-add ngay lập tức → lane không xoá được bằng phím tắt.
- **Xoá lane cuối cùng**: confirm dialog từ chối với thông báo phải có tối thiểu 1 lane.
- **Drag lane**: `LaneModel.draggable = false` → kéo không di chuyển.
- **Select lane**: app dùng hit-test riêng để hiện lane toolbar khi user click lane, không phụ thuộc selected state mặc định của LogicFlow.
- **Anchor lane**: `LaneModel.isShowAnchor = false` → không hiển thị điểm anchor (lane không phải target của edge).

## Kết quả mong đợi

- Cấu trúc lane phản ánh đúng số role thực tế.
- Lane mới luôn nằm bên phải, layout tự co giãn.
- User có affordance rõ ràng để rename, xoá, đổi thứ tự, và resize lane.
- Lane không bị xoá nhầm bằng DEL hoặc drag.

## Use case mở rộng

### UC-03a — Đổi tên lane bằng API (không qua UI)
- Có thể gọi `lf.graphModel.getNodeModelById('lane-1').updateText('New Name')` từ console.
- Không tự đồng bộ vào React state `lanes` → reload mất tên này.
- **TODO**: nên thêm listener `node:text-update` để sync về state.

### UC-03b — Sắp xếp lại thứ tự lane
- Hiện đã hỗ trợ bằng nút `←` / `→` trên lane toolbar.
- Backlog tương lai: nếu cần, nâng cấp sang drag header để reorder trực tiếp hơn.

### UC-03c — Resize shape trong lane
- User click `activity`, `decision`, hoặc `note` để hiện resize handle của shape.
- Kéo handle sẽ đổi kích thước shape và vẫn giữ text wrap bên trong.
- Auto-size theo text vẫn được giữ như mức sàn khi user sửa text lại sau đó.

## Source liên quan

- `src/App.tsx` — lane toolbar, hit-test chọn lane/node, resize handlers, `node:dbclick`, `node:contextmenu`, `node:delete`.
- `src/nodes.ts` — `LaneModel`.
- `src/lf-config.ts` — `buildLaneNodes()`.
