# W001 sample acceptance checks

## Deterministic sample
- Botol Minum: 120 clicks, 8 orders, Rp24,000 commission
- Lampu Meja: 80 clicks, 2 orders, Rp10,000 commission
- Tas Lipat: 0 clicks, 1 order, Rp5,000 commission

Expected:
- productCount = 3
- clicks = 200
- orders = 11
- commission = 39000
- conversionRate = 5.5 (%)

## Backend security/contract
- GET /health returns configured booleans only, never secret values.
- POST /v1/w001/analyze without bearer token returns 401.
- Missing secrets return 503.
- Non-allowed Origin returns 403.
- Unknown endpoint returns 404.
- Request body larger than 80 KiB returns 413.
- More than 30 product rows are rejected.
- Gemini HTTP 429 returns a quota message; API key is never returned in error output.

## Honest readiness status
- Passing the static sample is not evidence that Gemini is connected.
- Ready means a real request returns ok: true, model, and non-empty analysis from Gemini.
