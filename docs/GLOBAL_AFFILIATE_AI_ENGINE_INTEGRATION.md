# Global Affiliate AI Engine integration plan

Status: architecture and repository audit baseline
Branch: integration/global-affiliate-engine-foundation
Target: reuse OfficeMe as the control dashboard; keep the Global Affiliate AI Engine as the execution/orchestration layer.

## Executive decision

OfficeMe remains the user-facing control plane. The affiliate engine is not a second dashboard: it is the workflow and agent runtime behind OfficeMe. Existing OfficeMe UI and Cloudflare Worker are reused where safe. No existing live integration is declared operational until its endpoint and real authorization are verified.

## Audit findings from the current main branch

### Existing building blocks

- `index.html`: existing OfficeMe dashboard and login/configuration UI.
- `affiliate-workflow.js`: multi-platform affiliate workflow UI. It already calls:
  - `POST /api/agents/run` for team content drafting.
  - `POST /api/affiliate/analyze` for Google Search-grounded Shopee product research.
- `backend/worker.js`: Cloudflare Worker API with shared-token authentication, agent runtime, provider fallback, integration OAuth, and approval validation.
- `backend/schema.sql`: D1 tables already include `affiliate_products`, `affiliate_content_queue`, `affiliate_performance_daily`, `affiliate_ops_config`, and `approval_packages`.
- Existing agent team: Alexander (data), Olivia (research), Ethan (growth), Sophia (content), Daniel (SEO), Isabella (visual), Lucas (automation), Charlotte (QA).
- Existing platform OAuth readiness/status routes include YouTube, Pinterest, TikTok, Instagram and Facebook. OAuth connection is not equivalent to publishing permission.
- `/health` reports provider and storage configuration without exposing secret values.
- Publishing is explicitly disabled in the Worker health payload.

### Material gaps / risks

1. Affiliate account/channel records and drafts in `affiliate-workflow.js` are stored in browser `localStorage`; they are not shared across devices and are not server-authoritative.
2. Approval buttons in the current affiliate workflow update only local browser state. They do not create or decide a D1 `approval_packages` record.
3. D1 has affiliate operations tables, but the current documented UI flow does not yet demonstrate persistent CRUD/read APIs for those records.
4. The existing AI draft path invokes the team endpoint and can return partial results; the UI must surface which agents and QA succeeded rather than treating a partial result as a fully passed pipeline.
5. Shopee product research currently requires `GEMINI_API_KEY` and Google Search grounding. It is not the same as verified Shopee Affiliate Open API access, and a failed Search result must remain a failed research state.
6. Shopee API credentials and social OAuth credentials must remain in Cloudflare Worker secrets/KV. Never put tokens, API keys, cookies or account passwords in GitHub Pages, browser storage, or repository files.
7. Social OAuth readiness is not proof of account connection; platform publishing and automatic commission synchronization remain disabled/not implemented in this milestone.
8. `APP_SHARED_TOKEN` is a privileged backend credential. A public GitHub Pages app cannot safely embed a shared secret in shipped JavaScript. The current login flow needs a security review before any expansion of privileged browser-side API access.
9. The repository is public and the dashboard is GitHub Pages. It must not display or store sensitive account data as if the site were private.

## Target architecture

- **OfficeMe dashboard (control plane):** account/channel registry, product research intake, work queue, agent progress, content review, owner approvals, analytics views, and audit trail.
- **Global Affiliate AI Engine (execution plane):** workflow orchestrator that sequences research → trend/competitor intelligence → content planning/production → QA → approval request → distribution preparation → performance analysis/optimization.
- **Cloudflare Worker (API gateway):** authenticated API, policy checks, provider adapter, platform connectors, and orchestration entry points.
- **Cloudflare D1 (system of record):** affiliate accounts (metadata only), products, jobs, content versions, approvals, metrics, run logs, and audit events.
- **Cloudflare KV:** encrypted OAuth tokens and short-lived OAuth state only.
- **Human approval gate:** all external publishing or irreversible actions require a valid owner approval for the exact content version, payload fingerprint, and destination channels.

## Operating decisions to preserve

- Agent mode: hybrid (automated orchestration with human review at consequential steps).
- Content source: original content by default; third-party public content may be analyzed as inspiration/reference, not copied or republished without rights.
- Publication: mixed, but every actual publication requires explicit owner approval.
- Initial channels: YouTube Shorts and Pinterest are priority channels; other platforms can be enabled after their API scopes and product access are verified.
- Affiliate source: Shopee Affiliate.
- Budget: target Rp0; keep pay-as-you-go providers disabled and do not add paid dependencies by default.
- Never infer account authorization, live analytics, a successful publication, or earned commission from local UI state.

## Implementation sequence

### Phase 1 — Baseline audit (this document)

- Record existing routes, storage behavior, integration boundaries, and safety gaps.
- Preserve the current main branch; all changes are developed on a feature branch and reviewed through a pull request.

### Phase 2 — Connect the OfficeMe dashboard to a server-backed workspace

Implementation started on the feature branch:

- Added owner-authenticated D1 workspace endpoints for account/channel metadata and content drafts:
  - `GET /api/owner/workspace?kind=accounts|contents`
  - `PUT /api/owner/workspace/accounts/:id` and `PUT /api/owner/workspace/contents/:id`
  - `DELETE /api/owner/workspace/accounts/:id` and `DELETE /api/owner/workspace/contents/:id`
- Added `owner_workspace_records` to `backend/schema.sql`; Worker also creates the table/index defensively.
- Added manual push/pull controls to the affiliate workflow UI. The owner token is held only in page memory, is not written to localStorage, and can be cleared. Pull merges by ID and preserves local records on conflicts.
- CORS preflight now permits the required PUT and DELETE methods.
- The UI deliberately does not auto-sync or delete server data. Unsupported legacy account platform values are reported/skipped by the frontend until their mappings are confirmed.
- This is a first persistence slice, not yet full product/job/version/run-log persistence or server-backed approval decisions.
- Use owner-scoped authorization; do not expose Worker secrets to browser JavaScript.
- Migrate local browser records through an explicit export/import path. Do not silently overwrite or delete existing local data.
- Keep an explicit local-only mode if secure owner authentication cannot be established.
- Replace local-only approval decisions with the existing D1 approval package flow; use owner authorization for decisions and exact payload fingerprints.
- Do not enable publishing in this phase.

### Phase 3 — Orchestrate the affiliate workflow

- Add a persisted job state machine with idempotency keys and clear failure/retry states.
- Sequence research, trend intelligence, product validation, content brief, production, and Charlotte QA.
- Require source evidence for product/trend claims and mark unavailable data as unknown.
- Separate public competitor observations from private account analytics that require OAuth and permissions.

### Phase 4 — Channel readiness and distribution

- Verify YouTube and Pinterest OAuth status, scopes, account identity, and permitted actions.
- Prepare channel-specific publishing packages; do not publish until owner approval and endpoint-specific validation pass.
- Keep platform-specific API limitations visible in the dashboard.

### Phase 5 — Analytics and optimization

- Import metrics only from official authorized APIs or clearly labeled manual imports.
- Track impressions/reach, clicks, views, orders, pending/validated commission, cancellations, source, and verification timestamp.
- Distinguish measured results from estimates and optimize only from verified data.

### Phase 6 — Verification and release

- Unit-test route authorization, input validation, D1 persistence, idempotency, approval fingerprints, and failure paths.
- Test with synthetic data before using live affiliate or social accounts.
- Verify deployed Worker health and browser UI after deployment; do not infer deployment success from a Git commit.
- Release via PR review and merge only after tests and deployment checks pass.

## Acceptance criteria

- OfficeMe is the single control dashboard; no duplicate control panel is introduced.
- Account, product, content, approval, and analytics records persist server-side and are owner-scoped.
- No secret is committed to the repository or embedded in public frontend code.
- Every job exposes queued/running/partial/failed/completed status and evidence references.
- A partial agent result cannot be shown as fully QA-approved.
- Approval applies only to the exact content version, fingerprint, and selected destinations.
- No publication happens without an explicit owner decision and a successful server-side approval validation.
- Analytics labels distinguish official API, manual import, and estimated data.
- The Rp0-first policy is enforced; paid provider calls remain disabled unless separately authorized.

## Verification note

The owner token was reported as created by the owner, but its presence/value has not been independently verified from the Worker runtime. The new APIs and UI are committed only to the feature branch; D1 schema application, syntax/runtime tests, deployed Worker health, and browser end-to-end tests remain pending. This document is a repository-grounded implementation plan, not a claim that the backend is currently deployed or that any social/Shopee account is connected. Live Worker and GitHub Pages endpoints could not be verified with the available read-only browser check in this session. Runtime tests and deployment checks remain required before release.
