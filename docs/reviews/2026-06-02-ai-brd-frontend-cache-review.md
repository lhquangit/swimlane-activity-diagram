# AI BRD Frontend Cache Review

- Date: 2026-06-02
- Reviewer: Codex using `senior-ai-reviewer`
- Scope: Evaluate whether AI BRD drafts should be cached on the frontend before a database exists, and define an implementation path
- Artifacts reviewed:
  - [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx)
  - [src/brd/BrdPanel.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/brd/BrdPanel.tsx)

## Findings

### [P1] BRD state hiện chỉ sống trong React memory; không có persistence layer

Các state quan trọng như `brdSpec`, `brdDraft`, `brdWarnings`, `brdMetadata`, `lastGenerateFingerprint`, và `lastGeneratedRevision` đều đang nằm trong `useState` ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:679). Không có `localStorage`, `sessionStorage`, hay một store bền vững nào khác.

- Impact:
  - Draft còn tồn tại trong cùng một phiên React, nhưng sẽ mất hoàn toàn nếu reload trang, restart dev server, hoặc mount lại app.
  - Điều này không ổn với feature generate tốn thời gian/chi phí như AI BRD.

### [P1] Close panel hiện chỉ ẩn UI; không có affordance để mở lại BRD draft đã generate

Panel được đóng bằng `onClose={() => setBrdPanelOpen(false)}` ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1800). Còn panel chỉ được mở lại từ flow `executeGenerateBrd()` qua `setBrdPanelOpen(true)` ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:1195).

- Impact:
  - Về mặt kỹ thuật, draft chưa bị xóa ngay khi close.
  - Nhưng về mặt UX, user không có cách rõ ràng để “mở lại bản BRD vừa tạo” nếu không generate lại, nên hệ thống bị cảm nhận như là đã làm mất draft.

### [P2] Hệ thống đã có đủ tín hiệu để làm cache/invalidation khá an toàn ở frontend

Hiện tại app đã có `diagramRevision`, `lastGeneratedRevision`, `lastGenerateFingerprint`, và `lastIdempotencyKey` ở [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:678), [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:691). Đây là nền tảng tốt để xây cache mà không cần database ngay.

- Impact:
  - Có thể cache draft/spec/warnings/metadata cùng fingerprint của diagram.
  - Có thể phân biệt:
    - cache khớp với diagram hiện tại
    - cache vẫn tồn tại nhưng đã outdated

## Recommendation

Ý tưởng cache frontend là **đúng và nên làm ngay**.

Nhưng implementation nên đi theo 3 lớp:

1. **Persist snapshot** của BRD vào `localStorage`
2. **Hydrate + reopen UX** để user mở lại được draft đã có
3. **Invalidate/mark outdated** theo fingerprint và revision hiện tại

Nếu chỉ lưu raw markdown mà không lưu fingerprint/revision/status/spec, UX sẽ nhanh chóng trở nên khó đoán.

## Proposed Direction

- Phase 1 phù hợp nhất: **cache một “last BRD workspace snapshot” ở frontend**
- Chưa cần đa bản ghi / lịch sử nhiều draft nếu chưa có nhu cầu rõ
- Nên cache ít nhất:
  - `draft`
  - `spec`
  - `warnings`
  - `blockingIssues`
  - `metadata`
  - `requestId`
  - `runtimeStatus`
  - `lastGenerateFingerprint`
  - `lastGeneratedRevision`
  - `updatedAt`
- Nên có một action rõ ràng như `Open last BRD draft`

## Conclusion

Đây là một quyết định product/UX tốt và rất hợp giai đoạn hiện tại. Nó vừa tiết kiệm chi phí generate lại, vừa làm feature AI BRD bớt “mong manh” trước khi có backend persistence thật.
