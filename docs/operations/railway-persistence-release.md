# Railway Persistence Release Runbook

## Scope

Runbook này áp dụng cho FastAPI service và PostgreSQL service của Smart Diagram trên cùng Railway
project/environment. Application chỉ dùng một biến canonical `DATABASE_URL`.

## Required Variables

API service:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `CLERK_SECRET_KEY`
- `CLERK_AUTHORIZED_PARTIES`
- `BRD_CORS_ORIGINS`
- Các biến AI provider/model hiện có

Không copy `PGDATA`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `POSTGRES_*`,
`DATABASE_PUBLIC_URL` hoặc `SSL_CERT_DAYS` sang API service.

Local direct run phải dùng public TCP URL đã resolve và SSL. Railway reference `${{...}}` chỉ đặt
trong Railway Variables hoặc dùng qua `railway run`.

## Credential Rotation

1. Rotate PostgreSQL credential trong Railway.
2. Xác nhận API service dùng reference tới Postgres service, không giữ password copy thủ công.
3. Redeploy mọi service phụ thuộc database.
4. Xác nhận credential cũ không còn kết nối được.
5. Không ghi URL/password vào issue, log, screenshot hoặc tài liệu.

Credential đã từng bị chia sẻ phải được coi là compromised cho tới khi đủ năm bước trên được xác
nhận.

## Pre-Release

1. Railway CLI đã đăng nhập và repo đã link đúng project/environment.
2. Scheduled volume backup đang bật; owner và retention đã được ghi nhận.
3. Staging backup mới nhất hoàn tất.
4. `railway.toml` được Railway nhận đúng:
   - build: `apps/api/Dockerfile` từ repository root
   - pre-deploy: `python -m alembic upgrade head`
   - start: Uvicorn bind `0.0.0.0:$PORT`
   - healthcheck: `/healthz`
5. Production origins có trong Clerk authorized parties và backend CORS.
6. Backend, frontend và persistence integration suites pass.

## Staging Rehearsal

1. Deploy staging và kiểm pre-deploy migration log.
2. Kiểm `/healthz` trả `200`.
3. Kiểm `/readyz` trả `200` và chuyển lỗi khi database cố ý unavailable.
4. Đăng nhập bằng Clerk test user.
5. Tạo Project, lưu Spec, Feature, Use Case, Diagram và BRD.
6. Reload browser và xác nhận toàn chain được hydrate lại.
7. Dùng user thứ hai xác nhận UUID của user thứ nhất trả `404`.
8. Kiểm application log không chứa token, DB URL, password hoặc artifact payload.

## Backup And Restore Drill

1. Ghi thời điểm backup, environment, owner và Railway backup identifier.
2. Restore vào environment tách biệt.
3. Chạy `alembic current` và `/readyz`.
4. Kiểm một project mẫu cùng toàn bộ child artifact.
5. Ghi recovery time, data timestamp và mọi sai lệch.

Không nhận production data trước khi có ít nhất một restore drill thành công.

## Rollback

- Application rollback: deploy lại image/commit trước.
- Migration rollback: chỉ dùng khi migration được đánh giá backward-compatible và downgrade đã được
  rehearsal. Không tự động downgrade production schema.
- Database restore: dùng khi migration hoặc write path gây mất/corrupt dữ liệu; cần quyết định của
  release owner vì restore có thể mất write sau thời điểm backup.

## Observability

- Alert khi deploy/pre-deploy thất bại hoặc `/readyz` liên tục lỗi.
- Theo dõi latency/error rate theo route, pool timeout và database connection failures.
- Log request ID, route, status, latency và error class.
- Không log Authorization header, Clerk token, database URL, request payload hoặc BRD content.

## Current Verification

Ngày 2026-06-07, repo đã có manifest, migration, liveness/readiness và local PostgreSQL integration
test. Credential rotation, Railway staging deploy, backup schedule và restore drill chưa được xác
nhận vì Railway CLI session hiện không authenticated/link được project.

Ngày 2026-06-07 15:34 +07, rehearsal được chạy lại sau phần Save-state hardening. Frontend build,
UI tests và Playwright mock E2E pass. `railway status` vẫn fail vì OAuth token hết hạn và repo chưa
link project, nên staging deploy, Alembic pre-deploy và `/readyz` live vẫn đang chờ owner chạy
`railway login` và `railway link`.
