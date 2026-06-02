# Review — AI BRD testing strategy and API-key usage

## Scope

- Project: swimlane-activity-diagram
- Reviewer: Codex using `senior-ai-reviewer`
- Date: 2026-05-31
- Question reviewed:
  - Có cần phải add API key vào env file thì agent mới tự động test được trong lúc coding hay không?
  - Chiến lược đúng để implement và test tính năng AI BRD là gì?
- Artifacts checked:
  - `docs/scope/architecture-brd-backend.md`
  - `docs/product/ai-brd-description-feature.md`
  - `docs/use-cases/UC-06-sinh-brd-tu-diagram.md`

## Module Map

1. `provider-runtime-contract`
   - Purpose: define how backend chooses between OpenRouter and mock provider, and what env vars are required.
2. `request-response-contract`
   - Purpose: define endpoint behavior, status/error contract, and idempotency handling for `validate` and `generate`.
3. `quality-gates`
   - Purpose: define what should be tested deterministically vs what truly needs a live model/provider.

## Findings

### [P1] Requiring a real API key for routine automated testing is the wrong default

- Evidence:
  - the backend architecture already reserves `mock_provider.py` specifically “cho unit test + dev environment khi không có API key” in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:89).
  - the same doc says `MockProvider` should return deterministic fixtures in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:114).
  - local development explicitly allows `BRD_PROVIDER=mock` to run without a key in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:165) and [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:170).
- Impact:
  - if everyday testing depends on a real OpenRouter key, the implementation becomes slower, more expensive, and less deterministic.
  - CI would become flaky and expensive, and prompt/model drift would break routine development feedback.
- Recommended direction: **Harden**
  - keep real-provider tests as an opt-in layer, not the default feedback loop.
  - make mock-backed tests the standard path for normal coding, PR validation, and most browser flows.

### [P1] The correct implementation strategy is layered: mock-first, provider-smoke second, evaluation last

- Evidence:
  - the architecture intentionally separates deterministic steps (`extract`, `normalize`, `validate`, `interpret`, `render`, `postcheck`) from the provider boundary in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:84) through [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:88).
  - the feature doc makes BRD markdown deterministic after the structured spec in [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:591) through [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:593).
  - the feature doc already defines a golden-set eval layer rather than saying every request must hit the live provider in [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:745) through [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:760).
- Impact:
  - this architecture is specifically designed so the bulk of correctness can be tested without paying model cost.
  - only the provider adapter and a small number of smoke/eval cases truly need a real key.
- Recommended direction: **Keep as-is**
  - implement in four layers:
    1. pure deterministic unit tests,
    2. endpoint integration tests with `MockProvider`,
    3. frontend/browser tests against a mock backend,
    4. opt-in live-provider smoke/eval tests gated by env.

### [P2] Adding a real API key locally is reasonable for manual smoke tests, but it should be optional and never committed

- Evidence:
  - the env contract requires `BRD_OPENROUTER_API_KEY` only when `BRD_PROVIDER=openrouter` in [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:122) through [docs/scope/architecture-brd-backend.md](../scope/architecture-brd-backend.md:123).
  - the backend is expected to fail gracefully with `503` when the key is missing in [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:586) through [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:587).
- Impact:
  - this gives a clean local/manual path for testing the real provider without making the whole team or CI depend on shared secrets.
  - it also verifies the “missing key” path, which is itself part of the contract.
- Recommended direction: **Harden**
  - allow local `.env` with real key for optional smoke testing,
  - keep `.env.example` keyless by default,
  - never commit real secrets,
  - never make “key present” a prerequisite for routine coding.

### [P2] Live-provider tests should be a narrow, explicit suite with a clear trigger

- Evidence:
  - `generate` carries cost and idempotency behavior in [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:550) through [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:678).
  - the feature doc sets explicit cost targets and controlled retry limits in [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:762) through [docs/product/ai-brd-description-feature.md](../product/ai-brd-description-feature.md:774).
- Impact:
  - if live-provider tests run automatically on every save or every PR, they will burn cost and hide regressions behind model variance.
  - if they never run, the provider adapter and schema/JSON-contract edge cases may rot.
- Recommended direction: **Refactor in place**
  - define a separate smoke/eval command, for example:
    - `test:api-mock`
    - `test:api-live`
    - `test:eval-live`
  - run `mock` suites by default.
  - run `live` suites only when `BRD_OPENROUTER_API_KEY` is present and the developer explicitly asks for them, or on scheduled/manual CI jobs.

## Module Directions

### provider-runtime-contract

- Current quality: good; the docs already anticipate a mock path and optional real-provider path.
- Recommended direction: **Keep as-is**
- Why: the main issue is execution discipline, not missing architecture.

### request-response-contract

- Current quality: now strong enough to support mock-first endpoint tests because status/error/idempotency are explicitly defined.
- Recommended direction: **Harden**
- Why: the next step is to mirror the doc in actual Pydantic/TypeScript types and ensure both mock and live providers obey the same envelope.

### quality-gates

- Current quality: conceptually sound, but the testing pyramid is implied rather than spelled out.
- Recommended direction: **Harden**
- Why: implementation should name the suites and make live-provider runs opt-in.

## Recommended Strategy

1. **Do not block implementation on a real API key.**
   - Default local dev and automated tests should run with `BRD_PROVIDER=mock`.

2. **Implement deterministic layers first.**
   - `extract`
   - `normalize`
   - `validate`
   - `interpret`
   - `render`
   - `postcheck`
   - response envelope / error / idempotency state handling

3. **Build backend integration tests with `MockProvider`.**
   - Verify `POST /api/brd/validate`
   - Verify `POST /api/brd/generate`
   - Verify `400/409/422/502/503` paths
   - Verify `completed / replayed / in_progress / conflict`

4. **Build frontend and browser tests against a mock backend.**
   - `Generate BRD` button flow
   - warnings panel
   - `Structured Spec` read-only tab
   - editable `BRD Draft`
   - `Outdated` badge after diagram changes

5. **Only then add a small live-provider smoke suite.**
   - one valid diagram end-to-end
   - one timeout/failure path if controllable
   - one idempotent retry path

6. **Treat golden-set evaluation as a separate quality lane.**
   - not part of every edit-save cycle
   - not required for every PR unless the provider adapter or prompts changed materially

## Practical Answer

- **Có hợp lý không nếu bạn add API key vào env file để mình test tự động?**
  - Hợp lý cho **manual smoke test** hoặc **opt-in live-provider suite**.
  - Không hợp lý nếu biến nó thành điều kiện bắt buộc cho toàn bộ vòng coding/test hằng ngày.

- **Chiến lược đúng để implement là gì?**
  - `mock-first by default`
  - `real-provider smoke second`
  - `golden-set eval third`
  - CI/PR mặc định không phụ thuộc key thật
  - live-provider tests chỉ chạy khi có chủ đích và có guard về cost
