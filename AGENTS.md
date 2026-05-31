# Repository Agent Instructions

## Request Logging Protocol

For every user request in this repository, maintain a lightweight project log entry before the final response.

Use one entry per user request or coherent request batch, not one entry per tool call.

### Primary Log

Append to the monthly activity log:

```text
docs/activity-log/YYYY-MM.md
```

If the monthly file does not exist, create it using the format in `docs/activity-log/README.md`.

Each entry should include:

- Date and local time if available
- Request summary
- Category
- Action taken
- Files changed or reviewed
- Follow-up links
- Status

Keep the entry concise. Do not paste full prompts, secrets, personal data, raw logs, or large command output.

### Routing Rules

In addition to the monthly activity log, update the more specific document when relevant:

- Bug report or confirmed defect: update `docs/progress/known-issues.md`.
- Code review: create a snapshot in `docs/reviews/YYYY-MM-DD-<scope>.md` and update `docs/review-task-list.md` only for actionable backlog items.
- Implementation that changes behavior: update `docs/progress/changelog.md` or note why changelog was deferred.
- Product/scope change: update `docs/scope/*` or `docs/product/*`.
- End-to-end workflow change: update or create `docs/use-cases/*`.
- Roadmap or sprint planning change: update `docs/roadmap/*` or `docs/progress/README.md`.

### Status Values

Use these status values in activity log entries:

- `Done`: request completed.
- `Partial`: useful work completed, but a blocker or remaining task exists.
- `Decision`: no file/code change was required, but a documented decision was made.
- `Deferred`: request was intentionally postponed or only documented for later.

### Logging Discipline

- Prefer links to the canonical artifact instead of duplicating long explanations.
- Keep active implementation tasks in `docs/review-task-list.md`; keep historical review snapshots in `docs/reviews/`.
- Never rewrite unrelated log history unless the user asks for cleanup.
- If the user explicitly asks not to log a request, honor that request unless the change creates a project-facing artifact that must be traceable.

