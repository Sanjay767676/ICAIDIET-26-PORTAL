# ICAIDIET'26 Certificate Verifier (verify.icaidiet26.tech)

Public page: enter a certificate ID (bottom-left of the e-certificate, e.g. `20264821`) and it
shows **Verified Participant of ICAIDIET'26** with the name and college printed on that
certificate. No sign-in. Direct links work: `https://verify.icaidiet26.tech/?id=20264821`.

This folder is a standalone Vite + React app with its own `package-lock.json`; it is not part
of the root npm workspaces, so it deploys on its own.

## Deploy on Vercel
1. Vercel → **Add New… → Project** → import the GitHub repo.
2. **Root Directory**: `verifier-portal`. Framework preset: **Vite** (build `npm run build`,
   output `dist` — detected automatically).
3. **Environment Variables**: `VITE_API_URL` = your Cloudflare Worker URL (no trailing slash),
   for Production (and Preview if you use it). Deploy.
4. Project → **Settings → Domains** → add `verify.icaidiet26.tech`.
5. At the DNS provider of `icaidiet26.tech`, add the record Vercel shows for that domain — a
   **CNAME** with name `verify` pointing to the target Vercel gives (e.g. `cname.vercel-dns.com`
   or a project-specific `…vercel-dns-0xx.com`). If the DNS is on Cloudflare, set that record to
   **DNS only** (grey cloud). Vercel issues the HTTPS certificate once the record resolves.
6. Open `https://verify.icaidiet26.tech/?id=<a real certificate ID>` to check.

The Worker already allows this origin (`ALLOWED_ORIGINS` in `backend/wrangler.toml`). If you
use a different domain, add it there and redeploy the Worker.

`VITE_VERIFY_URL` in the **user portal** is optional. The PDF already contains the certificate
ID, so you can share the verifier URL separately. Set `VITE_VERIFY_URL` only if you also want a
clickable **Verify** link next to the ID in "View My Certificates"; when it is unset, that link
is hidden.

## Local
```
cp .env.example .env    # set VITE_API_URL
npm install
npm run dev             # http://localhost:5177
```

API used: `GET /api/verify/:id` (`backend/src/certificates.ts`, rate-limited to 30 lookups/min per IP).
