# Kiến trúc kỹ thuật

## 1. Stack tổng quan

| Layer | Công nghệ | Lý do chọn |
|---|---|---|
| Build / dev server | **Vite 5** | HMR nhanh, build nhỏ, hỗ trợ TS sẵn. |
| Ngôn ngữ | **TypeScript 5** | Type safety cho model node & event payload. |
| UI framework | **React 18** | Quản lý state UI (lanes, status), DnD palette. |
| Diagram engine | **@logicflow/core 1.2.x** | Engine vẽ flow chart open source, custom node/edge dễ. |
| Extensions | **@logicflow/extension** | Snapshot (PNG export), SelectionSelect (multi-select), NodeResize base classes cho model resize. |
| Style | CSS thuần (`src/styles.css`) | Tránh phụ thuộc CSS framework cho PoC. |

## 2. Sơ đồ thành phần

```
┌────────────────────────────────────────────────────────────────┐
│                         index.html                             │
│                              │                                  │
│                       ReactDOM.createRoot                       │
│                              │                                  │
│                          <App />                                │
│  ┌───────────────────────────┴────────────────────────────┐    │
│  │             App.tsx (editor shell)                      │    │
│  │ ┌─────────────┐  ┌────────────────────────────────┐    │    │
│  │ │  Toolbar    │  │       <DndPanel />              │    │    │
│  │ │ (Undo/Redo, │  │  palette: Start/Activity/...    │    │    │
│  │ │  Export...) │  │  onMouseDown → lf.dnd.startDrag │    │    │
│  │ └─────────────┘  └────────────────────────────────┘    │    │
│  │           │                       │                     │    │
│  │           ▼                       ▼                     │    │
│  │ ┌──────────────────────────────────────────────────┐   │    │
│  │ │      LogicFlow instance (lfRef.current)          │   │    │
│  │ │   Init: getLogicFlowOptions() + registerNodes()  │   │    │
│  │ │   Event listeners:                                │   │    │
│  │ │     - node:dnd-add    → snap X + zIndex top      │   │    │
│  │ │     - node:drop       → snap X khi drag node cũ  │   │    │
│  │ │     - node:delete     → chặn xoá lane            │   │    │
│  │ │     - node:dbclick    → đổi tên lane             │   │    │
│  │ │     - lane toolbar    → rename/delete/reorder    │   │    │
│  │ │     - custom handles  → resize lane / shape      │   │    │
│  │ └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

## 3. Module map

| File | Trách nhiệm |
|---|---|
| `src/main.tsx` | Bootstrap React, mount `<App />` vào `#root`. |
| `src/App.tsx` | Editor shell: toolbar, sidebar, khởi tạo LogicFlow, đăng ký event handler, cache BRD frontend, import/export XML draw.io, mở panel `Use case drafts`, và gọi backend AI (`/api/usecases/generate`, BRD APIs). |
| `src/DndPanel.tsx` | Palette sidebar (render các shape có thể kéo vào canvas). |
| `src/usecases/*` | Contract frontend cho `ProjectSpec`, `FeatureIntent`, `UseCaseDraft`, client gọi `/api/usecases/generate`, và panel review use case draft. |
| `apps/api/app/routes/usecase_generate.py` | API deterministic cho `ProjectSpec + FeatureIntent -> UseCaseDraft[]` cùng artifact chain. |
| `apps/api/app/services/usecase_builder.py` | Heuristic/service layer sinh use case draft từ project spec và feature intent. |
| `src/nodes.ts` | Định nghĩa custom node types: `lane`, `start`, `end`, `activity`, `decision`, `sync-bar`, `note`. Bao gồm model (data + behavior) và view (SVG). |
| `src/lf-config.ts` | Initial diagram data (`buildInitialData`), build lane node config (`buildLaneNodes`), snap-to-lane helper (`snapToLane`), LogicFlow options (`getLogicFlowOptions`). |
| `src/styles.css` | Layout grid (header / sidebar / canvas), styling cho toolbar và palette. |

## 4. State model

### React state (in `App.tsx`)

| State | Kiểu | Mục đích |
|---|---|---|
| `lanes` | `LaneConfig[]` | Cấu hình lane đang hiển thị. Đổi tên / thêm / xoá lane đều cập nhật state này. |
| `status` | `string` | Status bar text (thông báo cho user). |
| `projectSpec` | `ProjectSpec` | Input spec cấp dự án cho pipeline `spec -> use case`. |
| `featureIntent` | `FeatureIntent` | Intent chức năng user muốn build. |
| `useCaseDrafts` | `UseCaseDraft[]` | Danh sách use case draft đang review ở frontend. |
| `useCasePhase` | `idle \| generating \| ready \| failed` | Runtime state của panel use case. |
| `activeLaneId` | `string \| null` | Lane đang được chọn để hiện toolbar/resize handle. |
| `activeNodeId` | `string \| null` | Shape đang được chọn để hiện resize handle. |
| `lanesRef` | `useRef<LaneConfig[]>` | Mirror của `lanes`, dùng trong các LF event handler (đăng ký 1 lần với `useEffect([])`). |
| `laneHeightRef` | `useRef<number>` | Chiều cao swimlane hiện tại, kết hợp auto-grow và manual resize. |
| `lfRef` | `useRef<LogicFlow>` | Instance LogicFlow, dùng cho mọi thao tác imperative. |
| `containerRef` | `useRef<HTMLDivElement>` | DOM container nơi LF mount canvas. |

### LogicFlow state

- Toàn bộ node + edge trong `lf.graphModel`.
- Sync 2 chiều với React state thông qua các event handler trong `useEffect` mount lần đầu.

## 5. Conventions cho custom node

Mỗi loại node có 1 cặp `Model + View` (View optional nếu không cần custom SVG).

```ts
// nodes.ts
class ActivityModel extends RectNodeModel {
  initNodeData(data: any) {
    super.initNodeData(data);
    this.width = data.properties?.width ?? 180;
    this.height = data.properties?.height ?? 44;
    this.radius = 12;
  }
  getNodeStyle() { /* fill, stroke */ }
  getTextStyle() { /* fontSize, color */ }
}

lf.register({ type: 'activity', view: RectNode, model: ActivityModel });
```

Quy ước:
- **Model** kế thừa từ `RectResize.model` / `DiamondResize.model` / `EllipseNodeModel` tùy loại node.
- **Width / Height** lấy từ `data.properties` hoặc `properties.nodeSize` nếu có, fallback default.
- **Lane** đặc biệt: zIndex = -1000 (luôn nằm dưới), `draggable=false`, `isShowAnchor=false`, được app chọn qua hit-test riêng để hiện toolbar.

## 6. Snap-to-lane logic

```ts
// lf-config.ts
export function snapToLane(x: number, lanes: LaneConfig[]): number {
  // Tìm lane có center.x gần x nhất, trả về center.x của lane đó
}
```

Áp dụng trong 2 event:
1. `node:dnd-add` — khi vừa thả shape mới từ palette.
2. `node:drop` — khi drag node có sẵn rồi thả.

Loại trừ: `lane` (không snap chính nó), `sync-bar` (kéo ngang xuyên qua nhiều lane).

## 7. Render order (quan trọng cho bug-fix tháng 5/2026)

LogicFlow render SVG theo thứ tự DOM của children trong `<g>`. Element nào append sau sẽ hiển thị trên element trước đó.

Để đảm bảo lane luôn nằm dưới (background), còn node/lane action overlay vẫn dễ thao tác:

1. `LaneModel.zIndex = -1000` (model-level).
2. `buildLaneNodes()` set `zIndex: -1000` trong data init (data-level).
3. Sau `node:dnd-add`, gọi `lf.graphModel.setElementZIndex(id, 'top')` để new node luôn append sau lane → hiển thị trên.

Xem chi tiết bug & fix tại [progress/known-issues.md](../progress/known-issues.md#fixed-drop-shape-vao-lane-bi-bien-mat).

## 8. Build & deploy

```bash
npm install          # cài deps
npm run dev          # vite dev server (port 5173)
npm run dev:api      # FastAPI local backend (port 8000)
npm run build        # tsc -b && vite build → dist/
npm run preview      # preview dist/ qua port 4173
```

Output trong `dist/` là static files — deploy được lên Vercel / Netlify / nginx / S3.

## 9. Artifact chain hiện tại

Target mới của repo không còn dừng ở `diagram -> BRD`. Chain chuẩn hiện tại là:

`ProjectSpec -> FeatureIntent -> UseCaseDraft -> DiagramDraft -> FormalBRDDraft`

Chi tiết contract tại [artifact-chain.md](./artifact-chain.md).

## 10. Phụ thuộc bên ngoài cần lưu ý

- **LogicFlow Apache-2.0** — có thể fork/sửa nếu cần.
- Có backend FastAPI cục bộ cho AI workflows (`usecases`, `brd`), nhưng chưa có database bền.
- Lưu trữ tạm hiện gồm:
  - `localStorage` cho BRD draft cache
  - in-memory state cho `ProjectSpec`, `FeatureIntent`, và `UseCaseDraft`

Thiết kế persistence MVP đã được chốt tại
[database-architecture.md](./database-architecture.md): PostgreSQL + SQLAlchemy/Alembic trên FastAPI
hiện có, Clerk JWT ở backend, ownership trực tiếp user/project, chỉ lưu phiên bản mới nhất và dùng
nút `Lưu` cho từng phần.
