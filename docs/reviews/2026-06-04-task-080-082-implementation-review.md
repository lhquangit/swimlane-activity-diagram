## Scope

Review implementation quality of `TASK-080` to `TASK-082`:

- siết validation/normalization cho ingestion
- bảo vệ review state khi generate lại
- thay heuristic `2 + 1` bằng segmentation linh hoạt hơn

## Findings

### [P1] Sticky dirty-state tạo cảnh báo overwrite giả ngay cả khi user đã hoàn tác spec về đúng bản đã generate

`useCaseDirty` hiện được bật vĩnh viễn sau mọi lần sửa `ProjectSpec` hoặc `FeatureIntent` nếu đã có draft, nhưng không được suy lại từ fingerprint hay snapshot thật của lần generate gần nhất. Cụ thể, `handleProjectSpecChange()` và `handleFeatureIntentChange()` chỉ cần thấy có `useCaseDrafts` là set `useCaseDirty(true)`, trong khi luồng confirm replace lại chặn theo `useCaseDirty || isUseCaseDraftOutdated`.

- [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:761)
- [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:767)
- [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1372)
- [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1403)

Impact:

- user có thể gõ thử, hoàn tác toàn bộ về đúng nội dung cũ, nhưng generate lại vẫn luôn bị cảnh báo overwrite
- về lâu dài, prompt này dễ trở thành noise và làm giảm giá trị của cơ chế bảo vệ state

Direction: dirty-state nên được derive từ fingerprint/snapshot diff, không nên là cờ sticky chỉ tăng mà không tự giảm.

### [P2] TASK-080 mới siết required fields, chưa thật sự chốt shared validation contract giữa frontend và backend

Backend đã normalize tốt hơn nhiều ở schema (`trim`, `collapse whitespace`, `dedup list`), nhưng frontend pre-validation hiện mới chỉ kiểm tra 4 field bắt buộc. Điều này đủ để chặn path rỗng, nhưng chưa đạt mức “shared validation + normalization layer” theo nghĩa contract dùng chung giữa 2 phía.

- [apps/api/app/schemas/usecase.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/usecase.py:29)
- [src/usecases/prevalidate.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/prevalidate.ts:21)
- [src/usecases/UseCasePanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/UseCasePanel.tsx:286)

Impact:

- UX phía frontend và backend vẫn có thể drift dần nếu validation rules được mở rộng thêm ở server
- hiện tại acceptance “UI test cho generate button disabled/error state” mới được đáp ứng ở mức required-field path, chưa khóa hết contract normalization

Direction: giữ local pre-validation tối giản là hợp lý, nhưng nên chốt rõ đâu là “frontend quick guard” và đâu là “backend canonical validation”, rồi thêm coverage để tránh drift.

### [P2] TASK-082 cải thiện segmentation đáng kể, nhưng trạng thái `Done` vẫn hơi sớm so với acceptance “fixture domain thật”

Builder không còn hard-code `2 + 1`, nhưng segmentation vẫn dựa trên 4 family template (`intake`, `execution`, `coordination`, `exception`) và test hiện tại mới chứng minh bằng các fixture tổng hợp nhỏ. Acceptance criteria của task lại nói tới “fixture domain thật cho ra UC list có vẻ đúng bài hơn”.

- [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:77)
- [apps/api/app/services/usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/usecase_builder.py:128)
- [apps/api/tests/test_usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/test_usecase_builder.py:7)
- [docs/review-task-list.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/review-task-list.md:1776)

Impact:

- upstream đã bớt cơ học, nhưng nếu dùng ngay làm nguồn cho `UseCaseDraft -> DiagramDraft`, downstream vẫn có nguy cơ kế thừa UC boundaries hơi “template-ish”
- bài toán bây giờ không còn là số lượng UC, mà là độ đúng của đường cắt use case theo domain thật

Direction: giữ implementation hiện tại làm baseline tốt, nhưng thêm một lane golden/domain-fixture trước khi coi segmentation đã đủ chín để đi sâu sang diagram generation.

## Module directions

- `usecase-api-contract`: Harden
- `usecase-frontend-review`: Harden
- `usecase-builder`: Refactor in place
- `tests-and-verification`: Harden

## Suggested follow-up

1. Derive `useCaseDirty` từ fingerprint/snapshot thay vì sticky boolean.
2. Chốt ranh giới rõ giữa frontend quick-guard và backend canonical validation.
3. Thêm domain-grade golden fixtures cho segmentation trước khi dùng nó làm nguồn generate diagram.
