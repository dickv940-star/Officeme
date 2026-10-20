# Server-side approval gate (D1)

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
