# Known Issues

Format mỗi issue:

```
## [STATUS] <Tên bug> (severity: P0/P1/P2/P3)
- ID: KI-NN
- Phát hiện: YYYY-MM-DD by <ai>
- Severity: ...
- Reproduction: ...
- Root cause: ...
- Fix: ...
- Verified: <date> by <ai>
```

Severity:
- **P0**: chặn user, không có workaround.
- **P1**: ảnh hưởng lớn, có workaround.
- **P2**: khó chịu nhưng không cản trở.
- **P3**: cosmetic, edge case.

---

## [FIXED] Drop shape vào lane bị biến mất (severity: P0) {#fixed-drop-shape-vao-lane-bi-bien-mat}

- **ID**: KI-01
- **Phát hiện**: 2026-05-29 by Quân (user report)
- **Severity**: P0 — không thể tạo diagram mới một cách trực quan.

### Reproduction

1. Mở app `npm run dev`.
2. Kéo bất kỳ shape nào (Start / Activity / Decision / End / Note) từ palette sidebar vào canvas (vào một lane bất kỳ).
3. **Triệu chứng**: shape biến mất, không hiển thị trong canvas.
4. Click sang một lane khác (hoặc bất kỳ vùng nào trên canvas) → các shape vừa thả mới hiện ra.

### Root cause

LogicFlow render thứ tự SVG element trong `<g>` theo thứ tự append: element thêm sau sẽ vẽ đè lên element thêm trước. Lane trong diagram là một node có `<rect fill="#ffffff" ...>` phủ kín toàn bộ vùng lane (để có nền trắng).

Khi user thả shape mới:

1. LogicFlow phát event `node:dnd-add`.
2. Handler trong `App.tsx` gọi `moveTo(snappedX, data.y)` để snap node vào tâm lane.
3. Tuy nhiên LogicFlow có cơ chế "auto bring lane to front" khi user hover lane (mặc dù `selectable=false`), khiến lane bị **append cuối DOM** trong một số tình huống render race.
4. Khi lane nằm sau node mới trong DOM → lane vẽ đè lên node mới → **node biến mất**.
5. Khi user click vùng khác → LogicFlow trigger re-render, sắp xếp lại theo `zIndex`, lane (z = `-10`) được đẩy về phía trước trong DOM, node mới hiện ra.

`zIndex = -10` của lane không đủ lùi sâu khi LogicFlow tăng dần `zIndex` của node được mang ra trước.

### Fix

3 thay đổi cộng dồn:

1. **`src/nodes.ts` → `LaneModel.initNodeData`**: hạ `this.zIndex = -1000` (thay vì `-10`) và thêm `this.isShowAnchor = false`. Lane không bao giờ có thể bị tăng zIndex lên ngang tầm node thường.
2. **`src/lf-config.ts` → `buildLaneNodes`**: set `zIndex: -1000` ngay trong data init (để khi import JSON cũng đảm bảo lane luôn nằm dưới).
3. **`src/App.tsx` → handler `node:dnd-add`**: sau khi `moveTo`, gọi `lf.graphModel.setElementZIndex(data.id, 'top')` → ép node mới luôn lên top stacking.

```ts
// src/App.tsx
lf.on('node:dnd-add', ({ data }) => {
  if (!data || !data.type) return;
  if (data.type === 'lane') return;
  const model = lf.graphModel.getNodeModelById(data.id);
  if (!model) return;
  if (data.type !== 'sync-bar') {
    const snappedX = snapToLane(data.x, lanesRef.current);
    model.moveTo(snappedX, data.y);
  }
  // Bring new node above any lane in the stacking order.
  lf.graphModel.setElementZIndex(data.id, 'top');
});
```

### Verified

- 2026-05-29 by Devin — drag thử 5 lần với mỗi loại shape, qua các lane khác nhau, drop ở header / body / cạnh lane: shape luôn hiển thị ngay lập tức, không cần click sang lane khác.
- DOM SVG kiểm tra qua dev console: lanes luôn đứng đầu danh sách `g.lf-node`, node mới ở cuối → render order chuẩn.

---

## [OPEN] (chưa có)

Hiện không có issue mở. Khi phát hiện bug mới → thêm vào đầu file này với status `OPEN`.

---

## Quy tắc

- Mọi bug user-report → tạo entry ngay, không chờ tới khi fix.
- Một bug fix → mọi field phải đủ (đặc biệt **Root cause** để học hỏi).
- Khi đóng issue → đổi status `[OPEN]` → `[FIXED]` + ghi ngày verify.
- Issue P0/P1 → ưu tiên đưa vào sprint hiện tại.
