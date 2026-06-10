# Review lỗi trình bày persisted BRD

- Date: 2026-06-10
- Reviewer: Codex
- Scope:
  - Review ảnh UI persisted BRD đang hiển thị lệch, ưu tiên JSON `Structured Spec`, và không giống
    tài liệu BRD đọc được.
  - Tạo task executable để sửa presentation bug.

## Module map

1. **Persisted BRD route**
   - `src/brd/PersistedBrdWorkspace.tsx`

2. **Persisted BRD styles**
   - `src/styles.css`

3. **Regression coverage**
   - `src/brd/PersistedBrdWorkspace.test.tsx`
   - `src/application/ProjectWorkspace.brd.test.tsx`
   - `e2e/artifact-tree.spec.ts`

## Findings

### 1. [P1, confirmed] BRD artifact page presents debug payload before the business document

- Evidence:
  - `PersistedBrdWorkspace` renders `Thông tin tài liệu`, then `Structured Spec`, then `BRD Markdown`
    as a textarea at `src/brd/PersistedBrdWorkspace.tsx:242-300`.
  - The screenshot shows the right column dominated by dark JSON while the actual BRD/document area
    is pushed below the fold.
  - `persisted-brd__grid` uses two equal columns at `src/styles.css:1925-1929`, so the debug
    `Structured Spec` gets the same visual priority as the document itself.
- Impact:
  - User opens a BRD artifact but sees a developer/debug JSON view first.
  - The page does not read like a formal BRD and creates a large empty left-side gap.
  - Long JSON/code lines can overflow horizontally and make the page feel broken.
- Direction: **Redesign interface**

### 2. [P1, confirmed] Markdown is shown only as raw editable text, not as a reader-facing document

- Evidence:
  - BRD markdown is rendered in a `<textarea>` at `src/brd/PersistedBrdWorkspace.tsx:295-300`.
  - There is no reader/preview mode, no heading hierarchy styling, no table/list/prose presentation,
    and no regression asserting the document content is visible as rendered sections.
- Impact:
  - Even when the generated BRD content is correct, the user still experiences it as raw source.
  - The page cannot satisfy the product expectation “BRD hiển thị và trình bày đẹp mắt”.
- Direction: **Replace incrementally**

### 3. [P2, confirmed] Current tests do not guard BRD presentation quality

- Evidence:
  - `PersistedBrdWorkspace.test.tsx` asserts generation/save and textarea value, but not document
    reading order, rendered markdown, debug disclosure, or overflow behavior.
  - Persisted browser coverage still mostly references older side-panel expectations in
    `e2e/artifact-tree.spec.ts`.
- Impact:
  - Presentation can regress while tests remain green.
  - The artifact route can keep privileging debug controls over the reader-facing document.
- Direction: **Harden**

## Recommended direction

Create a dedicated reader-first BRD artifact surface:

- Primary area: rendered BRD document with clear title, metadata, generated/source badges, warning
  summary, and readable markdown sections.
- Secondary area: edit controls and document metadata.
- Debug/trace area: `Structured Spec` behind a collapsed details panel, tab, or secondary route.
- Responsive behavior: one-column reading layout on narrow screens, no large empty gutters, no raw
  JSON overflow in the initial viewport.

## Follow-up

- `TASK-200` tracks the implementation.
- `KI-43` tracks the confirmed defect.

