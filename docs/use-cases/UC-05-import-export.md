# UC-05 — Import / Export diagram

| Field | Value |
|---|---|
| **Mã** | UC-05 |
| **Tên** | Import / Export diagram (draw.io XML, PNG) |
| **Actor** | BA / Dev / Stakeholder |
| **Mục tiêu** | Trao đổi diagram với draw.io/diagrams.net, tiếp tục chỉnh sửa trong editor, hoặc xuất ảnh để chia sẻ. |
| **Trigger** | User bấm nút trên toolbar. |

## Tiền điều kiện

- Có ít nhất 1 lane.
- Toolbar Phase 1 hiển thị `Import XML…`, `Export XML`, `Export PNG`.
- Các action `Mở JSON…`, `Lưu JSON`, `Export SVG` đã được ẩn khỏi UI nhưng code path nền chưa bị xoá hẳn.

---

## Supported subset cho draw.io XML

Phase 1 chỉ cam kết import/export ổn định cho subset sau:

- Outer container: `mxfile > diagram > mxGraphModel > root > mxCell` với swimlane gốc dùng `childLayout=stackLayout`.
- Lane columns: mỗi lane là một `mxCell` swimlane con của outer container.
- Node types:
  - `start`
  - `end`
  - `activity`
  - `decision`
  - `sync-bar`
  - `note`
- Edge:
  - `source`, `target`
  - edge label qua child `mxCell` có style `edgeLabel`
- Text:
  - decode HTML-rich draw.io text về plain text nội bộ
  - export plain text nội bộ sang markup draw.io tối giản

### Mapping contract

| LogicFlow | draw.io XML |
|---|---|
| Lane | `mxCell` swimlane con của outer container |
| Start | `shape=startState` |
| End | `shape=endState` |
| Activity | `shape=mxgraph.bpmn.task2` + `lfType=activity` khi export |
| Note | `shape=mxgraph.bpmn.task2` + `lfType=note` khi export |
| Decision | `rhombus` |
| Sync bar | `shape=line` |
| Edge label | child `mxCell` với `edgeLabel` |

### Policy geometry

- Import XML sẽ **normalize lại lane layout** về hệ toạ độ nội bộ của editor, không giữ nguyên tuyệt đối mọi offset draw.io.
- Node vẫn phải rơi đúng lane logic sau import.
- Export XML dùng geometry ổn định và re-importable, ưu tiên round-trip hơn là pixel-perfect clone.

---

## A. Import XML

1. User bấm **Import XML…**.
2. Hệ thống mở file picker cho `.xml`.
3. User chọn file draw.io XML.
4. Handler đọc text bằng `FileReader`.
5. Adapter parse XML bằng `DOMParser`.
6. Validate sơ bộ:
   - có `mxfile/diagram/mxGraphModel/root`
   - có outer swimlane container
   - có ít nhất 1 lane con
7. Adapter map `mxCell[]` sang:
   - `lanes`
   - `graph.nodes`
   - `graph.edges`
8. Editor render graph mới, hydrate lane bindings, fit view.
9. Status bar: `Đã import XML: <file-name>`.

### Validation hiện có

- XML không hợp lệ → `Lỗi import XML: File XML không hợp lệ.`
- Thiếu cấu trúc draw.io cốt lõi → báo lỗi cấu trúc tương ứng.
- File ngoài supported subset có thể import partial; Phase 1 ưu tiên fail rõ hơn là silent corruption.

---

## B. Export XML

1. User bấm **Export XML**.
2. Handler lấy graph hiện tại từ `lf.getGraphData()`.
3. XML adapter serialize graph nội bộ thành draw.io XML:
   - outer swimlane container
   - lane cells
   - node cells
   - edge cells
   - edge label cells nếu có
4. Tạo file `diagram.drawio.xml`.
5. Trigger download.
6. Status bar: `Đã tải diagram.drawio.xml`.

### Kết quả mong đợi

- File mở lại được trong draw.io / diagrams.net.
- File export từ app import lại vào app không mất lane/node type cốt lõi trong supported subset.

---

## C. Export PNG

1. User bấm **Export PNG**.
2. Handler dùng plugin `Snapshot` của LogicFlow.
3. SVG được render sang canvas và tải về dạng `.png`.
4. Status bar: `Đã tải swimlane.png`.

---

## Kết quả mong đợi

| Action | File output | Dùng cho |
|---|---|---|
| Import XML | load lại vào editor | Tiếp tục chỉnh sửa diagram từ draw.io |
| Export XML | `.drawio.xml` | Trao đổi với draw.io / diagrams.net |
| Export PNG | `.png` | Slide, chat, báo cáo |

## Use case mở rộng

### UC-05a — Import XML có custom style ngoài supported subset
- Phase 1 có thể degrade về style nhưng vẫn cố giữ semantics lane/node/edge.
- Backlog: map thêm nhiều draw.io shape/style hơn nếu user dùng file phong phú hơn.

### UC-05b — Export profile
- Backlog: cho user chọn `reader-facing export` vs `debug-compatible export`.

### UC-05c — Bring back JSON/SVG dưới menu nâng cao
- Backlog: nếu team vẫn cần artifact nội bộ `diagram-as-code`, có thể đưa JSON/SVG vào menu phụ thay vì toolbar chính.

## Source liên quan

- `src/App.tsx` — toolbar handlers cho import/export.
- `src/io/drawio-import.ts` — XML parser + normalization.
- `src/io/drawio-export.ts` — XML serializer.
- `src/io/drawio-shared.ts` — text/style helpers.
- `examples/bomb.drawio.xml` — fixture contract cho supported subset Phase 1.
