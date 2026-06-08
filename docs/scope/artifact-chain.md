# Canonical Artifact Chain

## Mục tiêu

Chốt chuỗi artifact chuẩn cho target mới:

`ProjectSpec -> FeatureIntent -> UseCaseDraft -> DiagramDraft -> FormalBRDDraft`

Chuỗi này tồn tại để mọi bước AI/giao diện đều bám vào cùng một source of truth, thay vì nhảy thẳng từ diagram sang BRD.

## Artifact chain

| Artifact | Vai trò | Source of truth | Human editable | Sinh từ |
| --- | --- | --- | --- | --- |
| `ProjectSpec` | Bối cảnh dự án, domain, người dùng, rule nền | Yes | Yes | User input |
| `FeatureIntent` | Chức năng hoặc function cần build ở cấp feature | Yes | Yes | User input + `ProjectSpec` context |
| `UseCaseDraft` | Danh sách use case BA/Solution Engineer review trước khi sinh diagram | No | Yes | `ProjectSpec` + `FeatureIntent` |
| `DiagramDraft` | Swimlane activity diagram draft cho từng use case đã approve | No | Yes | `UseCaseDraft` |
| `FormalBRDDraft` | Tài liệu BRD formal tổng hợp từ use case và diagram đã ổn định | No | Yes | `ProjectSpec` + `UseCaseDraft` + `DiagramDraft` |

## Quy tắc vận hành

1. `ProjectSpec` và `FeatureIntent` là hai artifact người dùng nhập và chỉnh trực tiếp.
   - UI dùng essential-first view thay vì phơi raw schema.
   - Project description canonical hóa `project_summary + business_context`.
   - Actors / swimlanes là một danh sách ngang hàng do user nhập trực tiếp; UI không phân cấp actor chính/phụ và không giấu actor trong disclosure phụ.
   - Participants canonical hóa từ danh sách actors, với `target_users + systems_involved + primary_actor/supporting_actors` chỉ còn là compatibility contract khi cần.
   - Rules/constraints canonical hóa về `FeatureIntent.constraints`.
   - `function_name`, `glossary`, và `assumptions` là compatibility-only trong generation flow hiện tại.
2. `UseCaseDraft` là artifact sinh tự động nhưng phải được review/edit/approve trước khi đi tiếp.
   - `main_flow_steps` và `alternate_flows` là canonical editable source.
   - `happy_path_summary` và `key_exceptions` là derived compatibility views.
3. `DiagramDraft` không phải source of truth đầu tiên; nó là artifact diễn giải từ use case đã được chốt ở mức đủ rõ.
4. `FormalBRDDraft` là artifact reader-facing cuối, không thay thế traceability của `UseCaseDraft` hoặc `DiagramDraft`.

## Traceability tối thiểu

- `FeatureIntent` phải chỉ ra feature/function mà user muốn build.
- Mỗi `UseCaseDraft` cần có:
  - `use_case_id`
  - `objective`
  - actors / participant list đủ để sinh lane và actor refs
  - `preconditions`
  - `happy_path_summary`
  - `key_exceptions`
  - structured `main_flow_steps`
  - structured `alternate_flows`
  - `success_outcome`
- `DiagramDraft` cần trace ngược từ node/edge về `use_case_id` và stable step/alternate-flow/terminal-outcome source ID.
- Mỗi node/edge có provenance versioned: generated có trusted source trace, manual được đánh dấu rõ, imported metadata không hợp lệ phải là untrusted.
- Draw.io round-trip phải giữ provenance/trace hợp lệ; workspace báo coverage gồm total, traced, manual và untrusted.
- `FormalBRDDraft` cần trace ngược ít nhất về danh sách use case và diagram đã dùng để tổng hợp.

## Ghi chú Phase 1

- Repo đã implement và persist latest state cho toàn chuỗi
  `ProjectSpec -> FeatureIntent -> UseCaseDraft -> DiagramDraft -> FormalBRDDraft`.
- Mỗi artifact được mở theo resource UUID/deep-link từ artifact tree; Diagram và BRD chỉ tải payload
  khi được chọn.
- Semantic merge ngược từ Diagram/BRD vào Use Case vẫn nằm ngoài scope MVP.

## Persistence MVP đã chốt

Quan hệ lưu trữ:

`AppUser -> Projects -> Spec -> FeatureIntents -> UseCases -> Diagram -> BrdDoc`

- Một user có nhiều project.
- Một project có một spec.
- `Spec` là `ProjectSpec` hiện tại, nhưng tên project được chuyển sang entity `Project`.
- Một spec có nhiều feature intent.
- Một feature intent có nhiều use case.
- Một use case có tối đa một diagram.
- Một diagram có tối đa một BRD document.
- Chỉ lưu phiên bản mới nhất; user dùng nút `Lưu` cho từng phần.

Xem [database-architecture.md](./database-architecture.md).

## Workspace navigation đã chốt

Authenticated project workspace dùng một left sidebar dạng tree làm navigation chính:

```text
Project
├── Project Spec
└── Features
    └── Feature Intent
        └── Use Cases
            └── Use Case
                ├── Diagram
                └── BRD
```

Quy tắc:

1. Tree chỉ hiển thị resource identity, title, trạng thái và quan hệ thật từ database.
2. Không seed hoặc render Project Spec, Feature Intent, Diagram hay BRD mẫu trong normal runtime.
3. Diagram graph và BRD body là payload nặng, chỉ tải khi user chọn node tương ứng.
4. Artifact chưa tồn tại được trình bày bằng empty state/CTA rõ ràng, không dùng sample để lấp chỗ
   trống.
5. Artifact đang chọn phải có deep-link ổn định và mọi chuyển node phải đi qua scoped unsaved-change
   guard.
6. Sample fixtures chỉ được tồn tại trong test-only modules, không nằm trên user-facing route.

Xem [UC-08](../use-cases/UC-08-dieu-huong-artifact-tree.md).
