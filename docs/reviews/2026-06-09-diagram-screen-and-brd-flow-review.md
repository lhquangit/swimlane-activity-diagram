# Review màn Diagram và flow Generate BRD

- Date: 2026-06-09
- Reviewer: Codex
- Scope:
  - Rà lại màn vẽ diagram để xác định các nút đang thừa hoặc đặt sai cấp ưu tiên
  - Điều tra vì sao `Generate BRD` đang lỗi trong persisted flow
  - Đánh giá việc popup panel BRD trượt từ bên phải so với artifact-tree workflow hiện tại

## Module map

1. **Diagram canvas workspace**
   - `src/App.tsx`
   - `src/DndPanel.tsx`
   - `src/styles.css`

2. **BRD transient sidecar**
   - `src/brd/BrdPanel.tsx`
   - `src/brd/cache.ts`
   - `src/brd/client.ts`

3. **Persisted artifact routing**
   - `src/application/ProjectWorkspace.tsx`
   - `src/application/ArtifactTree.tsx`
   - `src/application/artifact-routing.ts`

4. **BRD backend generation + persistence**
   - `apps/api/app/routes/brd_generate.py`
   - `apps/api/app/routes/persistence.py`
   - `apps/api/app/config.py`

5. **Regression coverage**
   - `apps/api/tests/test_persistence_chain.py`
   - `apps/api/tests/test_routes.py`
   - `src/application/ProjectWorkspace.test.tsx`
   - `src/brd/BrdPanel.test.tsx`

## Kết luận ngắn

Màn diagram hiện đang trộn ba mô hình làm việc vào cùng một toolbar: canvas editor, export/debug
tool, và một BRD draft workspace tạm thời. Điều đó làm toolbar rối, khiến `Generate BRD` mở một
panel phụ từ bên phải thay vì đi theo artifact tree, và che mất nguyên nhân thật của lỗi backend:
persisted BRD generation hiện phụ thuộc trực tiếp vào provider live nên local/test path có thể fail
503 hoặc 502 rất dễ.

## Findings

### 1. [P1, confirmed] Persisted `Generate BRD` không có local/test-safe path, nên route fail cứng khi provider không sẵn

- Evidence:
  - Persisted route `/api/diagrams/{diagram_id}/brd/generate` chỉ wrap sang `generate_brd()` ở
    `apps/api/app/routes/persistence.py:304-315`.
  - `generate_brd()` trả `503` ngay khi provider không phải `mock` và thiếu key ở
    `apps/api/app/routes/brd_generate.py:148-161`.
  - Cùng route đó trả `502` cho OpenRouter transport/retryable provider failure ở
    `apps/api/app/routes/brd_generate.py:195-210`.
  - Regression hiện có đang kỳ vọng `200`, nhưng local run thực tế fail `503` ở
    `apps/api/tests/test_persistence_chain.py:127-132`.
  - `apps/api/tests/conftest.py` chỉ set `AUTH_DISABLED` và `DATABASE_URL`, không pin
    `BRD_PROVIDER=mock`, nên test behavior bị phụ thuộc env máy chạy.
- Impact:
  - Người dùng local bấm `Generate BRD` trên diagram đã lưu có thể thấy fail dù flow dữ liệu hợp lệ.
  - CI/local test không ổn định vì cùng một spec có thể pass hoặc fail tùy env/provider state.
  - Team rất khó phân biệt lỗi diagram content với lỗi provider/config.
- Direction: **Harden**
- Recommendation:
  - Quy định rõ persisted BRD route có deterministic/mock fallback cho local/test hay không.
  - Nếu có, pin test/local provider sang `mock` hoặc fallback spec builder.
  - Nếu không, đổi test và UI copy để thể hiện đây là live-provider-only capability, đồng thời
    surface lỗi cấu hình sớm hơn trước khi user bấm generate.

### 2. [P1, confirmed] BRD đã là artifact trong left tree nhưng UI vẫn đi qua một sidecar popup riêng, làm lệch workflow persisted

- Evidence:
  - Artifact routing đã có route `brd` ở `src/application/ProjectWorkspace.tsx:161-163`.
  - Nhưng khi chọn BRD artifact, canvas path vẫn auto mở panel bằng `setBrdPanelOpen(true)` ở
    `src/App.tsx:2157-2160`.
  - Nút `Generate BRD` cũng luôn mở panel trước khi validate/generate ở `src/App.tsx:2258-2267`.
  - `BrdPanel` được render như một overlay tuyệt đối bên phải canvas ở `src/styles.css:292-306`
    và `src/App.tsx:3021-3064`.
- Impact:
  - Một artifact persisted lại bị trình bày như draft popup tạm thời, trái với flow artifact tree
    mà phần Use Case/Diagram mới đã chuyển sang.
  - User phải hiểu thêm một cơ chế panel phụ và một bước `Lưu BRD` riêng trước khi BRD thực sự xuất
    hiện/được cập nhật dưới left tree.
  - Đây là lý do yêu cầu “không muốn popup nhảy ra từ bên phải” là hợp lý về mặt kiến trúc, không
    chỉ là preference UI.
- Direction: **Redesign interface**
- Recommendation:
  - Bỏ auto-open sidecar ở persisted flow.
  - `Generate BRD` nên tạo/cập nhật artifact persisted rồi refresh left tree.
  - Khi user chọn BRD từ left tree, route nên mở một BRD artifact surface thật thay vì dùng overlay
    trong canvas.

### 3. [P2, confirmed] Toolbar màn diagram đang chứa các nút thừa hoặc sai cấp ưu tiên

- Evidence:
  - Toolbar chính đang đặt cạnh nhau `Lưu diagram`, `Generate BRD`, `Open last BRD draft`,
    `Discard cached BRD`, `Export PNG`, và auth controls ở `src/App.tsx:2828-2860`.
  - `Open last BRD draft` và `Discard cached BRD` là action recovery/debug, nhưng đang chiếm chỗ
    ngang hàng với action chính.
  - Recovery server/local cho BRD đã có banner riêng trong panel ở
    `src/brd/BrdPanel.tsx:113-137`, nên toolbar bị trùng nhiệm vụ.
  - Nếu bỏ BRD sidecar như finding #2, hai nút cache này mất ý nghĩa ở primary canvas toolbar.
- Impact:
  - Toolbar khó scan, làm mờ action chính của diagram editor.
  - Người dùng bị kéo vào trạng thái “quản lý cache BRD” quá sớm, trước khi họ thật sự cần.
  - Phần không gian ngang vừa được mở rộng nhờ collapse sidebar lại bị tiêu hao bởi controls hiếm dùng.
- Direction: **Refactor in place**
- Recommendation:
  - Giữ primary toolbar cho action cốt lõi: lưu diagram, generate BRD, export cần thiết.
  - Chuyển recovery/debug actions vào menu phụ hoặc BRD artifact surface.
  - Xem lại `Export PNG` và auth controls có nên ở canvas toolbar hay ở header/page-level.

### 4. [P2, inferred] BRD transient cache đang kéo dài một mô hình cũ mà repo đã bắt đầu rời bỏ

- Evidence:
  - `App.tsx` có cả lifecycle cache recovery cho BRD tại `src/App.tsx:1088-1168`.
  - Persisted project workspace lại đang đầu tư vào artifact tree + saved scopes cho Use Case,
    Diagram và BRD ở `src/application/ProjectWorkspace.tsx`.
- Impact:
  - Cùng một artifact BRD đang có hai semantic khác nhau: draft cache cục bộ và persisted document.
  - Điều này làm tăng số state edge-case, đặc biệt khi diagram đổi sau generate hoặc khi server BRD
    và local recovery cùng tồn tại.
- Direction: **Consolidate duplication**
- Recommendation:
  - Chọn một canonical model cho BRD trong persisted workspace.
  - Nếu cần cache recovery, giữ nó là detail nội bộ của BRD artifact page thay vì là top-level
    canvas mode.

## Module directions

### Diagram canvas workspace

- Current state: vẫn làm được việc, nhưng toolbar và panel đã tích lũy quá nhiều trách nhiệm phụ.
- Main risks:
  - toolbar nhiễu
  - popup sidecar làm lệch mental model artifact
- Recommended direction: **Refactor in place**

### BRD transient sidecar

- Current state: hữu ích cho prototype standalone, nhưng không còn hợp với persisted artifact flow.
- Main risks:
  - nhân đôi state BRD
  - ép user đi qua popup + save step thủ công
- Recommended direction: **Replace incrementally**

### Persisted artifact routing

- Current state: đã có route `brd`, nhưng route đó chưa thật sự sở hữu BRD experience.
- Main risks:
  - route tồn tại nhưng chỉ là vỏ bọc để mở popup trong canvas
- Recommended direction: **Redesign interface**

### BRD backend generation + persistence

- Current state: generate route đúng contract API, nhưng operational contract chưa phù hợp local/test.
- Main risks:
  - fail cứng 503 khi thiếu key
  - fail 502 khi provider transport lỗi
  - behavior thay đổi theo env mà test không pin rõ
- Recommended direction: **Harden**

### Regression coverage

- Current state: có test route và persistence chain, nhưng chưa encode product decision mới
  “generate xong không mở popup”.
- Main risks:
  - UI regress về panel sidecar
  - BRD route tiếp tục phụ thuộc env
- Recommended direction: **Harden**

## Verification used in this review

- `PYTHONPATH=apps/api apps/api/.venv/bin/python -m pytest apps/api/tests/test_persistence_chain.py -q -vv`
- Source inspection:
  - `src/App.tsx`
  - `src/brd/BrdPanel.tsx`
  - `src/styles.css`
  - `src/application/ProjectWorkspace.tsx`
  - `apps/api/app/routes/brd_generate.py`
  - `apps/api/app/routes/persistence.py`
  - `apps/api/app/config.py`
