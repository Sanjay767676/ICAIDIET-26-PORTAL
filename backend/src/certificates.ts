// ==================================================================
// ICAIDIET'26 participant e-certificates
//
// Who gets one: every author of a live paper whose payment the admin approved
// AND whose author list was edited by the author (Edit Authors) and approved by
// the admin (submissions.authors_finalised_at is set). One certificate per author.
//
// What is printed comes from here, never re-typed by the engine:
//   name    = <title chosen by the author: Mr./Mrs./Ms./Dr.> <first name> <last name>
//   college = the college the author entered
// The verifier shows exactly the same two strings.
//
// Generation runs on the certificate engine (Render):
//   POST /api/internal/certificates/claim        -> next authors (name, college, ID)
//   POST /api/internal/certificates/:id/file     -> upload the PDF -> R2 "certificates"
//   GET  /api/internal/certificates/stats        -> progress
// These need the X-Certificate-Secret header (wrangler secret CERTIFICATE_SECRET).
//
// R2 bucket "certificates" (binding CERT_BUCKET), one folder per paper:
//   <paper title> [<paper id>]/<certificate id> - <name>.pdf
//
// Authors (Clerk, user portal "View My Certificates"):
//   GET /api/certificates/mine                   -> my papers, every author + certificate status
//   GET /api/certificates/:id/file?download=1    -> the PDF (owner / co-author only)
//
// Admin (admin token, /api/admin/* guard in index.ts), used by View Info:
//   GET  /api/admin/submissions/:id/certificates -> authors + certificate status
//   GET  /api/admin/certificates/:id/file        -> the PDF inline (web view)
//   GET  /api/admin/certificates/stats
//   POST /api/admin/certificates/:id/regenerate  -> back to PENDING, same ID
//   POST /api/admin/certificates/generate         -> wake the engine now
//
// Public verifier portal:
//   GET /api/verify/:id                          -> name + college if genuine
//
// Certificate ID = "2026" + CERT_ID_DIGITS random digits (wrangler.toml, 4 -> 10,000 IDs).
//
// Automatic generation: triggerCertificateEngine() calls the engine's POST /run
// (CERT_ENGINE_URL) right after an admin approves a payment, approves Edit Authors,
// or edits authors, and again from the hourly cron while anything is left. Calling
// it only wakes Render; the engine starts a run by itself whenever it starts up
// and work is waiting, so a sleeping free instance still gets the job done.
//
// A certificate is valid only while its author row still exists. When authors are
// re-saved (new rows), a certificate is moved to the new row of the same email and
// re-rendered with the same ID; certificates of removed authors stop verifying.
// ==================================================================

import type { Hono } from 'hono';

type Env = {
  DB: D1Database;
  CERT_BUCKET: R2Bucket;
  CERTIFICATE_SECRET?: string;
  CERT_ID_DIGITS?: string;
  CERT_ENGINE_URL?: string; // Render URL of the certificate engine, e.g. https://icaidiet-certificate-engine.onrender.com
};

export type CertificateDeps = {
  rateLimit: (c: any, key: string, limit: number, windowMs: number) => boolean;
  requireClerkAuth: (c: any, next: () => Promise<void>) => Promise<any>;
  ensureUserForClerk: (c: any, clerkUserId: string, clerkEmail: string) => Promise<string>;
  isAuthorizedForSubmission: (
    env: any,
    submission: { id: string; user_id: string; author_email?: string },
    userId: string,
    clerkUserId: string,
    clerkEmail: string
  ) => Promise<boolean>;
};

const CERT_PREFIX = '2026';
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const ID_PATTERN = /^\d{5,12}$/;

// Paper qualifies: not deleted, payment approved by admin, authors edited + approved.
export const CERT_ELIGIBLE_SQL = `s.deleted_at IS NULL AND s.payment_status = 'APPROVED' AND s.authors_finalised_at IS NOT NULL`;

// A certificate counts only if its author row still exists (authors removed by
// Edit Authors lose theirs).
const CERT_VALID_JOIN = `JOIN authors ca ON ca.id = c.author_id`;

const TITLES: Record<string, string> = { mr: 'Mr.', mrs: 'Mrs.', ms: 'Ms.', miss: 'Ms.', dr: 'Dr.', prof: 'Prof.' };
const HONORIFIC_AT_START = /^(dr|mrs|mr|ms|miss|prof)\b\s*\.?\s*/i;
const squash = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * The printed name: the title chosen in Edit Authors + first name + last name, exactly
 * as entered (no re-casing). A title typed inside the first or last name is ignored,
 * so the certificate never reads "Dr. Dr. Lakshmi" or "Mrs. Dr. ...".
 */
export function certificateName(title: unknown, first: unknown, last: unknown): { name: string; adjusted: boolean } {
  let adjusted = false;
  let typedTitle = '';
  // Drop a title typed at the start of the first or the last name ("Dr.Lakshmi", "Mr.").
  const strip = (v: unknown) => {
    let part = squash(v);
    const m = part.match(HONORIFIC_AT_START);
    if (m) {
      typedTitle ||= TITLES[m[1].toLowerCase()] || '';
      part = part.slice(m[0].length).trim();
      adjusted = true;
    }
    return part;
  };
  const full = squash(`${strip(first)} ${strip(last)}`);
  // The title chosen in Edit Authors always wins; a typed one is used only if none was chosen.
  const chosen = TITLES[squash(title).replace(/\.$/, '').toLowerCase()] || '';
  const t = chosen || typedTitle;
  return { name: t ? `${t} ${full}` : full, adjusted };
}

export const certificateCollege = (college: unknown) => squash(college);

function idDigits(env: Env): number {
  const n = parseInt(env.CERT_ID_DIGITS || '4', 10);
  return Number.isFinite(n) && n >= 1 && n <= 8 ? n : 4;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomDigits(n: number): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 10 ** n).padStart(n, '0');
}

// Safe R2 path segment: keeps letters/numbers/spaces/basic punctuation.
function pathPart(v: string, max: number): string {
  return squash(String(v || '').replace(/[\\/:*?"<>|#%{}^~[\]`\u0000-\u001f]/g, ' ')).slice(0, max).trim() || 'untitled';
}

function r2KeyFor(row: { paper_title: string; paper_id: string; submission_id: string; cert_id: string; name: string }) {
  const pid = squash(row.paper_id);
  const paperRef = pid && pid.toUpperCase() !== 'NA' ? pid : row.submission_id.slice(0, 8);
  return `${pathPart(row.paper_title, 120)} [${pathPart(paperRef, 40)}]/${row.cert_id} - ${pathPart(row.name, 80)}.pdf`;
}

async function stats(env: Env) {
  const row = (await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM authors a JOIN submissions s ON s.id = a.submission_id WHERE ${CERT_ELIGIBLE_SQL}) AS eligible_authors,
       (SELECT COUNT(DISTINCT s.id) FROM submissions s WHERE ${CERT_ELIGIBLE_SQL}) AS eligible_papers,
       (SELECT COUNT(*) FROM certificates c ${CERT_VALID_JOIN} JOIN submissions s ON s.id = c.submission_id
         WHERE c.status = 'READY' AND ${CERT_ELIGIBLE_SQL}) AS ready,
       (SELECT COUNT(*) FROM certificates WHERE status = 'PENDING') AS pending`
  ).first()) as any;
  const remaining = Math.max(0, (row?.eligible_authors || 0) - (row?.ready || 0));
  return { ...row, remaining, id_digits: idDigits(env), id_capacity: 10 ** idDigits(env) };
}

// Every author of one paper with the certificate state, for the user portal and admin.
async function paperCertificates(env: Env, submissionId: string) {
  const sub = (await env.DB.prepare(
    `SELECT s.id, s.paper_id, s.title, s.payment_status, s.authors_finalised_at, s.deleted_at
     FROM submissions s WHERE s.id = ?`
  ).bind(submissionId).first()) as any;
  if (!sub) return null;
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.title, a.first_name, a.last_name, a.college, a.is_primary,
            c.cert_id, c.status AS cert_status, c.printed_name, c.printed_college, c.generated_at
     FROM authors a LEFT JOIN certificates c ON c.author_id = a.id
     WHERE a.submission_id = ?
     ORDER BY a.is_primary DESC, a.created_at, a.id`
  ).bind(submissionId).all();
  const paymentApproved = sub.payment_status === 'APPROVED';
  const authorsEdited = Boolean(sub.authors_finalised_at);
  return {
    submission_id: sub.id,
    paper_id: sub.paper_id,
    paper_title: sub.title,
    payment_approved: paymentApproved,
    authors_edited: authorsEdited,
    eligible: !sub.deleted_at && paymentApproved && authorsEdited,
    authors: ((results || []) as any[]).map((a) => {
      const ready = a.cert_status === 'READY';
      return {
        author_id: a.id,
        is_primary: a.is_primary === 1,
        name: ready ? a.printed_name : certificateName(a.title, a.first_name, a.last_name).name,
        college: ready ? a.printed_college : certificateCollege(a.college),
        cert_id: ready ? a.cert_id : null,
        status: ready ? 'READY' : a.cert_status === 'PENDING' ? 'GENERATING' : 'NOT_GENERATED',
        generated_at: ready ? a.generated_at : null,
      };
    }),
  };
}

async function streamPdf(env: Env, certId: string, download: boolean) {
  const row = (await env.DB.prepare(
    `SELECT c.r2_key FROM certificates c ${CERT_VALID_JOIN} WHERE c.cert_id = ? AND c.status = 'READY'`
  ).bind(certId).first()) as any;
  const obj = row?.r2_key ? await env.CERT_BUCKET.get(row.r2_key) : null;
  if (!obj) return null;
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="ICAIDIET26_Certificate_${certId}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/**
 * Wakes the certificate engine on Render and asks it to generate whatever is
 * waiting. Safe to call often: does nothing when CERT_ENGINE_URL is unset or no
 * eligible author is missing a certificate. Never throws.
 */
export async function triggerCertificateEngine(env: Env, reason = ''): Promise<void> {
  try {
    const url = (env.CERT_ENGINE_URL || '').trim().replace(/\/+$/, '');
    const secret = env.CERTIFICATE_SECRET || '';
    if (!url || secret.length < 16) return;
    // Something to do? (eligible authors without a READY certificate, incl. relinks)
    const todo = (await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM authors a JOIN submissions s ON s.id = a.submission_id
          WHERE ${CERT_ELIGIBLE_SQL}
            AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.author_id = a.id AND c.status = 'READY')) AS n`
    ).first()) as any;
    if (!todo?.n) return;
    // A sleeping free Render instance can take ~1 min to start. The request wakes it;
    // the engine then runs by itself on startup, so a timeout here is fine.
    await fetch(`${url}/run`, {
      method: 'POST',
      headers: { 'X-Certificate-Secret': secret },
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {});
    console.log(`certificate engine triggered (${reason || 'manual'}): ${todo.n} waiting`);
  } catch (e) {
    console.error('certificate engine trigger failed', e);
  }
}

export function registerCertificateRoutes(app: Hono<any>, deps: CertificateDeps) {
  // ---------------------------------------------------------------
  // Engine endpoints (server-to-server, shared secret)
  // ---------------------------------------------------------------
  app.use('/api/internal/certificates/*', async (c, next) => {
    const secret = (c.env as Env).CERTIFICATE_SECRET || '';
    if (secret.length < 16) return c.json({ success: false, error: 'CERTIFICATE_SECRET is not configured on the Worker.' }, 503);
    if (!timingSafeEqual(c.req.header('X-Certificate-Secret') || '', secret)) return c.json({ success: false, error: 'Unauthorized.' }, 401);
    return next();
  });

  app.get('/api/internal/certificates/stats', async (c) => c.json({ success: true, ...(await stats(c.env as Env)) }));

  // Hands the engine the next batch. PENDING rows from an earlier, interrupted run
  // come first (same IDs), then new eligible authors get an ID.
  app.post('/api/internal/certificates/claim', async (c) => {
    const env = c.env as Env;
    const body = (await c.req.json().catch(() => ({}))) as any;
    const limit = Math.min(Math.max(parseInt(body?.limit, 10) || 20, 1), 50);
    const now = new Date().toISOString();
    const cols = `a.id AS author_id, a.submission_id, s.paper_id, s.title AS paper_title, a.title, a.first_name, a.last_name, a.college, a.email`;

    // Authors re-saved by Edit Authors get new row IDs. Move each existing
    // certificate to the new row of the same email (same certificate ID) and queue
    // it for re-rendering with the current details.
    await env.DB.prepare(
      `UPDATE certificates
       SET author_id = (
             SELECT a.id FROM authors a
             WHERE a.submission_id = certificates.submission_id
               AND lower(trim(a.email)) = lower(trim(certificates.author_email))
               AND NOT EXISTS (SELECT 1 FROM certificates c2 WHERE c2.author_id = a.id)
             LIMIT 1),
           status = 'PENDING'
       WHERE coalesce(trim(author_email), '') <> ''
         AND NOT EXISTS (SELECT 1 FROM authors a WHERE a.id = certificates.author_id)
         AND EXISTS (
             SELECT 1 FROM authors a
             WHERE a.submission_id = certificates.submission_id
               AND lower(trim(a.email)) = lower(trim(certificates.author_email))
               AND NOT EXISTS (SELECT 1 FROM certificates c2 WHERE c2.author_id = a.id))`
    ).run();

    const rows = ((await env.DB.prepare(
      `SELECT c.cert_id, ${cols}
       FROM certificates c JOIN authors a ON a.id = c.author_id JOIN submissions s ON s.id = a.submission_id
       WHERE c.status = 'PENDING' AND ${CERT_ELIGIBLE_SQL}
       ORDER BY c.claimed_at LIMIT ?`
    ).bind(limit).all()).results || []) as any[];

    if (rows.length < limit) {
      const fresh = ((await env.DB.prepare(
        `SELECT ${cols}
         FROM authors a JOIN submissions s ON s.id = a.submission_id
         WHERE ${CERT_ELIGIBLE_SQL} AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.author_id = a.id)
         ORDER BY s.created_at, s.id, a.is_primary DESC, a.created_at, a.id
         LIMIT ?`
      ).bind(limit - rows.length).all()).results || []) as any[];

      if (fresh.length) {
        const digits = idDigits(env);
        const capacity = 10 ** digits;
        const used = new Set(
          (((await env.DB.prepare(`SELECT cert_id FROM certificates`).all()).results || []) as any[]).map((r) => r.cert_id)
        );
        if (used.size + fresh.length > capacity * 0.9) {
          return c.json({ success: false, error: `Certificate IDs with ${digits} digits are almost used up (${used.size}/${capacity}). Raise CERT_ID_DIGITS.` }, 409);
        }
        for (const a of fresh) {
          let certId = '';
          for (let tries = 0; tries < 100_000 && !certId; tries++) {
            const candidate = CERT_PREFIX + randomDigits(digits);
            if (!used.has(candidate)) certId = candidate;
          }
          if (!certId) return c.json({ success: false, error: 'Could not allocate a certificate ID.' }, 500);
          const res = await env.DB.prepare(
            `INSERT OR IGNORE INTO certificates (cert_id, author_id, author_email, submission_id, paper_id, status, claimed_at)
             VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`
          ).bind(certId, a.author_id, squash(a.email), a.submission_id, a.paper_id || '', now).run();
          if (res.meta?.changes) {
            used.add(certId);
            rows.push({ cert_id: certId, ...a });
          }
        }
      }
    }

    const items = rows.map((r) => {
      const n = certificateName(r.title, r.first_name, r.last_name);
      return {
        cert_id: r.cert_id,
        author_id: r.author_id,
        submission_id: r.submission_id,
        paper_id: r.paper_id,
        paper_title: r.paper_title,
        name: n.name,
        college: certificateCollege(r.college),
        notes: n.adjusted ? ['title_typed_in_name_removed'] : [],
      };
    });
    return c.json({ success: true, items, ...(await stats(env)) });
  });

  // Engine uploads one rendered PDF (multipart: file, printed_name, printed_college, warnings).
  // The name/college are recomputed from the database and must match what the engine
  // printed, so a certificate can never disagree with the author record.
  app.post('/api/internal/certificates/:certId/file', async (c) => {
    const env = c.env as Env;
    const certId = c.req.param('certId');
    if (!ID_PATTERN.test(certId)) return c.json({ success: false, error: 'Bad certificate ID.' }, 400);
    const row = (await env.DB.prepare(
      `SELECT c.cert_id, c.r2_key AS old_key, a.submission_id, a.title, a.first_name, a.last_name, a.college, s.paper_id, s.title AS paper_title
       FROM certificates c JOIN authors a ON a.id = c.author_id JOIN submissions s ON s.id = a.submission_id
       WHERE c.cert_id = ?`
    ).bind(certId).first()) as any;
    if (!row) return c.json({ success: false, error: 'Unknown certificate ID — claim it first.' }, 404);

    const form = await c.req.formData().catch(() => null);
    const file = form?.get('file') as unknown as File | null;
    const printedName = String(form?.get('printed_name') || '');
    const printedCollege = String(form?.get('printed_college') || '');
    const warnings = String(form?.get('warnings') || '').trim().slice(0, 300);
    if (!file || typeof (file as any).arrayBuffer !== 'function') return c.json({ success: false, error: 'file is required.' }, 400);

    const name = certificateName(row.title, row.first_name, row.last_name).name;
    const college = certificateCollege(row.college);
    if (printedName !== name || printedCollege !== college) {
      return c.json({ success: false, error: 'Printed name/college does not match the database. Claim again.' }, 409);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_PDF_BYTES) return c.json({ success: false, error: 'PDF too large.' }, 413);
    if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      return c.json({ success: false, error: 'Not a PDF.' }, 400);
    }

    const key = r2KeyFor({ paper_title: row.paper_title, paper_id: row.paper_id, submission_id: row.submission_id, cert_id: certId, name });
    await env.CERT_BUCKET.put(key, bytes, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { cert_id: certId, submission_id: row.submission_id },
    });
    if (row.old_key && row.old_key !== key) await env.CERT_BUCKET.delete(row.old_key).catch(() => {});
    await env.DB.prepare(
      `UPDATE certificates SET status = 'READY', printed_name = ?, printed_college = ?, warnings = ?, r2_key = ?, generated_at = ?,
              author_email = (SELECT email FROM authors WHERE authors.id = certificates.author_id)
       WHERE cert_id = ?`
    ).bind(name, college, warnings, key, new Date().toISOString(), certId).run();
    return c.json({ success: true, cert_id: certId, r2_key: key });
  });

  // ---------------------------------------------------------------
  // Author endpoints (Clerk)
  // ---------------------------------------------------------------
  app.get('/api/certificates/mine', deps.requireClerkAuth, async (c) => {
    try {
      const env = c.env as Env;
      const clerkUserId = (c as any).get('clerkUserId') as string;
      const clerkEmail = (((c as any).get('clerkEmail') as string) || '').trim();
      const userId = await deps.ensureUserForClerk(c, clerkUserId, clerkEmail);

      // Same ownership rule as GET /api/submissions/mine.
      const { results } = await env.DB.prepare(
        `SELECT s.id FROM submissions s
         WHERE s.deleted_at IS NULL
           AND (
             s.user_id = ?
             OR s.user_id IN (SELECT id FROM users WHERE email = ? || '@clerk.local')
             OR (trim(coalesce(?, '')) <> '' AND (
               lower(trim(s.author_email)) = lower(?)
               OR EXISTS (SELECT 1 FROM authors a WHERE a.submission_id = s.id AND lower(trim(a.email)) = lower(?))
             ))
           )
         ORDER BY s.created_at DESC`
      ).bind(userId, clerkUserId, clerkEmail, clerkEmail, clerkEmail).all();
      const papers = [];
      for (const r of (results || []) as any[]) {
        const p = await paperCertificates(env, r.id);
        if (p) papers.push(p);
      }
      return c.json({ success: true, papers });
    } catch (e) {
      console.error('certificates mine', e);
      return c.json({ success: false, error: 'Internal Server Error.' }, 500);
    }
  });

  app.get('/api/certificates/:certId/file', deps.requireClerkAuth, async (c) => {
    try {
      const env = c.env as Env;
      const certId = c.req.param('certId');
      if (!ID_PATTERN.test(certId)) return c.json({ success: false, error: 'Not found.' }, 404);
      const row = (await env.DB.prepare(
        `SELECT s.id, s.user_id, s.author_email
         FROM certificates c ${CERT_VALID_JOIN} JOIN submissions s ON s.id = c.submission_id
         WHERE c.cert_id = ? AND c.status = 'READY' AND ${CERT_ELIGIBLE_SQL}`
      ).bind(certId).first()) as any;
      if (!row) return c.json({ success: false, error: 'Not found.' }, 404);

      const clerkUserId = (c as any).get('clerkUserId') as string;
      const clerkEmail = (((c as any).get('clerkEmail') as string) || '').trim();
      const userId = await deps.ensureUserForClerk(c, clerkUserId, clerkEmail);
      if (!(await deps.isAuthorizedForSubmission(env, row, userId, clerkUserId, clerkEmail))) {
        return c.json({ success: false, error: 'Forbidden.' }, 403);
      }
      const res = await streamPdf(env, certId, c.req.query('download') === '1');
      return res || c.json({ success: false, error: 'Certificate file missing.' }, 404);
    } catch (e) {
      console.error('certificate file', e);
      return c.json({ success: false, error: 'Internal Server Error.' }, 500);
    }
  });

  // ---------------------------------------------------------------
  // Public verifier
  // ---------------------------------------------------------------
  app.get('/api/verify/:certId', async (c) => {
    if (!deps.rateLimit(c, 'cert-verify', 30, 60_000)) {
      return c.json({ success: false, error: 'Too many lookups. Please wait a minute.' }, 429);
    }
    const env = c.env as Env;
    const certId = String(c.req.param('certId') || '').replace(/\s+/g, '');
    if (!ID_PATTERN.test(certId)) return c.json({ success: true, verified: false }, 404);
    const row = (await env.DB.prepare(
      `SELECT c.cert_id, c.printed_name, c.printed_college
       FROM certificates c ${CERT_VALID_JOIN} JOIN submissions s ON s.id = c.submission_id
       WHERE c.cert_id = ? AND c.status = 'READY' AND ${CERT_ELIGIBLE_SQL}`
    ).bind(certId).first()) as any;
    if (!row) return c.json({ success: true, verified: false }, 404);
    return c.json({ success: true, verified: true, cert_id: row.cert_id, name: row.printed_name, college: row.printed_college });
  });

  // ---------------------------------------------------------------
  // Admin (guarded by the /api/admin/* middleware in index.ts)
  // ---------------------------------------------------------------
  app.get('/api/admin/certificates/stats', async (c) => c.json({ success: true, ...(await stats(c.env as Env)) }));

  app.get('/api/admin/submissions/:id/certificates', async (c) => {
    const p = await paperCertificates(c.env as Env, c.req.param('id'));
    if (!p) return c.json({ success: false, error: 'Submission not found.' }, 404);
    return c.json({ success: true, ...p });
  });

  app.get('/api/admin/certificates/:certId/file', async (c) => {
    const certId = c.req.param('certId');
    if (!ID_PATTERN.test(certId)) return c.json({ success: false, error: 'Not found.' }, 404);
    const res = await streamPdf(c.env as Env, certId, c.req.query('download') === '1');
    return res || c.json({ success: false, error: 'Certificate not generated yet.' }, 404);
  });

  // Admin: start generation now (also happens automatically on approvals + hourly).
  app.post('/api/admin/certificates/generate', async (c) => {
    const env = c.env as Env;
    if (!env.CERT_ENGINE_URL) return c.json({ success: false, error: 'CERT_ENGINE_URL is not set in wrangler.toml.' }, 503);
    c.executionCtx.waitUntil(triggerCertificateEngine(env, 'admin'));
    return c.json({ success: true, message: 'Certificate engine triggered.', ...(await stats(env)) });
  });

  app.post('/api/admin/certificates/:certId/regenerate', async (c) => {
    const env = c.env as Env;
    const res = await env.DB.prepare(`UPDATE certificates SET status = 'PENDING' WHERE cert_id = ?`).bind(c.req.param('certId')).run();
    if (!res.meta?.changes) return c.json({ success: false, error: 'Not found.' }, 404);
    c.executionCtx.waitUntil(triggerCertificateEngine(env, 'regenerate'));
    return c.json({ success: true, message: 'Queued. The engine re-renders it with the same ID.' });
  });
}
