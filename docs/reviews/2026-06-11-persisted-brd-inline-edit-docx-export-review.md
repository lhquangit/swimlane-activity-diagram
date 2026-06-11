# Review persisted BRD inline editing và DOCX export

## Scope

- Date: 2026-06-11
- Reviewer: Codex using `senior-ai-reviewer`
- Request:
  - tạo task để bỏ nút `Chỉnh sửa markdown` và cho phép user chỉnh trực tiếp trên nội dung BRD đang
    hiển thị
  - tạo task để sinh file `BRD.docx` từ markdown đã generate và đã chỉnh sửa

## Module Map

1. **Persisted BRD route**
   - `src/brd/PersistedBrdWorkspace.tsx`
   - Responsibility: canonical persisted BRD surface, generate/save flow, document presentation.
2. **Markdown rendering model**
   - `src/brd/markdown.tsx`
   - Responsibility: parse markdown string thành React document blocks để hiển thị.
3. **Persistence and BRD save contract**
   - `src/persistence/api.ts`
   - `apps/api/app/routes/persistence.py`
   - `apps/api/app/schemas/persistence.py`
   - Responsibility: load/save BRD artifact theo `markdown_content` + `structured_spec`.
4. **Standalone BRD editor contract and product docs**
   - `src/brd/BrdPanel.tsx`
   - `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`
   - `docs/product/ai-brd-description-feature.md`
   - Responsibility: existing Phase 1 wording cho edit/export behavior.

## Findings

### 1. [P1, confirmed] Persisted BRD editing vẫn là mode-switch sang textarea, không phải direct editing trên document surface

- Evidence:
  - `PersistedBrdWorkspace` giữ state `isEditingMarkdown` và render nút toggle
    `Chỉnh sửa markdown` tại [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:31),
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:183).
  - Nội dung BRD hiển thị chỉ là output của `renderMarkdownDocument(draft)` và hoàn toàn read-only tại
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:279).
  - Khi bật mode edit, app mới render `<textarea>` riêng ở sidebar tại
    [src/brd/PersistedBrdWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/PersistedBrdWorkspace.tsx:360).
- Impact:
  - UX hiện tại vẫn là “xem tài liệu rồi chuyển sang source editor”, không phải edit ngay trên tài
    liệu đang đọc.
  - Nếu chỉ bỏ nút mà giữ nguyên renderer một chiều, team sẽ rơi vào giải pháp `contentEditable`
    chắp vá và rất dễ làm hỏng markdown/table numbering.
- Direction: **Redesign interface**
  - Đưa persisted BRD sang một editor model block-aware/canonical-document, nơi mỗi heading,
    paragraph, list, table, figure có thể chỉnh trực tiếp nhưng vẫn serialize ngược về
    `markdown_content` ổn định.

### 2. [P1, confirmed] Repo chưa có pipeline hay contract nào để xuất `BRD.docx`

- Evidence:
  - Persisted BRD API chỉ có `GET/PUT/DELETE` và `generate`, không có export endpoint tại
    [apps/api/app/routes/persistence.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/routes/persistence.py:304).
  - BRD save contract chỉ lưu `structured_spec`, `markdown_content`, `warnings`, `template` tại
    [apps/api/app/schemas/persistence.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/persistence.py:331).
  - Frontend persistence client cũng chỉ có `getBrd / generateBrd / saveBrd` tại
    [src/persistence/api.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/persistence/api.ts:179).
  - Repo hiện không có dependency docx nào trong web app package tại
    [package.json](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/package.json:21), và
    code export helper hiện chỉ download blob/text file chung tại
    [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:165).
- Impact:
  - Không có đường kỹ thuật sẵn có để tạo `.docx` đúng format từ markdown đã chỉnh sửa.
  - Nếu xử lý vội ở frontend bằng HTML giả hoặc rename file extension, output sẽ không phải DOCX
    thật và không đáng tin cho tài liệu business.
- Direction: **Harden**
  - Chốt một backend export pipeline sinh DOCX thật từ canonical markdown đã lưu/chưa lưu, rồi mới
    gắn nút export ở UI.

### 3. [P2, confirmed] Product/use-case docs hiện vẫn khóa Phase 1 vào textarea markdown và export `.md`

- Evidence:
  - Product doc nói user chỉnh BRD draft trong `text area / markdown editor` tại
    [docs/product/ai-brd-description-feature.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/product/ai-brd-description-feature.md:145).
  - UC-06 vẫn mô tả user chỉnh markdown trong `BRD Draft` và export `.md` tại
    [docs/use-cases/UC-06-sinh-brd-tu-diagram.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-06-sinh-brd-tu-diagram.md:47),
    [docs/use-cases/UC-06-sinh-brd-tu-diagram.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-06-sinh-brd-tu-diagram.md:51),
    [docs/use-cases/UC-06-sinh-brd-tu-diagram.md](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/docs/use-cases/UC-06-sinh-brd-tu-diagram.md:103).
  - Standalone BRD panel footer cũng chỉ có `Export markdown` tại
    [src/brd/BrdPanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.tsx:193).
- Impact:
  - Nếu implementation đổi persisted UX sang inline document editing và bổ sung DOCX export mà docs
    không đổi, repo sẽ có contract mâu thuẫn ngay trong cùng feature chain.
- Direction: **Refactor in place**
  - Update product/UC docs cùng implementation, và xác định rõ persisted BRD route là canonical
    review/edit/export surface; standalone panel chỉ cần theo sau nếu còn giữ trong scope.

## Recommended Task Direction

- `PersistedBrdWorkspace`: redesign interface.
- `markdown.tsx` + edit model: replace incrementally.
- Persistence/export contract: harden.
- Product/UC docs: refactor in place.

## Actionable Backlog

- `TASK-203` for direct inline editing on the persisted BRD surface.
- `TASK-204` for true DOCX export from edited markdown, with backend contract and verification.
