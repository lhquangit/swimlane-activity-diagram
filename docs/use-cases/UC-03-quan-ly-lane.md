# UC-03 — Quản lý lane (thêm / đổi tên / xoá)

| Field | Value |
|---|---|
| **Mã** | UC-03 |
| **Tên** | Quản lý lane |
| **Actor** | BA / Operation Lead |
| **Mục tiêu** | Tuỳ chỉnh cấu trúc lane theo quy trình thực tế. |
| **Trigger** | User tương tác với toolbar hoặc lane (double-click / right-click). |

## Tiền điều kiện

- App đang chạy.
- Có ít nhất 1 lane trong diagram.

---

## A. Thêm lane mới

1. User bấm nút **+ Lane** trên toolbar.
2. Handler `addLane()` được gọi:
   - Tính `nextX = max(lane.x) + max(lane.width)/2 + 360/2 + GAP`.
   - Tạo lane mới: `{ id: 'lane-N', x: nextX, width: 360, title: 'Lane N' }`.
   - Cập nhật React state `lanes`.
   - Gọi `lf.addNode(buildLaneNodes([newLane])[0])`.
3. Lane mới hiện bên phải lane cuối.
4. Status bar: `N lane · Đã thêm lane "Lane N"`.

---

## B. Đổi tên lane

1. User double-click vào lane (vùng header hoặc body).
2. LogicFlow phát event `node:dbl-click` với `data.type === 'lane'`.
3. Handler hiển thị `window.prompt('Tên lane mới:', currentTitle)`.
4. Nếu user nhập giá trị mới (không rỗng):
   - Cập nhật state `lanes` (immutable).
   - Cập nhật `lf.graphModel.getNodeModelById(laneId).updateText(newTitle)`.
5. Header lane hiển thị tên mới ngay lập tức.
6. Status bar: `N lane · Đã đổi tên lane`.

---

## C. Xoá lane

1. User right-click vào lane → event `node:contextmenu` với `data.type === 'lane'`.
2. Handler hiển thị `window.confirm('Xoá lane "X"?')`.
3. Nếu user xác nhận:
   - Kiểm tra `lanes.length > 1` (không cho xoá lane cuối cùng).
   - Xoá lane khỏi state `lanes`.
   - Xoá node lane khỏi LF: `lf.deleteNode(laneId)`.
   - Các node logic ở lane đó **không tự bị xoá** — vẫn nằm ở vị trí cũ. User tự dọn nếu cần.
4. Status bar: `N lane · Đã xoá lane "X"`.

---

## D. Bảo vệ (guard)

- **DEL key trên lane**: handler `node:delete` bắt event, re-add ngay lập tức → lane không xoá được bằng phím tắt.
- **Xoá lane cuối cùng**: confirm dialog từ chối với thông báo phải có tối thiểu 1 lane.
- **Drag lane**: `LaneModel.draggable = false` → kéo không di chuyển.
- **Select lane**: `LaneModel.selectable = false` → click không vào trạng thái selected.
- **Anchor lane**: `LaneModel.isShowAnchor = false` → không hiển thị điểm anchor (lane không phải target của edge).

## Kết quả mong đợi

- Cấu trúc lane phản ánh đúng số role thực tế.
- Lane mới luôn nằm bên phải, layout tự co giãn.
- Lane không bị xoá nhầm bằng DEL hoặc drag.

## Use case mở rộng

### UC-03a — Đổi tên lane bằng API (không qua UI)
- Có thể gọi `lf.graphModel.getNodeModelById('lane-1').updateText('New Name')` từ console.
- Không tự đồng bộ vào React state `lanes` → reload mất tên này.
- **TODO**: nên thêm listener `node:text-update` để sync về state.

### UC-03b — Sắp xếp lại thứ tự lane
- Hiện chưa hỗ trợ. Backlog: cho phép drag lane sang trái/phải để đổi thứ tự.

## Source liên quan

- `src/App.tsx` — `addLane()`, event `node:dbl-click`, `node:contextmenu`, `node:delete`.
- `src/nodes.ts` — `LaneModel`.
- `src/lf-config.ts` — `buildLaneNodes()`.
