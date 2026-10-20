# W001 Cloudflare Worker acceptance checklist

Use only the migration branch until the owner explicitly approves a production merge.

## Static review
- [ ] No Gemini API key or shared token is present in source files.
- [ ] Frontend points to `/health` and `/api/analyze`; no Apps Script iframe remains in the W001 panel.
- [ ] CSV parsing and aggregate calculation happen locally in the browser.
- [ ] The frontend sends data only after the user presses the analysis button.
- [ ] Worker validates bearer token, origin, request size, product count, and numeric fields.

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

## Do not mark complete yet
The backend is not live merely because code exists in GitHub. Mark Gemini as verified only after the actual analysis call succeeds. Do not delete the old Apps Script project or merge to `main` until these checks pass and the owner approves.
