# ICAIDIET'26 e-certificate engine

## How it works
```
Cloudflare Worker (backend/src/certificates.ts)          Render (this folder)
  claim: next authors ──────────────────────────────────▶ name  = "Mr./Mrs./Ms./Dr." + first + last name
         (only eligible papers, 4-digit ID allocated)      college = as the author entered it
                                                          engine.js prints exactly that on the template
  /:id/file ◀──────────────────────────── PDF ──────────  (style A_classic)
  checks name/college still match the database,
  saves to R2 bucket "certificates":
     <paper title> [<paper id>]/<certificate id> - <name>.pdf
  row -> READY (user portal, admin View Info, verifier)
```
- **Eligible:** paper not deleted, payment **APPROVED** by admin, and authors edited through
  **Edit Authors** and approved by the admin (`authors_finalised_at` set). One certificate per author.
- **Certificate ID:** `2026` + 4 random digits, e.g. `20264821` (Worker var `CERT_ID_DIGITS`).
- **No mismatch:** the name is printed with the author's own capitalisation, never re-cased or
  shortened. The title is always the one chosen in Edit Authors; a title typed inside the first or
  last name ("Dr.Lakshmi", "Mr.") is ignored. Such rows are flagged `title_typed_in_name_removed`.
- **Long colleges:** the font shrinks to fit the line (down to 10 pt). Longer ones are printed
  on two lines (8.5 → 7 pt) and flagged `college_two_lines`. Nothing is cut.
- Stop/restart any time: unfinished certificates keep their ID and are picked up again.

## Deploy (one time)
1. **Cloudflare** (in `backend/`):
   ```
   npx wrangler r2 bucket create certificates
   npx wrangler secret put CERTIFICATE_SECRET        # paste a long random string, keep it
   npx wrangler d1 migrations apply icaidiet_text_records --remote   # 0046 + 0047
   ```
2. **Render** → New → Web Service → connect the GitHub repo:
   - Root Directory `certificate-engine`, Runtime Node, Build `npm ci`, Start `npm start`, Instance Free
   - Environment: `API_URL` = Worker URL (no trailing slash), `CERTIFICATE_SECRET` = same string as step 1,
     `CERT_STYLE` = `A_classic`, `AUTO_RUN` = `true`, `NODE_VERSION` = `22`
   - Health check path `/`. (`render.yaml` here is a reference; follow the manual steps above.)
3. Put the Render URL in `backend/wrangler.toml` → `CERT_ENGINE_URL = "https://<app>.onrender.com"`,
   then `npm run deploy` in `backend/`.

The first time the Render service starts it generates every certificate that is waiting
(watch the Render **Logs** tab). `/status` is private; use the secret header shown below.

## Automatic generation
A certificate is generated when **both** are true: payment approved by the admin, and Edit Authors
done and approved by the admin. The Worker wakes the engine (`POST /run`) right after:
- the admin approves a payment,
- the admin approves an Edit Authors request, or edits the authors directly,
- every hour (cron), if any eligible author still has no certificate.

A sleeping free Render instance takes about a minute to start. It then starts a run by itself
(`AUTO_RUN`), so nothing is missed. If authors are edited again later, each author keeps their
certificate ID (matched by email) and the PDF is re-rendered. Certificates of authors removed
from a paper stop verifying.

Manual controls (header `X-Certificate-Secret: <secret>`):
```
curl -X POST https://<app>.onrender.com/run  -H "X-Certificate-Secret: <secret>"   # start now
curl https://<app>.onrender.com/status -H "X-Certificate-Secret: <secret>"       # progress
curl -X POST https://<app>.onrender.com/stop -H "X-Certificate-Secret: <secret>"   # stop
```
Admin token alternative: `POST /api/admin/certificates/generate` on the Worker.

## Fix one certificate
Correct the author in the database, then `POST /api/admin/certificates/<id>/regenerate`
(admin token) and call `/run` again. It is re-rendered with the same ID; the old R2 file is replaced.

## Worker endpoints
| Endpoint | Who | Purpose |
|---|---|---|
| `GET /api/certificates/mine` | signed-in author | my papers, every author + certificate status |
| `GET /api/certificates/:id/file?download=1` | signed-in author | download the PDF |
| `GET /api/admin/submissions/:id/certificates` | admin | View Info → Certificates |
| `GET /api/admin/certificates/:id/file` | admin | PDF web view |
| `GET /api/admin/certificates/stats` | admin | eligible / ready / pending |
| `POST /api/admin/certificates/:id/regenerate` | admin | re-render one certificate |
| `POST /api/admin/certificates/generate` | admin | wake the engine now |
| `GET /api/verify/:id` | public | name + college for the verifier portal |
| `POST /api/internal/certificates/claim`, `/:id/file`, `GET /stats` | engine (secret) | generation |

## Files
| File | |
|---|---|
| `engine.js` | draws name, college and certificate ID on `assets/template.jpg` → PDF (pdf-lib) |
| `generator.js` | claim → render → upload loop |
| `server.js` | Render web service (`/run`, `/status`, `/stop`) |
| `run.js` | one-shot run from the command line |
| `sample.js` | local samples from `sample-participants.json` (`--all` for every style) |
| `tools/` | font/template preparation and preview scripts (only to rebuild assets) |

Fonts are Google Fonts (SIL Open Font License), converted to static weights and cut down to Latin characters.
