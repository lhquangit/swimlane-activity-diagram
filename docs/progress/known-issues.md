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

## [FIXED] Lane resize/reorder giữ node trong lane theo binding mới (severity: P1) {#fixed-lane-layout-node-containment}

- **ID**: KI-05
- **Phát hiện**: 2026-05-30 by Quân (user report) / Codex (review xác nhận)
- **Severity**: P1 — khi lane đổi width hoặc đổi thứ tự, node có thể lệch khỏi phạm vi lane thay vì được giữ trong lane một cách có nghĩa.

### Reproduction

1. Mở app `npm run dev`.
2. Resize lane hẹp lại hoặc reorder lane qua `←` / `→`.
3. Quan sát node đã gắn với lane đó.
4. **Triệu chứng**: runtime có di chuyển node theo `x`, nhưng không có guard đảm bảo node vẫn nằm trong biên lane sau khi width thay đổi mạnh.

### Root cause

1. `laneOffsetX` đang được lưu như offset tuyệt đối theo pixel (`model.x - lane.x`), không phải relative placement.
2. Khi commit layout, app chỉ reapply `nextLane.x + binding.offsetX`.
3. Không có bước clamp theo `lane.width` và kích thước thực của node sau resize/reorder.

### Fix

1. Đổi contract binding từ `laneOffsetX` tuyệt đối sang `lanePosition` / `relativeX` và persist lại cùng `laneId`.
2. Trong `realignNodesToLaneLayout()`, tính lại `x` của node theo binding mới rồi clamp theo `lane.width` và `node.width`.
3. Khi user drag/drop hoặc resize shape, binding được cập nhật lại theo contract mới thay vì reset về offset cũ.
4. Khi user resize lane, runtime chặn lane co nhỏ hơn shape rộng nhất đang thuộc lane đó, để node không thể bị ép tràn biên vì hình học không còn đủ chỗ chứa.

### Verified

- 2026-05-31 by Codex — `npm run build` pass.
- 2026-05-31 by Codex — browser local: reorder lane rồi kéo lane hẹp lại; `a4` và `b1` vẫn nằm trọn trong lane mới, lane được chặn ở width `284` thay vì co tiếp xuống dưới shape rộng nhất.

---

## [FIXED] `sync-bar` đi theo lane layout và resize được bằng tay (severity: P1) {#fixed-sync-bar-layout-and-resize}

- **ID**: KI-06
- **Phát hiện**: 2026-05-30 by Quân (user report) / Codex (review xác nhận)
- **Severity**: P1 — junction fork/join không đi theo lane layout mới, kéo theo edge lệch logic; đồng thời user không thể đổi kích thước `sync-bar`.

### Reproduction

1. Mở app `npm run dev`.
2. Reorder hoặc resize lane có liên quan tới flow qua `sync-bar`.
3. Click trực tiếp vào `sync-bar`.
4. **Triệu chứng**:
   - `sync-bar` đứng yên khi node hai bên đổi vị trí theo lane.
   - Không có resize handle nào hiện ra cho `sync-bar`.

### Root cause

1. `hydrateNodeLaneBindings()` và `realignNodesToLaneLayout()` skip `sync-bar`.
2. `sync-bar` không được snap/bind theo lane khi drag/drop.
3. Runtime chỉ mở resize handle cho `activity`, `decision`, `note`; `sync-bar` không bao giờ trở thành `activeNode`.
4. Seed graph lại dùng `sync-bar` như junction thật với các edge `e5`, `e6`, nên khi nó đứng yên thì edge không còn giữ topology mong muốn.

### Fix

1. Đưa `sync-bar` vào flow realign riêng trong `commitLaneLayout()` thay vì skip hoàn toàn.
2. Persist metadata `syncBarFromLaneId`, `syncBarToLaneId`, `syncBarLeftInset`, `syncBarRightInset` để runtime giữ được span qua reorder/resize lane.
3. Chuẩn hóa span của `sync-bar` theo cả metadata đã lưu lẫn lane của các node đang nối vào nó, để junction vẫn phủ đúng miền logic sau khi reorder lane.
4. Mở manual `width-only` resize cho `sync-bar` và cập nhật lại metadata span sau khi user kéo.
5. Đồng bộ lại edge endpoints cho các edge nối vào `sync-bar` sau lane commit, drag/drop, và resize.

### Verified

- 2026-05-31 by Codex — `npm run build` pass.
- 2026-05-31 by Codex — browser local:
  - reorder lane rồi resize lane, `sync-bar` được realign lại từ `x=460.01`, `width=824` để vẫn phủ qua các lane có node đang nối vào nó;
  - click `sync-bar` hiện `shape-resize-handle`;
  - kéo handle đổi `sync-bar` từ `width=824` lên `width=944.57`, edge count vẫn giữ `14` và edge `e5`, `e6` cập nhật endpoints theo bar mới.

---

## [FIXED] Lane resize / lane reorder / manual shape resize đã được implement (severity: P1) {#fixed-lane-resize-reorder-manual-shape-resize}

- **ID**: KI-03
- **Phát hiện**: 2026-05-30 by Quân (user retest)
- **Severity**: P1 — user không thể chủ động bố cục diagram khi lane hoặc shape cần đổi kích thước ngoài auto-grow theo text.

### Reproduction

1. Mở app `npm run dev`.
2. Thử đổi kích thước lane bằng kéo chuột hoặc thao tác trực tiếp trên lane.
3. Thử đổi thứ tự lane sang trái / phải.
4. Thử đổi kích thước shape bằng kéo góc hoặc cạnh shape.
5. **Triệu chứng**: không có control hoặc interaction nào cho 3 thao tác trên.

### Root cause

Capability thiếu ở cả runtime lẫn UX:

1. Lane chỉ auto-tăng **chiều cao** theo node thấp nhất và chưa có cơ chế user-driven cho width hoặc reorder.
2. Thứ tự lane phụ thuộc vào mảng `lanes` + `withPositions()` nhưng chưa có control đổi vị trí trực tiếp.
3. Shape chỉ auto-size theo text, chưa có handle resize tay nên user không thể tinh chỉnh layout.

### Fix

1. Thêm lane toolbar hiển thị khi click lane, gồm `Rename`, `Delete`, `←`, `→`.
2. Thêm lane resize handle ở góc phải dưới để đổi `width` lane đang chọn và `height` toàn bộ swimlane.
3. Thêm shape resize handle cho `activity`, `decision`, `note` thông qua overlay riêng, không phụ thuộc resize control mặc định của LogicFlow.
4. Persist `laneId`, `laneOffsetX`, `width`, `height`, `nodeSize` để lane reorder/resize và shape resize sống qua export/import.
5. Giữ rule hiện tại: auto-size theo text vẫn tồn tại như mức sàn; resize tay của user không bị text update kéo nhỏ lại.

### Verified

- 2026-05-30 by Codex — `npm run build` pass.
- 2026-05-30 by Codex — verify browser local: click lane hiện toolbar; rename lane thành `Lane Alpha`; move lane sang phải; kéo resize handle đổi lane từ `320 × 1100` thành `468 × 1218`; click shape hiện handle và kéo shape từ `102 × 21` thành `172 × 56`.

---

## [FIXED] Lane actions khó discover và tài liệu lệch runtime (severity: P2) {#fixed-lane-actions-discoverability-and-doc-drift}

- **ID**: KI-04
- **Phát hiện**: 2026-05-30 by Quân (user retest)
- **Severity**: P2 — tính năng tồn tại nhưng tester dễ hiểu là đang hỏng.

### Reproduction

1. Mở app và chỉ làm theo phần hướng dẫn trong sidebar.
2. Thử xoá lane bằng thao tác hiển nhiên như chọn lane rồi nhấn `DEL`.
3. Đối chiếu tài liệu `docs/use-cases/UC-03-quan-ly-lane.md` với runtime hiện tại.
4. **Triệu chứng**: lane không selectable nên `DEL` không xoá được; sidebar không nói lane xoá bằng right-click; use case và architecture vẫn ghi event cũ `node:dbl-click`.

### Root cause

1. Runtime ban đầu chỉ có gesture ẩn (`node:dbclick`, `node:contextmenu`) nên tester không nhìn ra đường thao tác chính.
2. Sidebar guide và use case cũ chưa mô tả toolbar lane, resize handle, hoặc event rename đúng.

### Fix

1. Thêm lane toolbar rõ ràng khi click lane, để rename/delete/reorder không còn là hidden gesture.
2. Giữ tương thích ngược với `double-click` và `right-click` cho desktop flow cũ.
3. Cập nhật sidebar guide, feature list, use case, changelog, và activity log theo runtime mới.

### Verified

- 2026-05-30 by Codex — verify browser local: click lane hiện toolbar và control rõ ràng cho rename/delete/reorder/resize.
- 2026-05-30 by Codex — review docs/source: `src/App.tsx`, `src/DndPanel.tsx`, `docs/scope/features.md`, `docs/use-cases/UC-03-quan-ly-lane.md`.

---

## [FIXED] Lane rename và kích thước lane/shape bị cố định (severity: P1) {#fixed-lane-rename-va-auto-size}

- **ID**: KI-02
- **Phát hiện**: 2026-05-30 by Quân (user report)
- **Severity**: P1 — ảnh hưởng trực tiếp tới thao tác chỉnh sửa diagram khi lane/shape có nội dung dài.

### Reproduction

1. Mở app `npm run dev`.
2. Double-click một lane và nhập tên mới.
3. **Triệu chứng**: tên lane không đổi hoặc đổi xong bị quay lại tên cũ.
4. Tạo nhiều shape theo chiều dọc hoặc nhập text dài vào Activity / Decision / Note.
5. **Triệu chứng**: lane không cao thêm theo nội dung, shape giữ kích thước cũ và text có thể tràn khỏi shape.

### Root cause

Có 3 nguyên nhân kết hợp:

1. Handler rename lane đang lắng nghe sai event LogicFlow (`node:dbl-click`) thay vì event thực tế `node:dbclick`, nên double-click lane không kích hoạt đúng luồng đổi tên.
2. Khi sync lane sau rename, code xoá lane cũ rồi add lane mới. Handler bảo vệ `node:delete` lại re-add lane vừa xoá bằng dữ liệu cũ, làm rename bị ghi đè hoặc render lẫn state cũ.
3. `LANE_HEIGHT` và kích thước các node Activity / Decision / Note được set cố định, không có bước đo text sau khi tạo hoặc sau `text:update`, nên diagram không mở rộng theo nội dung.

### Fix

1. Đổi event rename lane sang `node:dbclick`.
2. Thêm guard `isSyncingLanesRef` để handler `node:delete` không re-add lane trong lúc app chủ động sync lại lane.
3. Thêm đo kích thước text và resize Activity / Decision / Note khi node được tạo và khi text được cập nhật.
4. Thêm tính toán lane height dựa trên node thấp nhất trong diagram, rồi cập nhật lại toàn bộ lane hiện có.
5. Thêm `textWidth` cho text style của Activity / Decision / Note để text dài wrap trong vùng shape.
6. Phạm vi fix này chỉ bao phủ rename lane + auto-grow theo nội dung + text wrap; không bao gồm resize lane/shape bằng tay hoặc đổi thứ tự lane.

### Verified

- 2026-05-30 by Codex — `npm run build` pass.
- 2026-05-30 by Codex — kiểm tra browser local: double-click lane mở prompt và tên lane đổi thành công; kéo activity xuống thấp làm 4 lane tăng từ 1100 lên 1372; note mẫu có text nằm trong rect sau auto-size/wrap.

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

## Quy tắc

- Mọi bug user-report → tạo entry ngay, không chờ tới khi fix.
- Một bug fix → mọi field phải đủ (đặc biệt **Root cause** để học hỏi).
- Khi đóng issue → đổi status `[OPEN]` → `[FIXED]` + ghi ngày verify.
- Issue P0/P1 → ưu tiên đưa vào sprint hiện tại.
