# AI BRD Live Readiness Review

- Date: 2026-06-01
- Scope: Review trạng thái hiện tại của feature generate BRD từ diagram sau khi hoàn tất mock-first pipeline, retry/idempotency hardening, note semantics, và sync-bar semantics.
- Reviewer: Codex (`$senior-ai-reviewer`)

## Findings

### [P1] Live provider path đã được implement nhưng vẫn chưa được verify end-to-end với provider thật

- `OpenRouterProvider` đã gọi thật tới OpenRouter với `json_schema` strict mode và parse usage metadata ở [apps/api/app/providers/openrouter_provider.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/providers/openrouter_provider.py:21).
- Route `/api/brd/generate` cũng đã nối sang live provider khi `BRD_PROVIDER != "mock"` và có `BRD_OPENROUTER_API_KEY` ở [apps/api/app/routes/brd_generate.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/routes/brd_generate.py:148).
- Tuy vậy, test hiện tại mới verify contract bằng fake provider/monkeypatch ở [apps/api/tests/test_routes.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/test_routes.py:259), chưa có smoke suite chạy thật và `package.json` cũng chưa có command live riêng ở [package.json](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/package.json:6).
- Kết luận: feature đã sẵn sàng cho live smoke hẹp, nhưng chưa nên gọi là fully complete ở live path.

### [P2] `UC-06` hứa frontend pre-validation trong browser, nhưng runtime hiện vẫn round-trip backend cho mọi lần generate

- Use case ghi rõ frontend phải kiểm tra sơ bộ `start/end`, lane ownership, và edge endpoint trước khi gọi backend ở [docs/use-cases/UC-06-sinh-brd-tu-diagram.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-06-sinh-brd-tu-diagram.md:22).
- Runtime hiện tại đi thẳng từ semantic build sang `POST /api/brd/validate` ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1181).
- Đây chưa phải lỗi semantic nghiêm trọng vì backend validation vẫn là source of truth, nhưng là một mismatch đáng dọn để UX và doc khớp nhau.

### [P2] Main user flow vẫn chưa có browser E2E để khóa regression

- Repo hiện chỉ có `test:ui-mock`, `test:api-mock`, `test:brd-mock` ở [package.json](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/package.json:6).
- UI tests mới dừng ở panel/unit level tại [src/brd/BrdPanel.test.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.test.tsx:78) và normalization tại [src/brd/normalize.test.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/normalize.test.ts:11).
- Backlog cũng đang phản ánh đúng trạng thái này với `TASK-015` và `TASK-017` ở [docs/review-task-list.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/review-task-list.md:595).
- Kết luận: mock-path đã khá chắc ở unit/integration level, nhưng chưa có lớp E2E để giữ UX flow `Generate -> retry -> edit -> export -> outdated`.

## Verification

- `apps/api/.venv/bin/python -m pytest apps/api/tests` -> `20 passed`
- `npm run test:brd-mock` -> pass

## Recommended next order

1. Chạy live smoke hẹp với key thật để đóng runtime gap của `TASK-016`.
2. Thêm command/suite live có guard env và cost cho `TASK-017`.
3. Thêm browser E2E cho mock flow để đóng `TASK-015`.
4. Hoặc implement frontend pre-validation đúng như `UC-06`, hoặc chỉnh use case để phản ánh backend-first validation.

## Conclusion

- Mock-first implementation đã đủ tốt để tiếp tục phát triển.
- Đây là thời điểm hợp lý để thêm `BRD_OPENROUTER_API_KEY` vào `.env` cục bộ cho **manual/live smoke test hẹp**.
- Chưa hợp lý để biến key thật thành điều kiện mặc định cho vòng coding và test hằng ngày.
