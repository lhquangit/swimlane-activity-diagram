# Changelog

Định dạng: theo [Keep a Changelog](https://keepachangelog.com/vi/1.0.0/) + ngày + link PR.

## [Unreleased]

### Added
- **AI-only Use Case authoring with fail-closed generation outcomes**: BA-facing Use Case creation
  no longer exposes scaffold/rule authoring as a normal option. The persisted and legacy Use Case
  screens now request AI-only generation, runtime truth is simplified to
  `available / degraded / unavailable`, and provider/config/auth failures or quality rejection now
  return failed envelopes instead of scaffold fallback portfolios. The production authoring path no
  longer imports deterministic builder output; shared artifact-chain metadata moved into a separate
  module while schema/grounding/quality/hydration guardrails stay in place. Core docs now describe
  AI-only authoring plus failure states rather than teaching scaffold as a normal workflow. Xem
  `apps/api/app/usecases/{generation_service.py,runtime.py,artifact_chain.py}`,
  `apps/api/app/{routes/usecase_generate.py,routes/persistence.py,services/persistence_generation.py,services/persistence_serializers.py,schemas/persistence.py,schemas/usecase.py,services/usecase_builder.py}`,
  `apps/api/tests/{test_usecase_generation_service.py,test_usecase_routes.py,test_persistence_auth_matrix.py,test_persistence_chain.py,test_live_smoke.py}`,
  `src/{usecases/PersistedUseCaseWorkspace.tsx,usecases/UseCasePanel.tsx,usecases/types.ts,usecases/prevalidate.ts,persistence/types.ts,App.tsx}`,
  `docs/{use-cases/UC-07-sinh-usecase-tu-spec.md,product/usecase-synthesis-model-policy.md,review-task-list.md,progress/known-issues.md}`.
- **Use-case synthesis quality hardening for real complaint domains**: promoted the default
  BA-facing Use Case policy to prompt `usecase_synthesis@1.2.0` plus
  `USECASE_MODEL_PRIMARY=openai/gpt-5.5`, added a dedicated model-policy document, and expanded the
  quality golden suite with accepted/rejected complaint domains for pet points, guest vehicle
  entry, and maintenance tickets. The new prompt now includes explicit business-segmentation
  heuristics, negative/positive counterexamples, and a pre-emission self-checklist so AI output is
  less likely to collapse into one broad scaffold-like flow. Xem
  `apps/api/app/ai/prompts/{registry.py,assets/usecase_synthesis/1.2.0/system.md}`,
  `apps/api/app/config.py`, `apps/api/.env.example`,
  `apps/api/tests/{test_prompt_registry.py,test_usecase_policy_artifacts.py,test_usecase_generation_service.py,test_usecase_synthesis.py,fixtures/usecase_synthesis_quality/*}`,
  `docs/{product/usecase-synthesis-model-policy.md,use-cases/UC-07-sinh-usecase-tu-spec.md}`.

### Fixed
- **Left-bar Use Case delete now works from `Project Spec` too**: the sidebar delete handler used to
  depend on the current `activeFeature`, so deleting a use case while the route was on `Project
  Spec` failed with “Feature hiện tại không còn khả dụng.” The tree action now deletes by the row’s
  own `featureId/useCaseId` context instead of the current screen context, with regression coverage
  for `Project Spec -> left bar -> Xóa Use case`. Xem
  `src/application/{ProjectWorkspace.tsx,ProjectWorkspace.test.tsx}`.
- **Persisted Use Case editor can delete saved use cases again**: the AI-only UI cleanup accidentally
  dropped the editor-surface delete action even though the workspace and left-bar delete flow still
  existed. The persisted `Use Case` route now exposes `Xóa use case` again with confirm + pending
  state, and regression coverage locks the route-level action back in. Xem
  `src/usecases/{PersistedUseCaseWorkspace.tsx,PersistedUseCaseWorkspace.test.tsx}`.
- **Fail-closed runtime contract + per-use-case trace coverage**: persisted feature responses now
  require `usecase_generation_runtime`, and the persisted `Use Case` screen now falls back to a
  conservative deterministic-only state when that runtime cannot be determined instead of
  re-exposing fake AI choices. The use-case quality gate also moved required
  input/output/constraint trace checks from portfolio-level aggregation to per-use-case evaluation,
  with issue messages naming the offending use case and a mixed-portfolio rejected fixture to lock
  the behavior. Xem
  `apps/api/app/{schemas/persistence.py,usecases/quality.py}`,
  `src/usecases/PersistedUseCaseWorkspace.tsx`,
  `apps/api/tests/{test_persistence_auth_matrix.py,test_usecase_synthesis.py,fixtures/usecase_synthesis_quality/mixed-portfolio-missing-trace-rejected.json}`,
  `src/usecases/PersistedUseCaseWorkspace.test.tsx`.
- **Truthful use-case generation runtime + deeper usability gate**: persisted Feature/Use Case
  resources now carry the effective server-side generation runtime so deterministic-only or
  AI-unavailable environments stop advertising fake AI paths before the user clicks. Deterministic
  output is now explicitly labeled as `scaffold theo rule`, fallback copy was tightened across the
  backend/UI, the use-case quality gate now rejects generic boundaries and missing
  input/output/constraint trace coverage, and fixture-backed acceptance goldens lock representative
  GPS-device and camera/re-id domains plus a scaffold-like rejected regression. Xem
  `apps/api/app/usecases/{runtime.py,generation_service.py,quality.py}`,
  `apps/api/app/{schemas/persistence.py,services/persistence_serializers.py}`,
  `src/usecases/{PersistedUseCaseWorkspace.tsx,UseCasePanel.tsx}`,
  `src/persistence/types.ts`,
  `apps/api/tests/{test_usecase_generation_service.py,test_usecase_synthesis.py}`,
  `src/usecases/{PersistedUseCaseWorkspace.test.tsx,UseCasePanel.test.tsx}`.
- **Feature mới now enforces required business inputs before save**: the Feature editor no longer
  allows saving when `Tên feature`, `Mô tả feature`, or `Actors` is empty. The save guard now lives
  in both the UI button state and the submit handler, with regression coverage on the new-feature
  flow in `ProjectWorkspace`. The same screen now visibly marks those three inputs as required,
  keeps them in an invalid state while blank, and shows inline helper text so users can see what
  is missing before they try to save. Xem
  `src/application/{ProjectWorkspace.tsx,ProjectWorkspace.test.tsx}`.
- **Persisted Use Case diagram CTA now reflects the save-first rule before click**: when the latest
  Use Case is `dirty`, `saving`, or `failed`, the persisted `Use Case` screen and missing-diagram
  route no longer advertise an executable `Tạo diagram` action. The CTA now switches to explicit
  save-first copy, stays disabled, and shows helper guidance before the user clicks into an error.
  Xem `src/usecases/{PersistedUseCaseWorkspace.tsx,PersistedUseCaseWorkspace.test.tsx}`.
- **Action-level loading UX for destructive, diagram, and export waits**: dashboard project delete,
  persisted Feature delete, left-tree Use Case delete, persisted Diagram generation, legacy saved
  Diagram open, and persisted BRD DOCX export now all expose explicit pending labels/disabled
  states instead of leaving the UI idle during API waits. Added focused regressions for each flow.
  Xem
  `src/application/{ProjectDashboard.tsx,ArtifactTree.tsx,ProjectWorkspace.tsx,ProjectDashboard.test.tsx,ProjectWorkspace.test.tsx}`,
  `src/usecases/{PersistedUseCaseWorkspace.tsx,UseCasePanel.tsx,PersistedUseCaseWorkspace.test.tsx,UseCasePanel.test.tsx,types.ts,lifecycle.ts}`,
  `src/brd/{PersistedBrdWorkspace.tsx,PersistedBrdWorkspace.test.tsx}`,
  `src/App.tsx`.
- **End-user UI surface simplification across persisted workspace routes**: the left artifact tree
  is now the canonical navigator for persisted Feature/Use Case/Diagram/BRD traversal, while route
  bodies keep only current-artifact actions such as save/generate/export. End-user screens no
  longer expose request IDs, provider/model, prompt/version, latency/cost, raw `Structured Spec`,
  warning node IDs, or the visible BRD template control by default. Dashboard/workspace headers and
  project cards were also tightened to remove repeated workflow-plumbing copy and low-value
  timestamp/placeholder chrome. Xem
  `src/application/{ProjectDashboard.tsx,ProjectWorkspace.tsx,ProjectDashboard.test.tsx,ProjectWorkspace.test.tsx}`,
  `src/usecases/{PersistedUseCaseWorkspace.tsx,UseCasePanel.tsx,PersistedUseCaseWorkspace.test.tsx,UseCasePanel.test.tsx}`,
  `src/brd/{PersistedBrdWorkspace.tsx,BrdPanel.tsx,PersistedBrdWorkspace.test.tsx,BrdPanel.test.tsx}`.
- **Artifact-tree use-case row actions and disclosure**: persisted left-bar Use Case rows now
  expose a direct delete action and independent collapse/expand controls for their `Diagram` and
  `BRD` children. Sidebar delete reuses the existing workspace delete orchestration so active-route
  cleanup, tree refresh, and descendant teardown stay consistent. Xem
  `src/application/{ArtifactTree.tsx,ProjectWorkspace.tsx,ArtifactTree.test.tsx,ProjectWorkspace.test.tsx}`,
  `src/styles.css`, `docs/use-cases/UC-08-dieu-huong-artifact-tree.md`.
- **Persisted BRD inline editing + DOCX export**: persisted BRD artifacts no longer require the
  `Chỉnh sửa markdown` toggle to edit content. The rendered BRD document is now the canonical edit
  surface for headings, paragraphs, tables, lists, and figure captions, and the same route exposes
  a real `Export DOCX` action backed by a FastAPI `python-docx` export endpoint that uses the
  latest in-page draft, including unsaved edits. Xem
  `src/brd/{PersistedBrdWorkspace.tsx,markdown.tsx,PersistedBrdWorkspace.test.tsx}`,
  `src/persistence/{types.ts,api.ts,WorkspaceContext.tsx}`,
  `src/application/ProjectWorkspace.tsx`, `src/styles.css`,
  `apps/api/app/{routes/persistence.py,schemas/persistence.py,services/brd_docx.py}`,
  `apps/api/tests/test_persistence_chain.py`, `apps/api/pyproject.toml`,
  `docs/{use-cases/UC-06-sinh-brd-tu-diagram.md,product/ai-brd-description-feature.md}`.
- **Persisted BRD artifact page + no-popup workspace flow**: persisted `brd` routes now open a
  dedicated `PersistedBrdWorkspace` page instead of the legacy canvas sidecar, and `Generate BRD`
  from the persisted diagram toolbar now saves directly into the left artifact tree without opening
  the right-side popup. Added route/component regressions for the new surface. Xem
  `src/brd/PersistedBrdWorkspace.tsx`, `src/brd/PersistedBrdWorkspace.test.tsx`,
  `src/application/ProjectWorkspace.tsx`, `src/application/ProjectWorkspace.test.tsx`,
  `src/App.tsx`, `src/styles.css`.
- **Persisted use-case generation provenance on Feature Intent**: latest use-case generation
  metadata now persists on the feature itself and is surfaced in the persisted Use Case list/editor
  routes so reviewers can see `AI` vs `deterministic_fallback`, provider/model, rollout mode, and
  prompt version after reload. Xem `apps/api/app/models.py`,
  `apps/api/app/services/persistence_generation.py`, `apps/api/app/services/persistence_serializers.py`,
  `apps/api/app/schemas/persistence.py`, `apps/api/alembic/versions/20260608_01_feature_usecase_generation_metadata.py`,
  `src/application/ProjectWorkspace.tsx`, `src/usecases/PersistedUseCaseWorkspace.tsx`.
- **Use-case prompt assets + technical actor grounding hardening**: prompt use-case đã được tách
  khỏi hardcode sang markdown assets versioned, backend grounding/quality giờ giữ
  `FeatureIntent.actors` như participant canonical, và deterministic fallback không còn collapse các
  feature camera/AI/re-id thành một actor con người duy nhất. Xem
  `apps/api/app/ai/prompts/assets/usecase_synthesis/1.1.0/system.md`,
  `apps/api/app/ai/prompts/registry.py`, `apps/api/app/usecases/grounding.py`,
  `apps/api/app/usecases/quality.py`, `apps/api/app/usecases/deterministic_builder.py`,
  `apps/api/tests/test_prompt_registry.py`, `apps/api/tests/test_usecase_builder.py`,
  `apps/api/tests/test_usecase_synthesis.py`.
- **Persisted Use Case readability and lifecycle hardening**: persisted bulk save now honors
  replace semantics and deletes omitted descendants, generated drafts can be retried without
  re-running AI, diagram CTAs on the persisted Use Case route now use the shared lifecycle model,
  and the editor itself has been redesigned as a read-first artifact page with compact step
  summaries plus browser-level layout coverage on desktop/mobile. Xem
  `apps/api/app/services/persistence_service.py`, `apps/api/tests/test_persistence_auth_matrix.py`,
  `src/usecases/PersistedUseCaseWorkspace.tsx`, `src/usecases/PersistedUseCaseWorkspace.test.tsx`,
  `src/styles.css`, `e2e/artifact-tree.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.
- **Persisted Feature Intent -> Use Case -> Diagram workflow**: `Use Cases` now generates and
  persists resource rows immediately, refreshes the left artifact tree, renders a dedicated list page
  and single-Use-Case editor outside the canvas overlay, and exposes `Tạo diagram` directly on
  approved Use Cases plus missing-Diagram routes. Added route regressions and a full persisted E2E
  covering generate -> review -> approve -> create Diagram. Xem
  `src/application/ProjectWorkspace.tsx`, `src/usecases/PersistedUseCaseWorkspace.tsx`,
  `src/persistence/WorkspaceContext.tsx`, `src/persistence/save-state.ts`,
  `src/application/ProjectWorkspace.test.tsx`, `src/usecases/PersistedUseCaseWorkspace.test.tsx`,
  `e2e/artifact-tree.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.

### Changed
- **Committed use-case provenance now follows the saved portfolio revision**: use-case generation
  metadata is no longer persisted during the generate call. The backend now commits provenance only
  when the generated Use Case portfolio is saved successfully, while the persisted Use Case UI keeps
  the newest in-session generation metadata visible as a clearly labeled pending state until save
  succeeds. Xem `apps/api/app/{routes/persistence.py,schemas/persistence.py,services/persistence_generation.py,services/persistence_service.py}`,
  `apps/api/tests/test_persistence_auth_matrix.py`,
  `src/{application/ProjectWorkspace.tsx,persistence/WorkspaceContext.tsx,persistence/api.ts,usecases/PersistedUseCaseWorkspace.tsx,usecases/PersistedUseCaseWorkspace.test.tsx,styles.css}`.
- **Artifact sidebar can now collapse into a slim rail while editing diagrams**: the persisted
  workspace shell now lets users collapse the left artifact tree into a remembered narrow rail so
  the diagram canvas can claim more horizontal space, with a one-click restore path and regression
  coverage for the remembered state. Xem
  `src/{application/ArtifactTree.tsx,application/ArtifactTree.test.tsx,application/ProjectWorkspace.tsx,application/ProjectWorkspace.test.tsx,styles.css}`.
- **Persisted artifact tree workspace**: added one owned metadata-only artifact-tree API, canonical
  deep-links for Spec/Feature/Use Case/Diagram/BRD, an accessible collapsible left tree, lazy
  Diagram/BRD hydration, real empty/loading/error states, and guarded node transitions. A full
  Playwright scenario now creates and saves the real Project-to-BRD chain. Xem
  `apps/api/app/routes/persistence.py`, `apps/api/app/services/persistence_service.py`,
  `src/application/ArtifactTree.tsx`, `src/application/ProjectWorkspace.tsx`, `src/App.tsx`,
  `e2e/artifact-tree.spec.ts`.
- **Persisted workspace transition hardening**: persisted Save scopes now carry feature ownership and
  clear only after explicit feature discard/new/delete decisions; invalid feature URLs unmount stale
  editor context; diagram load/generation switches commit only after success and guard both open and
  generate paths; dirty BRD recovery drafts now win over server load until the user explicitly
  selects the server version. Added ProjectWorkspace integration and BRD recovery regression tests.
  Xem `src/persistence/save-state.ts`, `src/application/ProjectWorkspace.tsx`,
  `src/application/ProjectWorkspace.test.tsx`, `src/brd/cache.ts`, `src/brd/BrdPanel.tsx`,
  `src/App.tsx`.

- **Persisted workspace save-state registry**: added a resource-scoped Save-state registry so dirty Diagram/BRD scopes remain visible after context switches, guarded diagram switching with confirmation prompts, made invalid feature deep-links explicit, and preserved scoped BRD recovery drafts when server load fails. Railway staging rehearsal remains blocked by expired CLI OAuth and missing project link. Xem `src/persistence/save-state.ts`, `src/persistence/WorkspaceContext.tsx`, `src/application/ProjectWorkspace.tsx`, `src/App.tsx`, `docs/operations/railway-persistence-release.md`.
- **Persistence hardening follow-up**: chuẩn hóa backend npm scripts qua `apps/api/.venv/bin/python`, thêm `api:python:smoke`, tách persistence route monolith thành serializer/CRUD/generation services, thêm Clerk auth matrix tests, saved diagram graph validator, scoped Save-state guards, persisted UseCasePanel read-only parent summaries, explicit UseCase delete, scoped BRD recovery cache, active feature deep links, and Docker API build/health rehearsal. Xem `package.json`, `apps/api/app/{auth,schemas/persistence.py,routes/persistence.py,services/persistence_*}.py`, `apps/api/tests/test_persistence_auth_matrix.py`, `src/application/*`, `src/persistence/*`, `src/usecases/UseCasePanel.tsx`, `src/brd/cache.ts`, `src/App.tsx`, `apps/api/pyproject.toml`.
- **Latest-state PostgreSQL project persistence**: thêm SQLAlchemy/Alembic schema cho `app_users -> projects -> specs -> feature_intents -> use_cases -> diagrams -> brd_docs`, Clerk-authenticated ownership APIs, Railway deploy/readiness contract, protected project routes, Project Dashboard, Spec/Feature editors và explicit Save/Load cho Use Case, Diagram, BRD. Generation giờ có resource-scoped routes và chỉ dùng parent đã lưu; PostgreSQL integration test kiểm full chain cùng cross-user `404`. Xem `apps/api/app/{auth,db,models,persistence}.py`, `apps/api/app/routes/persistence.py`, `apps/api/alembic/*`, `src/application/*`, `src/persistence/*`, `src/App.tsx`, `railway.toml`, `docs/operations/railway-persistence-release.md`.
- **Clerk authentication**: linked the React/Vite app to Clerk, added the root `ClerkProvider`, and exposed sign-in, sign-up, and signed-in user controls in the editor header. Xem `src/main.tsx`, `src/App.tsx`, `src/styles.css`.
- **Grounded AI use-case generation with safe rollout**: thêm shared AI provider/config, prompt registry có ID/version/fingerprint, semantic synthesis schema không chứa technical ID, deterministic hydrator, evidence grounding và prompt-injection guard, quality gate, bounded retry/fallback, token/cost/source observability, cùng mode `deterministic / ai_shadow / ai_opt_in / ai_default`. Workspace cho phép ưu tiên AI hoặc rule và luôn hiển thị nguồn sinh thật. Xem `apps/api/app/ai/*`, `apps/api/app/usecases/*`, `apps/api/app/routes/usecase_generate.py`, `src/usecases/UseCasePanel.tsx`, `src/App.tsx`.
- **Essential-first use-case workspace and canonical structured editor**: primary intake chỉ còn thông tin chức năng cốt lõi; enrichment/project context được đưa vào disclosure và adapter tương thích loại bỏ field dead khỏi request. Review editor nay dùng `main_flow_steps/alternate_flows` làm nguồn chỉnh sửa duy nhất, giữ stable IDs/reference, derive summary, hỗ trợ branch outcome đầy đủ và giấu trace kỹ thuật khỏi hierarchy chính. Mobile workspace chiếm full viewport và không tràn ngang. Xem `src/usecases/editor.ts`, `src/usecases/prevalidate.ts`, `src/usecases/UseCasePanel.tsx`, `src/styles.css`, `apps/api/tests/test_usecase_builder.py`, `e2e/brd-flow.spec.ts`.
- **Diagram contract, recovery, terminal-flow, and provenance hardening**: chặn phê duyệt use case có dangling actor/step/branch references ở cả frontend/backend; giữ orphan/current diagram qua regenerate và failure; gom canvas mutation vào workspace commit path; render terminal alternate outcome thành nhánh kết thúc riêng; và thêm provenance versioned giữ source trace qua manual edit cùng Draw.io import/export. Canvas context nay hiển thị trace coverage generated/manual/untrusted. Xem `src/usecases/contract.ts`, `src/usecases/diagram.ts`, `src/io/provenance.ts`, `src/App.tsx`, `apps/api/app/schemas/usecase.py`, `apps/api/app/services/diagram_builder.py`, `e2e/brd-flow.spec.ts`.
- **Use case -> diagram generation and round-trip trace**: nâng `UseCaseDraft` thành contract diagram-ready với stable step/flow IDs, actor theo bước, branch source/rejoin và expected result; thêm `POST /api/diagrams/generate` deterministic để sinh lane/node/edge có trace, render graph thật vào LogicFlow, giữ workspace riêng theo `use_case_id`, và phân biệt `ready / outdated / diverged`. CTA giờ dùng `Tạo sơ đồ` khi chưa có artifact và chỉ dùng `Mở canvas` khi draft thật đã tồn tại; regenerate có confirm khi graph đã bị sửa ngữ nghĩa. Xem `apps/api/app/schemas/usecase.py`, `apps/api/app/services/diagram_builder.py`, `apps/api/app/routes/diagram_generate.py`, `src/usecases/diagram.ts`, `src/usecases/UseCasePanel.tsx`, `src/App.tsx`, `e2e/brd-flow.spec.ts`.
- `docs/` — Tài liệu dự án đầy đủ: scope, use cases, roadmap, progress. (PR fix bug drop)
- **Spec -> use case generation slice**: thêm canonical artifact chain `ProjectSpec -> FeatureIntent -> UseCaseDraft -> DiagramDraft -> FormalBRDDraft`, backend route deterministic `POST /api/usecases/generate`, frontend panel `Use case drafts` để nhập spec/intent, generate danh sách use case, chỉnh tay, và approve từng item trước khi đi tiếp. Kèm docs `artifact-chain`, `UC-07`, unit tests, backend route tests, và browser smoke. Xem `apps/api/app/schemas/usecase.py`, `apps/api/app/services/usecase_builder.py`, `apps/api/app/routes/usecase_generate.py`, `src/usecases/*`, `src/App.tsx`, `docs/scope/artifact-chain.md`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.
- **Spec -> use case hardening**: siết validation/normalization cho ingestion (`ProjectSpec`, `FeatureIntent`), thêm local pre-validation ở frontend, chặn overwrite âm thầm bằng dirty-state + confirm khi generate lại, và thay heuristic builder từ `2 + 1` sang segmentation linh hoạt hơn (1 đến 4 UC tùy tín hiệu intake/coordination/exception). Kèm builder tests, invalid-request route test, frontend prevalidation tests, và browser E2E cho regenerate warning. Xem `apps/api/app/schemas/usecase.py`, `apps/api/app/main.py`, `apps/api/app/services/usecase_builder.py`, `apps/api/tests/test_usecase_builder.py`, `apps/api/tests/test_usecase_routes.py`, `src/usecases/prevalidate.ts`, `src/usecases/prevalidate.test.ts`, `src/usecases/UseCasePanel.tsx`, `src/App.tsx`, `e2e/brd-flow.spec.ts`.
- **AI BRD mock-first vertical slice**: thêm backend FastAPI mới tại `apps/api` với contract `validate/generate`, response envelope, idempotency cache Phase 1, deterministic render markdown từ structured spec, `MockProvider`, `.env.example`, và script `npm run dev:api`. Frontend editor thêm action `Generate BRD`, side panel `Warnings / Structured Spec / BRD Draft`, editable BRD draft, export markdown, retry/error states, và badge `Outdated` khi diagram thay đổi sau khi generate. Xem `apps/api/*`, `src/App.tsx`, `src/brd/*`, `src/styles.css`, `src/lf-config.ts`.
- **AI BRD mock test layer**: thêm backend pytest suite cho deterministic pipeline + `validate/generate` contract, idempotency scenarios, Phase 1 section mapping (`loops` -> `Exceptions / warnings`, `annotations` -> `Assumptions / open questions`), cùng UI tests bằng Vitest cho semantic normalization và BRD panel interaction. Thêm scripts `npm run test:api-mock`, `npm run test:ui-mock`, `npm run test:brd-mock`. Xem `apps/api/tests/*`, `src/brd/*.test.ts*`, `package.json`, `vite.config.ts`.
- **AI BRD live + E2E verification harness**: thêm `npm run test:api-live` với live smoke guard bằng env/key, thêm Playwright E2E cho flow `Generate BRD -> edit draft -> outdated -> export`, và tự động load `apps/api/.env` cho local backend runtime. Xem `apps/api/app/config.py`, `apps/api/tests/test_live_smoke.py`, `e2e/brd-flow.spec.ts`, `playwright.config.ts`, `package.json`.
- **AI BRD frontend cache for draft continuity**: thêm contract `BrdWorkspaceCacheEntry`, persist/hydrate last BRD snapshot qua `localStorage`, toolbar actions `Open last BRD draft` và `Discard cached BRD`, cùng outdated policy khi diagram đổi sau reset/import hoặc reload. Kèm unit test cho cache helper và Playwright flow cho close/reopen/reload/discard. Xem `src/brd/cache.ts`, `src/brd/cache.test.ts`, `src/App.tsx`, `e2e/brd-flow.spec.ts`, `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`.
- **Draw.io XML interchange workflow**: thêm adapter import/export draw.io XML (`mxfile > diagram > mxGraphModel > root > mxCell[]`), toolbar XML-first với `Import XML…` và `Export XML`, hardening geometry/text mapping cho lane/node/edge, và regression coverage cho fixture import, serializer structure, round-trip, cùng Playwright flow import/export XML. Xem `src/io/*`, `src/App.tsx`, `e2e/brd-flow.spec.ts`, `docs/use-cases/UC-05-import-export.md`, `README.md`.
- **Spec -> use case contract hardening v2**: derive review protection từ snapshot/fingerprint thật thay vì sticky dirty flag, chốt rõ boundary giữa frontend quick-guard và backend canonical validation, và thêm domain-grade golden fixtures cho segmentation (`GPS Device issuance`, `fire incident response`, `swimlane theme update`). Kèm route/UI/E2E regression mới cho normalize contract và flow hoàn tác spec mà không bị confirm oan. Xem `src/App.tsx`, `src/usecases/prevalidate.ts`, `src/usecases/UseCasePanel.tsx`, `apps/api/tests/test_usecase_routes.py`, `apps/api/tests/test_usecase_builder.py`, `e2e/brd-flow.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.
- **Use case workspace redesign**: đổi `Use case drafts` thành `Use Case Workspace` với 3 vùng `Input / Use cases / Diagrams`, chuyển `Artifact chain` vào `Advanced traceability`, thêm diagram inventory gắn theo từng `use_case_id`, và thêm next action rõ ràng trên từng use case item để đi sang bước diagram. Kèm update UC-07, roadmap UX contract, component tests, và wiring state mới trong editor shell. Xem `src/App.tsx`, `src/usecases/UseCasePanel.tsx`, `src/usecases/types.ts`, `src/styles.css`, `src/usecases/UseCasePanel.test.tsx`, `e2e/brd-flow.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`, `docs/roadmap/README.md`.

### Removed
- **User-visible sample runtime**: removed `/demo`, `Reset mẫu`, default fire-incident graph, and
  default Project Spec/Feature Intent from normal runtime. Sample data now lives only in a
  test fixture injected through the gated `/__test__/editor` harness. Xem
  `src/test-fixtures/fire-incident.ts`, `src/test-harness/EditorTestHarness.tsx`,
  `src/application/AppRouter.tsx`, `playwright.config.ts`.

### Fixed
- **Persisted BRD DOCX export Unicode filename header**: `POST /api/diagrams/{id}/brd/export.docx`
  no longer crashes with `UnicodeEncodeError` when the BRD title contains Vietnamese characters.
  The response now emits an ASCII `filename=` fallback plus RFC 5987 `filename*=` UTF-8 encoding in
  `Content-Disposition`, with regression coverage for accented titles. Xem
  `apps/api/app/{routes/persistence.py,services/brd_docx.py}`,
  `apps/api/tests/test_persistence_chain.py`.
- **AI BRD sample-style document contract and reader rendering**: generated BRDs no longer stay on
  the old generic process-brief outline. The backend now emits a formal sample-inspired document
  shape with business scope tables, actor catalog, use-case catalog, state catalogs, numbered
  per-use-case sections, and figure placeholders; the persisted BRD reader now renders those
  tables and captions as real document elements with controlled overflow. Xem
  `apps/api/app/{schemas/request.py,schemas/spec.py,services/persistence_generation.py,services/render.py,services/spec_builder.py}`,
  `apps/api/tests/test_pipeline.py`, `src/brd/{types.ts,markdown.tsx,PersistedBrdWorkspace.test.tsx}`,
  `src/styles.css`.
- **Persisted BRD reader-first presentation**: saved BRD artifacts no longer open into a debug-first
  view with raw JSON and textarea dominating the first viewport. The route now renders a styled
  BRD document surface, keeps markdown editing behind an explicit toggle, collapses
  `Structured Spec` into a bounded disclosure, and updates deep-link regressions to assert the
  rendered document experience. Xem `src/brd/PersistedBrdWorkspace.tsx`,
  `src/brd/markdown.tsx`, `src/brd/PersistedBrdWorkspace.test.tsx`,
  `src/application/ProjectWorkspace.brd.test.tsx`, `src/styles.css`.
- **Persisted BRD repeat-fetch loop**: opening a saved BRD no longer recreates its own load effect
  after the source Diagram updates workspace state. Diagram/BRD load commands now keep stable
  identities, the effect keys off the selected Use Case, and stale responses are ignored when users
  switch artifacts. Added a real workspace integration regression that locks one Diagram request
  and one BRD request per stable deep link. Xem `src/application/ProjectWorkspace.tsx`,
  `src/application/ProjectWorkspace.brd.test.tsx`, `src/brd/PersistedBrdWorkspace.tsx`,
  `src/brd/PersistedBrdWorkspace.test.tsx`.
- **Persisted BRD generation fallback contract**: persisted `/api/diagrams/{id}/brd/generate` no
  longer fails hard in local/dev when provider config is missing or a provider request errors; the
  route now falls back to deterministic BRD generation and keeps raw `/api/brd/generate` failure
  semantics intact. Also fixed a runtime `UnboundLocalError` in the provider-failure fallback path.
  Xem `apps/api/app/routes/{brd_generate,persistence}.py`,
  `apps/api/tests/test_persistence_chain.py`.
- **Persisted Use Case deep-link hydration state**: direct `Feature -> Use Case` routes no longer
  flash the missing-editor error while feature resources are still hydrating from persistence; the
  workspace now keeps a truthful loading state until the feature inventory is ready. Xem
  `src/application/ProjectWorkspace.tsx`, `src/application/ProjectWorkspace.test.tsx`.
- **Project Spec list input Space/Enter**: các textarea danh sách như `Người dùng mục tiêu`,
  `Business rules`, `Glossary` và Feature list fields giờ giữ raw text trong lúc nhập, nên space cuối
  từ và newline tạm thời không còn bị `trim/filter` xóa ngay; dữ liệu gửi lên persistence vẫn được
  normalize thành danh sách sạch. Xem `src/application/ProjectWorkspace.tsx`,
  `src/application/ProjectWorkspace.test.tsx`.
- **Shape drag từ vùng text**: label bên trong node không còn là drag target độc lập; kéo từ text giờ di chuyển toàn bộ shape, trong khi double-click sửa node text và kéo edge label vẫn hoạt động. Xem `src/lf-config.ts`, `src/lf-config.test.ts`, `e2e/brd-flow.spec.ts`.
- **Shape lane placement**: activity/decision/note mới hoặc đang kéo không còn bị auto căn giữa lane; canvas giờ giữ vị trí ngang người dùng chọn và chỉ clamp vào mép lane khi shape vượt biên, tránh nhiều shape bị dồn chồng lên nhau trong cùng lane. Xem `src/App.tsx`, `src/DndPanel.tsx`, `e2e/brd-flow.spec.ts`.
- **Shape text auto-wrap**: activity, decision và note giờ bật `autoWrap`, giữ newline thủ công, tự bẻ từ dài và tính `textWidth` theo giới hạn từng shape để text không tràn khỏi khung khi nội dung dài hoặc shape bị resize. Xem `src/node-text.ts`, `src/nodes.ts`, `src/nodes.test.ts`.
- **Use case actor textarea Enter fix**: field `Actors / swimlanes` giờ giữ dòng mới tạm thời khi người dùng bấm Enter, nên có thể nhập nhiều actor theo từng dòng thay vì bị normalize lại ngay sau dòng hiện tại. Xem `src/usecases/UseCasePanel.tsx`, `src/usecases/UseCasePanel.test.tsx`.
- **Use case project context input polish**: đổi `Bối cảnh dự án` từ disclosure nhỏ sang panel luôn hiển thị, có header `ProjectSpec`, nhãn `Mô tả bối cảnh`, placeholder rõ hơn và layout responsive 2 cột/1 cột để người dùng thấy đây là context nền của workspace. Xem `src/usecases/UseCasePanel.tsx`, `src/styles.css`, `src/usecases/UseCasePanel.test.tsx`.
- **Use case actor input simplification**: bỏ phân cấp `Actor chính / Actor hỗ trợ` khỏi UI use-case generation và bỏ disclosure `Thông tin bổ sung`; input chính giờ dùng một danh sách `Actors / swimlanes` ngang hàng, mỗi dòng một actor. Adapter vẫn map sang contract backend cũ để giữ compatibility, nhưng UI/review copy không còn chia actor chính/phụ. Xem `src/usecases/UseCasePanel.tsx`, `src/usecases/prevalidate.ts`, `apps/api/app/ai/prompts/registry.py`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.
- **Use case diagram lifecycle hardening**: tách inventory focus khỏi canvas binding thật, bỏ lifecycle `selected`, và đưa label/note/style/quyền `Mở canvas` về một pure lifecycle helper duy nhất. Contract đã chuẩn bị cho `outdated`, `diverged`, `generating`, `failed`; test harness không còn copy policy `approved -> reviewed`, và có regression A-active/B-focused/B-active. Xem `src/usecases/lifecycle.ts`, `src/usecases/lifecycle.test.ts`, `src/App.tsx`, `src/usecases/UseCasePanel.tsx`, `e2e/brd-flow.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.
- **Use case workspace review/context hardening**: edit nội dung của use case đã phê duyệt giờ tự kéo trạng thái về `reviewed`, diagram inventory không còn cho mở canvas khi item cần phê duyệt lại, editor shell có context chip bền vững cho use case đang gắn với canvas, và primary copy của workspace được chuẩn hóa theo VN-first UI. Kèm component/E2E regression cho edit-after-approve và handoff canvas context. Xem `src/App.tsx`, `src/usecases/UseCasePanel.tsx`, `src/styles.css`, `src/usecases/UseCasePanel.test.tsx`, `e2e/brd-flow.spec.ts`, `docs/use-cases/UC-07-sinh-usecase-tu-spec.md`.
- **Shape biến mất khi thả vào lane**: node mới được DnD vào lane đôi khi bị che bởi lane background, chỉ hiện khi click sang lane khác. Sửa bằng cách (1) hạ `zIndex` của lane xuống `-1000`, (2) gọi `setElementZIndex(id, 'top')` cho node mới sau `node:dnd-add`, (3) tắt `isShowAnchor` cho lane để tránh anchor giả khi hover lane. Xem `src/App.tsx`, `src/nodes.ts`, `src/lf-config.ts`.
- **Lane rename và auto-size**: sửa lỗi double-click lane không đổi tên do dùng sai event `node:dbl-click` và lane sync bị handler `node:delete` re-add dữ liệu cũ. Đồng thời thêm auto-size cho lane theo nội dung phía dưới và auto-size/wrap text cho Activity, Decision, Note để nội dung dài không tràn khỏi shape. Xem `src/App.tsx`, `src/nodes.ts`, `src/lf-config.ts`.
- **Lane management và manual resize controls**: thêm lane toolbar hiển thị khi click lane để rename, xoá, đổi thứ tự trái/phải; thêm resize handle cho lane để user tự đổi width lane và chiều cao toàn bộ swimlane; thêm resize handle cho `activity`, `decision`, `note` để user tự đổi kích thước shape mà vẫn giữ auto-size theo text làm ngưỡng tối thiểu. Xem `src/App.tsx`, `src/nodes.ts`, `src/DndPanel.tsx`, `src/styles.css`.
- **Lane containment, edge coherence, và `sync-bar` resize/layout**: chuẩn hóa lane binding sang `relativeX` có clamp theo bề ngang thực của node; chặn lane co nhỏ hơn shape rộng nhất bên trong; đưa `sync-bar` vào lane layout commit với metadata span + chuẩn hóa span theo các lane của node đang nối vào nó; đồng bộ lại edge endpoints sau lane move/resize và mở `width-only` resize cho `sync-bar`. Xem `src/App.tsx`, `src/nodes.ts`, `src/DndPanel.tsx`, `src/styles.css`.
- **AI BRD semantic/main-flow + contract hardening**: backend không còn suy `main_flow_steps` theo tọa độ canvas mà đi theo topology của graph, ưu tiên path chính trước rồi mới append các node reachable còn lại; frontend không còn auto-map node ngoài lane sang lane gần nhất; backend enforce `X-Schema-Version`, thêm rate limit Phase 1, bounded retry cho live provider, strict `json_schema` output qua OpenRouter, và lấy cost metadata từ `usage` thay vì constant. Xem `apps/api/app/services/interpret.py`, `src/brd/normalize.ts`, `apps/api/app/routes/brd_validate.py`, `apps/api/app/routes/brd_generate.py`, `apps/api/app/providers/openrouter_provider.py`.
- **AI BRD completion hardening cho retry + semantic interpretation**: `/generate` giờ release idempotency entry trên mọi nhánh lỗi/blocking để retry cùng `Idempotency-Key` không còn bị kẹt `in_progress`; post-check dùng canonical traceability set thay vì chỉ `main_flow_steps`; sticky note được phân loại thành note gắn step hoặc `global_note`; và `sync-bar` được diễn giải thành parallel block có ngữ nghĩa fork/join tốt hơn với `join_node_id` khi suy ra được. Xem `apps/api/app/idempotency.py`, `apps/api/app/routes/brd_generate.py`, `apps/api/app/services/postcheck.py`, `apps/api/app/services/validate.py`, `apps/api/app/services/interpret.py`, `apps/api/tests/*`.
- **AI BRD frontend pre-validation**: frontend giờ chặn sớm các diagram thiếu `start/end`, thiếu lane cho activity/decision, hoặc edge tham chiếu node không tồn tại trước khi gọi backend; invalid graph được đẩy vào BRD panel ở trạng thái `blocking`, giúp runtime khớp với `UC-06`. Xem `src/brd/prevalidate.ts`, `src/App.tsx`, `src/brd/prevalidate.test.ts`, `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`.
- **AI BRD strict schema compatibility cho live provider**: chuẩn hóa JSON Schema gửi sang OpenRouter/OpenAI strict structured output để mọi object node đều có `additionalProperties: false` và `required` bao phủ đầy đủ property keys; fix này mở được live smoke thành công với model nhỏ như `openai/gpt-4o-mini`. Xem `apps/api/app/providers/openrouter_provider.py`, `apps/api/app/schemas/*.py`, `apps/api/tests/test_schema_contract.py`, `apps/api/tests/test_live_smoke.py`.
- **AI BRD reader-facing quality pipeline**: tách `main spine` khỏi alternate path, capture branch narrative theo `path_summary`/`rejoin_node_text`, định nghĩa lại handoff theo nghĩa nghiệp vụ, nâng `parallel_blocks` thành summary đọc hiểu được, và loại raw ids khỏi 10 section BRD chính bằng cách dồn trace sang `Appendix A`. Đồng thời harmonize live provider output về deterministic reader-facing fields và thêm golden quality tests + route regression cho path live. Xem `apps/api/app/services/interpret.py`, `apps/api/app/services/spec_builder.py`, `apps/api/app/services/render.py`, `apps/api/tests/test_pipeline.py`, `apps/api/tests/test_routes.py`.
- **AI BRD mock E2E isolation**: tách Playwright mock backend sang port `18000` để `test:e2e-mock` không còn reuse nhầm backend live/stale đang chạy ở `8000`. Xem `playwright.config.ts`.
- **AI BRD semantic polish for fire-incident style diagrams**: bỏ false-positive `Parallel activities` cho `sync-bar` không phân nhánh, tách `context note` khỏi `step annotation`, và đổi decision narrative cho main-path continuation sang phrasing `Tiếp tục: ...` thay vì luôn dùng `quay lại luồng chính`. Kèm regression tests cho sync-bar tuyến tính, context note gần start, và continuation branch phrasing. Xem `apps/api/app/services/interpret.py`, `apps/api/app/services/render.py`, `apps/api/app/schemas/spec.py`, `apps/api/tests/test_pipeline.py`, `src/brd/types.ts`.
- **AI BRD trigger + branch wording polish**: section `Assumptions / open questions` không còn tự mâu thuẫn khi chỉ có `Context:` note; alternate branch wording được render theo narrative `Thực hiện lần lượt ...` thay vì dùng mũi tên trace graph; và `Process overview` giờ được harmonize theo deterministic summary để nêu rõ trigger/context mở đầu cùng actor tiếp nhận xử lý ban đầu. Kèm regression tests cho context-only section 10, branch wording, summary harmonization trên cả pipeline và live route. Xem `apps/api/app/services/render.py`, `apps/api/app/services/spec_builder.py`, `apps/api/tests/test_pipeline.py`, `apps/api/tests/test_routes.py`.
- **AI BRD export prose polish**: normalize whitespace của canvas text trước khi render reader-facing BRD, đổi `Context` note nhiều dòng thành heading + sub-bullets rõ ràng hơn, và thay các empty-state wording kỹ thuật bằng phrasing gần tài liệu BA hơn. Kèm regression tests cho multiline activity/decision/handoff text, structured context notes, và các empty-state mới. Xem `apps/api/app/services/reader_text.py`, `apps/api/app/services/render.py`, `apps/api/app/services/spec_builder.py`, `apps/api/app/services/interpret.py`, `apps/api/tests/test_pipeline.py`.
- **AI BRD objective + overview prose hardening**: `Business objective` không còn là placeholder tĩnh mà được dựng deterministically theo domain/semantic của diagram; `Process overview` nay suy diễn subject cụ thể hơn cho case cháy và đe dọa bom; và section 10 được chốt lại thành `Context / assumptions / open questions` để label khớp hơn với nội dung thực tế. Kèm golden tests cho objective case cháy, opening overview domain-specific, và label section 10 mới. Xem `apps/api/app/services/render.py`, `apps/api/app/services/spec_builder.py`, `apps/api/tests/test_pipeline.py`, `docs/product/ai-brd-description-feature.md`, `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`.
- **AI BRD OpenRouter transport hardening**: live provider không còn để `IncompleteRead`/chunked transport error rơi ra thành `500 Internal Server Error`; các lỗi stream bị ngắt giờ được map sang `OpenRouterProviderError(retryable=True)` để route `/generate` giữ đúng retry/502 contract. Thêm regression test trực tiếp cho provider path. Xem `apps/api/app/providers/openrouter_provider.py`, `apps/api/tests/test_openrouter_provider.py`.
- **AI BRD realism upgrade for reader-facing exports**: mở rộng `MainFlowStep` với các field BRD-level (`step_title`, `step_purpose`, `business_action`, `expected_result`, `input_or_trigger`), render lại `Main workflow` theo format giàu nghiệp vụ hơn, điền responsibilities cho actor, làm lại `Scope` theo ranh giới quy trình, và tách `template=default` reader-facing khỏi `template=full` có `Appendix A. Traceability (debug)`. Kèm golden tests và live smoke sau khi mở rộng schema. Xem `apps/api/app/schemas/spec.py`, `apps/api/app/services/spec_builder.py`, `apps/api/app/services/render.py`, `apps/api/tests/test_pipeline.py`, `apps/api/tests/test_routes.py`, `docs/product/ai-brd-description-feature.md`, `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`.

---

## 2026-05-29

### Added
- **PR #1** — Khởi tạo dự án Swimlane Activity Diagram:
  - Setup Vite + React 18 + TypeScript + LogicFlow.
  - Custom nodes: lane, start, end, activity, decision, sync-bar, note.
  - Palette sidebar có thể kéo-thả.
  - Lane mặc định 4 cột (VOC operations).
  - Snap-to-lane khi kéo node.
  - Quản lý lane: thêm, đổi tên, xoá lane qua toolbar + dbl-click + right-click.
  - Bảo vệ lane khỏi DEL key.
  - Export PNG / SVG / JSON.
  - Import JSON.
  - Undo / Redo / Zoom / Fit / Reset / Xoá nội dung.

---

## Quy tắc thêm entry

1. Mỗi PR có thay đổi hành vi user-facing → thêm entry mới.
2. Phân nhóm: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
3. Có link PR / commit khi có thể.
4. Khi release: di chuyển "Unreleased" thành version + ngày.
