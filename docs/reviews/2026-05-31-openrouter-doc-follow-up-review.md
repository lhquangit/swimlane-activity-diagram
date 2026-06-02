# Review — Follow-up phản biện các nhận xét về AI BRD docs

## Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-31
- Artifacts checked:
  - `docs/reviews/2026-05-31-ai-brd-architecture-uc-review.md`
  - `docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md`
  - `docs/review-task-list.md`
  - `docs/product/ai-brd-description-feature.md`
  - `docs/scope/architecture-brd-backend.md`
  - `docs/activity-log/2026-05.md`

## Findings

### [P1] TASK-010 is marked `Done`, but its third acceptance criterion is still unmet

- Verdict: **Đúng, cần sửa**
- Evidence:
  - `TASK-010` requires that review v2 no longer make readers think `UC-06` and `architecture-brd-backend.md` are not created in [docs/review-task-list.md](../review-task-list.md:228).
  - review v2 still says `NX1. Tạo UC-06-sinh-brd-tu-diagram.md` in [docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md](./2026-05-31-ai-brd-feature-doc-review-v2.md:120).
  - it still says `NX3. Deployment topology` may become a separate backend architecture doc in [docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md](./2026-05-31-ai-brd-feature-doc-review-v2.md:136).
  - its disposition still recommends creating both docs in [docs/reviews/2026-05-31-ai-brd-feature-doc-review-v2.md](./2026-05-31-ai-brd-feature-doc-review-v2.md:173).
- Why this matters:
  - the task status currently overstates closure.
  - anyone using `docs/review-task-list.md` as the active truth will think all acceptance criteria were satisfied, but one is still open.
- Recommended direction:
  - either add a short addendum to review v2 saying those docs now exist, or
  - change `TASK-010` to `Partial` until that addendum exists.

### [P2] The claim that the architecture/UC snapshot review is “self-contradictory” is overstated

- Verdict: **Một phần đúng, nhưng severity và framing đang quá tay**
- Evidence:
  - the snapshot review records findings against the state it inspected in [docs/reviews/2026-05-31-ai-brd-architecture-uc-review.md](./2026-05-31-ai-brd-architecture-uc-review.md:27).
  - later activity-log entries show those findings were then acted on in follow-up doc changes at [docs/activity-log/2026-05.md](../activity-log/2026-05.md:192) and [docs/activity-log/2026-05.md](../activity-log/2026-05.md:201).
- Why this matters:
  - a historical review snapshot becoming stale after the same or a later fix is normal.
  - that does not automatically mean the snapshot is invalid or internally contradictory.
  - the real issue is discoverability: the snapshot lacks an addendum/superseded note, so readers may mistake it for current truth.
- Recommended direction:
  - keep the snapshot as historical evidence,
  - add a short superseding note or link to the follow-up decisions instead of rewriting the original findings.

### [P2] `BRD_MODEL_HELPER` exists in backend config even though Phase 1 does not actively use it

- Verdict: **Đúng một nửa; nên giữ nhưng cần làm rõ**
- Evidence:
  - feature doc says helper-model usage is for later/Phase 2 support tasks in [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:456).
  - backend architecture still defines `BRD_MODEL_HELPER` in the Phase 1 env contract in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:128).
- Why this matters:
  - this is not a correctness bug.
  - it is a contract-clarity issue: a reader may assume the variable is already required by Phase 1 runtime.
- Recommended direction:
  - keep the env var if the intent is to stabilize a forward-compatible config contract,
  - but label it explicitly as `optional / reserved for Phase 2 or helper flows not enabled in MVP`.

### [P3] The clustered `Decision` entries in the activity log should ideally be consolidated, but this is process cleanup rather than a defect

- Verdict: **Đúng về process, không cần sửa hồi tố**
- Evidence:
  - four consecutive `Decision` entries cover one discussion chain in [docs/activity-log/2026-05.md](../activity-log/2026-05.md:147), [docs/activity-log/2026-05.md](../activity-log/2026-05.md:156), [docs/activity-log/2026-05.md](../activity-log/2026-05.md:165), and [docs/activity-log/2026-05.md](../activity-log/2026-05.md:183).
- Why this matters:
  - `AGENTS.md` prefers one entry per coherent request batch.
  - however, rewriting historical log granularity after the fact has limited value and can create unnecessary churn.
- Recommended direction:
  - leave existing history intact,
  - apply stricter batching for future conversational decision threads.

### [P3] The trailing-whitespace complaint is correct, but the reported count is too low

- Verdict: **Đúng, cần sửa nếu muốn dọn docs**
- Evidence:
  - current file still contains pervasive trailing whitespace on blank lines throughout [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:1).
  - a direct whitespace scan reports far more than 36 affected lines.
- Why this matters:
  - low functional risk, but it adds avoidable noise for diffs and formatting hygiene.
- Recommended direction:
  - remove trailing whitespace in one mechanical cleanup patch, separate from semantic doc edits if possible.

### [P3] “code/template deterministic” is an acceptable nit, not a substantive issue

- Verdict: **Đúng, có thể sửa nhẹ**
- Evidence:
  - the phrase appears in the product spec at [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:260) and [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:467).
- Why this matters:
  - meaning is understandable, but wording is clunky.
- Recommended direction:
  - simplify to `render bằng template deterministic` or `render deterministically bằng code/template`.

### [P3] Moving the open CI question into `review-task-list.md` is not the right default

- Verdict: **Không đồng ý; nên giữ nguyên**
- Evidence:
  - the CI question is currently an unresolved architecture decision in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:188).
  - `docs/review-task-list.md` is meant for executable tasks with implementation steps and acceptance criteria, not undecided questions.
- Why this matters:
  - moving an open question into the task list too early would blur the line between “decision pending” and “task approved”.
- Recommended direction:
  - keep the question in the architecture doc until the team decides,
  - then create a concrete task in `docs/review-task-list.md` if implementation work is needed.
