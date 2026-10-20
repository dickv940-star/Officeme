# AppDIGI W001 Cloudflare Worker

Backend replacement for the Google Apps Script integration. It keeps the Gemini key server-side and accepts the aggregate CSV metrics plus at most 30 products.

## Endpoints

- `GET /health` — requires `Authorization: Bearer <APP_SHARED_TOKEN>`.
- `POST /api/analyze` — same authorization; JSON body contains `metrics` and `products`.
- CORS defaults to `https://dickv940-star.github.io`. Set `ALLOWED_ORIGINS` to a comma-separated list if the actual frontend origin differs. Do not use a wildcard for a private application.

## Deploy without Google Apps Script

1. Open Cloudflare Dashboard → Workers & Pages → Create → Worker. Name it `appdigi-w001-backend`.
2. Deploy this directory's Worker code (or connect the existing GitHub repository using Workers Builds and set the root directory to `backend/cloudflare-worker`).
3. In the Worker settings, add **secret** `GEMINI_API_KEY` with your Gemini API key.
4. Add **secret** `APP_SHARED_TOKEN` with a long random value. Do not commit either secret to GitHub or paste them into chat.
5. Set the non-secret variables `GEMINI_MODEL=gemini-2.5-flash` and `ALLOWED_ORIGINS=https://dickv940-star.github.io`.
6. Deploy and copy the Worker URL, typically `https://appdigi-w001-backend.<your-subdomain>.workers.dev`.
7. Open the Orchestrator page in the migration branch, paste the Worker URL and the shared token, test health, then run an analysis with a small CSV.

## GitHub-connected deployment

Cloudflare Workers Builds can connect an existing GitHub repository and deploy on commits. Configure the Worker build's root directory as `backend/cloudflare-worker`. Use a non-production branch for initial verification. Never set production deployments to run from this migration branch until the owner explicitly approves.

## Local checks

The handler is dependency-free JavaScript for the Workers runtime. Validate:
- valid preflight from the configured origin returns 204;
- an unapproved origin returns 403;
- missing/wrong bearer token returns 401;
- authenticated `GET /health` returns model/configuration status;
- `POST /api/analyze` rejects invalid input and accepts no more than 30 products;
- successful Gemini calls return an analysis without returning the API key.

A successful health check only proves the Worker is reachable and configured. Gemini is verified only after a real analysis returns successfully.
