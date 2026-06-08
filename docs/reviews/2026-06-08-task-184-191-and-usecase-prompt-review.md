# Review TASK-184 đến TASK-191 và bug use-case actor drift

- Date: 2026-06-08
- Reviewer: Codex
- Scope:
  - Re-review implementation `TASK-184` đến `TASK-191`
  - Điều tra bug use-case generation bị lệch actor ở domain camera re-id
  - Đánh giá cách quản lý prompt use-case hiện tại

## Kết luận ngắn

Phần lớn `TASK-184` đến `TASK-191` đã đi đúng hướng, nhưng review vòng này xác nhận thêm ba vấn đề
thật:

1. actor kỹ thuật trong `FeatureIntent.actors` có thể bị rơi khỏi grounding và deterministic
   fallback, khiến output lệch về actor con người như `Ban quản lý`;
2. prompt use-case đang là một phần của code Python thay vì asset reviewable/versioned;
3. deep-link `Feature -> Use Case` có thể thoáng hiện state lỗi thiếu editor trong lúc inventory
   feature còn đang hydrate.

Ba điểm trên đã được sửa trong cùng vòng này. Sau khi vá, không còn blocker mới ở phạm vi
`TASK-184` đến `TASK-191`, nhưng vẫn nên tiếp tục `TASK-192` để làm rõ cho người dùng khi nào họ
đang xem output AI thật và khi nào là deterministic fallback.

## Findings

### 1. [P1, fixed] Technical actors bị collapse khỏi canonical participant set

- Evidence:
  - `apps/api/app/usecases/grounding.py` trước đó chỉ allow actor từ `target_users`,
    `primary_actor`, `systems_involved`, bỏ qua `feature_intent.actors`.
  - `apps/api/app/usecases/deterministic_builder.py` trước đó chọn `primary_actor` và
    `supporting_actors` mà không coi `FeatureIntent.actors` là nguồn canonical ngang hàng.
- Impact:
  - Domain camera re-id, AI vision, detector/pipeline có thể sinh use case hợp schema nhưng sai hẳn
    actor thực hiện ở main flow.
  - Diagram/BRD downstream vẫn “đẹp” về cấu trúc nhưng sai nghiệp vụ cốt lõi.
- Fix shipped:
  - `FeatureIntent.actors` được đưa vào grounding catalog, allowlist, deterministic actor
    resolution, và quality gate.
  - Added technical-actor coverage rule cho cả grounding lẫn quality evaluation.

### 2. [P1, fixed] Prompt use-case hard-code trong registry gây khó review và iterate

- Evidence:
  - Prompt trước đây nằm trực tiếp trong `apps/api/app/ai/prompts/registry.py`.
- Impact:
  - Prompt khó diff/review như một artifact độc lập.
  - Domain guidance như camera/AI/re-id khó evolve có kiểm soát.
- Fix shipped:
  - Tách prompt sang `apps/api/app/ai/prompts/assets/usecase_synthesis/1.0.0/system.md` và
    `.../1.1.0/system.md`.
  - Registry chỉ còn load asset và pin version.
  - Prompt `1.1.0` bổ sung rule rõ cho `FeatureIntent.actors`, actor kỹ thuật, evidence refs, và
    anti-collapse cho domain camera/AI/re-id.

### 3. [P2, fixed] Persisted route có loading regression ở deep-link Use Case

- Evidence:
  - `ProjectWorkspace` có thể render message `Feature nguồn chưa sẵn sàng hoặc không còn tồn tại`
    trước khi `listFeatures()` hoàn tất.
- Impact:
  - Người dùng mở deep-link hợp lệ nhưng thấy state lỗi giả, làm mất niềm tin vào persisted route.
- Fix shipped:
  - Tách `featuresLoading` khỏi `contentLoading` và giữ loading state trung thực cho các artifact
    phụ thuộc inventory feature.
  - Có regression test mới trong `src/application/ProjectWorkspace.test.tsx`.

### 4. [P2, open] Người dùng vẫn khó biết mình đang xem AI hay deterministic fallback

- Evidence:
  - Bug report lần này được mô tả như “AI đang sinh actor sai”, nhưng local config hiện tại rất dễ
    chạy ở deterministic path hoặc fallback path mà người review không nhận ra ngay ở persisted UI.
- Impact:
  - Team có thể đổ lỗi cho prompt dù root cause thực tế là rollout mode hoặc provider path.
- Direction:
  - Thực hiện `TASK-192` để hiển thị source/fallback/provider/model/prompt version rõ hơn trên
    persisted surfaces.

## Files reviewed

- `apps/api/app/ai/prompts/registry.py`
- `apps/api/app/usecases/grounding.py`
- `apps/api/app/usecases/quality.py`
- `apps/api/app/usecases/deterministic_builder.py`
- `apps/api/app/usecases/generation_service.py`
- `src/application/ProjectWorkspace.tsx`
- `src/application/ProjectWorkspace.test.tsx`
- `apps/api/tests/test_prompt_registry.py`
- `apps/api/tests/test_usecase_synthesis.py`
- `apps/api/tests/test_usecase_generation_service.py`
- `apps/api/tests/test_usecase_builder.py`

## Verification

- `npm run test:api-mock`
- `npm run test:ui-mock`
- `npm run build`

