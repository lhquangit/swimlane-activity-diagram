# Review: toàn bộ trường trong Không gian use case

## Review scope

- Tab `Đầu vào`: toàn bộ `ProjectSpec` và `FeatureIntent`
- Tab `Use case`: toàn bộ field review/edit của `UseCaseDraft`
- Tab `Sơ đồ`: inventory metadata và technical labels liên quan
- Request normalization, backend schema, deterministic builder, diagram builder và tests

Review này mở rộng và thay thế kết luận phạm vi hẹp trong
`2026-06-06-usecase-input-field-necessity-review.md`.

## Module map

| Module | Trách nhiệm | Hướng |
| --- | --- | --- |
| Input UI | Thu thập project context và feature intent | Redesign interface |
| Request contract | Normalize/fingerprint payload | Harden incrementally |
| Use-case builder | Biến input thành use-case contract | Consolidate duplication |
| Use-case review UI | Cho user sửa contract trước approval | Redesign around one canonical model |
| Diagram inventory | Hiển thị lifecycle/handoff | Keep, giảm technical noise |

## Executive summary

- UI hiện hiển thị **17 field đầu vào** trước nút `Sinh use case`.
- Chỉ bốn field được validate bắt buộc, nhưng hai field project-level trong số đó không cần thuộc lần generate feature.
- `function_name` và `glossary` là dead input trong builder hiện tại.
- Có bốn cặp chồng lấn rõ:
  - `project_summary` / `business_context`
  - `target_users` / `systems_involved`
  - `business_rules` / `constraints`
  - `outputs` / `success_outcome`
- Tab `Use case` giữ đồng thời summary và structured contract:
  - `happy_path_summary` / `main_flow_steps`
  - `key_exceptions` / `alternate_flows`
- Kết luận: primary generate flow chỉ nên yêu cầu **Tên chức năng**, **Mô tả chức năng**, và **Actor chính**. Project context nên được chọn hoặc thiết lập một lần, không nhập lại như nội dung của mỗi lần generate.

## Field audit: Đầu vào

| Field hiện tại | Builder sử dụng | Đánh giá | Quyết định UX |
| --- | --- | --- | --- |
| `Tên dự án` | Sinh prefix ID và precondition chung | Có ích nhưng là workspace context, không phải feature intent | Hiển thị dạng project context/select; không đặt trong form generate lặp lại |
| `Tóm tắt dự án` | Corpus heuristic cho exception/coordination | Giá trị thấp trong mỗi lần generate; trùng context | Chuyển sang project setup, không phải primary form |
| `Bối cảnh nghiệp vụ` | Cùng corpus heuristic với project summary | Trùng semantic | Gộp vào project description hoặc bỏ |
| `Người dùng mục tiêu` | Fallback primary actor, supporting actors, intake heuristic | Chồng lấn actor/hệ thống ở feature | Thay bằng một optional field `Bên tham gia` ở feature scope |
| `Rule nghiệp vụ` | Exception content và segmentation | Có consumer nhưng trùng constraints | Gộp với `Ràng buộc` |
| `Thuật ngữ` | Không được builder đọc | Dead input | Bỏ khỏi UI; chỉ đưa lại khi có terminology-preservation contract |
| `Tên feature` | Title, objective, steps, IDs | Cốt lõi | Giữ, đổi copy thành `Tên chức năng` |
| `Tên function` | Không được builder đọc | Dead input kỹ thuật | Bỏ khỏi UI và deprecate contract nếu không có integration consumer |
| `Tóm tắt feature` | Heuristic segmentation | Cốt lõi nhưng copy kỹ thuật | Giữ, đổi thành `Mô tả chức năng` |
| `Actor chính` | Primary actor và lane chính | Cốt lõi cho diagram | Giữ trong primary form |
| `Trigger` | Intake segmentation, precondition, first-step trace | Hữu ích nhưng không phải mọi flow đều có | Optional advanced: `Điều gì bắt đầu quy trình?` |
| `Dữ liệu vào` | Intake segmentation và preconditions | Hữu ích khi có data flow; chồng lấn trigger một phần | Optional advanced |
| `Dữ liệu đầu ra` | Execution/coordination steps và outcome | Hữu ích nhưng chồng lấn success outcome | Optional advanced; ưu tiên một `Kết quả mong muốn` ở primary/secondary flow |
| `Ràng buộc` | Preconditions, exceptions, segmentation | Hữu ích | Gộp với business rules thành `Quy tắc và ràng buộc` |
| `Giả định` | Chỉ thêm một exception generic | Giá trị quan sát thấp | Bỏ khỏi primary UI; chỉ giữ trong advanced nếu output dùng nội dung cụ thể |
| `Hệ thống liên quan` | Supporting actors, coordination steps/segmentation | Có ích nhưng chồng lấn target users | Gộp vào `Bên tham gia` với loại `Người/Hệ thống` nếu cần |
| `Kết quả thành công` | Success outcome và expected result cuối | Có giá trị cao | Giữ dưới tên `Kết quả mong muốn`; có thể optional với fallback |

## Field audit: Use case review

| Field hiện tại | Diagram/contract sử dụng | Đánh giá | Quyết định UX |
| --- | --- | --- | --- |
| `use_case_id` | Stable artifact/trace ID | Cần kỹ thuật, không cần chiếm visual hierarchy | Hiển thị trong trace/details, không như nội dung chính |
| `Tiêu đề` | Tên artifact/context | Cốt lõi | Giữ |
| `Mục tiêu` | Contract bắt buộc; diagram builder chưa dùng | Có giá trị BA nhưng secondary | Giữ trong phần `Thông tin chung`, có thể collapse |
| `Actor chính` | Lane và actor refs | Cốt lõi | Giữ |
| `Actor hỗ trợ` | Lane và actor refs | Cốt lõi khi có | Giữ dưới dạng danh sách participant có kiểm soát |
| `Điều kiện tiên quyết` | Contract narrative; diagram builder chưa render | Hữu ích nhưng secondary | Đưa vào advanced/details, không nằm giữa flow editing |
| `Luồng chính tóm tắt` | Mirror của actions trong `main_flow_steps` | Duplicate source of truth | Bỏ editor; derive read-only nếu cần summary |
| `Actor thực hiện` từng bước | Lane binding | Cốt lõi | Giữ |
| `Hành động` từng bước | Activity node text | Cốt lõi | Giữ |
| `Kết quả mong đợi` từng bước | Trace/property, chưa hiển thị trực tiếp trên canvas | Hữu ích cho BA/BRD nhưng làm step editor nặng | Đưa vào expandable step details |
| `input_or_trigger` từng bước | Contract có nhưng UI không cho sửa | Incomplete editor | Chỉ expose trong step details nếu formal BRD cần; nếu không derive từ trigger |
| `Ngoại lệ chính` | Mirror của `alternate_flows.condition` | Duplicate source of truth | Bỏ editor; derive summary từ alternate flows |
| `Điều kiện rẽ nhánh` | Decision text | Cốt lõi | Giữ |
| Bước xử lý của alternate flow | Diagram cần nhưng UI hiện không render/edit | Thiếu field quan trọng | Thêm structured flow editor |
| Source/rejoin/terminal outcome | Topology diagram | Cốt lõi nhưng đang gần như read-only | Dùng select/mode control rõ ràng, giữ stable IDs ẩn |
| `Kết quả thành công` | Contract bắt buộc và source trace | Cốt lõi | Giữ |
| `step_id`, `flow_id`, request ID | Stable technical identity | Technical noise | Chuyển vào trace/details; không đặt cạnh heading chính |

## Field audit: Sơ đồ

Tab `Sơ đồ` không có input dư thừa đáng kể. Lifecycle status, CTA và orphan controls đều có chức năng rõ.

Các thông tin `use_case_id`, trace coverage và artifact provenance vẫn cần cho audit, nhưng nên được xem là disclosure kỹ thuật; không nên cạnh tranh với title/status/action trong visual hierarchy.

## Confirmed findings

### [P1] Use-case editor có hai nguồn chỉnh sửa cho cùng một flow

- Evidence: `happy_path_summary` cập nhật `main_flow_steps`, và action step lại ghi ngược về summary; `key_exceptions` tương tự với `alternate_flows`.
- Impact: Xóa/reorder summary có thể rebuild structured steps theo index, làm branch reference hoặc expected result mang nghĩa cũ.
- Direction: Xem `main_flow_steps` và `alternate_flows` là canonical editable model. Summary chỉ derive.

### [P2] Intake phơi toàn bộ raw schema thay vì minimum user job

- Evidence: 17 field được render liên tục; chỉ bốn field nằm trong quick guard.
- Impact: Cognitive load cao và user không biết field nào thật sự ảnh hưởng output.
- Direction: Essential-first với ba field feature-level; project context tách khỏi per-generate form.

### [P2] Hai field không có generation consumer

- Evidence: `function_name` và `glossary` chỉ được normalize/pass-through, không được `usecase_builder.py` đọc.
- Impact: Thu dữ liệu không tạo giá trị quan sát được.
- Direction: Bỏ khỏi UI và deprecate contract có versioning.

### [P2] Project-level và feature-level concepts bị chồng lấn

- Evidence: target users/systems cùng tạo supporting actors; rules/constraints cùng kích hoạt exception; outputs/success outcome cùng mô tả kết quả.
- Impact: User phải hiểu data model nội bộ thay vì mô tả quy trình.
- Direction: Hợp nhất UI theo ngôn ngữ nghiệp vụ, giữ compatibility mapping trong adapter.

## Recommended information architecture

### Project context

Thiết lập/chọn một lần:

- Tên dự án
- Mô tả dự án (optional)

### Generate use case

Luôn hiển thị:

1. Tên chức năng
2. Mô tả chức năng
3. Actor chính
4. Kết quả mong muốn (optional nhưng dễ hiểu và giá trị cao)

`Thông tin bổ sung` đóng mặc định:

- Bên tham gia
- Điều gì bắt đầu quy trình
- Dữ liệu vào/đầu ra
- Quy tắc và ràng buộc

### Review use case

Luôn hiển thị:

- Tiêu đề
- Actor
- Main steps: actor + action
- Alternate flows: condition + steps + rejoin/end
- Kết quả thành công

Collapse:

- Mục tiêu
- Điều kiện tiên quyết
- Input/kết quả mong đợi từng bước
- Technical trace IDs

Không cho sửa trực tiếp:

- Happy-path summary
- Key-exception summary

## Decision

Các field nên bỏ khỏi UI hiện tại: `Thuật ngữ`, `Tên function`, `Bối cảnh nghiệp vụ` riêng biệt, `Luồng chính tóm tắt`, `Ngoại lệ chính`.

Các field nên gộp: `Rule nghiệp vụ + Ràng buộc`, `Người dùng mục tiêu + Hệ thống liên quan`, `Dữ liệu đầu ra + Kết quả thành công` ở tầng intake.

Các field nên chuyển sang advanced/collapse: project summary, trigger, input/output chi tiết, giả định, mục tiêu use case, preconditions, per-step expected result và technical IDs.

