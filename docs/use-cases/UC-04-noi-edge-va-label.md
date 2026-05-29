# UC-04 — Nối edge và đặt label

| Field | Value |
|---|---|
| **Mã** | UC-04 |
| **Tên** | Nối edge giữa 2 node và đặt label |
| **Actor** | BA / Operation Lead |
| **Mục tiêu** | Mô tả thứ tự thực hiện hoặc rẽ nhánh trong quy trình. |
| **Trigger** | User di chuột vào node nguồn để hiển thị anchor → kéo từ anchor sang node đích. |

## Tiền điều kiện

- Có ≥ 2 node (không phải lane) trong canvas.

## Bước thực hiện

1. User di chuột vào **node nguồn** (ví dụ Activity "Tiếp nhận tín hiệu").
2. LogicFlow hiển thị 4 anchor circle ở 4 cạnh của node.
3. User nhấn giữ chuột trên 1 anchor và kéo.
4. Một preview edge (đường gấp khúc) đi theo con trỏ.
5. User thả chuột trên **node đích** (ví dụ Decision "Quyết định").
6. LogicFlow gắn edge từ source → target. Edge mặc định kiểu `polyline` (xem `getLogicFlowOptions`).
7. Edge hiển thị mũi tên ở đầu target.

## Đặt label cho edge

1. User double-click vào edge.
2. LogicFlow hiển thị input chỉnh sửa text inline trên edge.
3. User nhập (ví dụ "Có" / "Không") → Enter hoặc click ra ngoài để xác nhận.
4. Label hiển thị ngay tại điểm giữa edge.

## Drag điểm đầu / cuối edge

1. User click chọn edge.
2. 2 điểm cuối hiện rõ.
3. User kéo điểm đầu / cuối sang anchor của node khác.
4. Edge tự reroute.

## Xoá edge

1. User click chọn edge (1 lần).
2. Nhấn DEL → edge bị xoá.

## Kết quả mong đợi

- Edge nối đúng nguồn → đích, có mũi tên hướng đi rõ ràng.
- Label hiển thị ngay tại edge.
- Có thể di chuyển source / target dễ dàng.

## Use case mở rộng

### UC-04a — Nối edge từ node sang chính nó (self-loop)
- Hiện tại LF mặc định không hỗ trợ self-loop đẹp. Backlog.

### UC-04b — Nối edge xuyên qua lane
- Cho phép, edge sẽ chạy theo polyline đi qua các lane khác nhau.
- Auto-route giúp edge không cắt qua node khác (best effort).

### UC-04c — Label dài
- LogicFlow tự wrap text khi quá dài.
- User có thể double-click lại để sửa.

## Source liên quan

- `src/lf-config.ts` — `getLogicFlowOptions()` set `edgeType = 'polyline'`, `adjustEdgeStart/End = true`.
- LogicFlow core handles drawing.
