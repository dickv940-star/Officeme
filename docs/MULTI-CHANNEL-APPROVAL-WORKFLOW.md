# AI AFFILIATE by AppDIGI — Multi-channel approval workflow

## Product rule

**No video may be published until the owner explicitly approves that exact version and its channel-specific publishing package.** This is a hard gate, not a suggestion to the AI.

The owner remains the Shopee Affiliate account holder and the final decision-maker. The Orchestrator coordinates workers; it does not gain ownership of accounts or bypass platform authorization.

## End-to-end workflow

1. **Owner command / Director AI** — accept a natural-language request and create a campaign/task record.
2. **Data Analyst** — analyze only available and authorized Shopee Affiliate exports or API data; report missing fields and data freshness.
3. **Product Research** — rank candidate products using evidence, commission/performance data, trend signals where available, and video suitability. Do not invent metrics.
4. **Content Writer** — prepare a product brief, supported claims, script, hook, caption, hashtags, CTA, and affiliate link for each target channel.
5. **Video Editor** — create/edit a video using authorized product assets or properly licensed material. Pinterest may be used for discovery/reference; a pin is not automatically permission to download or republish it. Canva/CapCut actions must use supported and authorized integrations.
6. **QC** — check product identity, claims, disclosure requirements, asset rights, video quality, captions, links, and platform-specific package.
7. **Owner approval gate** — show the exact video preview plus product, caption, affiliate link, selected channels, and version identifier. Available decisions: Approve, Request revision, Reject.
8. **Marketing Publisher** — may publish only the exact approved version to the channels specifically approved. A changed video, caption, affiliate link, or target channel invalidates approval and returns the package to review.
9. **Publication receipt and analytics** — record channel, timestamp, returned platform ID/URL when available, outcome, and errors. Never claim publication succeeded without confirmation from the publishing integration.
10. **Feedback loop** — Data Analyst evaluates metrics when they are legitimately available and feeds learnings back to product research.

## Required state machine

`DRAFT → RESEARCHING → BRIEF_READY → EDITING → QC_REVIEW`

- QC failure: `REVISION_REQUIRED → EDITING`
- QC pass: `PENDING_OWNER_APPROVAL`
- Owner requests changes: `REVISION_REQUIRED`
- Owner rejects: `REJECTED`
- Owner approves exact version: `APPROVED`
- Only an approved, channel-matched version may enter `PUBLISH_QUEUED`
- Verified platform success: `PUBLISHED`
- API failure or unavailable publishing route: `PUBLISH_FAILED` or `MANUAL_ACTION_REQUIRED`

A task must never move from QC directly to publication. No timeout, retry, worker instruction, or model output may imply consent.

## Approval record and audit

For each approval store at minimum:
- campaign/content ID and immutable version ID or content hash;
- video asset reference;
- product ID/name and affiliate link;
- exact caption/hashtags/disclosure text;
- target channels;
- QC result and warnings;
- owner decision, timestamp, and optional revision notes;
- publisher result per channel and platform receipt where available.

Approval is invalid if any approved field changes. Keep secrets, session cookies, passwords, and OTPs out of logs and approval records.

## Channel behavior

- **Shopee Video:** use an official/authorized publishing path only if one is available for the user's account. Otherwise provide a ready-to-upload package and mark manual action required.
- **Instagram:** use supported Meta publishing APIs and eligible account types/permissions; otherwise mark manual action required.
- **YouTube:** use authorized YouTube upload integration/OAuth; do not assume account connection until a live test succeeds.
- Each channel is approved independently as part of the visible package. Partial success must be recorded per channel and must not be represented as full success.

## Security and operational requirements

- The owner retains account ownership and revokes integrations when needed.
- Prefer OAuth and least-privilege scopes; never request passwords or OTPs in chat.
- Separate development/test from production. Do not change `main` or publish a production deployment without explicit owner approval.
- Start with a simulated approval queue and tests. Only mark integrations connected after a real, successful authorization/health test.
- If any integration is unavailable, preserve the workflow and clearly expose the manual handoff rather than faking automation.

## Implementation acceptance criteria

- [ ] No publishing action can run without an explicit owner approval record.
- [ ] Approval binds to exact version, caption, affiliate link, and target channel(s).
- [ ] Any post-approval edit invalidates approval.
- [ ] Reject and request-revision paths work and are logged.
- [ ] Each platform has an independent status and receipt.
- [ ] Unavailable integrations are shown as manual action required.
- [ ] UI makes clear this workflow is not live until backend persistence and publishing integrations are implemented and tested.
