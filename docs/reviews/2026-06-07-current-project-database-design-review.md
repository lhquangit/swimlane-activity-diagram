# Review: Railway Database and Full Persistence Flow

## Review Scope

- Date: 2026-06-07
- Runtime entrypoints: `src/main.tsx`, `src/App.tsx`, `apps/api/app/main.py`
- Frontend data flow: `src/usecases/*`, `src/brd/*`
- Backend contracts: `apps/api/app/config.py`, `apps/api/app/routes/*`,
  `apps/api/app/schemas/*`
- Test/deploy surface: `package.json`, `vite.config.ts`, `apps/api/tests/*`,
  `e2e/brd-flow.spec.ts`
- Environment review: variable names and connection topology only; secret values are not recorded.
- Canonical design: [Database Architecture](../scope/database-architecture.md)

## Executive Summary

The seven-table latest-state model remains the correct MVP. The Railway PostgreSQL service is
reachable through its public TCP proxy, but the current FastAPI application still has no database
driver, ORM, migration, session, persistence route, backend Clerk verification, or authenticated
frontend client.

The pasted `.env` is not directly usable for local development. Railway expressions such as
`${{ ... }}` are resolved by Railway Variables or `railway run`; the custom loader in
`apps/api/app/config.py` reads them literally. The private database hostname is only usable by
services in the same Railway project/environment. Local direct runs need a resolved public URL.

There is also an immediate credential incident: the database password was shared in plaintext.
It must be rotated before implementation and every dependent Railway service must be redeployed.
The local `.env` is correctly ignored by Git, but Git ignore does not undo disclosure through chat
or other external channels.

Recommended delivery is incremental: secure/configure runtime first, add schema/auth/shared API
foundations, then deliver one vertical artifact slice at a time from Project/Spec through BRD.

## Module Map

| Module | Responsibility | Current state | Direction |
| --- | --- | --- | --- |
| Secrets and Railway config | Resolve DB URLs and deploy safely | Variables copied into local `.env` | Harden immediately |
| API runtime/deploy | Start FastAPI, health checks, migrations | Local command only | Add deployment contract |
| Persistence foundation | Engine, session, models, Alembic | Missing | Add |
| Identity/authorization | Verify Clerk and enforce ownership | UI auth only | Harden immediately |
| Domain/API boundary | CRUD and generation from saved parents | Generation accepts browser payloads | Redesign interface |
| Frontend shell/routing | Sign-in, dashboard, project workspace | One editor screen | Split responsibilities |
| Project/Spec | User project and one context spec | Singular in-memory ProjectSpec | Add persistence and separate UI |
| FeatureIntent | Multiple features per spec | Singular state, actor data mixed | Refactor in place |
| UseCase | Generate/review/save latest portfolio | In-memory only | Add resource persistence |
| Diagram | Generate/edit/save per use case | Session workspace only | Add latest-state persistence |
| BRD | Generate/edit/save per diagram | `localStorage` only | Replace incrementally |
| Tests/operations | Prove auth, isolation, reload, deploy | Mock generation coverage only | Expand by risk |

## Findings

### P0 - Database credential must be rotated

- Claim: The active PostgreSQL password was disclosed in plaintext.
- Evidence: The database environment block supplied for this review contained the credential.
- Impact: Anyone with access to the disclosure and public proxy can attempt database access.
- Recommendation: Rotate the Railway credential immediately, redeploy dependent services, and only
  then perform authenticated connectivity/migration tests.
- Confidence: Confirmed.

### P0 - Railway reference variables do not work in the current local `.env` loader

- Claim: `DATABASE_URL` and `DATABASE_PUBLIC_URL` contain unresolved `${{ ... }}` expressions when
  FastAPI is started directly.
- Evidence: `apps/api/app/config.py:8-23` only strips quotes and assigns strings to `os.environ`; it
  performs no interpolation. Railway documents `${{ ... }}` as platform reference syntax.
- Impact: SQLAlchemy would receive an invalid host/port or private hostname during local execution.
- Recommendation: Use a resolved public `DATABASE_URL` locally or run through `railway run`; use a
  namespaced private reference such as `${{Postgres.DATABASE_URL}}` in the deployed API service.
- Confidence: Confirmed.

### P0 - Backend has no authentication or authorization boundary

- Claim: Clerk currently changes only frontend controls; all generation API routes are public.
- Evidence: `src/main.tsx:13-17` mounts Clerk, while `apps/api/app/main.py:60-63` includes routers
  without an auth dependency. Routes derive rate limits from client IP, not verified user identity.
- Impact: Persistence CRUD would be vulnerable to IDOR; AI endpoints can also be consumed without a
  signed-in user.
- Recommendation: Require verified Clerk session tokens for all `/api/*` business routes, derive the
  user from JWT `sub`, and resolve ownership server-side.
- Confidence: Confirmed.

### P0 - Current CORS policy blocks the required authenticated CRUD flow

- Claim: Browser preflight will reject bearer auth and write methods.
- Evidence: `apps/api/app/main.py:28-29` allows only `GET`, `POST`, `OPTIONS` and omits
  `Authorization` from allowed headers.
- Impact: Even correct CRUD/auth code will fail from the React app for `PUT`, `PATCH`, `DELETE` or
  requests carrying the Clerk token.
- Recommendation: Add exact production origins, required methods, and `Authorization`; add CORS
  preflight tests.
- Confidence: Confirmed.

### P1 - The API has no persistence runtime

- Claim: There is no database configuration, driver, ORM, migration or request-scoped session.
- Evidence: `apps/api/pyproject.toml:6-16` contains only FastAPI/Pydantic/Uvicorn plus test packages.
  `apps/api/app/config.py:29-86` contains AI/runtime settings only.
- Impact: The new database cannot be used, schema changes cannot be deployed deterministically, and
  route tests cannot verify transactions or constraints.
- Recommendation: Add synchronous SQLAlchemy 2.x, `psycopg`, Alembic, session dependency and
  migration tests against PostgreSQL.
- Confidence: Confirmed.

### P1 - Deployment topology is not executable from the repository

- Claim: The repository has no Railway manifest/start command/pre-deploy migration configuration.
- Evidence: No `railway.toml`, `railway.json`, Dockerfile or Procfile exists. `package.json:9` is a
  local reload command and does not bind Railway's injected `PORT`.
- Impact: A deploy can start from the wrong monorepo directory, skip migrations, or fail health
  checks.
- Recommendation: Add an API service deployment contract with root directory/start command,
  `alembic upgrade head` pre-deploy, `$PORT`, `/healthz` and DB-aware `/readyz`.
- Confidence: Confirmed.

### P1 - Generation trusts client payload instead of saved parent resources

- Claim: Current generation routes accept full ProjectSpec, FeatureIntent, UseCase or diagram data
  from the browser.
- Evidence: `apps/api/app/routes/usecase_generate.py:48-58`,
  `apps/api/app/routes/diagram_generate.py:46-59`, and BRD routes operate directly on request data.
- Impact: After persistence is added, generation can bypass ownership and use unsaved/tampered parent
  content unless the boundary changes.
- Recommendation: Add resource-scoped generation routes that authorize the resource ID and load the
  latest saved parent before invoking existing generation services.
- Confidence: Confirmed design risk.

### P1 - Project, Spec and FeatureIntent boundaries do not match the target hierarchy

- Claim: The UI keeps one ProjectSpec and one FeatureIntent, and the input panel writes feature
  actors into project-level target users.
- Evidence: `src/App.tsx:788-790` stores singular state.
  `src/usecases/UseCasePanel.tsx:220-228` updates both `ProjectSpec.target_users` and
  `FeatureIntent.primary_actor`. `src/usecases/UseCasePanel.tsx:317-329` edits project name inside
  ProjectSpec.
- Impact: Multiple projects/features cannot be selected safely, and project-level context becomes
  contaminated by feature-specific actors.
- Recommendation: Introduce persistent IDs, project routing, separate Spec/Feature tabs, and a
  first-class feature `actors` list.
- Confidence: Confirmed.

### P1 - Frontend API clients cannot authenticate and are duplicated by capability

- Claim: Fetch helpers do not accept a Clerk token or provide shared error/auth behavior.
- Evidence: `src/brd/client.ts:24-59` and `src/usecases/client.ts:15-50` build headers independently
  and never set `Authorization`.
- Impact: Every new CRUD module could implement token refresh, 401 handling and response parsing
  differently.
- Recommendation: Create one authenticated API client whose token provider comes from
  `useAuth().getToken()`, then build typed resource services on top.
- Confidence: Confirmed.

### P1 - The editor shell is too singular for reloadable project navigation

- Claim: The app has no route-level project identity and renders auth controls inside the editor
  toolbar.
- Evidence: `src/App.tsx:760-811` owns all project/use-case/diagram/BRD state in one component;
  `package.json:18-24` has no router dependency.
- Impact: Refresh/deep-link behavior, dashboard-to-project navigation and dirty guards become brittle
  if added only as more conditionals in `App.tsx`.
- Recommendation: Add protected routes for project list and project workspace, then extract project
  persistence state from the LogicFlow editor.
- Confidence: Confirmed.

### P1 - Use-case database identity is not separated from business key

- Claim: Current `UseCaseDraft.use_case_id` is a generated label, while the database design also
  needs a UUID primary key for ownership and foreign keys.
- Evidence: `src/usecases/types.ts:42-55` exposes only `use_case_id`; diagram maps are keyed by that
  value in `src/App.tsx:793-800`.
- Impact: Renumbering/regeneration can orphan diagrams or accidentally overwrite another row.
- Recommendation: Return a resource UUID separately from `use_case_key`; use UUIDs for CRUD/FKs and
  keep `content.use_case_id` as the human/business key.
- Confidence: Confirmed design gap.

### P1 - Diagram and BRD persistence need canonical serialization boundaries

- Claim: Diagram state is distributed across LogicFlow graph, lane state and React workspace maps;
  BRD state is cached globally under one localStorage key.
- Evidence: `src/App.tsx:794-800` stores diagram workspaces; `src/brd/cache.ts:3-4` defines one global
  cache key.
- Impact: Saving only one representation can lose lane geometry/provenance, and BRD cache can leak
  context across projects/use cases on the same browser profile.
- Recommendation: Define DTO adapters and round-trip tests before wiring Save; scope recovery cache
  by signed-in user and diagram, then make server state authoritative.
- Confidence: Confirmed.

### P2 - Latest-only storage has accepted overwrite risk

- Claim: Every Save replaces the previous value and no optimistic lock/revision is planned.
- Impact: Two tabs can overwrite each other and accidental edits cannot be restored in-app.
- Recommendation: Keep latest-only for MVP, but show dirty/saved timestamps, guard navigation, and
  enable Railway backups before production data is accepted.
- Confidence: Product decision.

## Module Directions

### Secrets and Railway Config

- Current state: Public proxy is reachable, but local values are unresolved and the credential is
  compromised.
- Main risks: unauthorized access, invalid local URL, private hostname misuse.
- Recommended direction: Harden immediately.
- Why now: No migration or connectivity test should run with a disclosed password.

### Persistence and API Runtime

- Current state: Generation backend is healthy but stateless.
- Main risks: no migrations, no transaction boundary, no deploy contract.
- Recommended direction: Add foundations incrementally.
- Why now: Every Save feature depends on one shared engine/session/schema layer.

### Identity and Authorization

- Current state: Clerk UI exists; backend trusts all callers.
- Main risks: IDOR, anonymous AI usage, blocked CORS preflight.
- Recommended direction: Harden immediately.
- Why now: Ownership must be designed into repositories and routes, not appended after CRUD ships.

### Frontend Application Shell

- Current state: One large editor owns every artifact.
- Main risks: state bleed across projects/features and broken reload/deep-link behavior.
- Recommended direction: Split responsibilities.
- Why now: Dashboard/routing must exist before artifact Save flows are attached to project IDs.

### Artifact Persistence

- Current state: Project through diagram are memory-only; BRD is browser-cache-only.
- Main risks: mismatched IDs, unsafe parent generation, incomplete serialization.
- Recommended direction: Deliver vertical slices.
- Why now: Each slice can be independently tested for Save/reload/ownership before the next child
  artifact is added.

### Tests and Operations

- Current state: Generation contracts have useful mock coverage; persistence/auth/deploy do not.
- Main risks: migrations or ownership regress silently; Railway deploy can start without schema.
- Recommended direction: Expand by blast radius.
- Why now: Database/auth errors are expensive to discover only through manual production testing.

## Recommended Execution Order

1. Rotate credential and normalize Railway/local configuration.
2. Add Railway API deployment contract and PostgreSQL migration foundation.
3. Add Clerk verification, CORS and ownership helpers.
4. Add shared API DTO/repository/client/routing foundations.
5. Deliver Project + Spec backend/frontend.
6. Deliver FeatureIntent backend/frontend.
7. Deliver UseCase persistence and saved-parent generation.
8. Deliver Diagram persistence and saved-parent generation.
9. Deliver BRD persistence and saved-parent generation.
10. Standardize Save guards, run full-chain E2E, enable backup/release checks.

## Deliberately Deferred

- revisions, revert and optimistic locking;
- workspace/team membership;
- admin UI or admin special access;
- audit/share/comments;
- autosave and realtime collaboration;
- persistent generation-run history.

## External References

- [Railway Variables](https://docs.railway.com/variables)
- [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)
- [Railway Private Networking](https://docs.railway.com/guides/private-networking)
- [Railway Pre-deploy Command](https://docs.railway.com/guides/pre-deploy-command)
- [Railway Healthchecks](https://docs.railway.com/guides/healthchecks-and-restarts)
- [Clerk session token validation](https://clerk.com/docs/how-to/validate-session-tokens)
- [Clerk React `useAuth`](https://clerk.com/docs/react/reference/hooks/use-auth)
