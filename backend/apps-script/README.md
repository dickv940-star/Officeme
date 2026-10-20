# W001 Gemini backend — Google Apps Script

Test-only backend for AI AFFILIATE by AppDIGI. GitHub Pages remains the frontend. The API key is stored in Apps Script **Script Properties**, never in HTML or GitHub.

## Files
- Code.gs — server-side request validation and Gemini API call.
- Bridge.html — origin-checked iframe bridge. It calls server functions with google.script.run, avoiding reliance on cross-origin fetch/CORS headers from ContentService.
- tests/w001-gemini-apps-script.html — test frontend with local CSV metrics and opt-in AI analysis.

## A. Create the Apps Script backend

1. Open https://script.google.com/home and create a **New project** named \`AI AFFILIATE W001 Backend\`.
2. Replace the default Code.gs with the contents of this folder's Code.gs.
3. Click **+** next to Files → **HTML**, name it exactly \`Bridge\`, then paste Bridge.html.
4. In Project Settings → Script Properties, add:
   - \`GEMINI_API_KEY\` = API key created in Google AI Studio (treat as secret)
   - \`APP_SHARED_TOKEN\` = a long, random token (at least 32 random characters)
   - \`ALLOWED_ORIGIN\` = \`https://dickv940-star.github.io\`
   - \`GEMINI_MODEL\` = \`gemini-2.5-flash\` (change only to a model available to your API key)
5. Do not paste the API key into Code.gs, Bridge.html, GitHub, or this chat.
6. Click Deploy → New deployment → select type **Web app**.
7. Execute as: **Me**. Access: choose the narrowest option that still permits the intended iframe to load (usually anyone with the link for a public GitHub Pages frontend). A public web-app URL is not itself authentication; the server also checks APP_SHARED_TOKEN.
8. Deploy and copy the URL ending in \`/exec\`. After code changes, manage deployments and deploy a new version.
9. The owner may need to authorize UrlFetchApp when prompted. The first real analysis call can surface an authorization prompt or an error if deployment permissions are incomplete.

## B. Configure the test page

1. Open \`tests/w001-gemini-apps-script.html\` locally for sample metrics, or publish the test branch to GitHub Pages using a separate test URL/workflow.
2. Enter the deployed Apps Script URL and the same APP_SHARED_TOKEN configured in Script Properties.
3. Click **Muat data contoh**. Expected: 3 products, 200 clicks, 11 orders, Rp39.000 commission, conversion 5.5%.
4. Click **Tes backend**. It should return configured booleans and model name, not secret values.
5. Click **Jalankan analisis Gemini**. The page reports success only if Apps Script returns a non-empty analysis from the real Gemini API. A local sample passing is not evidence of AI connectivity.

## Security and limits

- The shared token is a simple access gate, not Google-account login. Anyone who obtains it can call the backend. Rotate it if exposed.
- Do not put API keys/tokens in URL query parameters. The frontend asks for the shared token each session and does not save it.
- CORS/origin checks are not authentication by themselves. The iframe bridge checks exact parent origin and parent window.
- The backend sends only aggregate metrics and at most 30 top products, not the raw CSV. Product names are still sent to Google Gemini when the AI button is clicked; remove/anonymize names if sensitive.
- No direct Shopee login, scraping, publishing, or external account actions are implemented.
- Gemini free-tier availability, limits, and data-use terms depend on model, account, region, and current Google policy. Check https://ai.google.dev/gemini-api/docs/pricing before sending sensitive business data.
- Keep the change on the test branch; do not merge until sample and real API acceptance checks pass.
