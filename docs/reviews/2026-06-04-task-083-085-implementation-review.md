## Scope

Review implementation quality of `TASK-083` to `TASK-085`:

- derive `useCaseDirty` from snapshot/fingerprint
- formalize frontend/backend validation contract
- add domain-grade golden fixtures for `spec -> use case` segmentation

## Findings

### [P2] Validation contract is clearer now, but it is still duplicated manually across frontend and backend

The new contract constants in the frontend improve readability, but they are still a hand-maintained copy of backend field coverage rather than a shared source of truth. `USECASE_LOCAL_REQUIRED_FIELDS` and `USECASE_CANONICAL_NORMALIZATION_FIELDS` live in the frontend, while the real canonical rules still live in Pydantic validators on the backend.

- [src/usecases/prevalidate.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/prevalidate.ts:8)
- [apps/api/app/schemas/usecase.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/schemas/usecase.py:29)

Impact:

- the repo is now easier to explain, but still vulnerable to slow drift if backend fields change and frontend constants/docs are not updated in the same PR
- this is especially relevant because this ingestion contract sits at the head of the whole `spec -> UC -> diagram -> BRD` pipeline

Direction: keep the current split between frontend quick-guard and backend canonical validation, but reduce duplication by adding a tighter shared contract artifact or a sync test that fails when the field sets diverge.

### [P2] Domain-grade fixture coverage is still shallow for the segmentation quality bar the task claims

The new fixture lane is a strong step forward, but the assertions still only lock three coarse properties: use-case count, primary actor, and high-level kind classification from title wording. That means a segmentation regression can still pass if the builder keeps the same count and rough labels while degrading objective quality, preconditions, or UC boundary clarity.

- [apps/api/tests/test_usecase_builder.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/test_usecase_builder.py:101)
- [apps/api/tests/fixtures/usecase_generation/fire-incident-response.json](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/tests/fixtures/usecase_generation/fire-incident-response.json:1)

Impact:

- the fixture lane proves the builder no longer hard-codes `2 + 1`, but it does not yet prove that the generated UC boundaries are “right enough” for downstream diagram generation
- title-based kind classification also makes the test lane fairly coupled to current wording templates

Direction: keep these fixtures, but deepen them into true goldens that also review boundary semantics and a few representative content fields per UC.

### [P3] The new snapshot-based dirty-state is only regression-tested for spec revert, not draft revert

The new logic now derives draft-change state from `buildUseCaseDraftFingerprint(useCases)`, which should correctly clear the warning if a user edits a draft and then restores it exactly. But the test lane only proves the spec-revert case; it does not explicitly cover reverting a changed title/objective/review status back to the original generated snapshot.

- [src/App.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/App.tsx:769)
- [e2e/brd-flow.spec.ts](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/e2e/brd-flow.spec.ts:125)

Impact:

- this is not a confirmed bug, but it is a branch of the new protection logic that is still unguarded
- if later UI behavior changes around draft editing, this gap could let false-positive replace warnings creep back in

Direction: add one focused regression test for “edit draft -> revert draft -> generate again without confirm”.

## Module directions

- `usecase-frontend-review`: Harden
- `usecase-api-contract`: Harden
- `usecase-builder`: Keep as-is
- `tests-and-verification`: Harden

## Suggested follow-up

1. Add a sync guard so frontend validation contract constants cannot silently drift from backend schema coverage.
2. Expand domain fixtures from count/kind checks into richer UC-boundary goldens.
3. Add one regression specifically for reverted draft edits.
