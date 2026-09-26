# ICAIDIET'26 — Codebase Notes

Working notes for this repo. Read this first, then the source. Deployment rules live in `AGENTS.md`
(they are not repeated here).

Last reviewed: commit `7590e6b` ("Update Industry Delegates author type to include Research Scholar").

---

## 1. Shape of the thing

npm workspaces monorepo, single root `package-lock.json`, no root scripts, no CI, no tests.

```
backend/          Cloudflare Worker — Hono 4 + D1 + R2. The entire API is ONE file.
user-portal/      React 19 + Vite 6 + Tailwind 4 + Clerk        → Vercel
admin-portal/     React 19 + Vite 6 + Tailwind 4, custom auth   → Vercel
reviewer-portal/  React 19 + Vite 6 + Tailwind 4, custom auth   → Vercel
backup/           raw production SQL dumps (gitignored)
```

| Package | Stack | Loc of source |
|---|---|---|
| `backend` | Hono 4.13 on workerd, `compatibility_date 2024-12-24`, TS strict | `src/index.ts` = 2,967 lines / 127 KB |
| `admin-portal` | React 19, Vite 6, Tailwind 4 (`@tailwindcss/vite`), lucide-react | `src/App.tsx` = 3,447 lines + `DownloadPanel.tsx` 347 |
| `reviewer-portal` | same, no extra deps | `src/App.tsx` = 1,275 lines |
| `user-portal` | same + `@clerk/react` + `@vercel/analytics` | `App` 138, `MySubmissions` 1,077, `SubmissionWizard` 763 |

**Local dev ports** (inferred from backend CORS defaults, `backend/src/index.ts:35-40`):
user `5173`, admin `5174`, reviewer `5175` (explicit in `reviewer-portal/vite.config.ts:15-16`),
worker `8787`.

**There is no router in any portal.** All three are single-URL `useState` view/tab machines
(`user-portal/src/App.tsx:9`, `admin-portal/src/App.tsx:2001`, `reviewer-portal/src/App.tsx:719`).
No deep-linking, no browser back support, no data library — plain `fetch` in components.

---

## 2. Backend architecture notes

### Routes are flat, registered directly on one `Hono` instance
No `app.route()`, no sub-apps, no `basePath`, no file-based routing, no `onError`/`notFound`.
Every handler wraps itself in try/catch and returns `{ success: false, error: 'Internal Server Error.' }`.
**All auth, mail, ZIP/XLSX generation, cron, validation and business rules live inline in `src/index.ts`**
as top-level functions/constants. There is no `routes/`, `lib/`, `services/` or `db/` layer.

### Middleware order (`src/index.ts`)
1. `:64` CORS on `*` — merges `DEFAULT_ALLOWED_ORIGINS` (4 localhost ports) with the `ALLOWED_ORIGINS` env var.
   Methods: GET, POST, PUT, DELETE, OPTIONS. **No PATCH.**
2. `:75` admin guard on `/api/admin/*` — skips OPTIONS + `/api/admin/login`; verifies HMAC token;
   rejects `reviewer:` subjects (403); requires a `users` row with `role='ADMIN'` (403).
3. Per-route: `requireClerkAuth` (`:214`) on 6 routes, `requireReviewerAuth` (`:917`) on 4 routes.
4. **Admin auth is redundantly re-checked inline in ~14 handlers** (e.g. `:330`, `:1569`, `:2191`, `:2933`).
   Defense-in-depth, but duplicated.

### API surface (all in `backend/src/index.ts`)

| Method | Path | Line | Purpose |
|---|---|---|---|
| GET | `/api/health` | 809 | unauthenticated liveness |
| GET | `/api/settings` | 2601 | **public** — whole settings map (maintenance + `registration_open`) |
| POST | `/api/admin/login` | 820 | 12h HMAC token; accepts bare `admin` → `admin@snsct.org` |
| POST | `/api/reviewer/login` | 867 | 12h token, `sub = reviewer:<id>`; 503 if reviewer maintenance |
| POST | `/api/users/sync` | 1187 | Clerk-authed (inline check); ensures `users` row exists |
| GET | `/api/users/me` | 1225 | legacy, no frontend caller |
| POST | `/api/users/profile` | 1258 | legacy, no frontend caller |
| POST | `/api/submissions` | 1315 | **create submission** (multipart, 3 PDFs, rate-limited 10/min) |
| GET | `/api/submissions/mine` | 1759 | author's own submissions + review + payment fields |
| POST | `/api/submissions/:id/files` | 1798 | replace files (revision round-trip) |
| POST | `/api/user/submissions/:id/payment-proof` | 2765 | upload proof to `PROOF_BUCKET` → `payment_status='PENDING'` |
| POST | `/api/user/submissions/:id/register` | 2834 | registration_type + author_type + UTR; requires proof; resets to PENDING |
| GET | `/api/reviewer/submissions` | 945 | all live submissions + this reviewer's saved review |
| GET | `/api/reviewer/submissions/:id/file` | 1025 | stream PDF inline from R2 |
| GET | `/api/reviewer/submissions/:id/review` | 1077 | saved review (no frontend caller) |
| POST | `/api/reviewer/submissions/:id/review` | 1105 | upsert decision; **also transitions submission status** |
| GET | `/api/admin/submissions` | 1567 | all live submissions, enriched |
| GET | `/api/admin/submissions/deleted` | 1632 | soft-deleted + 30-day `expired` flag |
| GET | `/api/admin/submissions/:id/file` | 1699 | stream PDF inline |
| DELETE | `/api/admin/submissions/:id` | 1971 | soft delete (`deleted_at`) |
| POST | `/api/admin/submissions/:id/recover` | 2008 | un-delete, preserves `created_at` |
| POST | `/api/admin/submissions/:id/status` | 2050 | restricted to `ALLOWED_SUBMISSION_STATUSES` (`:43`) |
| POST | `/api/admin/submissions/:id/enquired` | 2099 | toggle flag |
| POST | `/api/admin/submissions/:id/no-corrections` | 2143 | toggle flag — **no frontend caller** |
| PUT | `/api/admin/submissions/:id/authors` | 2187 | replace author list atomically, exactly one primary |
| GET | `/api/admin/users` | 2517 | **no frontend caller** |
| GET | `/api/admin/backup` | 2270 | full DB dump JSON + R2 manifest for both buckets |
| GET | `/api/admin/export/columns` | 2399 | 23 exportable columns + valid filters |
| POST | `/api/admin/export` | 2417 | filtered `.xlsx` |
| GET | `/api/admin/mail-templates` · POST · DELETE | 328 / 346 / 382 | template CRUD (POST upserts on supplied `id`) |
| POST | `/api/admin/mail/enqueue` | 400 | render per submission → `mail_logs` rows `status='queued'` |
| POST | `/api/admin/mail/process` | 486 | claim + send **exactly one**; returns `remaining` |
| GET | `/api/admin/submissions/:id/payment-proof` | 2890 | streams proof, falls back `PROOF_BUCKET` → `BUCKET` |
| POST | `/api/admin/submissions/:id/payment-status` | 2931 | APPROVED / REJECTED / PENDING |
| — | `scheduled` handler | 2960 | daily purge, cron `0 0 * * *` |

Response convention everywhere: `{ success: boolean, ..., error?: string }`.

---

## 3. Data model (D1, `icaidiet_text_records`)

22 migrations in `backend/migrations/`, `0001` → `0022`. All multi-step table rebuilds use
`PRAGMA defer_foreign_keys=on` + drop children before parents (see `0010`, `0014`, `0018`).

| Table | Key columns |
|---|---|
| `users` | `id`, `name`, `email` UNIQUE, `password_hash`, `role CHECK(USER\|ADMIN)`, timestamps |
| `user_profiles` | 1:1 via `user_id`; `institution/department/country/phone`; `clerk_id` (Clerk link) |
| `submissions` | see below — this is "the paper" |
| `submission_files` | `submission_id` CASCADE, `file_type CHECK(MANUSCRIPT\|SUPPORTING\|PLAGIARISM\|AI_PLAGIARISM)`, `storage_key`, `mime_type`, `file_size` |
| `authors` | `submission_id` CASCADE, `is_primary`, `first_name`, `last_name`, `phone`, `email`, `college` |
| `reviewers` | separate from `users`; `username` UNIQUE, `password_hash` |
| `reviews` | `UNIQUE(submission_id, reviewer_id)` ← **the upsert target**; `decision`, `feedback`, `resubmitted` |
| `settings` | key/value. `maintenance_*`, `registration_open` |
| `mail_templates` | `name`, `subject`, `body` |
| `mail_logs` | `submission_id` — **no FK**, so the cron deletes it manually |

`submissions` columns: `id`, `submission_code` (`SUB-<10 hex>`, UNIQUE), `title`, `abstract`, `keywords`,
`user_id` → users CASCADE, `status` CHECK, `created_at`, `updated_at`, `track`, `author_name`, `author_email`,
`paper_id` (CMT), `deleted_at`, `enquired`, `no_corrections`, `registration_type`, `payment_proof_url`
(**an R2 key, not a URL**), `utr_transaction_id`, `payment_status`, `payment_approved_at`,
`payment_submitted_at`, `author_type`.

**There is no `payments` table** — all payment/registration state is denormalized onto `submissions`.

### Statuses & decisions (the vocabulary to keep straight)
- `submissions.status`: `DRAFT, SUBMITTED, UNDER_REVIEW, REVISION_REQUIRED, ACCEPTED, REJECTED,
  READY_FOR_REGISTRATION, READY_FOR_CAMERA_READY` (CHECK).
- Admin can set **only 4** via `/status`: `SUBMITTED, UNDER_REVIEW, READY_FOR_REGISTRATION,
  READY_FOR_CAMERA_READY` (`ALLOWED_SUBMISSION_STATUSES`, `index.ts:43-48`; mirrored in
  `admin-portal/src/App.tsx:77`).
- `reviews.decision`: `ACCEPTED, ACCEPTED_WITH_MINOR_CHANGES, ACCEPTED_WITH_MAJOR_CHANGES, NOT_ACCEPTED`.
- Frontends display all 7 statuses but can only set 4 — that asymmetry is intentional, not a bug.

### D1 gotchas already handled
- **100-bound-parameter limit** → `chunkArray(ids, 50)` (`:125`) used for every `IN (...)`
  in author/review joins (`:418`, `:966`, `:1598`, `:1664`, `:2470`).
- Multi-write atomicity via `DB.batch([...])` everywhere it matters.

---

## 4. Auth — three parallel systems, no shared session layer

All tokens travel as `Authorization: Bearer <token>`. **No cookies, no session table, no CSRF surface.**

| Portal | Mechanism | Token subject | Storage |
|---|---|---|---|
| user | Clerk JWT, `verifyToken` from `@clerk/backend` (`:190`) | Clerk `sub` | never stored; `useAuth().getToken` |
| admin | hand-rolled 2-part token `base64url(payload).base64url(HMAC-SHA256)` (`:142`/`:157`), TTL 12h | `users.id` where `role='ADMIN'` | `sessionStorage['icaidiet_admin_token']` |
| reviewer | same token format | `"reviewer:" + reviewers.id` (`:902`) | `sessionStorage['icaidiet_reviewer_token']` |

The `reviewer:` prefix is the entire separation mechanism between the two custom systems: the admin
guard rejects it (`:88-90`), `requireReviewerAuth` requires it (`:927-929`).

`password_hash` is **unsalted SHA-256** (`:103-107`) compared with `!==` (`:844`, `:897`).
Clerk-managed users get the sentinel string `'clerk-managed'` (`:606`).
Default creds are baked in as hashes in migrations `0002` (admin) and `0011` (reviewer).
**Neither login endpoint is rate limited.**

Identity resolution for authors — `ensureUserForClerk` (`:581`): `user_profiles.clerk_id` join → email
fallback (`lower(email) = lower(?)`) → race-safe insert (`ON CONFLICT DO NOTHING` then re-SELECT, because
`/users/sync` and `/users/me` can fire concurrently). Identity is **always** derived from the verified
token, never from a client-supplied email.

---

## 5. Business workflows (where the code is)

**W1 Submission creation** — `index.ts:1315-1561`. rate-limit → maintenance gate → resolve user →
parse multipart (11 fields incl. `authors` JSON) → validate → generate UUID + `SUB-<hex>` code →
3× `BUCKET.put` → one `DB.batch` (submission + 3 files + N authors) → **on any failure, delete the
uploaded R2 keys** (`:1551`).

**W2 Review** — `index.ts:1105-1179`. Feedback is **mandatory unless decision is exactly `ACCEPTED`**.
`INSERT … ON CONFLICT(submission_id, reviewer_id) DO UPDATE` (also resets `resubmitted=0`) batched with
the status update. Status side-effect: `ACCEPTED → READY_FOR_REGISTRATION`, anything else → `UNDER_REVIEW`.
There is **no reviewer-assignment table** — the single reviewer account sees everything.

**W3 Revision round-trip** — `index.ts:1798-1963`. Files only (title/abstract/authors are immutable by
design). Uploads under a new timestamped key, updates the `submission_files` row, deletes the
superseded object, then one `DB.batch` that resets `enquired=0, no_corrections=0` and sets
`reviews.resubmitted=1` **only if an un-flagged review exists and its decision is not `ACCEPTED`**
(rationale in comments at `:1923-1931` — an accepted paper doing a final re-upload must stay in
`READY_FOR_REGISTRATION` and not bounce back to the reviewer).

**W4 Acceptance** — two paths: reviewer's review side-effect (W2) or admin `/status`. Admin list
surfaces the latest review via correlated subqueries (`:1586-1589`).

4. **Registration & payment** — `registrationEligible(env, id)` (backend `:2577`) requires
`settings.registration_open === 'true'` **and** (accepted review decision **or** accepted status).
Then: proof upload (`:2765`) → register with UTR (`:2834`) → admin approve/reject (`:2931`).
Re-uploading or re-registering **resets `payment_status` to `PENDING` and nulls `payment_approved_at`**
(`:2818`, `:2876`) — deliberate, so a declined paper can't silently reappear as approved.
`READY_FOR_REGISTRATION` / `READY_FOR_CAMERA_READY` is what the user portal gates the payment card on.

**Multi-paper authors (13 of 211 authors have >1 paper).** Both payment endpoints are addressed by
`submission id`, so a user with several accepted papers previously had no way to tell *which* paper a
given payment form belonged to. The user portal now shows a paper picker:
`isPayablePaper()` mirrors the backend's `registrationEligible` statuses (single source of truth — the
congrats card and the picker both call it), and `isStillPayable()` additionally drops papers whose
`payment_status` is `APPROVED` or `PENDING`, so **a paper leaves the list once money is against it** and
cannot be paid twice. `REJECTED` papers stay selectable so the author can correct and resubmit.
The picker is a `<select>` when more than one paper is payable, and a static "Paper being paid for"
label when the author has several papers but only one is payable — a one-option dropdown reads as broken.
Switching papers resets the form through the `resetKey` prop, not `key`, because of the missing React
types (see §7). No backend change was needed: `/api/submissions/mine` already returns everything the
picker needs.

**W6 Soft delete → recover → purge.** All read paths filter `deleted_at IS NULL`. Daily cron
`0 0 * * *` → `purgeExpiredDeleted` (`:2703`): 30-day cutoff, collects R2 keys from `submission_files`
**and** from `payment_proof_url` separately (proofs aren't in `submission_files`), batches the deletes
children-first, tries **both** buckets for proofs, swallows all errors so a purge failure can't fail
the cron.

**W7 Maintenance** — two independent switches surfaced by the public `GET /api/settings`:
`maintenance_user_*` (blocks `POST /api/submissions` `:1321` and `POST /api/submissions/:id/files`
`:1804` with **503**) and `maintenance_review_*` (blocks `POST /api/reviewer/login` `:869` with 503;
the reviewer frontend also **force-logs-out** on load, `reviewer-portal/src/App.tsx:799-825`).
`maintenance_{portal}_until` auto-expires if the timestamp has passed (`:2566`).
The legacy single `maintenance_mode` boolean is remapped onto `maintenance_user_enabled` (`:2628`).

**W8 Mail** — **client-paced queue**, not cron. `POST /mail/enqueue` renders per submission (recipient =
primary author, fallback `submissions.author_email`) and inserts `queued` rows in chunks of 50.
`POST /mail/process` claims exactly one row with a single
`UPDATE … WHERE id = (SELECT id … ORDER BY l.created_at LIMIT 1) RETURNING *`, marks it `sending`, sends,
writes `delivered`+`resend_id` or `failed`+`error`, and returns `remaining` so the admin browser can
pace at ~1/sec (Resend free-tier limit — rationale in comments at `:244`, `:484`).
Resend is called via raw `fetch` to `https://api.resend.com/emails`, no npm dep (`:236-240`).
Sends both `text` and `html`; `mailHtmlBody` turns `\n` into `<br/>` and passes `<b>/<i>/<u>` through
untouched, so HTML written in a template renders in the email.

**Template placeholders** — `MAIL_PLACEHOLDERS` (`:248`) is the single list, mirrored as clickable chips
by `admin-portal/src/components/MailField.tsx`; keep the two in step. Supported:
`{name} {paper_title} {paper_id} {submission_code} {track} {review_decision} {review_feedback}`.
`{paper_id}` falls back to `submission_code` when the author left the CMT ID blank.

`renderMailBody` uses **`split`/`join`, deliberately not `String.replace`** — replacement strings are
pattern-aware, so reviewer feedback containing `$&` or `$1` used to be silently mangled
(`"Use $& ..."` rendered as `"Use x ..."`, where `x` was the matched token). Never go back to
`.replace()` here without a function or a replacer callback.

Admin UI: the template body is a plain `<textarea>` plus a B/I/U toolbar and Ctrl+B/I/U shortcuts that
wrap the selection. `applyTag()` in `MailField.tsx` also *unwraps* a selection that is already exactly
`<b>…</b>`, so repeated presses cannot produce nested tags.

**W9 Export** — `EXPORT_COLUMNS` (`:2373`) is a fixed 23-entry `{id,label,pick}` list, explicitly
*no user-controlled SQL*. Filters validated against two allow-list Sets (`:2335`). `.xlsx` is generated
by a hand-rolled ZIP + OOXML writer (`:659-804`: `crc32`, `buildZip` with STORED entries, `generateXlsx`
with `inlineStr` cells) to avoid bundling a spreadsheet library.

---

## 6. Frontend notes

### Theme
Identical `@theme` token block in all three `src/index.css` (Tailwind 4 CSS-first config, no
`tailwind.config.js` anywhere):
`--color-brand-bg #fdf08a`, `--color-brand-card #ffbf00`, `--color-brand-text #000`, `--color-brand-accent #ffbf00`,
`--color-brand-footer #000`; `--font-serif "Libre Baskerville"`, `--font-sans "Plus Jakarta Sans","Inter"`.
Base layer applies the serif font to **all headings**. Only difference: user adds `marquee`,
admin/reviewer add `updated-pulse`.

### API base URL
Each portal hardcodes its own `const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'`
(`admin/src/App.tsx:5`, `admin/src/components/DownloadPanel.tsx:4`, `reviewer/src/App.tsx:4`,
`user/src/App.tsx:67`, `user/src/components/portal/MySubmissions.tsx:21`, plus 2 inline copies in
`SubmissionWizard.tsx`). **Silent failure mode: if `VITE_API_URL` is unset at build time, the app
ships pointing at localhost.** No `.env.example` exists.

### Admin portal tab membership logic (`App.tsx:2579-2624`) — non-obvious
- `submissions` = `status==='SUBMITTED' && payment_status!=='APPROVED'`
- `minorChanges` / `majorChanges` = matching `review_decision` && `payment_status!=='APPROVED'`
- `accepted` = `review_decision==='ACCEPTED'` **or** status in `{READY_FOR_REGISTRATION, READY_FOR_CAMERA_READY}`,
  excluding paid; sorted payment-info-first → newest `payment_submitted_at` → newest `created_at`
- `payments` = `payment_status==='APPROVED'`
- `duplicates` = **client-side** duplicate detection on lowercased/trimmed `title` appearing >1× (`:2611`)
- search spans **all** states, not just the current tab (commit `010a70b`)

40 `useState` hooks in `App.tsx`; 10 inline components; polls every **180 s**, tab-aware.
401 handling is **inconsistent**: `confirmDelete` (`:2501`) and `handleEnquiredToggle` (`:2543`) log out,
most other calls just surface `data.error`, and `PdfViewer`/`DownloadPanel` take an `onUnauthorized` prop.

### Reviewer portal
Tabs `pending` (no review) / `reviewed` (`decision==='ACCEPTED'`) / `notAccepted` (everything else).
`FeedbackModal` forces an explanation when *Not Accepted* is chosen. Polls every 180 s.
Centralized 401 → `handleLogout()` in `fetchSubmissions` (`:756`).

### User portal
`MySubmissions.tsx` holds the whole author feature set: status/decision/payment badges, review feedback
banner, `RegistrationForm` (`:194-599`), `EditFilesModal` (`:605-806`). **No polling** — My Submissions
loads on mount and on `getToken` change only, so status changes require a manual reload.
`REGISTRATION_FEES` (`:179-192`) and the early-bird cutoff `Oct 24` (`:171-177`) are **hardcoded in the
UI**, not served by the backend. Track select has a single hardcoded option (`:478`).

### Duplicated across all three (no shared package exists)
`API_URL` fallback (6 copies), `STATUS_META`/`statusBadge` (3 divergent copies), review-decision maps
(3 copies), `formatDate`/`formatDateTime`, `PdfViewer` + `FileView` interface, `FilterPanel` + `matchesSearch`,
`LoginScreen`, `Author`/`Submission` TS interfaces, `MAX_FILE_SIZE = 10MB`, `tsconfig.json`, `index.html`,
`main.tsx`. A `packages/portal-ui` workspace is the obvious de-duplication target.

---

## 7. Commands

```bash
npm install                      # root — single lockfile, all workspaces

# portals
cd user-portal      && npm run dev     # 5173
cd admin-portal     && npm run dev     # 5174
cd reviewer-portal  && npm run dev     # 5175
npm run build                          # -> dist/
npm run lint                           # == tsc --noEmit. This is the ONLY automated gate.
npm run preview
# DISABLE_HMR=true disables HMR + file watching (vite.config.ts)

# backend (from backend/)
npm run dev                            # wrangler dev src/index.ts
npm run deploy                         # wrangler deploy --minify
npx wrangler d1 migrations apply icaidiet_text_records --remote
```

No `test` script, no test runner, no ESLint/Prettier config, no `.github/`. Source contains
`// eslint-disable-next-line react-hooks/exhaustive-deps` comments even though ESLint isn't installed.
**Before any change: run `npm run lint` (tsc) in each touched portal.**

### `npm run lint` is far weaker than it looks — there are NO React types installed
`@types/react` is **not a dependency of any portal**, and `react@19.3.0` ships no `.d.ts` of its own.
`tsconfig.json` has `allowJs: true`, so `tsc` silently resolves `react` and `react/jsx-runtime` to the
plain `.js` files. Consequences:

- Every React API is `any` — `useState`, `React.FormEvent`, JSX intrinsic elements, all of it.
- `tsc` therefore only catches syntax errors and unresolvable *local* imports. It will **not** catch a
  wrong prop name, a bad hook usage, or a missing property on a component's props.
- Symptom seen in practice: passing `key` to a **custom** component is a type error
  (`Property 'key' does not exist`), because `JSX.IntrinsicAttributes` never gets merged. Work around
  it with an explicit `resetKey` prop + `useEffect` rather than relying on remount-by-key.
- `strict` is off in all three portals, so the little checking that does happen is shallow.

**`npm run build` (vite) is the only real frontend check** — it actually compiles the JSX.
Fixing this properly means adding `@types/react` + `@types/react-dom` as devDependencies and turning
on `strict`, which will surface a backlog of pre-existing errors. Treat that as its own task, not a
drive-by change.

---

## 8. Known issues / gotchas — check before you touch things

**No migration drift — the backup dump is misleading. RESOLVED, verified 2026-09-26.**
`backup/current_production_backup.sql` (dated 2026-09-22) shows `d1_migrations` applied only through
`0018_review_decisions.sql` (`sqlite_sequence` = 18), which suggests `0019`–`0022` are missing while the
code already depends on their columns. That is **not** the actual state. Verified against production:

- `npx wrangler d1 migrations list icaidiet_text_records --remote` → **"No migrations to apply!"**
  (all 22 applied).
- All 7 columns present on `submissions`: `registration_type`, `author_type`, `utr_transaction_id`,
  `payment_proof_url`, `payment_status`, `payment_approved_at`, `payment_submitted_at`.

The dump is just older than the last deploy. **Do not read drift into `backup/*.sql` — check the remote.**
The dump also contains two hand-made tables no migration creates (`users_bak_20260922`,
`submissions_bak_20260922`); those are real and live in production.

**`registration_open` has no migration seed** — it only exists because an admin set it. Production value
is currently `"true"` (verified 2026-09-26), so registration is open. On a **fresh/local** D1 the key is
absent ⇒ `!== 'true'` ⇒ registration reads as closed; a local dev DB must have it set manually.
It is read at `:2582`, written at `:2677`.

**`backend/worker-configuration.d.ts` is stale** (590 KB, `wrangler types` output). Missing
`PROOF_BUCKET`, `RESEND_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`; its `ALLOWED_ORIGINS` literal is
stale. Harmless only because `tsconfig` uses `@cloudflare/workers-types` and the real contract is the
`Bindings` interface at `index.ts:5-14`. Regenerate or ignore.

**`backend/wrangler.toml` is gitignored but present on disk** (as is `.example`, and `.example` is
outdated — no `PROOF_BUCKET`, no mail vars, no `[triggers]`/`[observability]`). Both ignore patterns are
in `.gitignore` (which also has a corrupt UTF-16 tail: `b a c k u p /`).

**No signed URLs anywhere.** All R2 reads are proxied through authenticated endpoints that stream
`object.body` with `Cache-Control: private, no-store`. Adding a public/signed-URL path would be a
deliberate security change.

**Rate limiting is per-isolate in-memory** (`:50`, `:617-630`), keyed on `c.get('clerkUserId')` with IP
fallback. Not durable, not globally consistent, bucket map is never pruned. Only on submit/edit — **not
on either login endpoint**.

**D1 rebuild migrations are the fragile ones.** `0007`, `0010`, `0014`, `0018` recreate tables to
widen a CHECK. Any new CHECK change will need the same copy/drop/rename dance; don't assume `ALTER`.

**Secrets.** `backend/.dev.vars` (gitignored) holds a real `AUTH_SECRET` and a Clerk **test** key.
Rotate if this tree is ever shared.

---

## 9. Conventions to follow

- Match the existing style: 2-space indent, single quotes, semicolons, explicit `async (c) =>` handlers,
  no `any` in new backend code (the existing `c: any` in the CORS helpers is a wart caused by
  `ALLOWED_ORIGINS` missing from `Bindings`).
- Backend: one `DB.batch` per logical unit; every uploaded R2 key tracked in `uploadedKeys` and deleted
  in the `catch`.
- Backend: hand-rolled validation inline. There is no Zod — keep it that way unless asked, and don't
  introduce a dependency casually (the Resend and XLSX code exists specifically to avoid deps).
- Frontend: `success`/`error` from the API is the only feedback channel, surfaced through
  `user-portal/src/components/Popup.tsx` (user) or `data.error` (admin/reviewer).
- New statuses: update the DB CHECK **and** `ALLOWED_SUBMISSION_STATUSES` (`:43`) **and** all three
  frontend `STATUS_META` copies.
- New decisions: update the `reviews` CHECK **and** all three `REVIEW_DECISION_META`/`DECISION_META` copies.
- Deploys: migrations then `npm run deploy`, both from `backend/` (see `AGENTS.md`). Vercel deploys and
  git pushes are the user's job.
