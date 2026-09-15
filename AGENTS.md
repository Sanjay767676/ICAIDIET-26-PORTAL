# Agent instructions — ICAIDIET'26 conference portal

Monorepo for the conference at `C:\Users\user\3D Objects\conference-portal`.
Contains `backend` (Cloudflare Worker: Hono + D1 + R2), `user-portal`, `admin-portal`, and `reviewer-portal`.

## "Deploy to Cloudflare"

Whenever the user says to deploy to Cloudflare, run BOTH steps from the `backend/` directory:

1. Apply any pending D1 migrations to the remote (production) database:
   `npx wrangler d1 migrations apply icai.diet_text_records --remote`
   (DB name per `backend/wrangler.toml` — `database_name = "icaidiet_text_records"`.)
2. Deploy the Worker code:
   `npm run deploy`

Never deploy the backend without applying pending migrations first, and vice versa —
the user expects both together on every "deploy to cloudflare" request.

## Notes
- Git pushes and Vercel deployments are done by the user; do not run them unless asked.
- Production Worker runs from `wrangler.toml` `[vars]` (e.g. `ALLOWED_ORIGINS`) + `wrangler deploy`; the Worker is NOT deployed via GitHub integrations.
- Frontend portals read `VITE_API_URL` (build-time env var) and must be configured in Vercel dashboard.