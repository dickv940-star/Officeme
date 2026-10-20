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
