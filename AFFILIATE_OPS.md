# AI TEAM — Shopee Affiliate Operations

## Operating contract
- Daily target: 10 content-task slots, using the Asia/Jakarta calendar.
- Goal: improve affiliate commission using observed performance, not guaranteed-income claims.
- The 10 slots are a queue, not a claim that 10 final videos have already been rendered or published.
- AI creates scripts, captions, hashtags, shot lists and fact-check reminders. It does not render a final video file.
- Every AI-generated package enters `NEEDS_HUMAN_REVIEW`. Only an explicit owner decision can set `APPROVED`.
- Publishing is manual. `PUBLISHED_MANUALLY` records the owner's confirmation; it does not upload to Shopee, Instagram or YouTube.
- Clicks, orders, sales and commissions are manual/CSV-entered data until a supported official integration is verified.
- The backend uses Workers AI only, with the existing 40-inference/day application guard. No paid provider fallback is added.

## API routes
All routes require `Authorization: Bearer APP_SHARED_TOKEN`, except public `GET /health`.
- `GET /api/ops/dashboard`: queue and aggregate analytics.
- `POST /api/ops/tasks` with `{"action":"seed_daily"}`: idempotently prepare ten slots for today.
- `POST /api/ops/tasks/:id`: save product details and topic.
- `POST /api/ops/tasks/:id/generate`: generate a content package; one Workers AI inference.
- `POST /api/ops/tasks/:id/decision`: owner token in `X-Owner-Token`, actions `approve`, `reject`, `revise`, or `mark_published` (the UI currently exposes approve/reject/manual-published).
- `POST /api/ops/tasks/:id/metrics`: append manual metrics and update aggregate task totals.

## Daily schedule
The Worker exports a `scheduled()` handler that idempotently creates ten task slots for the scheduled Asia/Jakarta date. A Cloudflare Cron Trigger must be configured separately for the Worker, e.g. `0 1 * * *` UTC (08:00 Jakarta). This repository branch does not itself configure a live Cloudflare trigger. Until one is configured and the Worker is deployed, use the dashboard button to prepare today's queue.

## Deployment / verification boundary
Changes are staged on `test/affiliate-ops-daily-queue` and must pass CI/review before merging or deploying. Do not deploy this branch to the production Worker without explicit approval. The dashboard does not claim to auto-publish, auto-render videos, or synchronize Shopee analytics.
