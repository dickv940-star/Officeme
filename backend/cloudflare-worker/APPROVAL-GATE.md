# Server-side approval gate (D1)

## Current Cloudflare deployment status

The Worker has been uploaded to the Cloudflare account as `appdigi-w001-backend`, and its `workers.dev` subdomain is enabled:

- Health endpoint: https://appdigi-w001-backend.dickv940.workers.dev/health
- D1 binding: `APPROVAL_DB` → database `appdigi-approvals`
- Allowed browser origin: `https://dickv940-star.github.io`
- Gemini model variable: `gemini-2.5-flash`
- Secrets still required: `APP_SHARED_TOKEN`, `APP_OWNER_TOKEN`, and `GEMINI_API_KEY`

The health endpoint is intended to be readable before secrets are configured. A successful upload is not yet proof that the full analysis and approval workflow works; test it after adding secrets. Publishing remains disabled.

## Configure required secrets safely

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/217f93e14f8b7ac177af17fad3af2c3e/workers-and-pages).
2. Select **Workers & Pages** → `appdigi-w001-backend` → **Settings** → **Variables and Secrets**.
3. Add three values as **Secrets**, not plain-text variables:
   - `APP_SHARED_TOKEN`: a long, random secret for trusted app/backend requests.
   - `APP_OWNER_TOKEN`: a different long, random secret for owner approval endpoints.
   - `GEMINI_API_KEY`: an API key generated in Google AI Studio.
4. Save/deploy the updated Worker. Do not send these secret values in chat, commit them to GitHub, or put the owner token in the public GitHub Pages app.
5. Open the health endpoint above. It should report `geminiConfigured`, `sharedTokenConfigured`, `approvalStoreConfigured`, and `ownerDecisionConfigured` as true. Never share the secret values in a screenshot.
6. Only after that, run the acceptance checks below with a trusted private client. Do not connect public frontend approval controls to the owner token.

This migration adds persistent approval records to the W001 Cloudflare Worker. It does **not** publish videos or connect social accounts. Publishing remains disabled until each platform integration is separately implemented and tested.

## Routes

All requests must use an allowed browser Origin and a bearer token.

- `POST /api/approvals` — `APP_SHARED_TOKEN`; creates a new immutable version in `PENDING_OWNER_APPROVAL`.
- `GET /api/approvals` — `APP_OWNER_TOKEN`; returns up to 100 recent records.
- `POST /api/approvals/{contentId}/decision` — `APP_OWNER_TOKEN`; JSON: `{"version":1,"decision":"approve|revise|reject","note":"optional"}`.
- `POST /api/publisher/validate` — `APP_SHARED_TOKEN`; checks exact content ID, version, fingerprint and full channel set. Returns `allowed: true` only for a currently approved exact package. This route validates only; it does not publish.
- `GET /health` — reports whether D1 and owner-decision configuration exist; does not reveal secrets.

Channel identifiers are `shopee_video`, `instagram`, and `youtube`. Approval is bound to product name, affiliate link, video URL, caption, and the complete selected channel set. Create a new version for any edit; the previous approval is not inherited.

## Configure D1

1. In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database** and create a database, for example `appdigi-approvals`.
2. Open its Console and run the SQL in `backend/cloudflare-worker/migrations/0001_approval_packages.sql`.
3. Open Worker `appdigi-w001-backend` → **Settings → Bindings**, add a D1 database binding named exactly `APPROVAL_DB`, and select the database.
4. Under **Settings → Variables and Secrets**, add secret `APP_OWNER_TOKEN` with a long, random value distinct from `APP_SHARED_TOKEN`. Keep both secrets private; never commit them or paste them into public issue/PR comments.
5. Deploy the Worker from the development branch only after reviewing the changes. Then call `GET /health` and confirm `approvalStoreConfigured` and `ownerDecisionConfigured` are true.

If using Wrangler, add the following binding to `wrangler.toml` after creating the database and substituting the real database ID:

```toml
[[d1_databases]]
binding = "APPROVAL_DB"
database_name = "appdigi-approvals"
database_id = "REPLACE_WITH_REAL_D1_DATABASE_ID"
```

Do not put secret token values in `wrangler.toml`; use Cloudflare secrets or `wrangler secret put APP_OWNER_TOKEN`.

## Security and limitations

- Current W001 authentication is a shared bearer token. This is a development gate, not a full end-user identity system. Anyone who obtains the owner token can make owner decisions; keep it private and rotate it if exposed.
- Ensure only the owner UI can access the owner token. Do not embed `APP_OWNER_TOKEN` in a public GitHub Pages frontend. Until a private owner interface or proper identity/OAuth layer exists, owner decision endpoints should be used only from a trusted private client.
- Browser localStorage is not authoritative; D1 is authoritative for these endpoints.
- The endpoint validates package integrity and channel equality, but a future publisher must call it server-to-server immediately before each channel action. Do not rely on client-side validation.
- The current API does not upload video, publish, authorize Shopee/Instagram/YouTube, or claim successful publication.
- Run acceptance checks after deployment. Code committed to GitHub is not proof of a live, tested backend.
