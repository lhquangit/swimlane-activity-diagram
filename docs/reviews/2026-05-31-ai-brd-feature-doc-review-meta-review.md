# Meta-review of `2026-05-31-ai-brd-feature-doc-review.md`

## Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-31
- Artifact reviewed: `docs/reviews/2026-05-31-ai-brd-feature-doc-review.md`
- Goal: assess whether the review itself is accurate, well-scoped, and useful as input for implementation planning

## Findings

### [P2] Review chưa tách đủ rõ giữa “thiếu ở product spec” và “thiếu ở implementation design”

- Evidence:
  - review correctly calls out spec gaps such as scope, use case, backend strategy, privacy, eval, and DoD in [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:32), [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:62), [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:99), [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:143).
  - but it also asks the same product doc to carry OpenAI-specific details such as `reasoning_effort`, model snapshot pinning, `gpt-5.4-nano`, and Structured Outputs API details in [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:249).
- Why it matters:
  - the feature doc being reviewed is still a product-facing design note, not yet an implementation contract.
  - mixing vendor-specific execution details into the same “missing items” bucket can make the author feel the doc is much farther from acceptable than it really is.
- Recommended direction:
  - keep the reviewer’s product gaps as blockers for the next draft.
  - move API-level details (`reasoning_effort`, snapshot ids, strict schema transport, fallback mini/nano mix) into a later implementation design doc or task list.

### [P2] Review đúng về breadth, nhưng hơi nặng tính checklist nên chưa chỉ ra “minimum viable next draft”

- Evidence:
  - sections A1-A16 plus B1-B11 provide strong coverage, but the “Now” group still mixes structural blockers with polish items such as smart quote cleanup in [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:267).
  - the conclusion says “ít nhất 5 mục ở nhóm Now và 5 mục ở Next cần được trả lời rõ” in [2026-05-31-ai-brd-feature-doc-review.md](2026-05-31-ai-brd-feature-doc-review.md:293), but does not spell out the smaller subset required to make the doc implementable at Phase 1.
- Why it matters:
  - the review is excellent as a completeness audit.
  - it is slightly less effective as a sequencing tool, because the author still has to infer what the truly blocking decisions are.
- Recommended direction:
  - collapse the blockers for the next revision into 4 mandatory decisions:
    1. scope / out-of-scope,
    2. backend + privacy strategy,
    3. graph and structured-spec schema boundary,
    4. Phase 1 validation / post-check contract.
  - leave the rest as follow-on refinements.

## Overall assessment

This is a strong review. It is fact-checked, concrete, and much more useful than a generic “doc should be clearer” pass. Its biggest value is that it identifies the real architectural risks early: backend strategy, privacy, semantic schema, validation, and ambiguity handling.

My main adjustment is not to remove content, but to reframe it:

1. keep the product-spec blockers front and center,
2. move vendor/API tuning details into implementation design,
3. make the “minimum next draft” explicit so the team can act without feeling buried.

## Recommended disposition

- Accept the review overall.
- Use it as the base for the next doc revision.
- Reclassify the OpenAI-specific tuning items as implementation-level follow-up rather than product-spec blockers.
