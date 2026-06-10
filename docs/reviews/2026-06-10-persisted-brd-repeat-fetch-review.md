# Review vòng lặp tải persisted BRD

- Date: 2026-06-10
- Reviewer: Codex
- Scope:
  - Điều tra vì sao mở BRD artifact liên tục gọi
    `GET /api/use-cases/{use_case_id}/diagram`
  - Xác định vì sao UI không hoàn tất tải BRD
  - Đánh giá coverage hiện tại cho interaction giữa BRD page và workspace context

## Module map

1. **Persisted BRD page**
   - `src/brd/PersistedBrdWorkspace.tsx`

2. **Workspace orchestration and context lifecycle**
   - `src/application/ProjectWorkspace.tsx`
   - `src/persistence/WorkspaceContext.tsx`
   - `src/persistence/save-state.ts`

3. **Persistence API client**
   - `src/persistence/api.ts`

4. **Regression coverage**
   - `src/brd/PersistedBrdWorkspace.test.tsx`
   - `src/application/ProjectWorkspace.test.tsx`

## Kết luận

Backend không tự poll. Vòng lặp được tạo ở frontend vì effect tải BRD phụ thuộc toàn bộ object
`workspace`, trong khi chính `workspace.loadDiagram()` cập nhật state của component cha. State update
làm `contextValue` đổi identity, effect bị cleanup rồi chạy lại, và request diagram được gửi tiếp.
Chuỗi tải thường bị restart trước khi `loadBrd()` hoàn tất nên màn hình không ổn định ở kết quả BRD.

## Findings

### 1. [P1, confirmed] BRD load effect tự invalidates dependency của chính nó

- Claim: Mỗi lần tải diagram thành công lại làm effect tải BRD chạy lại.
- Evidence:
  - Effect gọi `workspace.loadDiagram()` và phụ thuộc `workspace` tại
    `src/brd/PersistedBrdWorkspace.tsx:31-63`.
  - `loadDiagram()` gọi `setActiveDiagramBusinessKey()`, `setActiveDiagram()` và
    `setScopedSaveState()` tại `src/application/ProjectWorkspace.tsx:612-620`.
  - `contextValue` phụ thuộc `activeDiagram`, `activeDiagramBusinessKey` và
    `saveStateRegistry` tại `src/application/ProjectWorkspace.tsx:720-740`.
  - Vì vậy mỗi response diagram tạo một `workspace` object mới, kích hoạt lại effect dù
    `activeUseCaseResource.id` không đổi.
- Impact:
  - Endpoint diagram bị gọi liên tục.
  - Effect cũ bị cleanup bằng `active = false`; chuỗi `loadDiagram -> loadBrd` có thể bị bỏ trước
    hoặc trong lúc tải BRD.
  - UI giữ trạng thái tải/chớp trạng thái và user không xem được artifact đã lưu.
- Recommendation:
  - Không dùng toàn bộ context object làm dependency của load effect.
  - Cung cấp các command có identity ổn định hoặc tách một read-only persistence service khỏi
    mutable workspace state.
  - Chỉ chạy load theo resource identity thật sự: use-case ID/business key hoặc diagram ID.
- Direction: **Refactor in place**
- Confidence: Confirmed from the current execution path and matching repeated API log pattern.

### 2. [P1, confirmed] Current tests deliberately remove the interaction that causes the loop

- Claim: Test suite pass nhưng không bảo vệ integration lifecycle đang lỗi.
- Evidence:
  - `PersistedBrdWorkspace.test.tsx` truyền một object `workspace` cố định, nên context identity
    không đổi sau `loadDiagram()`.
  - `ProjectWorkspace.test.tsx` mock toàn bộ `PersistedBrdWorkspace`, nên không mount effect tải
    diagram/BRD cùng context thật.
  - Focused suite ngày 2026-06-10 pass `9/9`, nhưng không có assertion về số lần gọi `getDiagram`
    hoặc việc `getBrd` hoàn tất trên deep link BRD.
- Impact:
  - Regression ở boundary component/context không bị phát hiện.
  - Unit tests riêng lẻ tạo tín hiệu xanh sai cho flow người dùng thật.
- Recommendation:
  - Thêm integration test mount `ProjectWorkspace` và `PersistedBrdWorkspace` thật với API mock.
  - Assert `getDiagram` và `getBrd` mỗi hàm chỉ gọi một lần cho một deep link ổn định.
  - Rerender do `activeDiagram`/save-state update không được phép tạo request mới.
- Direction: **Harden**
- Confidence: Confirmed.

## Module directions

### Persisted BRD page

- Current state: Logic tải tuần tự dễ hiểu nhưng dependency quá rộng.
- Main risk: Effect tự restart do mutable context identity.
- Recommended direction: **Refactor in place**

### Workspace orchestration and context lifecycle

- Current state: Một context object chứa cả data, save state và command closures.
- Main risk: Bất kỳ state update nào cũng có thể đổi identity của command consumer.
- Recommended direction: **Harden**

### Persistence API client

- Current state: Mỗi UI call tương ứng một HTTP request; không có polling nội bộ.
- Main risk: Không phải nguồn của defect hiện tại.
- Recommended direction: **Keep as-is**

### Regression coverage

- Current state: Có unit/component coverage nhưng thiếu boundary integration thật.
- Main risk: Không phát hiện feedback loop giữa child effect và parent context.
- Recommended direction: **Harden**

## Verification

- Source trace từ BRD route qua `PersistedBrdWorkspace`, `WorkspaceContext`, `ProjectWorkspace` và
  `PersistenceApi`.
- `npm run test:ui-mock -- --run src/brd/PersistedBrdWorkspace.test.tsx src/application/ProjectWorkspace.test.tsx`
  pass `9/9`; kết quả này xác nhận test gap vì hai suite không mount interaction gây lỗi.

