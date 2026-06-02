# Kiến trúc backend cho tính năng AI BRD
 
> Tài liệu này bổ sung cho [architecture.md](./architecture.md) — vốn chỉ mô tả frontend editor. Khi triển khai tính năng AI BRD (xem [../product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md)), repo cần một backend Python + FastAPI mới. Doc này chốt topology Phase 1 trên Railway, ranh giới module, và policy hosting để chuẩn bị cho Phase 1 build.
 
## 1. Mục tiêu
 
- Tách AI generation ra khỏi browser để bảo vệ provider API key và áp privacy/rate-limit policy.
- Tập trung quản lý runtime key/quota/usage qua OpenRouter thay vì cài từng upstream provider key riêng ở backend app.
- Có boundary rõ giữa logic deterministic (Extract / Normalize / Validate / Interpret / Post-check) và phần gọi model LLM.
- Có thể swap gateway/provider (OpenRouter → provider trực tiếp / self-hosted) mà không sửa contract frontend.
 
## 2. Phạm vi và non-goals
 
### Trong phạm vi Phase 1
 
- 1 backend Python FastAPI service riêng cho AI BRD.
- Endpoint sync (single response), không SSE.
- Không persist BRD artifact (chỉ cache idempotency ngắn hạn).
- Không có DB schema cố định ở Phase 1.
 
### Out-of-scope ở Phase 1
 
- Auth-based multi-tenant (Phase 2 sau khi roadmap collaboration chốt).
- Realtime streaming progress events.
- Lưu structured spec / BRD draft dài hạn ở backend.
 
## 3. Repo layout đề xuất
 
Doc này khuyến nghị **mono-repo** thay vì repo riêng cho backend, để giữ frontend + backend cùng version control và CI:
 
```text
swimlane-activity-diagram/
├── src/                              # frontend Vite + React + LogicFlow (đã có)
├── apps/
│   └── api/                          # backend mới, FastAPI
│       ├── pyproject.toml
│       ├── app/
│       │   ├── main.py               # FastAPI entrypoint
│       │   ├── routes/
│       │   │   ├── brd_validate.py
│       │   │   └── brd_generate.py
│       │   ├── services/
│       │   │   ├── extract.py
│       │   │   ├── normalize.py
│       │   │   ├── validate.py
│       │   │   ├── interpret.py
│       │   │   ├── render.py
│       │   │   └── postcheck.py
│       │   ├── providers/
│       │   │   ├── base.py           # LLMProvider abstract
│       │   │   ├── openrouter_provider.py
│       │   │   └── mock_provider.py  # cho unit test
│       │   ├── schemas/
│       │   │   ├── request.py        # DiagramSemanticRequest
│       │   │   ├── spec.py           # DiagramBRDSpec
│       │   │   └── error.py
│       │   └── config.py
│       ├── tests/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── eval/                 # golden set cho Section 17
│       └── Dockerfile
├── docs/                             # đã có
└── package.json
```
 
Lý do mono-repo:
 
- Frontend gọi backend qua HTTP, contract định nghĩa bởi schema TS (Section 9-10 feature doc) → đồng bộ thuận lợi khi cùng repo.
- CI có thể test integration thực sự (frontend gọi backend mock).
- User không phải clone 2 repo để chạy thử.
 
Nếu sau này backend lớn lên (auth, multi-tenant, queue), có thể tách repo riêng.
 
## 4. Module map backend
 
| Module | Trách nhiệm |
|---|---|
| `routes/brd_validate.py` | Endpoint `POST /api/brd/validate`. Chạy Step 1-3, trả `warnings[]` + blocking. |
| `routes/brd_generate.py` | Endpoint `POST /api/brd/generate`. Chạy Step 1-7, trả `DiagramBRDSpec` + `brd_markdown`. |
| `services/extract.py` | Chuyển payload JSON thành internal graph object. Pure function, không gọi model. |
| `services/normalize.py` | Mapping lane → actor, activity → action step (Step 2). |
| `services/validate.py` | Rule-based validate (Step 3). Trả warnings + blocking. |
| `services/interpret.py` | Detect main flow, branch, handoff, parallel block, loop (Step 4). Pure function. |
| `services/render.py` | Render markdown deterministically từ `DiagramBRDSpec` theo template đã chọn (Step 6). |
| `services/postcheck.py` | Rule-based post-check (Step 7). |
| `providers/base.py` | Interface `LLMProvider.generate_structured(payload, schema) -> dict`. |
| `providers/openrouter_provider.py` | Implementation cho OpenRouter, route tới model slug như `openai/gpt-5.5` và ưu tiên structured outputs strict mode khi có. |
| `providers/mock_provider.py` | Mock cho unit test + dev environment khi không có API key. |
| `schemas/*.py` | Pydantic models tương ứng với TS types trong feature doc. |
| `config.py` | Load env vars (model snapshot ID, rate limit config, idempotency TTL). |
 
## 5. Provider abstraction
 
```python
# providers/base.py
from typing import Protocol
from pydantic import BaseModel
 
class LLMProvider(Protocol):
    def generate_structured(
        self,
        system_prompt: str,
        user_content: str,
        response_schema: type[BaseModel],
        model: str,
    ) -> BaseModel: ...
```
 
Implementation lưu ý:

- `OpenRouterProvider` gọi OpenRouter API qua `https://openrouter.ai/api/v1`, dùng `response_format: { type: 'json_schema', strict: true }` khi model route hỗ trợ structured outputs.
- Phase 1 không cần `generate_text()` cho prose pass thứ hai; BRD markdown được render bằng code/template từ canonical structured spec.
- `MockProvider` trả fixture deterministic dựa trên input hash → unit test ổn định, không tốn token.
 
## 6. Cấu hình môi trường
 
Backend đọc các env var sau (xem `apps/api/.env.example` khi tạo):
 
| Env var | Mặc định | Mô tả |
|---|---|---|
| `BRD_PROVIDER` | `openrouter` | Provider/gateway đang dùng: `openrouter` hoặc `mock`. Nếu là `mock`, backend không gọi provider thật. |
| `BRD_OPENROUTER_API_KEY` | _empty_ | API key cho OpenRouter; nếu rỗng, backend từ chối `POST /api/brd/generate` với `503`. |
| `BRD_OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Base URL cho OpenRouter API. Giữ tách riêng để test/mock gateway khi cần. |
| `BRD_OPENROUTER_HTTP_REFERER` | _empty_ | Optional header `HTTP-Referer` cho app attribution trên OpenRouter. |
| `BRD_OPENROUTER_APP_TITLE` | _empty_ | Optional header `X-OpenRouter-Title` cho app attribution trên OpenRouter. |
| `BRD_MODEL_PRIMARY` | `openai/gpt-5.5` | Model slug cho synthesis qua OpenRouter. Pin snapshot slug ở production nếu cần ổn định hơn alias. |
| `BRD_MODEL_HELPER` | `openai/gpt-5.4-mini` | Model slug cho cheap ops / Phase 2 rewrite hỗ trợ. |
| `BRD_IDEMPOTENCY_TTL_SECONDS` | `600` | Thời gian cache idempotency. |
| `BRD_REQUEST_RATE_LIMIT` | `20/min` | Per-IP rate limit ở Phase 1 (chưa có auth). |
| `BRD_LOG_PROMPT_BODY` | `false` | Bật chỉ khi debug local. Production luôn `false` (Section 14.3 feature doc). |
| `BRD_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated. Phase 1 chỉ allow frontend chính thức. |
 
## 7. Deployment topology Phase 1

Phase 1 chốt deploy backend lên **Railway**.

### Railway (đã chọn cho Phase 1)

- Backend Python FastAPI build từ `apps/api/Dockerfile`.
- 1 service Railway riêng cho `apps/api`.
- Frontend tiếp tục host tách riêng như hiện tại; frontend gọi backend qua `VITE_BRD_API_URL`.
- Railway lo TLS, build, secret env vars, và health check cơ bản cho Phase 1.
- Phù hợp với scope hiện tại: 1 service, lưu lượng thấp, cần setup nhanh hơn tự vận hành VPS.

### Fallback option nếu Railway không phù hợp sau này

- VPS self-managed với Nginx reverse proxy `/api/*` -> FastAPI uvicorn local.
- Chỉ dùng nếu cần tối ưu chi phí sâu hơn hoặc có ràng buộc hạ tầng riêng.

### Không khuyến nghị Phase 1
 
- AWS Lambda / Vercel Functions: cold start + token quota khó kiểm soát + tiền xử lý graph có thể vượt timeout 30s.
- Kubernetes / ECS: over-engineered cho 1 service, 1 region, < 10 req/min.
 
## 8. CORS & frontend wiring
 
- Frontend đọc `VITE_BRD_API_URL` để biết gọi đâu (dev: `http://localhost:8000`, prod: Railway URL).
- Backend cấu hình CORS qua `BRD_CORS_ORIGINS` env var, không hard-code domain.
- Phase 1 chưa cần preflight cho header tuỳ chỉnh ngoài `Idempotency-Key` và `X-Schema-Version` → CORS config phải allow 2 header này.
 
## 9. Local development workflow
 
1. `cd apps/api && uv venv && uv sync` (hoặc `pip install -e .`).
2. Copy `.env.example` → `.env`, set `BRD_OPENROUTER_API_KEY` (hoặc dùng `BRD_PROVIDER=mock` để chạy không cần key).
3. Chạy `uv run uvicorn app.main:app --reload --port 8000`.
4. Ở frontend, `npm run dev` như bình thường; set `VITE_BRD_API_URL=http://localhost:8000` trong `.env.local`.
5. Health check: `curl http://localhost:8000/healthz`.
 
Nếu chỉ muốn dev frontend không kèm AI: dùng `BRD_PROVIDER=mock`, backend trả structured spec fixture deterministic.
 
## 10. Observability tối thiểu Phase 1

- Log JSON structured: `request_id`, `endpoint`, `latency_ms`, `status_code`, `diagram_node_count`, `model_used`.
- **Không log** prompt body / structured spec / BRD markdown ở production (Section 14.3).
- Metric counter cơ bản: số request validate, số request generate, tỉ lệ blocking warning, tỉ lệ post-check fail.
- OpenRouter workspace / organization là lớp theo dõi usage ngoài ứng dụng; backend app không cần tự xây usage dashboard ở Phase 1.
- Response/status contract, error shape, và idempotency states phải bám theo Section 13 của feature doc; backend architecture không tự tạo contract thứ hai riêng.
 
## 11. Bảo mật

- Backend chỉ giữ `BRD_OPENROUTER_API_KEY`, không giữ từng upstream provider key riêng trong app config Phase 1.
- API key runtime không bao giờ trả về frontend.
- Quản lý limit/rotation/disable key nên thực hiện trong OpenRouter workspace; nếu cần automation về sau, dùng OpenRouter Management API thay vì tự xây service riêng ngay ở Phase 1.
- Phase 1 chưa có user auth → rate limit theo IP.
- Phase 2 sẽ bổ sung session-based auth khi roadmap collaboration được triển khai.
- Tham chiếu chéo: feature doc Section 14 (privacy + prompt injection).
 
## 12. Câu hỏi còn mở (chờ quyết định trước khi code)
 
- [ ] Domain production cho backend Railway (ví dụ custom domain hay dùng Railway domain mặc định)?
- [ ] Có cần monitoring/uptime check ngay Phase 1 hay defer Phase 2?
- [ ] CI: GitHub Actions test Python ở job riêng?
 
## 13. Tài liệu liên quan
 
- Feature definition: [../product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md)
- Use case: [../use-cases/UC-06-sinh-brd-tu-diagram.md](../use-cases/UC-06-sinh-brd-tu-diagram.md)
- Frontend architecture: [./architecture.md](./architecture.md)
- Roadmap Phase 2 (sẽ kéo theo persistence): [../roadmap/phase-2-collaboration.md](../roadmap/phase-2-collaboration.md)
