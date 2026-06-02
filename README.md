# Swimlane Activity Diagram — LogicFlow PoC

Trình editor Swimlane Activity Diagram tự dựng, không phụ thuộc drawio. Stack: **React + Vite + TypeScript + [LogicFlow](https://github.com/didi/LogicFlow)**.

Repo hiện có thêm backend FastAPI để:
- validate semantic của diagram
- generate mô tả BRD từ diagram
- chạy theo `mock` mode hoặc `openrouter` live mode qua `apps/api/.env`

## Tính năng

- Canvas có sẵn **4 lane dọc** (Group container, header trên cùng).
- DnD palette: **Start / Activity / Decision / Sync Bar / End / Sticky Note** — kéo vào canvas.
- **Auto snap-to-lane**: node thả vào sẽ tự căn vào lane gần nhất.
- Nối edge giữa node, đặt label cho edge (Có / Không).
- Undo / Redo (Ctrl+Z, Ctrl+Y), Zoom +/−, Fit view.
- **Reset mẫu** (load lại diagram demo), **Xoá nội dung** (giữ lại lane).
- **Mở JSON…**, **Lưu JSON**, **Export SVG**, **Export PNG**.
- **Generate BRD**: gọi backend để validate diagram, sinh structured spec, và render BRD draft.
- BRD panel có 3 tab: **Warnings / Structured Spec / BRD Draft**.
- User có thể **chỉnh sửa trực tiếp BRD draft**, export markdown, và thấy badge `Outdated` khi diagram đổi sau lần generate gần nhất.

## Chạy full luồng local

### 1. Cài frontend

```bash
npm install
```

### 2. Cài backend Python

```bash
python3 -m venv apps/api/.venv
source apps/api/.venv/bin/activate
pip install -e "apps/api[dev]"
```

### 3. Tạo file env cho backend

```bash
cp apps/api/.env.example apps/api/.env
```

Chọn một trong hai mode:

#### Mock mode

Không cần API key. Giữ:

```bash
BRD_PROVIDER=mock
```

#### Live mode qua OpenRouter

Điền các biến tối thiểu trong `apps/api/.env`:

```bash
BRD_PROVIDER=openrouter
BRD_OPENROUTER_API_KEY=...
BRD_MODEL_PRIMARY=openai/gpt-4o-mini
```

`BRD_MODEL_PRIMARY` có thể đổi sang model production sau khi test luồng xong.

### 4. Chạy backend

Mở terminal 1:

```bash
source apps/api/.venv/bin/activate
npm run dev:api
```

Backend mặc định chạy tại:

```text
http://127.0.0.1:8000
```

### 5. Chạy frontend

Mở terminal 2:

```bash
npm run dev:ui
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

### 6. Test luồng hoàn chỉnh

1. Mở `http://localhost:5173`
2. Giữ sample diagram mặc định hoặc chỉnh sửa thêm node/lane
3. Bấm `Generate BRD`
4. Kiểm tra:
   - tab `Warnings`
   - tab `Structured Spec`
   - tab `BRD Draft`
5. Sửa thử nội dung trong `BRD Draft`
6. Bấm `Export markdown`
7. Chỉnh diagram thêm một thay đổi bất kỳ rồi kiểm tra badge `Outdated`

## Chạy test

### Mock path mặc định

```bash
npm run test:brd-mock
```

Gồm:
- `test:ui-mock`
- `test:api-mock`
- `test:e2e-mock`

### Live API smoke

Chỉ dùng khi `apps/api/.env` đã có:
- `BRD_PROVIDER=openrouter`
- `BRD_OPENROUTER_API_KEY`

```bash
npm run test:api-live
```

Suite này hiện test:
- happy path generate
- replay cùng `Idempotency-Key`

## Build production frontend

```bash
npm run build
# Thư mục dist/ ready để deploy lên bất kỳ static host nào (Vercel/Netlify/nginx).
```

## Cấu trúc thư mục

```
swimlane-logicflow/
├── index.html
├── package.json
├── playwright.config.ts
├── vite.config.ts
├── tsconfig.json
├── e2e/
│   └── brd-flow.spec.ts      # Playwright E2E cho BRD flow
├── apps/
│   └── api/
│       ├── app/              # FastAPI app
│       ├── tests/            # Pytest suites (mock + live smoke)
│       ├── .env.example
│       └── pyproject.toml
└── src/
    ├── main.tsx            # React bootstrap
    ├── App.tsx             # Editor shell + toolbar + handlers
    ├── DndPanel.tsx        # Palette sidebar (kéo shape vào canvas)
    ├── nodes.ts            # Custom node types: lane/start/end/activity/decision/sync-bar/note
    ├── lf-config.ts        # Initial diagram data + LogicFlow options + snap logic
    ├── brd/                # Client, normalize, prevalidate, BRD panel
    └── styles.css
```

## Tuỳ biến nhanh

| Bạn muốn | Sửa ở đâu |
|---|---|
| Đổi tên/định nghĩa lane | `src/nodes.ts` → `LANES` array |
| Thêm shape mới vào palette | `src/App.tsx` → `PALETTE` array + register node model ở `src/nodes.ts` |
| Đổi diagram khởi tạo | `src/lf-config.ts` → `buildInitialData()` |
| Đổi style node (màu, font, border) | `src/nodes.ts` → từng `getNodeStyle()` / `getTextStyle()` |
| Đổi provider/model AI BRD | `apps/api/.env` → `BRD_PROVIDER`, `BRD_MODEL_PRIMARY` |
| Đổi structured output / provider behavior | `apps/api/app/providers/openrouter_provider.py` |
| Đổi rule local pre-validation | `src/brd/prevalidate.ts` |
| Đổi deterministic markdown render | `apps/api/app/services/render.py` |

## Bước tiếp theo gợi ý

1. **Rerun live smoke với model production** để chốt latency/cost baseline cuối cùng.
2. **Golden-set eval** cho chất lượng BRD trên diagram thật.
3. **Backend lưu trữ** — POST JSON + BRD draft/spec lên API, gắn user/project/version.
4. **Collaborate realtime** (CRDT/Yjs) — LogicFlow hỗ trợ qua plugin community.
5. **Theme**: dark mode, theme switching, lưu preference user.

## License

PoC này tự viết, free để dùng. LogicFlow (`@logicflow/core`, `@logicflow/extension`) là Apache-2.0.
