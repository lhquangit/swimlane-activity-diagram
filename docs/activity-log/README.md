# Activity Log

This folder stores lightweight monthly logs for user requests and agent actions.

The goal is traceability without turning every conversation into a long document. Each request should have one concise entry. Detailed artifacts belong in the specialized docs linked from the entry.

## Monthly File Naming

Use:

```text
YYYY-MM.md
```

Examples:

```text
2026-05.md
2026-06.md
```

## Entry Template

```md
### YYYY-MM-DD HH:mm - <short title>

- Category: bug | review | implementation | docs | planning | question | maintenance
- Request: <one-sentence summary>
- Action: <what changed or what decision was made>
- Files: <changed/reviewed files, or "none">
- Follow-up: <links to task list, known issue, review snapshot, changelog, or "none">
- Status: Done | Partial | Decision | Deferred
```

## Routing Rules

- Bug report or confirmed defect: `docs/progress/known-issues.md`
- Code review snapshot: `docs/reviews/YYYY-MM-DD-<scope>.md`
- Active implementation backlog: `docs/review-task-list.md`
- Behavior change: `docs/progress/changelog.md`
- Product/scope change: `docs/scope/*` or `docs/product/*`
- End-to-end workflow change: `docs/use-cases/*`
- Roadmap/sprint change: `docs/roadmap/*` or `docs/progress/README.md`

## Privacy And Signal

- Summarize the request; do not paste full prompts.
- Do not store secrets, private credentials, personal data, or large command output.
- Link to canonical docs instead of duplicating long explanations.

