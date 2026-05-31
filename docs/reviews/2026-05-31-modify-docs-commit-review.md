# Review — commit `modify docs` trên nhánh `devin/1780227456-review-ai-brd-feature-doc`

## Review Scope

- Project: swimlane-activity-diagram
- Reviewer: Devin (Cognition) cho user `lhquangit`
- Date: 2026-05-31
- Commit chính được review: `464b78b modify docs`
- Bối cảnh nhánh: 4 commit (2 commit AI snapshot review + 2 commit user content) chưa merge vào `main`.
- Artifacts được sửa hoặc thêm trong commit:
  - `docs/product/ai-brd-description-feature.md` (sửa)
  - `docs/use-cases/UC-06-sinh-brd-tu-diagram.md` (thêm)
  - `docs/scope/architecture-brd-backend.md` (thêm)
  - `docs/reviews/2026-05-31-ai-brd-architecture-uc-review.md` (thêm)
  - `docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md` (reformat)
  - `docs/review-task-list.md` (thêm TASK-008..010)
  - `docs/activity-log/2026-05.md` (6 entry mới)

## Module Map

1. `ai-brd-feature-spec` — product spec sau khi đổi sang OpenRouter và chốt Step 6 là deterministic render.
2. `ai-brd-backend-architecture` — backend FastAPI mới, chọn Railway Phase 1, OpenRouter gateway.
3. `uc-06-workflow` — luồng end-to-end Generate BRD trên editor.
4. `ai-brd-architecture-uc-review` — snapshot review về 3 doc trên (do commit này thêm vào).
5. `review-task-list-update` — 3 task mới TASK-008..010 ghi nhận và mark Done.

## Executive Summary

Commit này thực hiện một loạt quyết định product/architecture quan trọng và đồng bộ chúng giữa 3 doc gốc (feature spec + UC-06 + backend architecture):

- Chốt Phase 1 dùng **OpenRouter** làm gateway thay vì gọi OpenAI trực tiếp.
- Chốt Step 6 render BRD markdown bằng **template deterministic** từ structured spec, không gọi LLM lần 2.
- Map `loops[]` -> `Exceptions / warnings` và `annotations[]` -> `Assumptions / open questions` để giữ template Phase 1 ở 10 section.
- Chọn **Railway** là deployment target Phase 1 cho backend.
- Bổ sung `BRD_PROVIDER` vào bảng env var.

Các quyết định này tự nhất quán với nhau trong 3 doc nguồn, và phù hợp với hướng "fine-tune trước khi vào implementation" mà review v2 đề xuất.

**Nhưng:** chính trong cùng commit này, file review mới `2026-05-31-ai-brd-architecture-uc-review.md` được commit chung với các bản sửa giải quyết các finding của nó. Điều này khiến snapshot review bị mâu thuẫn với chính diff của mình ngay khi được commit, và đẩy TASK-010 đi qua tiêu chí "Review v2 không còn khiến người đọc nghĩ hai doc này chưa được tạo" mà thực tế chưa thỏa mãn.

## Findings

### [P1] Snapshot review mới tự mâu thuẫn với diff của chính commit

- Evidence:
  - `docs/reviews/2026-05-31-ai-brd-architecture-uc-review.md` được thêm trong commit `464b78b`, cùng commit với các bản fix.
  - Section "Findings" của review nêu finding P1 "UC-06 requires BRD sections that the Phase 1 template does not define" và trỏ tới [ai-brd-description-feature.md](../product/ai-brd-description-feature.md:387) — nhưng cùng commit đã thêm quy tắc map `loops[]` -> `Exceptions / warnings` và `annotations[]` -> `Assumptions / open questions` ở Section 11.1.
  - Finding P1 thứ hai "render markdown deterministically vs LLM render" trỏ tới [ai-brd-description-feature.md](../product/ai-brd-description-feature.md:440) với câu "render BRD draft chất lượng cao" — câu này đã bị xoá khỏi Section 12.2 trong cùng commit.
  - Finding P2 "architecture-brd-backend.md still leaves the actual hosting decision open" — Section 7 trong cùng commit đã chốt Railway.
  - Finding P2 "env-var contract is incomplete because local workflow depends on BRD_PROVIDER" — bảng env trong cùng commit đã có `BRD_PROVIDER`.
- Impact:
  - Người đọc chỉ mở file review sẽ kết luận sai rằng các finding vẫn còn open.
  - Line references trong review hiện trỏ vào file đã đổi nên không khớp với line thực tế (line số bị shift theo diff).
- Recommended direction: **Harden** review snapshot.
  - Thêm header `## Status` ngay sau `## Review Scope` ghi rõ "Pre-fix snapshot; xem TASK-008..010 hoặc commit `464b78b` cho disposition".
  - Hoặc tách commit: review snapshot commit trước, fix commit sau, để git history phản ánh đúng trình tự.
  - Tối thiểu: thay line refs cố định bằng anchor section (vd `Section 11.1` thay vì `:387`) để không bị stale theo diff.

### [P1] TASK-010 marked Done nhưng acceptance criterion thứ ba chưa thỏa

- Evidence:
  - `docs/review-task-list.md` line 220 `Status: Done (2026-05-31)` cho TASK-010.
  - Acceptance criteria của TASK-010 bao gồm: "Review v2 không còn khiến người đọc nghĩ hai doc này chưa được tạo".
  - `docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md` NX1 vẫn nói "Tạo `UC-06-sinh-brd-tu-diagram.md`" và NX3 vẫn nói "Có thể là 1 file riêng `docs/scope/architecture-brd-backend.md`".
  - "Đề xuất disposition" cuối file v2 review vẫn liệt kê việc tạo 2 doc đó như một việc của tương lai.
  - Diff của commit `464b78b` đối với review v2 chỉ là reformat bảng (align cột) + thêm dòng trắng, không thêm note "now exists / superseded".
- Impact:
  - Task tracking và doc thực tế lệch nhau ngay tại điểm bàn giao.
  - Người đọc review v2 độc lập (vd để onboarding) vẫn sẽ tin 2 doc chưa tồn tại.
- Recommended direction: **Harden**.
  - Option A: hạ status TASK-010 thành `Partial` và mở task con riêng chỉ để thêm addendum vào review v2.
  - Option B: ngay trong commit fix tiếp theo, thêm 1 callout box ở đầu review v2 (vd `> **Update 2026-05-31:** Cả `UC-06` và `architecture-brd-backend.md` đã được tạo tại commit 464b78b. NX1 và NX3 đã hoàn tất.`) và giữ TASK-010 = Done.

### [P2] `BRD_MODEL_HELPER` được khai báo nhưng không có usecase Phase 1

- Evidence:
  - `docs/scope/architecture-brd-backend.md` Section 6 vẫn liệt kê `BRD_MODEL_HELPER` với default `openai/gpt-5.4-mini`.
  - `docs/product/ai-brd-description-feature.md` Section 12.2 viết: "`openai/gpt-5.4-mini`: hỗ trợ các task AI phụ trợ ở Phase 2 như regenerate section hoặc rewrite có kiểm soát".
  - Tức là Phase 1 không có flow gọi helper model.
- Impact:
  - Backend code sẽ load env var không bao giờ dùng ở Phase 1 → noise trong config contract.
  - Người đọc backend doc có thể giả định helper được dùng ở Phase 1.
- Recommended direction: **Harden**.
  - Hoặc đánh dấu rõ trong bảng env: `BRD_MODEL_HELPER | _Phase 2 reserve_ | …`.
  - Hoặc gỡ khỏi bảng env Phase 1 và bổ sung lại khi mở Phase 2.

### [P2] Activity log có nhiều entry "Decision" cho cùng một mạch thảo luận

- Evidence:
  - 6 entry mới trong `docs/activity-log/2026-05.md` cho ngày 2026-05-31 (12:45 → 14:05).
  - 4 trong số đó là `Status: Decision` cho các discussion clarify wording, không tạo file thay đổi ngoài chính activity log (entry 12:55, 13:12, 13:20, 13:32 ghi `Files: docs/activity-log/2026-05.md` hoặc kết hợp với doc đã sửa trước đó).
- Impact:
  - AGENTS.md nói "Use one entry per user request or coherent request batch, not one entry per tool call".
  - Log entry trở nên ồn → khó skim lại lịch sử quyết định.
- Recommended direction: **Harden** (low priority).
  - Lần sau gộp các discussion clarify thành 1 entry "Decision" duy nhất, link tới chỗ thực sự thay đổi doc.

### [P3] Trailing whitespace ở `architecture-brd-backend.md`

- Evidence: 36 dòng trong `docs/scope/architecture-brd-backend.md` có ký tự space ở cuối (verify: `grep -nP ' $' docs/scope/architecture-brd-backend.md`).
- Impact: chỉ là cosmetic / lint smell; không ảnh hưởng render markdown.
- Recommended direction: **Harden** — chạy 1 lần trim trailing whitespace nếu repo có markdownlint hoặc EditorConfig.

### [P3] Wording Step 6 hơi dư

- Evidence: `docs/product/ai-brd-description-feature.md` Section 8 Step 6: "Render từ structured spec sang markdown theo template đã chọn bằng code/template deterministic."
- Impact: "code/template" + "deterministic" lặp lại ý.
- Recommended direction: **Harden**: đề xuất "Render markdown deterministically từ structured spec theo template đã chọn." để gọn và rõ.

### [P3] Open question "CI: GitHub Actions test Python ở job riêng?" nằm sai chỗ

- Evidence: `docs/scope/architecture-brd-backend.md` Section 12 cuối file liệt kê câu hỏi "CI: GitHub Actions test Python ở job riêng?" cùng với "domain production" và "monitoring/uptime".
- Impact: Đây là task vận hành CI chứ không phải open question architecture; nó sẽ block người đọc tự hỏi đây có phải decision blocker không.
- Recommended direction: **Harden** — chuyển sang `docs/review-task-list.md` dạng TASK-... priority P3 hoặc Next, hoặc gộp vào TASK-010 followup.

## Module Directions

### ai-brd-feature-spec

- Current quality: tốt và đã consistent với UC-06 + backend doc cho 3 quyết định lớn (OpenRouter, deterministic render, mapping loops/annotations).
- Main risk: wording Step 6 hơi dư + thiếu liên kết tới snapshot review tương ứng.
- Recommended direction: **Harden** — micro edits.

### ai-brd-backend-architecture

- Current quality: deployment topology đã chốt rõ (Railway), env var đầy đủ hơn, module map ổn.
- Main risks: `BRD_MODEL_HELPER` định nghĩa nhưng không có flow Phase 1, open questions trộn vận hành CI với architecture.
- Recommended direction: **Harden** — micro edits.

### uc-06-workflow

- Current quality: tốt, traceability rõ, alternates phong phú, đã loại bỏ kỳ vọng section `Loops` riêng.
- Main risk: dòng 51 "Loop được render trong `Exceptions / warnings`, không tạo section `Loops` riêng ở Phase 1" cần stay consistent nếu Phase 2 đổi template — nên có cross-link tới feature spec Section 11.1.
- Recommended direction: **Keep as-is** với 1 cross-link nhỏ.

### ai-brd-architecture-uc-review

- Current quality: nội dung review tốt nhưng đã bị fix vượt qua tại chính commit thêm vào.
- Main risk: đánh lừa người đọc về trạng thái issue.
- Recommended direction: **Refactor in place** — thêm status header hoặc tách thành "pre-fix snapshot + post-fix addendum".

### review-task-list-update

- Current quality: tốt, 3 task có đầy đủ Problem/Why/Steps/Acceptance/Verification.
- Main risk: TASK-010 marked Done nhưng AC thứ 3 chưa thỏa.
- Recommended direction: **Harden** — chỉnh status hoặc bổ sung addendum vào review v2.

## Open Questions / Assumptions

- Giả định nhánh `devin/1780227456-review-ai-brd-feature-doc` sẽ được merge vào `main` qua PR riêng, không phải force-push. Nếu thật sự muốn dùng nhánh này làm baseline cho implementation, các finding P1 trên nên fix trước khi mở PR.
- Giả định không có Phase 2 doc đi kèm trong cùng PR — nếu có, NX4 trong review v2 (Phase 2 template) nên được link cùng để giữ chuỗi disposition.

## Recommended Disposition

1. **Trước khi mở PR / merge nhánh:**
   - Thêm status header vào `docs/reviews/2026-05-31-ai-brd-architecture-uc-review.md` để nói rõ findings đã được fix tại commit nào.
   - Thay line refs cố định trong review đó bằng anchor section.
   - Thêm 1 callout "Update" ở đầu review v2 ghi rõ UC-06 và architecture-brd-backend.md đã tồn tại, đóng NX1/NX3.
   - Hoặc hạ TASK-010 = Partial và mở TASK-011 nhỏ chỉ cho việc addendum review v2.
2. **Nice to have (không block):**
   - Đánh dấu `BRD_MODEL_HELPER` là Phase 2 reserve trong bảng env.
   - Gộp các entry activity log "Decision" thành 1 entry.
   - Trim trailing whitespace trong `architecture-brd-backend.md`.
   - Tinh chỉnh wording Step 6 cho gọn.
3. **Sau khi merge:** mở implementation kickoff PR theo task list backend (extract/normalize/validate/interpret/render/postcheck).
