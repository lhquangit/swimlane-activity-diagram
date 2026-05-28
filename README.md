# Swimlane Activity Diagram — LogicFlow PoC

Trình editor Swimlane Activity Diagram tự dựng, không phụ thuộc drawio. Stack: **React + Vite + TypeScript + [LogicFlow](https://github.com/didi/LogicFlow)**.

## Tính năng

- Canvas có sẵn **4 lane dọc** (Group container, header trên cùng).
- DnD palette: **Start / Activity / Decision / Sync Bar / End / Sticky Note** — kéo vào canvas.
- **Auto snap-to-lane**: node thả vào sẽ tự căn vào lane gần nhất.
- Nối edge giữa node, đặt label cho edge (Có / Không).
- Undo / Redo (Ctrl+Z, Ctrl+Y), Zoom +/−, Fit view.
- **Reset mẫu** (load lại diagram demo), **Xoá nội dung** (giữ lại lane).
- **Mở JSON…**, **Lưu JSON**, **Export SVG**, **Export PNG**.

## Chạy local

```bash
cd swimlane-logicflow
npm install
npm run dev
# Mở http://localhost:5173
```

## Build production

```bash
npm run build
# Thư mục dist/ ready để deploy lên bất kỳ static host nào (Vercel/Netlify/nginx).
```

## Cấu trúc thư mục

```
swimlane-logicflow/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx            # React bootstrap
    ├── App.tsx             # Editor shell + toolbar + handlers
    ├── DndPanel.tsx        # Palette sidebar (kéo shape vào canvas)
    ├── nodes.ts            # Custom node types: lane/start/end/activity/decision/sync-bar/note
    ├── lf-config.ts        # Initial diagram data + LogicFlow options + snap logic
    └── styles.css
```

## Tuỳ biến nhanh

| Bạn muốn | Sửa ở đâu |
|---|---|
| Đổi tên/định nghĩa lane | `src/nodes.ts` → `LANES` array |
| Thêm shape mới vào palette | `src/App.tsx` → `PALETTE` array + register node model ở `src/nodes.ts` |
| Đổi diagram khởi tạo | `src/lf-config.ts` → `buildInitialData()` |
| Đổi style node (màu, font, border) | `src/nodes.ts` → từng `getNodeStyle()` / `getTextStyle()` |
| Lưu vào backend thay vì download | `src/App.tsx` → thay `downloadBlob(...)` bằng `fetch(POST)` |

## Bước tiếp theo gợi ý

1. **Custom shape stencil cho domain riêng** (actor "Khán giả" / "Trưởng VOC" / "Sensor CCTV"…) — thêm node type mới với icon riêng.
2. **Backend lưu trữ** — POST JSON lên API, gắn user/project/version.
3. **Validate**: bắt buộc có ≥1 Start, ≥1 End; warning nếu node mồ côi; ngăn xoá Lane.
4. **Collaborate realtime** (CRDT/Yjs) — LogicFlow hỗ trợ qua plugin community.
5. **Theme**: dark mode, theme switching, lưu preference user.

## License

PoC này tự viết, free để dùng. LogicFlow (`@logicflow/core`, `@logicflow/extension`) là Apache-2.0.
