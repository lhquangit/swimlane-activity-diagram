# UC-05 — Import / Export diagram

| Field | Value |
|---|---|
| **Mã** | UC-05 |
| **Tên** | Import / Export diagram (JSON, SVG, PNG) |
| **Actor** | BA / Dev / Stakeholder |
| **Mục tiêu** | Chia sẻ diagram, lưu trữ, hoặc commit vào git. |
| **Trigger** | User bấm nút trên toolbar. |

## Tiền điều kiện

- Có ít nhất 1 lane (luôn đúng theo bảo vệ UC-03).

---

## A. Lưu JSON

1. User bấm **Lưu JSON**.
2. Handler:
   - Gọi `lf.getGraphData()` → object với `nodes[]`, `edges[]`.
   - Đóng gói: `{ lanes: lanesRef.current, graph: data }`.
   - `JSON.stringify(payload, null, 2)`.
   - Tạo `Blob` + URL + `<a download>` → trigger download `diagram-YYYYMMDD-HHmmss.json`.
3. File JSON tải về máy user.
4. Status bar: `N lane · Đã lưu JSON`.

### Cấu trúc file JSON

```json
{
  "lanes": [
    { "id": "lane-1", "title": "Nguồn phát hiện đầu tiên", "x": 200, "width": 320 },
    ...
  ],
  "graph": {
    "nodes": [
      { "id": "lane-1", "type": "lane", "x": 200, "y": 580, ... },
      { "id": "n-001", "type": "start", "x": 200, "y": 90, ... },
      ...
    ],
    "edges": [
      { "id": "e-001", "type": "polyline", "sourceNodeId": "n-001", "targetNodeId": "n-002", ... }
    ]
  }
}
```

---

## B. Mở JSON (Import)

1. User bấm **Mở JSON…** (label trên `<input type="file">` ẩn).
2. Hệ thống mở file picker.
3. User chọn file `.json` → `onChange` handler đọc text bằng `FileReader`.
4. `JSON.parse(text)` → kiểm tra cấu trúc `{ lanes, graph }`.
5. Cập nhật state `lanes = payload.lanes`.
6. `lf.render(payload.graph)`.
7. `lf.fitView(20, 20)`.
8. Status bar: `N lane · Đã import diagram từ JSON`.

### Validation hiện có

- Nếu file không phải JSON hợp lệ → `alert('File không hợp lệ')`.
- Nếu thiếu `lanes` hoặc `graph` → vẫn render được phần có, log warning.
- **Backlog**: schema validation chặt chẽ với Zod.

---

## C. Export SVG

1. User bấm **Export SVG**.
2. Handler lấy node `<svg name="canvas-overlay">` từ DOM container.
3. Serialize bằng `XMLSerializer`.
4. Wrap trong `<svg xmlns="http://www.w3.org/2000/svg">...</svg>`.
5. Tạo Blob `image/svg+xml` → download.
6. Status bar: `N lane · Đã export SVG`.

---

## D. Export PNG

1. User bấm **Export PNG**.
2. Handler dùng plugin `Snapshot` của LogicFlow:
   - `lf.extension.snapshot.getSnapshot()` hoặc `lf.getSnapshot()` (API tuỳ version).
3. Plugin chuyển SVG → canvas → `toDataURL('image/png')` → download.
4. Status bar: `N lane · Đã export PNG`.

### Lưu ý

- PNG xuất ra theo kích thước **thực** của diagram (không phải kích thước viewport hiện tại) — đảm bảo không bị crop.
- Nền PNG mặc định trắng.

---

## Kết quả mong đợi

| Action | File output | Dùng cho |
|---|---|---|
| Lưu JSON | `.json` | Diagram-as-code, commit vào git, diff được. |
| Mở JSON | (load lại) | Tiếp tục chỉnh sửa diagram đã lưu. |
| Export SVG | `.svg` | Nhúng vào tài liệu vector, in chất lượng cao. |
| Export PNG | `.png` | Báo cáo, slide, chia sẻ qua chat. |

## Use case mở rộng

### UC-05a — Import file JSON từ version cũ
- Hiện tại không có migration tool — nếu format đổi, file cũ có thể không load đúng.
- Backlog: thêm trường `version` vào JSON và viết migration.

### UC-05b — Drag & drop file JSON vào canvas
- Backlog: chấp nhận `dragover` trên canvas, parse JSON.

### UC-05c — Lưu URL state
- Backlog: encode JSON vào URL hash để share quick link.

## Source liên quan

- `src/App.tsx` — `saveJson()`, `openJsonFile()`, `exportSvg()`, `exportPng()`.
- `src/lf-config.ts` — `getLogicFlowOptions()` đăng ký plugin `Snapshot`.
