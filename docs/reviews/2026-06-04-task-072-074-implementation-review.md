# Review — TASK-072 to TASK-074 implementation

Date: 2026-06-04  
Scope: `artifact chain`, `ProjectSpec + FeatureIntent ingestion`, `spec -> use case list + UI review`

## Module map

1. `artifact-chain-docs`
   - `docs/scope/artifact-chain.md`
   - `docs/scope/architecture.md`
   - `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`
2. `usecase-api-contract`
   - `apps/api/app/schemas/usecase.py`
   - `apps/api/app/routes/usecase_generate.py`
3. `usecase-builder`
   - `apps/api/app/services/usecase_builder.py`
4. `usecase-frontend-review`
   - `src/usecases/*`
   - `src/App.tsx`
   - `src/styles.css`
5. `tests-and-verification`
   - `apps/api/tests/test_usecase_routes.py`
   - `src/usecases/UseCasePanel.test.tsx`
   - `e2e/brd-flow.spec.ts`

## Findings

### 1. Ingestion contract vẫn cho qua payload rỗng hoặc gần-rỗng, nên có thể generate ra use case vô nghĩa
- Severity: P1
- Evidence:
  - `ProjectSpec` và `FeatureIntent` hiện chỉ dùng `str` trần, không có `min_length`, validator, hay semantic guard ở [apps/api/app/schemas/usecase.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/usecase.py:28), [apps/api/app/schemas/usecase.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/usecase.py:37).
  - Frontend panel cũng cho bấm `Generate use cases` chỉ cần `phase !== 'generating'`, không check các field tối thiểu ở [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:264).
  - Service builder sẽ fallback sang slug `feature` và actor `"Người dùng nghiệp vụ"` nếu input quá rỗng ở [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:60), [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:139).
- Impact:
  - Hệ thống đúng là đã có “schema”, nhưng chưa có “ingestion contract ổn định” theo đúng acceptance của `TASK-073`.
  - Chỉ cần project name/feature name trống hoặc summary quá nghèo, output vẫn được generate và nhìn hợp lệ về JSON nhưng vô nghĩa về nghiệp vụ.
- Direction: Harden

### 2. User có thể mất toàn bộ edit/review state của use case draft chỉ bằng một lần bấm generate lại
- Severity: P1
- Evidence:
  - User được phép chỉnh trực tiếp từng `UseCaseDraft` trong panel ở [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:305).
  - `Approve`, `Approve all`, và edit đều chỉ đổi state frontend tại [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1387), [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1402).
  - Nhưng khi generate lại, `handleGenerateUseCases()` overwrite thẳng `setUseCaseDrafts(result.use_cases)` mà không có dirty-state, confirm, merge, hay cache trước đó ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1363).
- Impact:
  - Điều này làm lớp “review/edit/approve use case trước khi generate diagram” rất dễ mất giá trị trong thực tế, vì user có thể xóa công sức review của chính mình rất nhanh.
  - Đây là defect workflow chứ không chỉ là thiếu persistence backend.
- Direction: Harden

### 3. Heuristic builder hiện đang hard-code 2 use case nền + 1 use case ngoại lệ, chưa thật sự là `spec -> use case list`
- Severity: P2
- Evidence:
  - `generate_use_case_drafts()` luôn tạo:
    - `...-01` intake
    - `...-02` execution
    - optional `...-03` exception  
    ở [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:77).
  - Việc có tạo UC thứ 3 hay không chỉ dựa vào keyword/rule/constraint ở [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:115), [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:238).
- Impact:
  - Với feature đơn giản, output dễ bị tách UC quá cơ học.
  - Với feature phức tạp có nhiều nhánh nghiệp vụ ngang hàng, output lại bị gom quá ít UC.
  - Nếu giữ heuristic này làm nền cho `TASK-075` trở đi, diagram generation và formal BRD sẽ kế thừa một segmentation rất dễ lệch domain.
- Direction: Refactor in place

## Module directions

### `artifact-chain-docs`
- Current state: Khá tốt, đã chốt được canonical chain và nói rõ source-of-truth.
- Direction: Keep as-is

### `usecase-api-contract`
- Current state: Có schema/route rõ, test route cũng ổn.
- Main risk: thiếu validation/normalization tối thiểu cho ingestion.
- Direction: Harden

### `usecase-builder`
- Current state: đủ tốt cho vertical slice đầu tiên.
- Main risk: segmentation quá cơ học, chưa scale được cho domain thật.
- Direction: Refactor in place

### `usecase-frontend-review`
- Current state: panel dùng được, UX khá nhanh để demo/review sớm.
- Main risk: mất state review khi generate lại, chưa có dirty-state policy.
- Direction: Harden

### `tests-and-verification`
- Current state: có backend, unit, và E2E smoke; đó là nền rất ổn.
- Main risk: chưa có regression test cho invalid ingestion và overwrite-review workflow.
- Direction: Harden
