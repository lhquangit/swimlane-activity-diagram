# Swimlane Activity Diagram — LogicFlow PoC

Trình editor Swimlane Activity Diagram tự dựng, không phụ thuộc drawio. Stack: **React + Vite + TypeScript + [LogicFlow](https://github.com/didi/LogicFlow)**.

Repo hiện có thêm backend FastAPI để:
- ingest `ProjectSpec + FeatureIntent` và sinh `UseCaseDraft[]`
- validate semantic của diagram
- generate mô tả BRD từ diagram
- chạy theo `mock` mode hoặc `openrouter` live mode qua `apps/api/.env`

## Tính năng

- Project workspace có left artifact tree:
  **Project Spec → Feature Intent → Use Case → Diagram → BRD**.
- Canvas chỉ tải Diagram thật đã lưu hoặc vừa generate; project mới không có diagram mẫu.
- DnD palette: **Start / Activity / Decision / Sync Bar / End / Sticky Note** — kéo vào canvas.
- **Auto snap-to-lane**: node thả vào sẽ tự căn vào lane gần nhất.
- Nối edge giữa node, đặt label cho edge (Có / Không).
- Undo / Redo (Ctrl+Z, Ctrl+Y), Zoom +/−, Fit view.
- **Xoá nội dung** giữ lại lane của Diagram đang mở.
- **Import XML…**, **Export XML**, **Export PNG**.
- **Use case drafts**: nhập `ProjectSpec + FeatureIntent`, generate danh sách use case draft, chỉnh tay, và approve trước khi đi tiếp.
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

Repo scripts intentionally call `apps/api/.venv/bin/python` directly, so backend commands do
not depend on packages installed in the system Python.

### 3. Tạo file env cho backend

```bash
cp apps/api/.env.example apps/api/.env
```

Chọn một trong hai mode:

#### Mock mode

Không cần API key. Giữ:

```bash
AI_PROVIDER=mock
BRD_PROVIDER=mock
USECASE_PROVIDER=mock
USECASE_GENERATION_MODE=deterministic
```

#### Live mode qua OpenRouter

Điền các biến tối thiểu trong `apps/api/.env`:

```bash
AI_PROVIDER=openrouter
AI_OPENROUTER_API_KEY=...
BRD_PROVIDER=openrouter
BRD_MODEL_PRIMARY=openai/gpt-4o-mini
USECASE_PROVIDER=openrouter
USECASE_MODEL_PRIMARY=openai/gpt-4o-mini
USECASE_GENERATION_MODE=ai_default
USECASE_PROMPT_VERSION=1.1.0
```

`USECASE_GENERATION_MODE` hỗ trợ `deterministic`, `ai_shadow`, `ai_opt_in`, và
`ai_default`. Với feature mang tính AI Agent như camera re-id, nên bật `ai_default` để route
generate ưu tiên semantic synthesis trước khi fallback. Giữ `deterministic` làm kill switch khi
đang debug hoặc chưa có provider/key.

### 4. Chạy backend

Mở terminal 1:

```bash
npm run api:python:smoke
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
2. Đăng nhập, tạo project và lưu `Project Spec`
3. Tạo/lưu một `Feature Intent` từ artifact tree
4. Mở node `Use Cases`, bấm `Sinh use case` để AI generate và persist ngay danh sách vào left tree
5. Kiểm tra panel `Lần sinh gần nhất` trên list/editor để biết đây là `Bản nháp AI` hay
   `Bản nháp theo rule`, provider/model nào đã chạy, và prompt version/fallback nào được dùng
6. Mở từng `Use Case`, review/chỉnh sửa, `Đánh dấu đã rà soát` -> `Phê duyệt` -> `Lưu Use Case`
7. Bấm `Tạo diagram` trên Use Case đã approved hoặc trên state `Diagram chưa tạo`, đợi route Use Case hiện `Mở diagram`, rồi mở canvas và `Lưu diagram`
8. Kiểm tra:
   - URL deep-link đúng artifact đang chọn
   - tree hiển thị Diagram thật vừa lưu
   - `Export XML` và `Import XML…` hoạt động với Diagram hiện tại
9. Chọn node BRD và bấm `Generate BRD`
10. Kiểm tra:
   - tab `Warnings`
   - tab `Structured Spec`
   - tab `BRD Draft`
11. Sửa thử nội dung trong `BRD Draft`
12. Bấm `Export markdown`
13. Chỉnh diagram thêm một thay đổi bất kỳ rồi kiểm tra badge `Outdated`

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
- `AI_PROVIDER=openrouter`
- `AI_OPENROUTER_API_KEY`

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
    ├── application/        # Project dashboard, artifact routes/tree/workspace
    ├── DndPanel.tsx        # Palette sidebar (kéo shape vào canvas)
    ├── nodes.ts            # Custom node types: lane/start/end/activity/decision/sync-bar/note
    ├── lf-config.ts        # LogicFlow options + lane node helpers
    ├── test-fixtures/      # Sample graph chỉ dành cho automated tests
    ├── test-harness/       # Editor harness chỉ bật bằng env test
    ├── brd/                # Client, normalize, prevalidate, BRD panel
    ├── usecases/           # Spec ingestion, use case client, review panel
    └── styles.css
```

## Tuỳ biến nhanh

| Bạn muốn | Sửa ở đâu |
|---|---|
| Đổi tên/định nghĩa lane | `src/nodes.ts` → `LANES` array |
| Thêm shape mới vào palette | `src/App.tsx` → `PALETTE` array + register node model ở `src/nodes.ts` |
| Đổi dữ liệu test editor | `src/test-fixtures/fire-incident.ts` |
| Đổi contract draw.io XML | `src/io/drawio-import.ts`, `src/io/drawio-export.ts`, `src/io/drawio-shared.ts` |
| Đổi style node (màu, font, border) | `src/nodes.ts` → từng `getNodeStyle()` / `getTextStyle()` |
| Đổi provider/model AI | `apps/api/.env` → `AI_PROVIDER`, `BRD_MODEL_PRIMARY`, `USECASE_MODEL_PRIMARY` |
| Đổi rollout AI use case | `apps/api/.env` → `USECASE_GENERATION_MODE` |
| Đổi structured output / provider behavior | `apps/api/app/ai/providers/openrouter.py` |
| Đổi prompt/version | `apps/api/app/ai/prompts/assets/*` + `apps/api/app/ai/prompts/registry.py` |
| Đổi rule local pre-validation | `src/brd/prevalidate.ts` |
| Đổi deterministic markdown render | `apps/api/app/services/render.py` |

## Bước tiếp theo gợi ý

1. **Rerun live smoke với model production** để chốt latency/cost baseline cuối cùng.
2. **Golden-set eval** cho chất lượng BRD trên diagram thật.
3. **Persistence hardening** — backup/monitoring và hosted Clerk/Railway E2E.
4. **Collaborate realtime** (CRDT/Yjs) — LogicFlow hỗ trợ qua plugin community.
5. **Theme**: dark mode, theme switching, lưu preference user.

## License

PoC này tự viết, free để dùng. LogicFlow (`@logicflow/core`, `@logicflow/extension`) là Apache-2.0.
