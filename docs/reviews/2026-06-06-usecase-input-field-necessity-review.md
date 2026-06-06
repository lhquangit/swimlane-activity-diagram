# Review: mức cần thiết của các trường đầu vào use case

## Scope

- UI `Không gian use case > Đầu vào`
- `ProjectSpec` frontend/backend contract
- deterministic use-case builder
- tests và fixture liên quan

## Module map

| Module | Vai trò |
| --- | --- |
| `src/usecases/UseCasePanel.tsx` | Hiển thị và thu thập input |
| `src/usecases/prevalidate.ts` | Normalize, fingerprint và quick guard |
| `apps/api/app/schemas/usecase.py` | Canonical request schema |
| `apps/api/app/services/usecase_builder.py` | Chuyển spec/intent thành use case draft |
| `src/App.tsx` và fixtures | Giá trị mẫu khiến form trông như mọi field đều cần thiết |

## Findings

### [P2] Primary form trình bày optional enrichment như input bắt buộc

- Claim: `Bối cảnh nghiệp vụ`, `Rule nghiệp vụ`, và `Thuật ngữ` được đặt ngang hàng với bốn field bắt buộc, không có nhãn optional hoặc progressive disclosure.
- Evidence: `UseCasePanel.tsx` render toàn bộ field trong cùng một `Spec dự án` card; quick guard chỉ yêu cầu project name/summary và feature name/summary.
- Impact: User phải đọc và tự phân biệt nhiều khái niệm gần nhau trước khi thử workflow chính; form tạo cảm giác cần hoàn thiện một project brief đầy đủ chỉ để sinh use case.
- Recommendation: Chuyển sang essential-first form. Primary flow chỉ giữ thông tin tối thiểu; optional enrichment đặt trong `Thông tin bổ sung` đóng mặc định.
- Confidence: Confirmed.

### [P2] `Bối cảnh nghiệp vụ` trùng semantic với `Tóm tắt dự án`

- Claim: Hai textarea đều thu thập mô tả bài toán/bối cảnh, nhưng không có boundary đủ rõ cho user.
- Evidence: Placeholder của `Tóm tắt dự án` đã yêu cầu “dự án và bối cảnh nghiệp vụ”; `business_context` chỉ được builder dùng như corpus bổ sung cho heuristic exception/coordination.
- Impact: User lặp lại nội dung hoặc không biết nên phân chia thông tin thế nào; chất lượng output không tăng tương xứng.
- Recommendation: Gộp thành một field `Mô tả bài toán` trong primary flow. Giữ `business_context` trong schema tạm thời để backward compatibility hoặc map từ advanced notes nếu sau này có nhu cầu rõ.
- Confidence: Confirmed.

### [P2] `Rule nghiệp vụ` hữu ích nhưng đang trùng với `Ràng buộc`

- Claim: `business_rules` có ảnh hưởng thật đến exception use case, nhưng `FeatureIntent.constraints` cũng kích hoạt cùng nhánh và cùng mô tả loại thông tin.
- Evidence: `should_create_exception_use_case()` kiểm tra cả `project_spec.business_rules` và `feature_intent.constraints`; UI yêu cầu hai danh sách ở hai card khác nhau.
- Impact: User phải quyết định một rule thuộc project hay feature dù hệ thống chưa khai thác boundary này một cách có ý nghĩa.
- Recommendation: Trong UI, gộp thành một field optional `Quy tắc và ràng buộc` ở cấp chức năng. Chỉ giữ hai field riêng trong contract nếu có consumer thực sự cần phân cấp.
- Confidence: Confirmed.

### [P2] `Thuật ngữ` là dead input trong generation path hiện tại

- Claim: `glossary` được normalize, gửi API và xuất hiện trong fixture, nhưng use-case builder không đọc nó.
- Evidence: Không có reference tới `project_spec.glossary` trong `usecase_builder.py`; tests không assert glossary ảnh hưởng title, steps, actors hoặc outcomes.
- Impact: UI thu dữ liệu không tạo giá trị quan sát được, làm giảm niềm tin vào form và tăng thời gian nhập.
- Recommendation: Bỏ khỏi primary UI ngay. Chỉ đưa lại khi generation/prompt có contract cụ thể về terminology preservation và test chứng minh tác dụng.
- Confidence: Confirmed.

## Module directions

### Input UI

- Current state: Đầy đủ về schema nhưng quá nặng cho workflow đầu tiên.
- Main risks: cognitive load, field duplication, false-required impression.
- Recommended direction: Redesign interface.
- Why now: Đây là điểm vào của toàn bộ use-case-to-diagram flow; giảm ma sát tại đây có tác động lớn hơn thêm helper copy.

### ProjectSpec contract

- Current state: Optionality đúng ở schema nhưng không phản ánh đúng trong UI.
- Main risks: contract chứa field không có consumer; project/feature boundaries chưa được product hóa.
- Recommended direction: Harden incrementally.
- Why now: Có thể giữ backward compatibility trong API trong khi tinh gọn UI trước.

### Use-case builder

- Current state: Dùng context/rules như heuristic enrichment, không dùng glossary.
- Main risks: input-to-output relationship không minh bạch.
- Recommended direction: Consolidate duplication.
- Why now: Builder nên có test chứng minh mỗi input hiển thị cho user tạo ra khác biệt hữu ích.

## Recommended product shape

Primary form:

1. Tên dự án
2. Mô tả bài toán
3. Tên chức năng
4. Mô tả chức năng
5. Actor chính

Optional `Thông tin bổ sung`:

- Người tham gia / hệ thống liên quan
- Trigger và dữ liệu vào/ra
- Quy tắc và ràng buộc
- Giả định

Không hiển thị `Thuật ngữ` cho tới khi hệ thống thực sự dùng nó để giữ terminology nhất quán.

## Decision

User không cần điền ba field được hỏi trong flow hiện tại. Vấn đề chính không phải thiếu giải thích, mà là form đang phản ánh raw schema thay vì minimum information needed để hoàn thành job.

