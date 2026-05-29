# Tổng quan dự án

## 1. Tên gọi

**Swimlane Activity Diagram Editor** — Trình soạn thảo sơ đồ hoạt động phân làn (swimlane activity diagram) chạy hoàn toàn trên trình duyệt.

## 2. Mục tiêu

Cung cấp một editor nhẹ, chạy được offline, không phụ thuộc draw.io / Visio, để vẽ và xuất các sơ đồ activity dạng swimlane phục vụ:

- Đặc tả quy trình vận hành (SOP) trong các bộ phận VOC, an ninh, sự kiện…
- Phân vai trò actor (ai làm gì) qua các "lane" rõ ràng theo cột dọc.
- Trao đổi quy trình giữa các team dưới dạng JSON / SVG / PNG có thể commit vào repo.

## 3. Đối tượng người dùng (target users)

| Vai trò | Use case chính |
|---|---|
| Solution Engineer / BA | Thiết kế quy trình mới, chia sẻ với stakeholder. |
| QA / Operation Lead | Mô tả SOP, edge case, escalation path. |
| Developer | Đọc & sửa quy trình cùng code (diagram-as-code → JSON). |
| Stakeholder | Xem PNG / SVG xuất ra trong tài liệu, báo cáo. |

## 4. Giá trị mang lại

- **Không cần cài đặt**: chạy trong bất kỳ trình duyệt nào hỗ trợ ES2019+.
- **Diagram-as-code**: lưu JSON, đưa vào git, diff được khi quy trình thay đổi.
- **Snap-to-lane**: shape tự căn vào lane khi thả, không cần kéo chính xác.
- **Lane động**: thêm, đổi tên, xoá lane theo nhu cầu thực tế.
- **Export đa dạng**: PNG (báo cáo), SVG (vector), JSON (machine-readable).

## 5. Ngoài phạm vi (out of scope, hiện tại)

- Multi-user collaboration realtime (Yjs/CRDT) — nằm trong [phase 2](../roadmap/phase-2-collaboration.md).
- Backend lưu trữ trung tâm với versioning — nằm trong [phase 2](../roadmap/phase-2-collaboration.md).
- Validate ngữ nghĩa diagram (mỗi flow phải có ≥1 Start, ≥1 End, không node mồ côi) — backlog.
- Domain-specific stencil (icon riêng cho từng vai trò) — nằm trong [phase 3](../roadmap/phase-3-domain-extensions.md).
- Authentication / phân quyền user — backlog.
- Mobile / touch-first UX — backlog.

## 6. Các thuật ngữ chính

| Thuật ngữ | Mô tả |
|---|---|
| **Lane** | Cột dọc đại diện cho một actor/role. Mỗi diagram tối thiểu 1 lane. |
| **Activity** | Node hành động (rectangle bo tròn, màu vàng). |
| **Decision** | Node rẽ nhánh (hình thoi). |
| **Start / End** | Node bắt đầu / kết thúc (hình tròn). |
| **Sync Bar** | Thanh ngang biểu diễn fork/join (chạy song song). |
| **Sticky Note** | Khối ghi chú text dài. |
| **Edge** | Cạnh nối giữa các node, có thể đặt label (ví dụ "Có" / "Không"). |
| **Snap-to-lane** | Hành vi tự căn X của node vào tâm lane gần nhất khi thả. |

## 7. Tham khảo nhanh

- Kiến trúc kỹ thuật: [architecture.md](architecture.md)
- Tính năng đang có: [features.md](features.md)
- Roadmap: [../roadmap/README.md](../roadmap/README.md)
