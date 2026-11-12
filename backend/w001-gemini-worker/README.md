# W001 Gemini backend test — AI AFFILIATE by AppDIGI

This is a test-only integration. It does not change the production index.html and does not access Shopee accounts or publish content.

## Architecture

- tests/w001-gemini.html: CSV parser and deterministic metrics run in the browser.
- backend/w001-gemini-worker/src/index.js: Cloudflare Worker proxy to Gemini.
- Only aggregate metrics and up to 30 products are sent to the Worker, only after the user clicks the AI analysis button.
- The Gemini API key stays in a Cloudflare Worker Secret, never in browser code or this repository.
- The Worker also requires an APP_SHARED_TOKEN secret. Enter the same token in the test page.

## Create the Worker in Cloudflare Dashboard

1. Open Cloudflare Dashboard → Workers & Pages → Create → Worker.
2. Name it officeme-w001-gemini-test, create/deploy the starter Worker, then open Edit code.
3. Replace the starter code with the complete contents of src/index.js from this folder and deploy.
4. Open the Worker → Settings → Variables and Secrets.
5. Add plaintext variable ALLOWED_ORIGIN = https://dickv940-star.github.io. For local testing, use http://localhost:8000 instead. Do not use *.
6. Add plaintext variable GEMINI_MODEL = gemini-3.5-flash-lite.
7. Add Secret GEMINI_API_KEY using a key created in Google AI Studio.
8. Add Secret APP_SHARED_TOKEN using a long random token (at least 32 random characters). Keep it private; do not commit it or send it in chat.
9. Deploy the Worker again after adding variables/secrets.
10. Copy the Worker URL, e.g. https://officeme-w001-gemini-test.YOUR-SUBDOMAIN.workers.dev.

Official references:
- Cloudflare Worker secrets: https://developers.cloudflare.com/workers/configuration/secrets/
- Cloudflare environment variables: https://developers.cloudflare.com/workers/configuration/environment-variables/
- Gemini model list: https://ai.google.dev/gemini-api/docs/models
- Gemini pricing and free-tier limits: https://ai.google.dev/gemini-api/docs/pricing

## Test

1. Open tests/w001-gemini.html locally or through project GitHub Pages after this test branch is published.
2. Click Muat data contoh. Expected results: 3 products, 200 clicks, 11 orders, Rp39.000 commission, 5.5% orders/click.
3. Enter the Worker URL and click Tes koneksi backend.
4. Enter the same APP_SHARED_TOKEN configured as a Worker Secret, then click Jalankan analisis AI.
5. A successful real Gemini call shows the model name and generated analysis. If secrets are missing, the UI shows an error rather than claiming success.

## Security notes

- Never put GEMINI_API_KEY in HTML, GitHub Actions logs, Git history, or browser storage.
- The shared token is an MVP access gate, not full Google-account login. Anyone who receives it can call the API. Rotate it if exposed.
- CORS restricts browser origins but is not authentication by itself.
- No production files are changed by this branch. Do not merge until the deterministic sample and a real Gemini API request have been verified.
- Gemini free-tier eligibility, rate limits, and data-use terms vary by model, account, and region. Check the current Google AI Studio usage page before uploading business-sensitive data.
