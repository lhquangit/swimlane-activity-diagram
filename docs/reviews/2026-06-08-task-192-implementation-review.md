# Review TASK-192 implementation

- Date: 2026-06-08
- Reviewer: Codex
- Scope: persisted use-case generation metadata visibility (`TASK-192`)

## Module map

1. **Backend generation-to-persistence bridge**
   - `apps/api/app/services/persistence_generation.py`
   - `apps/api/app/routes/persistence.py`
   - `apps/api/app/models.py`
   - `apps/api/app/schemas/persistence.py`
   - `apps/api/app/services/persistence_serializers.py`

2. **Persisted workspace orchestration**
   - `src/application/ProjectWorkspace.tsx`
   - `src/persistence/types.ts`

3. **Persisted Use Case presentation**
   - `src/usecases/PersistedUseCaseWorkspace.tsx`
   - `src/styles.css`

4. **Regression coverage**
   - `apps/api/tests/test_persistence_auth_matrix.py`
   - `src/usecases/PersistedUseCaseWorkspace.test.tsx`

## Summary

`TASK-192` improved the visibility problem the team was trying to solve: the persisted Use Case
list/editor now shows AI-vs-rule provenance, provider/model, prompt version, and rollout mode after
reload. The architectural direction is good.

That said, the current implementation introduces one correctness issue and one provenance-staleness
risk that both undercut the trustworthiness of the new UI.

## Findings

### 1. [P1, confirmed] Persisted provenance can point to a generation run that never became the saved Use Case portfolio

- Claim: `latest_usecase_generation` is persisted too early, before the generated use-case list has
  been saved successfully.
- Evidence:
  - The generate endpoint writes `feature.latest_usecase_generation` and commits immediately in
    [apps/api/app/services/persistence_generation.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/persistence_generation.py:56).
  - The actual persisted Use Case portfolio is saved later by a separate call in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:139).
  - The failure path where generate succeeds but save fails is real and already covered in
    [src/usecases/PersistedUseCaseWorkspace.test.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.test.tsx:196).
- Impact:
  - After a failed save and a reload, the user can see provenance from the newest generate attempt
    while the database still contains the older Use Case list.
  - The new `Lần sinh gần nhất` panel can therefore misattribute the saved artifacts to the wrong
    generation run, which is exactly the type of confusion `TASK-192` was meant to remove.
- Recommendation:
  - Persist generation metadata only when the generated portfolio is committed successfully, or
    explicitly separate `pending_generation_metadata` from `committed_generation_metadata`.
  - Tie the displayed metadata to a saved portfolio revision instead of to the raw generate event.
- Confidence: High

### 2. [P2, confirmed] Feature edits do not invalidate persisted generation metadata

- Claim: Editing `Feature Intent` leaves `latest_usecase_generation` untouched, so the UI can show
  old provenance for newer source inputs.
- Evidence:
  - Feature updates simply overwrite feature fields and return the resource in
    [apps/api/app/services/persistence_service.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/persistence_service.py:237)
    through [apps/api/app/services/persistence_service.py](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/apps/api/app/services/persistence_service.py:248).
  - The frontend immediately promotes that saved feature into active state in
    [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:362)
    through [src/application/ProjectWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/application/ProjectWorkspace.tsx:381).
  - The persisted Use Case route renders `latest_usecase_generation` whenever it exists in
    [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:87)
    through [src/usecases/PersistedUseCaseWorkspace.tsx](/Users/quanliver/Projects/AI_Sys/swimlane-activity-diagram/src/usecases/PersistedUseCaseWorkspace.tsx:108).
- Impact:
  - A user can edit actors, trigger, constraints, or outcomes, then still see the previous
    prompt/provider metadata as if it described the current input state.
  - That weakens the debugging value of the new panel, especially for AI-agent domains where prompt
    quality depends heavily on exact actor/system wording.
- Recommendation:
  - Clear or mark generation metadata stale whenever any generation-relevant feature field changes,
    or persist a source fingerprint and show a stale warning when the current feature no longer
    matches the last generated input.
- Confidence: High

## Module directions

### Backend generation-to-persistence bridge

- Current state: Correctly persists and serializes generation metadata, but commits it at the wrong
  lifecycle moment.
- Main risks:
  - Provenance can refer to an unsaved generation run.
  - Feature updates can keep stale provenance alive indefinitely.
- Recommended direction: **Harden**
- Why now: The UI is now relying on this metadata as a truth signal. That raises the bar from
  “nice-to-have telemetry” to “must not mislead.”
- Near-term actions:
  1. Move committed metadata write to the portfolio-save success path.
  2. Add stale/dirty provenance semantics keyed to feature revision or fingerprint.
  3. Add API tests for reload-after-save-failure and feature-edit-after-generate cases.

### Persisted workspace orchestration

- Current state: The state plumbing is clean and localized.
- Main risks:
  - The frontend trusts backend metadata as authoritative even when source inputs may have changed.
- Recommended direction: **Keep as-is**, then **Harden** once backend revision semantics exist.
- Why now: Most of the remaining risk is upstream data truth, not orchestration complexity.
- Near-term actions:
  1. Preserve current UI wiring.
  2. Add stale-state rendering once backend exposes it.

### Persisted Use Case presentation

- Current state: The new metadata card is useful and easy to scan.
- Main risks:
  - It currently overstates freshness because it lacks “pending” or “stale” affordances.
- Recommended direction: **Refactor in place**
- Why now: The component already has a coherent surface; it just needs better state distinctions.
- Near-term actions:
  1. Add explicit visual treatment for `pending_save` and `stale_after_feature_edit`.
  2. Keep `request_id` clearly marked as session-only until it is persisted or intentionally removed.

### Regression coverage

- Current state: Good targeted coverage for list/editor visibility and resource persistence.
- Main risks:
  - No regression currently proves that a failed save does not overwrite committed provenance.
  - No regression proves stale metadata is cleared or flagged after feature edits.
- Recommended direction: **Harden**
- Why now: Both missing tests correspond directly to the two trust bugs above.
- Near-term actions:
  1. Add a backend test for generate-success/save-fail/reload semantics.
  2. Add a UI/API test for feature edits invalidating metadata.

## Verification run

- `npm run test:ui-mock -- src/usecases/PersistedUseCaseWorkspace.test.tsx src/application/ProjectWorkspace.test.tsx`
- `npm run test:ui-mock`
- `npm run build`
- `PYTHONPATH=apps/api apps/api/.venv/bin/python -m pytest apps/api/tests/test_persistence_auth_matrix.py apps/api/tests/test_usecase_generation_service.py -q`

Note: `npm run test:api-mock` currently still has a broader unrelated failure at
`apps/api/tests/test_persistence_chain.py` where BRD generate returned `502`; this review did not
attribute that failure to `TASK-192`.
