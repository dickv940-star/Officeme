# Orchestrator Control Center — AI AFFILIATE by AppDIGI

## What this adds
- A standalone `orchestrator.html` page for the Director command workflow.
- A local task planner that routes a command to relevant worker roles.
- A service-readiness panel that defaults external services to **not verified**.
- Explicit guardrails: no external API calls, account access, publishing, or data changes from this prototype.

## Preview
After this branch is deployed to GitHub Pages, open:
`https://dickv940-star.github.io/Officeme/orchestrator.html`

Until this branch is merged/deployed, the page is only available from the branch source or a local preview.

## Current limitations
This is a frontend planning prototype, not a live multi-agent runtime. It does not connect to Canva, Shopee Affiliate, Gemini, or Apps Script. The GitHub integration is represented as repository workflow status, not an account test from this page. Service statuses must not be marked connected until a real authenticated test succeeds.

## Next integration steps
1. Add a server-side orchestrator endpoint in the existing Apps Script project without overwriting the current `doGet()` HTML entry point.
2. Add authenticated worker wrappers and a bounded task schema.
3. Verify Gemini through a real server-side API call; keep the API key in Apps Script Script Properties.
4. Use a permitted Shopee Affiliate CSV upload first, unless official API access is confirmed.
5. Connect Canva through an authorized integration and verify create/read operations.
6. Add automated acceptance tests for routing, unavailable services, missing data, and approval-required actions.
7. Review the Pull Request before merging; do not deploy production changes automatically.
