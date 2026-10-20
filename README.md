# AI AFFILIATE by AppDIGI

Private workspace for managing one Shopee Affiliate account with eight logical AI worker roles.

## Current milestone: UI prototype

- `index.html` is the first dashboard prototype.
- The command form creates an in-memory local task queue for interface testing only.
- No AI model, database, Shopee API, affiliate account, or external publishing action is connected yet.
- Never enter passwords, API keys, cookies, personal identifiers, or payout details into this prototype.

## Eight worker roles

1. Operations Manager
2. Product Researcher
3. Data Analyst
4. Trend Analyst
5. Content Creator
6. Video Planner
7. Campaign Strategist
8. Performance Auditor

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
