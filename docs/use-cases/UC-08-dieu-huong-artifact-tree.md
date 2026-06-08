# UC-08 - Điều hướng project bằng artifact tree

## Mục tiêu

Cho phép người dùng duyệt và mở toàn bộ chuỗi artifact thật của một project từ một left sidebar:

`Project Spec -> Feature Intent -> Use Case -> Diagram -> BRD`

## Cấu trúc tree

```text
Project: <project name>
├── Project Spec
└── Features
    ├── <Feature A>
    │   └── Use Cases
    │       ├── <Use Case 1>
    │       │   ├── Diagram
    │       │   └── BRD
    │       └── <Use Case 2>
    │           ├── Diagram
    │           └── BRD
    └── <Feature B>
        └── Use Cases
```

## Main Flow

1. Người dùng mở một project đã đăng nhập.
2. Hệ thống tải metadata tree thuộc project và user hiện tại.
3. Tree hiển thị Project Spec, các Feature Intent, các Use Case, cùng trạng thái tồn tại của Diagram
   và BRD.
4. Người dùng chọn một node.
5. URL cập nhật theo artifact đang chọn.
6. Khu vực nội dung tải editor hoặc viewer tương ứng từ persisted data.
7. Với Diagram và BRD, payload lớn chỉ được tải khi node tương ứng được chọn.
8. Sau khi tạo, lưu, hoặc xóa artifact, tree cập nhật đúng identity và trạng thái mới nhất.

## Alternate Flows

- Nếu artifact chưa tồn tại, hệ thống hiển thị empty state và CTA hợp lệ như `Tạo Diagram` hoặc
  `Tạo BRD`; không hiển thị dữ liệu mẫu.
- Nếu URL trỏ tới artifact không thuộc project/user, hệ thống hiển thị not-found an toàn và không
  tự mở artifact khác.
- Nếu artifact hiện tại có thay đổi chưa lưu, click sang node khác phải đi qua scoped dirty prompt.
- Nếu tải Diagram/BRD thất bại, tree selection và editor trước đó không bị chuyển sang trạng thái
  nửa vời.

## Acceptance

- Tree chỉ dùng resource identity và metadata thật từ backend.
- Không có sample Project Spec, Feature Intent, Diagram, hoặc BRD trong normal runtime.
- Refresh một deep-link mở lại đúng artifact.
- Keyboard navigation, focus state, expand/collapse, và mobile collapse usable.

