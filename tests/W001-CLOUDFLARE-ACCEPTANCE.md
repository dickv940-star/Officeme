# W001 Cloudflare Worker acceptance checklist

Use only the migration branch until the owner explicitly approves a production merge.

## Static review
- [ ] No Gemini API key, shared token, or owner token is present in source files.
- [ ] Frontend points to `/health` and `/api/analyze`; no Apps Script iframe remains in the W001 panel.
- [ ] CSV parsing and aggregate calculation happen locally in the browser.
- [ ] The frontend sends data only after the user presses the analysis button.
- [ ] Worker validates bearer token, origin, request size, product count, and numeric fields.
- [ ] Approval endpoints fail closed if D1 or owner token is not configured.
- [ ] Owner decisions use `APP_OWNER_TOKEN`, distinct from `APP_SHARED_TOKEN`.
- [ ] Approval version is immutable; decision is limited to pending records.
- [ ] Publisher validation denies missing, rejected, revised, stale, mismatched-fingerprint, and mismatched-channel approvals.
- [ ] There is no actual publishing route; validation must not claim to publish.

## Approval API tests (after D1 setup)
- [ ] Create an approval package and verify status `PENDING_OWNER_APPROVAL`.
- [ ] Try to decide with the shared token instead of owner token; expect HTTP 401.
- [ ] Approve the exact pending version with owner token; expect `APPROVED`.
- [ ] Repeat a decision on the same version; expect HTTP 409.
- [ ] Validate exact fingerprint and complete channel set; expect `allowed: true`.
- [ ] Change fingerprint, version, or any channel; expect `allowed: false`.
- [ ] Revise/reject a pending version and confirm it cannot pass publisher validation.
- [ ] Create a new version after approval; confirm the new version starts pending and old version is not reused for changed content.
- [ ] Confirm requests fail closed when D1 binding is absent.

## Live checks after manual Cloudflare deployment
- [ ] Correct origin + correct token: `GET /health` returns `ok: true`.
- [ ] Missing or incorrect token returns HTTP 401.
- [ ] An unapproved browser origin is rejected.
- [ ] Missing `GEMINI_API_KEY` reports backend configuration issue without leaking secrets.
- [ ] Valid CSV with up to 30 products returns a real Gemini analysis.
- [ ] More than 30 products or malformed numeric metrics are rejected.
- [ ] Wrong token and Gemini errors do not reveal key/token values.
- [ ] Worker URL and model status display correctly in Orchestrator.
- [ ] GitHub Pages production URL remains unchanged during the test.

## Multi-channel approval gate
See [Multi-channel approval workflow](../docs/MULTI-CHANNEL-APPROVAL-WORKFLOW.md) and [server-side gate setup](../backend/cloudflare-worker/APPROVAL-GATE.md).

- [ ] QC pass sends content to `PENDING_OWNER_APPROVAL`, never directly to publishing.
- [ ] Approval screen shows exact video version, product, affiliate link, caption/disclosures, and selected channels.
- [ ] Owner can approve, request revision, or reject.
- [ ] Approval is bound to exact version and target channels; changing any approved field invalidates it.
- [ ] Publisher rejects jobs with missing, revoked, or mismatched approval.
- [ ] Each channel records independent result; failed/unavailable channels show manual action required.
- [ ] No channel is marked connected or published without a successful live authorization/publish test.
- [ ] Pinterest-sourced assets are not reused unless rights/permission are confirmed.
- [ ] Tests cover bypass attempts, stale approvals, post-approval edits, and partial publication failures.

## Do not mark complete yet
The backend is not live merely because code exists in GitHub. Mark Gemini or approval storage as verified only after the actual live checks pass. Do not delete the old Apps Script project or merge to `main` until these checks pass and the owner approves.
