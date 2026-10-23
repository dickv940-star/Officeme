# AI AFFILIATE by AppDIGI

Private workspace for managing one Shopee Affiliate account with eight logical AI worker roles.

## Current milestone: UI prototype

- `index.html` is the first dashboard prototype.
- The command form creates an in-memory local task queue for interface testing only.
- No AI model, database, Shopee API, affiliate account, or external publishing action is connected yet.
- Never enter passwords, API keys, cookies, personal identifiers, or payout details into this prototype.

## The team

William Bigboss is the owner/director (you): sets targets, gives orders, receives reports. Eight AI specialists work for him:

1. Alexander - Lead Data Analyst
2. Olivia - Senior Product Researcher
3. Ethan - Growth & Affiliate Strategist
4. Sophia - Senior Content Producer
5. Daniel - SEO & Discovery Specialist
6. Isabella - Lead Visual Designer
7. Lucas - Automation & Integration Engineer
8. Charlotte - Quality & Compliance Lead (reviews everyone's work)

## Planned architecture

- Frontend: static HTML/CSS/JS dashboard.
- Backend: authenticated API service that validates requests and coordinates jobs.
- Queue/scheduler: persistent job queue; schedule jobs only after guardrails are tested.
- Database: tasks, outputs, approvals, and audit events.
- Shopee Integration Gateway: only officially documented API access authorized for this account and region. Keep credentials server-side in environment variables or a secret manager.
- AI provider adapter: model can be changed; enforce budget limits and per-task permissions.
- Human approval: required before publishing, sending messages, or irreversible/external actions.

## Security rules

- This copy is in a public repository: anyone can view and copy its source code. Enable MFA on GitHub.
- Never commit `.env`, API credentials, cookies, session tokens, affiliate payout data, or raw personal data.
- Frontend code must never contain a Shopee App Secret or AI API key.
- Use HTTPS, server-side authentication, rate limits, input validation, audit logs, and least-privilege credentials.
- Do not automate login by scraping or bypassing access controls.
- Confirm API eligibility through official Shopee Affiliate channels; do not assume access is granted.
- This public repository and its GitHub Pages site must be treated as public. Do not put secrets, account data, or private information in the code. GitHub Pages is not suitable for a private authenticated dashboard under common GitHub Free personal usage.

## Preview

Open `index.html` in a modern browser. The task queue is in memory and resets when the page reloads.

## Next milestones

1. Confirm access to Shopee Affiliate API for the Indonesian account.
2. Add backend authentication and a mock integration.
3. Add persistent tasks, approvals, audit logs, and budget limits.
4. Connect one AI provider and orchestrate the eight roles.
5. Test with mock data before reading real affiliate reports.


## Shopee Affiliate Open API gateway

The Cloudflare Worker now provides an authenticated Shopee Affiliate Open API gateway:

- `GET /api/shopee/status` — reports whether the App ID and secret are configured without exposing their values.
- `POST /api/shopee/graphql` — forwards allowlisted GraphQL operations to the official Indonesian Affiliate Open API endpoint with server-side SHA-256 signing.
- Allowed root operations: `productOfferV2`, `shopOfferV2`, `shopeeOfferV2`, `conversionReport`, `validatedReport`, and `generateShortLink`. Only `generateShortLink` is allowed as a mutation.
- Requests require `Authorization: Bearer APP_SHARED_TOKEN`. The API secret stays in Cloudflare Worker secrets and is never exposed to the browser.

### Enable account access

In Cloudflare Dashboard → Workers & Pages → `appdigi-w001-backend` → Settings → Variables and Secrets, configure:

- `SHOPEE_AFFILIATE_APP_ID` — the official App ID issued for the Shopee Affiliate Open API.
- `SHOPEE_AFFILIATE_SECRET` — the matching secret, stored as a secret.
- Optional `SHOPEE_AFFILIATE_ENDPOINT` — if needed, the official HTTPS endpoint for the Indonesian account. The Worker only accepts `open-api.affiliate.shopee.co.id`.

Do not put credentials in GitHub, frontend code, screenshots, or chat. The API is usable only if Shopee has granted Open API access to the account. If access has not been approved, request it through the official Affiliate Open API portal first. Human approval remains required before publication; this gateway does not publish social posts.


## Free AI providers (0 rupiah) with automatic fallback

The Worker never calls paid-only APIs. Each agent has an ordered list of free providers; if one is rate-limited, out of daily budget, or failing, the next one answers automatically. Set any of these as Cloudflare Worker **secrets** (all have free tiers, no credit card; limits change, check each site):

- `GEMINI_API_KEY` - Google AI Studio. Note: free-tier prompts may be used by Google for training; avoid sensitive data.
- `GROQ_API_KEY` - Groq (Llama 3.3 70B).
- `CEREBRAS_API_KEY` - Cerebras (Llama 3.3 70B).
- `OPENROUTER_API_KEY` - OpenRouter free models.
- Cloudflare Workers AI works through the `AI` binding with no key.

Optional variables: `<PROVIDER>_DAILY_LIMIT` and `<PROVIDER>_MODEL`. See `backend/wrangler.toml.example`. The approvals table already exists in your `appdigi-approvals` D1 database; `backend/schema.sql` documents it. Run tests with `node --test backend/test/*.test.mjs`.

## Secure account connections (OAuth)

The account-connect UI and backend OAuth callbacks are implemented, but a platform is **not connected** until its developer application is configured and the user completes consent and identity verification.

### Required Cloudflare Worker configuration

1. Create a Cloudflare KV namespace and bind it to the Worker as INTEGRATION_KV.
2. Add Worker secrets/variables (never commit their values):
   - INTEGRATION_ENCRYPTION_KEY: high-entropy random secret, at least 32 characters. Changing it makes previously encrypted integration tokens unreadable.
   - OAUTH_CALLBACK_URL: exact HTTPS URL https://YOUR-WORKER-HOST/api/integrations/oauth/callback. Register this exact URI with each provider.
   - OAUTH_APP_URL: optional, defaults to the OfficeMe GitHub Pages app URL.
   - Meta: META_APP_ID, META_APP_SECRET; optionally META_GRAPH_VERSION.
   - Google: YOUTUBE_OAUTH_CLIENT_ID, YOUTUBE_OAUTH_CLIENT_SECRET; enable YouTube Data API v3 and configure the OAuth consent screen.
   - TikTok: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET; optionally TIKTOK_SCOPES (default user.info.basic,video.list).
3. In Meta, configure Facebook Login/Instagram API products and request only permissions approved for your app. Instagram requires a Professional (Business/Creator) account linked to a Facebook Page.
4. In Google Cloud, register the callback as an authorized redirect URI and enable YouTube Data API v3.
5. In TikTok for Developers, enable Login Kit and register the callback URI. Additional publishing scopes require TikTok approval.
6. In Pinterest Developers, register an app and the exact callback URI. Request only the required scopes; Pinterest must approve the app/access tier before production use.
7. Deploy backend/worker.js, then use the OfficeMe “Hubungkan Akun” cards. The user must already be logged into OfficeMe with the backend shared token. Tokens are encrypted with AES-GCM before storage in KV; OAuth state expires after 10 minutes and is single-use.

### Platform-specific limitations

- Instagram and Facebook use Meta OAuth and verify a managed Facebook Page (Instagram additionally requires a linked professional Instagram account).
- YouTube uses Google OAuth and verifies a channel through YouTube Data API. This confirms the YouTube channel, not a separate Shorts account; Shorts publishing is still disabled until upload, privacy settings, and human approval are implemented and tested.
- TikTok uses Login Kit and verifies the authorized TikTok identity. The default scope reads basic profile and video-list access; publishing is not enabled automatically.
- Pinterest uses the official OAuth authorization-code flow, encrypts access/refresh tokens in KV, verifies `/v5/user_account`, and reads up to 25 boards. Pin creation is intentionally disabled; OAuth connection does not mean a Pin can be published.
- Shopee in this repository is the Shopee Affiliate Open API, which uses official app credentials and signed API calls, not a generic Shopee account OAuth flow. Its status deliberately remains unconnected until a separate authenticated API verification is added.
- Content publication and other write actions remain disabled in this milestone. OAuth grants only scopes approved by the provider; it does not itself implement or authorize every publishing action. Human approval remains mandatory.



## Google Sheets bridge (Rp0)

OfficeMe includes a free manual CSV bridge to Google Sheets and an optional Google Apps Script helper:

- The OfficeMe **Kalender Konten Google Sheets** panel stores drafts in the current browser and imports/exports CSV.
- The helper script is in [google-sheets-bridge/Code.gs](./google-sheets-bridge/Code.gs).
- Setup instructions: [google-sheets-bridge/README.md](./google-sheets-bridge/README.md).
- No paid API, API key, or public Apps Script web app is required for this workflow.
- CSV transfer is manual, not real-time synchronization. Social account connection and publishing still require official platform authorization.


## Multi-platform affiliate workflow MVP

The frontend loads `affiliate-workflow.js` with these capabilities:

- Flexible local registry of affiliate accounts/channels (metadata only; adding an entry does not connect an account).
- AI team content-draft generation via authenticated `POST /api/agents/run`.
- Shopee product research via `POST /api/affiliate/analyze` when Google Search grounding is configured in the backend.
- Editable drafts and a local owner-approval queue. Approval is a local workflow decision and **does not publish**.
- Manual entry for reach, clicks, orders/conversions, and commission copied from official platform dashboards.
- JSON backup/import and text export.

### Current limitations — do not treat as live integration

Account records, draft content, approval decisions, and metrics are stored in the current browser's localStorage. They are not shared across devices and do not constitute a server audit log. Metric fields are manual inputs, not live analytics. Multi-platform OAuth, automatic platform publishing, automatic commission sync, and persistent server-side account storage are not activated by this UI. Each platform's official API access, review, scopes, and account eligibility must be completed before enabling those actions. Every real publication must have explicit owner approval and server-side authorization.

After deployment, hard-refresh the GitHub Pages site (Ctrl+F5). Test with a non-sensitive dummy account first.
