# Acceptance checks — Orchestrator Control Center

These checks apply to the frontend planning prototype in `orchestrator.html`.

- [ ] Page opens on desktop and mobile widths.
- [ ] Empty command shows a validation message and creates no plan.
- [ ] A CSV/data/commission request routes to Data Analyst and Quality Control.
- [ ] A content request routes to Content Writer and Quality Control.
- [ ] A Canva/design request marks Canva as unverified and says the design work is a brief until connection is verified.
- [ ] A Shopee/product request says CSV or approved official API is required.
- [ ] A publish/post/upload request is explicitly held for integration and Director approval.
- [ ] Plan generation does not send the command to external services.
- [ ] Clear resets command, plan, and task count.
- [ ] Service status defaults never claim Canva, Shopee Affiliate, Gemini, or Apps Script is connected.
- [ ] No secrets or API keys are embedded in the HTML.
- [ ] Existing `main` branch remains unchanged until explicit approval.

## Live CSV → Apps Script → Gemini panel
- [ ] CSV file selection parses product name, clicks, orders, and commission locally.
- [ ] Missing required columns are reported without sending any data.
- [ ] Backend test requires a user-provided URL and token; no token is stored in local storage or URL.
- [ ] Bridge URL appends `?bridge=1` and reports timeout/deployment errors clearly.
- [ ] Wrong token is rejected by Apps Script.
- [ ] Health result alone does not label Gemini as live/verified.
- [ ] Only a real non-empty Gemini analysis is displayed as a successful analysis.
- [ ] At most 30 products and aggregate metrics are sent; raw CSV is not sent.
- [ ] API key remains only in Apps Script Script Properties.
- [ ] Existing Apps Script `doGet(e)`, Index page, access logging, and email notifications are preserved.
