import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { verifyToken as clerkVerifyToken } from '@clerk/backend';
import {
  findDuplicatePaymentGroups,
  findProofsNeedingScan,
  proofNeedsScan,
  scanProofOcr,
  stuckScanCutoff,
} from './paymentOcr';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  PROOF_BUCKET: R2Bucket;
  AUTH_SECRET: string;
  CLERK_SECRET_KEY: string;
  RESEND_API_KEY?: string;
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  // OCR.space key used to read text out of uploaded payment proofs so the
  // duplicate-payment check can spot a reused screenshot. Falls back to
  // OCR.space's public demo key when unset, so local dev needs no secret.
  OCR_SPACE_API_KEY?: string;
};

type Variables = {
  clerkUserId: string;
  clerkEmail: string;
  reviewerId: string;
};

type AppEnv = { Bindings: Bindings; Variables: Variables };

const app = new Hono<AppEnv>();

// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
};

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:8787',
];

// Statuses an admin may set from the dashboard. Values are stored in DB.
const ALLOWED_SUBMISSION_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'READY_FOR_REGISTRATION',
  'READY_FOR_CAMERA_READY',
]);

// ------------------------------------------------------------------
// Registration configuration (admin-editable)
//
// Fees, the early-bird cutoff and the bank details block are stored as one
// JSON document under the `registration_config` settings key so the admin and
// user portals read one source of truth and a save is a single atomic upsert.
//
// The values below are the fallback used when that key is absent (fresh or
// local D1) or cannot be parsed, which is why they duplicate migration
// 0023_registration_config.sql. Change one, change the other.
//
// Fee amounts are free-text display strings ('₹2,000') so an admin can enter
// exactly what authors should see; nothing here is ever summed or converted.
// `early_bird_until` is an INCLUSIVE calendar date (YYYY-MM-DD) on which early
// bird pricing still applies -- standard fees begin the day after.
const DEFAULT_REGISTRATION_CONFIG = {
  // Seed only. The live value is the `registration_config` settings row the
  // admin edits in the dashboard, and that always wins. This must be kept equal
  // to what the admin last saved, otherwise a transient settings-row problem
  // would silently revert pricing to a deadline the admin had already moved --
  // the exact failure this comment exists to prevent.
  //
  // Set by the admin in Registration & Fees. Do not hardcode a different date
  // here without also updating the settings row.
  early_bird_until: '2026-10-10',
  fees: {
    'Indian Author': {
      'Conference alone': { early: '₹2,000', standard: '₹2,500' },
      'Conference with Scopus proceedings': { early: '₹10,000', standard: '₹11,000' },
    },
    'Foreign Author': {
      'Conference alone': { early: '$350', standard: '$400' },
      'Conference with Scopus proceedings': { early: '$400', standard: '$500' },
    },
    'Industry Delegate/Research Scholar': {
      'Conference alone': { early: '₹2,500', standard: '₹3,000' },
      'Conference with Scopus proceedings': { early: '₹12,000', standard: '₹13,000' },
    },
  },
  bank: {
    account_number: '5904946502',
    ifsc: 'CBIN0281361',
    branch: 'Crosscut Road, CBE',
    beneficiary: 'SNSCT CH4 CS',
    bank_name: 'CENTRAL BANK OF INDIA',
  },
} as const;

type RegistrationFeeRow = { early: string; standard: string };
type RegistrationConfig = {
  early_bird_until: string;
  fees: Record<string, Record<string, RegistrationFeeRow>>;
  bank: Record<string, string>;
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getEnvOrigin(c: any): string {
  return (c.env.ALLOWED_ORIGINS as string) || '';
}

function corsOrigins(c: any): string[] {
  const extra = getEnvOrigin(c)
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED_ORIGINS, ...extra];
}

app.use('*', (c, next) => {
  const origin = corsOrigins(c);
  return cors({ origin, allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'], maxAge: 86400 })(c, next);
});

// ------------------------------------------------------------------
// Admin auth guard. Every /api/admin/* endpoint (except login) must
// present a token whose subject is an ADMIN user row. Reviewer tokens
// (subject `reviewer:<id>`) and look-alike HMAC tokens are rejected,
// so a reviewer can never read or mutate admin data.
// ------------------------------------------------------------------
app.use('/api/admin/*', async (c, next) => {
  if (c.req.method === 'OPTIONS' || c.req.path === '/api/admin/login') {
    return next();
  }
  const token = getBearer(c);
  if (!token) {
    return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
  }
  const verified = await verifyToken(c, token);
  if (!verified.ok) {
    return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  const subject = verified.subject || '';
  if (subject.startsWith('reviewer:')) {
    return c.json({ success: false, error: 'Forbidden. Admin access is required.' }, 403);
  }
  const admin = await c.env.DB.prepare(`SELECT id FROM users WHERE id = ? AND role = 'ADMIN'`)
    .bind(subject).first() as any;
  if (!admin) {
    return c.json({ success: false, error: 'Forbidden. Admin access is required.' }, 403);
  }
  return next();
});

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function chunkArray<T>(items: T[], size = 50): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function getAuthSecret(c: any): Promise<string> {
  const secret = c.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set. Configure it via wrangler secret put AUTH_SECRET.');
  }
  return secret;
}

// Sign the admin token (HMAC-SHA256). Payload = { exp, sub }.
async function signToken(c: any, subject: string, ttlSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ sub: subject, exp })));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(await getAuthSecret(c)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sig = base64UrlEncode(sigBuf);
  return `${payload}.${sig}`;
}

async function verifyToken(c: any, token: string): Promise<{ ok: boolean; subject?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false };
    const payload = parts[0];
    const sig = parts[1];
    if (!payload || !sig) return { ok: false };
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(await getAuthSecret(c)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(sig),
      new TextEncoder().encode(payload)
    );
    if (!valid) return { ok: false };
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return { ok: false };
    return { ok: true, subject: decoded.sub };
  } catch {
    return { ok: false };
  }
}

// ------------------------------------------------------------------
// Clerk JWT Verification (via @clerk/backend SDK)
// ------------------------------------------------------------------

async function verifyClerkJwt(c: Context<AppEnv>, rawToken: string): Promise<{ ok: boolean; userId?: string; email?: string }> {
  try {
    const token = (rawToken || '').trim();
    if (!token) return { ok: false };

    const secretKey = c.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.error('CLERK_SECRET_KEY is not configured.');
      return { ok: false };
    }

    const result = await clerkVerifyToken(token, { secretKey });
    return {
      ok: true,
      userId: result.sub,
      email: (result as any).email || (result as any).email_address || '',
    };
  } catch (err) {
    console.error('Clerk JWT verification failed:', err);
    return { ok: false };
  }
}

// ------------------------------------------------------------------
// Resolving the author's real email address
//
// The `clerkEmail` on the context is load-bearing: it is what the
// approved-email list is matched against, so a wrong or missing value here
// refuses authors the admin deliberately allowed.
//
// Clerk's DEFAULT session token carries only sub / iss / azp / exp / iat /
// nbf. An `email` claim appears only if the instance's JWT template was
// hand-edited to add one, so reading the claim alone makes `email` an empty
// string for every author on a stock instance -- and an empty string reads as
// "not on the list", which turns a correctly configured allowlist into a
// portal that turns away everyone. That is why the address is resolved here
// rather than assumed from the token.
//
// Order, cheapest first:
//   1. the token's own email / email_address claim, when the template has one
//   2. the users row already linked to this Clerk identity via
//      user_profiles.clerk_id
//   3. the Clerk Backend API, which is authoritative
//
// The @clerk.local address ensureUserForClerk synthesizes for identities that
// arrive with no address is a placeholder, not a real one, so it is never
// accepted here and never allowed to shadow a real address found later.
// ------------------------------------------------------------------

const CLERK_PLACEHOLDER_EMAIL_DOMAIN = '@clerk.local';

// Positive lookups are cached briefly to keep a burst of requests (wizard
// pre-check, then submit) to one Clerk call; failures are cached far shorter so
// a transient outage cannot keep a legitimate author locked out for long.
const CLERK_EMAIL_CACHE_TTL_MS = 10 * 60 * 1000;
const CLERK_EMAIL_NEGATIVE_CACHE_TTL_MS = 60 * 1000;
const clerkEmailCache = new Map<string, { email: string; expiresAt: number }>();

// Kept bounded so a long-lived isolate cannot accumulate one entry per visitor.
const CLERK_EMAIL_CACHE_MAX = 5000;

function normalizeResolvedEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email || !email.includes('@')) return '';
  if (email.toLowerCase().endsWith(CLERK_PLACEHOLDER_EMAIL_DOMAIN)) return '';
  return email;
}

async function clerkEmailFromBackendApi(env: Bindings, clerkUserId: string): Promise<string> {
  const cached = clerkEmailCache.get(clerkUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.email;

  let email = '';
  if (env.CLERK_SECRET_KEY) {
    try {
      const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`, {
        headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
      });
      if (res.ok) {
        const data: any = await res.json();
        const addresses: any[] = Array.isArray(data?.email_addresses) ? data.email_addresses : [];
        const primaryId = data?.primary_email_address_id;
        email = normalizeResolvedEmail(
          data?.primary_email_address?.email_address ||
            addresses.find((a: any) => a?.id === primaryId)?.email_address ||
            addresses[0]?.email_address ||
            data?.email ||
            data?.email_address
        );
      } else {
        console.error('Clerk user lookup failed:', res.status);
      }
    } catch (err) {
      console.error('Clerk user lookup error:', err);
    }
  } else {
    console.error('CLERK_SECRET_KEY is not configured; cannot resolve the author email.');
  }

  if (clerkEmailCache.size >= CLERK_EMAIL_CACHE_MAX) clerkEmailCache.clear();
  clerkEmailCache.set(clerkUserId, {
    email,
    expiresAt: Date.now() + (email ? CLERK_EMAIL_CACHE_TTL_MS : CLERK_EMAIL_NEGATIVE_CACHE_TTL_MS),
  });
  return email;
}

async function resolveClerkEmail(env: Bindings, clerkUserId: string, tokenEmail: string): Promise<string> {
  const fromToken = normalizeResolvedEmail(tokenEmail);
  if (fromToken) return fromToken;

  try {
    const row = await env.DB.prepare(
      `SELECT u.email FROM user_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.clerk_id = ? LIMIT 1`
    ).bind(clerkUserId).first() as any;
    const fromDb = normalizeResolvedEmail(row?.email);
    if (fromDb) return fromDb;
  } catch (err) {
    console.error('Linked-email lookup failed:', err);
  }

  return clerkEmailFromBackendApi(env, clerkUserId);
}

// Middleware: require Clerk auth
async function requireClerkAuth(c: Context<AppEnv>, next: () => Promise<void>) {
  const header = c.req.header('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Authentication required. Please sign in.' }, 401);
  }
  const token = header.slice('Bearer '.length).trim();
  const result = await verifyClerkJwt(c, token);
  if (!result.ok || !result.userId) {
    return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  // Attach identity to the context for downstream handlers. The email is the
  // verified address of THIS Clerk identity -- resolved server-side when the
  // token does not carry one, and never taken from the request body.
  c.set('clerkUserId', result.userId);
  c.set(
    'clerkEmail',
    await resolveClerkEmail(c.env as Bindings, result.userId, result.email || '')
  );
  return next();
}

function getBearer(c: any): string | null {
  const header = c.req.header('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

// ------------------------------------------------------------------
// Mail helpers (Resend). The Resend API is called directly via fetch —
// the `resend` npm package is a thin wrapper around this same REST
// endpoint, and calling it directly keeps the Worker dependency-free.
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Admin Endpoints — Mail templates + bulk mail queue
// The queue ships one email per API call so the client can pace it at
// ~1 email/second, matching the free-tier Resend rate limit.
// ------------------------------------------------------------------

// Placeholders available to mail templates. The admin UI renders this same
// list as clickable chips, so keep the two in step.
const MAIL_PLACEHOLDERS = [
  'name',
  'paper_title',
  'paper_id',
  'submission_code',
  'track',
  'review_decision',
  'review_feedback',
] as const;

function mailPlaceholderValue(key: string, sub: any): string {
  switch (key) {
    case 'name':
      return sub.recipient_name || sub.author_name || 'Author';
    case 'paper_title':
      return sub.title || '';
    case 'paper_id':
      return sub.paper_id || sub.submission_code || '';
    case 'submission_code':
      return sub.submission_code || '';
    case 'track':
      return sub.track || '';
    case 'review_decision':
      return sub.review_decision || '';
    case 'review_feedback':
      return sub.review_feedback || '';
    default:
      return '';
  }
}

// Replace {placeholder} tokens in a template with per-submission values.
// Uses split/join rather than String.replace so that reviewer feedback
// containing "$&" or "$1" is inserted literally instead of being treated
// as a replacement pattern.
function renderMailBody(text: string, sub: any): string {
  let out = text || '';
  for (const key of MAIL_PLACEHOLDERS) {
    out = out.split(`{${key}}`).join(mailPlaceholderValue(key, sub));
  }
  return out;
}

// Convert a template body written with simple HTML (e.g. <b>, <br>, <p>)
// into readable plain text so non-HTML clients still get sensible content.
function mailHtmlToText(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Wrap a template body into a minimal HTML document for Resend. Templates
// may use tags like <b>, <i>, <u>, <br>, <p>; bare line breaks are kept.
function mailHtmlBody(text: string): string {
  const content = (text || '').replace(/\n/g, '<br/>');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a">${content}</div>`;
}

async function sendViaResend(
  c: Context<AppEnv>,
  to: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = c.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, error: 'RESEND_API_KEY is not configured on the Worker.' };
  }
  const fromName = (c.env.MAIL_FROM_NAME as string) || 'ICAIDIET26';
  const fromEmail = (c.env.MAIL_FROM_EMAIL as string) || 'onboarding@resend.dev';
  const from = fromEmail.includes('<')
    ? fromEmail
    : `${fromName} <${fromEmail}>`;

  let res: globalThis.Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: mailHtmlToText(body),
        html: mailHtmlBody(body),
      }),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not reach the Resend API.' };
  }

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok || !data || !data.id) {
    const msg =
      data && (data.message || data.error)
        ? String(data.message || data.error)
        : `Resend error ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true, id: data.id };
}

// ------------------------------------------------------------------
// Admin Endpoints — Mail templates + bulk mail queue
// The queue ships one email per API call so the client can pace it at
// ~1 email/second, matching the free-tier Resend rate limit.
// ------------------------------------------------------------------

app.get('/api/admin/mail-templates', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    const { results } = await c.env.DB.prepare(
      `SELECT id, name, subject, body, created_at, updated_at
       FROM mail_templates ORDER BY created_at DESC`
    ).all();
    return c.json({ success: true, templates: results || [] });
  } catch (error) {
    console.error('Fetch mail templates error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

app.post('/api/admin/mail-templates', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    const body = await c.req.json().catch(() => null);
    const id = (body?.id || '').toString().trim();
    const name = (body?.name || '').toString().trim();
    const subject = (body?.subject || '').toString().trim();
    const text = (body?.body || '').toString().trim();

    if (!name || !subject || !text) {
      return c.json({ success: false, error: 'Name, subject and body are all required.' }, 400);
    }

    const now = new Date().toISOString();
    if (id) {
      await c.env.DB.prepare(
        `UPDATE mail_templates SET name = ?, subject = ?, body = ?, updated_at = ? WHERE id = ?`
      ).bind(name, subject, text, now, id).run();
      return c.json({ success: true, message: 'Mail template updated.', template: { id, name, subject, body: text, created_at: now, updated_at: now } });
    }

    const newId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO mail_templates (id, name, subject, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(newId, name, subject, text, now, now).run();
    return c.json({ success: true, message: 'Mail template created.', template: { id: newId, name, subject, body: text, created_at: now, updated_at: now } });
  } catch (error) {
    console.error('Save mail template error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

app.delete('/api/admin/mail-templates/:id', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    const id = c.req.param('id');
    await c.env.DB.prepare(`DELETE FROM mail_templates WHERE id = ?`).bind(id).run();
    return c.json({ success: true, message: 'Mail template deleted.' });
  } catch (error) {
    console.error('Delete mail template error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// Enqueue one queued mail per selected submission. Nothing is sent here —
// the client calls /mail/process repeatedly to send one per second.
app.post('/api/admin/mail/enqueue', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    const body = await c.req.json().catch(() => null);
    const ids: string[] = Array.isArray(body?.submission_ids) ? body.submission_ids.map((x: any) => String(x)) : [];
    const templateId = (body?.template_id || '').toString().trim();
    if (ids.length === 0) return c.json({ success: false, error: 'Please select at least one submission.' }, 400);
    if (!templateId) return c.json({ success: false, error: 'Please choose a mail template.' }, 400);

    const template = await c.env.DB.prepare(`SELECT id, subject, body FROM mail_templates WHERE id = ?`)
      .bind(templateId).first() as any;
    if (!template) return c.json({ success: false, error: 'Mail template not found.' }, 404);

    const now = new Date().toISOString();
    const chunks = chunkArray(ids, 50);
    const subResults = await Promise.all(
      chunks.map(async (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        const res = await c.env.DB.prepare(
          `SELECT id, submission_code, paper_id, title, track, author_name, author_email,
                  (SELECT decision FROM reviews r WHERE r.submission_id = submissions.id
                   ORDER BY r.updated_at DESC LIMIT 1) AS review_decision,
                  (SELECT feedback FROM reviews r WHERE r.submission_id = submissions.id
                   ORDER BY r.updated_at DESC LIMIT 1) AS review_feedback
           FROM submissions
           WHERE deleted_at IS NULL AND id IN (${placeholders})`
        ).bind(...chunk).all();
        return (res.results as any[]) || [];
      })
    );
    const subs = subResults.flat();
    const logStatements: D1PreparedStatement[] = [];
    let enqueued = 0;

    for (const s of subs) {
      const email = ((s.author_email || '') as string).trim();
      const primary = await c.env.DB.prepare(
        `SELECT first_name, last_name, email FROM authors
         WHERE submission_id = ? AND is_primary = 1 LIMIT 1`
      ).bind(s.id).first() as any;
      const recipientEmail = (primary?.email || email).trim();
      if (!recipientEmail) continue;

      const recipientName =
        [(primary?.first_name || '').trim(), (primary?.last_name || '').trim()].filter(Boolean).join(' ') ||
        s.author_name ||
        'Author';

      const subject = renderMailBody(template.subject, {
        recipient_name: recipientName,
        title: s.title,
        track: s.track,
        paper_id: s.paper_id,
        submission_code: s.submission_code,
        review_decision: s.review_decision,
        review_feedback: s.review_feedback,
      });
      const text = renderMailBody(template.body, {
        recipient_name: recipientName,
        title: s.title,
        track: s.track,
        paper_id: s.paper_id,
        submission_code: s.submission_code,
        review_decision: s.review_decision,
        review_feedback: s.review_feedback,
      });

      logStatements.push(
        c.env.DB.prepare(
          `INSERT INTO mail_logs
            (id, submission_id, template_id, recipient_name, recipient_email, paper_title, subject, body, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`
        ).bind(crypto.randomUUID(), s.id, templateId, recipientName, recipientEmail, s.title, subject, text, now, now)
      );
      enqueued++;
    }

    for (const chunk of chunkArray(logStatements, 50)) {
      await c.env.DB.batch(chunk);
    }
    return c.json({
      success: true,
      message: `${enqueued} mail${enqueued === 1 ? '' : 's'} queued. Sending ${enqueued === 1 ? 'it' : 'them'} now...`,
      enqueued,
    });
  } catch (error) {
    console.error('Enqueue mail error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// Send ONE queued mail (oldest first). Returns the remaining queue size
// so the client can keep calling until the queue is drained (~1/sec).
app.post('/api/admin/mail/process', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    const now = new Date().toISOString();

    // Atomically claim the oldest queued mail. A single UPDATE...RETURNING
    // means two concurrent /mail/process calls can never pick the same row
    // and send a duplicate email.
    const queued = await c.env.DB.prepare(
      `UPDATE mail_logs SET status = 'sending', updated_at = ?
       WHERE id = (SELECT id FROM mail_logs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1)
       RETURNING id, recipient_email, subject, body`
    ).bind(now).first() as any;

    if (!queued) {
      return c.json({ success: true, processed: false, remaining: 0 });
    }

    const result = await sendViaResend(c, queued.recipient_email, queued.subject, queued.body);

    if (result.ok) {
      await c.env.DB.prepare(
        `UPDATE mail_logs SET status = 'delivered', resend_id = ?, error = NULL, updated_at = ? WHERE id = ?`
      ).bind(result.id || null, new Date().toISOString(), queued.id).run();
    } else {
      await c.env.DB.prepare(
        `UPDATE mail_logs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`
      ).bind(result.error || 'Send failed.', new Date().toISOString(), queued.id).run();
    }

    const remaining = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM mail_logs WHERE status IN ('queued', 'sending')`
    ).first() as any;

    return c.json({
      success: true,
      processed: true,
      status: result.ok ? 'delivered' : 'failed',
      error: result.error || null,
      remaining: Number(remaining?.n || 0),
    });
  } catch (error) {
    console.error('Process mail queue error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// A profile is "complete" (submission-ready) when all required fields are filled.
function isProfileComplete(p: any): boolean {
  if (!p) return false;
  return ['institution', 'department', 'country', 'phone'].every(
    (k) => String(p[k] || '').trim() !== ''
  );
}

// Resolve a signed-in user's internal user row + profile.
// Strong link first (user_profiles.clerk_id), then fallback by email.
async function resolveUserProfile(
  c: Context<AppEnv>,
  clerkUserId: string,
  clerkEmail: string
): Promise<any | null> {
  const byClerk = await c.env.DB.prepare(
    `SELECT p.id AS profile_id, p.user_id, p.institution, p.department, p.country, p.phone, p.clerk_id,
            u.name, u.email
     FROM user_profiles p
     JOIN users u ON u.id = p.user_id
     WHERE p.clerk_id = ?`
  ).bind(clerkUserId).first() as any;
  if (byClerk) return byClerk;

  if (clerkEmail) {
    const user = await c.env.DB.prepare(`SELECT id, name, email FROM users WHERE lower(email) = lower(?)`)
      .bind(clerkEmail).first() as any;
    if (user) {
      const byUser = await c.env.DB.prepare(
        `SELECT p.id AS profile_id, p.user_id, p.institution, p.department, p.country, p.phone, p.clerk_id,
                u.name, u.email
         FROM user_profiles p
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?`
      ).bind(user.id).first() as any;
      if (byUser) return byUser;
    }
  }

  return null;
}

// Ensure a users row exists for a Clerk identity and return its internal id.
// No profile is required to submit a paper.
async function ensureUserForClerk(c: Context<AppEnv>, clerkUserId: string, clerkEmail: string): Promise<string> {
  // Legacy: previously-created users may be linked via user_profiles.clerk_id.
  const legacy = await c.env.DB.prepare(
    `SELECT user_id FROM user_profiles WHERE clerk_id = ? LIMIT 1`
  ).bind(clerkUserId).first() as any;
  if (legacy?.user_id) return legacy.user_id;

  // Email fallback for token-only identities: a synthesized per-Clerk address.
  const email = (clerkEmail || `${clerkUserId}@clerk.local`).trim().toLowerCase();

  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email) = ?`)
    .bind(email).first() as any;
  if (existing?.id) return existing.id;

  // A real address arrived for an identity that previously only ever had a
  // synthesized one. Rename that row rather than inserting a second row: the
  // placeholder's id is what their existing submissions point at via user_id,
  // so a fresh row would orphan them out of "My Submissions" and out of every
  // admin count that joins on user_id. The lookup is by the exact derived
  // placeholder string, so this can only ever touch a row this function made.
  const placeholder = `${clerkUserId}@clerk.local`;
  if (email !== placeholder) {
    try {
      const renamed = await c.env.DB.prepare(
        `UPDATE users SET email = ?, updated_at = datetime('now') WHERE email = ?`
      ).bind(email, placeholder).run();
      if ((renamed?.meta?.changes || 0) > 0) {
        const upgraded = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email) = ?`)
          .bind(email).first() as any;
        if (upgraded?.id) return upgraded.id;
      }
    } catch (err) {
      // The address can already belong to another row (the lookup above missed
      // it only in a race), and users.email is UNIQUE. Losing this race is not
      // an error: fall through, and the re-select below finds whichever row owns
      // the address. That author's own submissions stay visible either way via
      // the author_email fallback in /api/submissions/mine.
      console.error('Placeholder email upgrade failed:', err);
    }
  }

  // Race-safe: two concurrent requests (e.g. /users/sync + /users/me firing
  // together) can both miss the SELECT above. ON CONFLICT turns the second
  // INSERT into a no-op instead of failing with a unique-key error, then we
  // re-select the (now guaranteed) row.
  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = email.split('@')[0] || 'User';
  await c.env.DB.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'USER', ?, ?)
     ON CONFLICT(email) DO NOTHING`
  ).bind(userId, name, email, 'clerk-managed', now, now).run();

  const row = await c.env.DB.prepare(`SELECT id FROM users WHERE lower(email) = ?`)
    .bind(email).first() as any;
  return row!.id;
}

function clientIp(c: any): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown';
}

function rateLimit(c: any, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Key on the signed-in user when available so throttling follows the
  // user (not just their IP, which can change on mobile / NAT networks).
  const identity = (typeof c.get === 'function' && (c.get('clerkUserId') as string | undefined)) || clientIp(c);
  const fullKey = `${identity}:${key}`;
  const bucket = rateBuckets.get(fullKey);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(fullKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function validateFile(file: File): { ok: boolean; reason?: string } {
  if (!file || !file.name) return { ok: false, reason: 'No file uploaded.' };

  const lower = file.name.toLowerCase();
  const extEntry = Object.entries(ALLOWED_TYPES).find(([ext]) => lower.endsWith(ext));
  if (!extEntry) {
    return { ok: false, reason: 'Invalid file type. Only PDF (.pdf) files are accepted.' };
  }

  const allowedMimes = extEntry[1];
  const declaredType = (file.type || '').toLowerCase();
  if (declaredType && !allowedMimes.includes(declaredType)) {
    return { ok: false, reason: 'File content type does not match its extension.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, reason: 'File size must be 10MB or less.' };
  }

  return { ok: true };
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'document';
}

// ------------------------------------------------------------------
// Phone number validation
// A phone number is digits only, 5-15 digits long. Formatting characters
// (+, -, spaces, brackets) are stripped on the way in so legacy values
// like "87548 28766" normalise to "8754828766" instead of being rejected.
// ------------------------------------------------------------------
const PHONE_MIN_DIGITS = 5;
const PHONE_MAX_DIGITS = 15;
const PHONE_RULE = `${PHONE_MIN_DIGITS}-${PHONE_MAX_DIGITS} digits (numbers only, no +, - or spaces)`;

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
}

function isValidPhone(value: unknown): boolean {
  const digits = normalizePhone(value);
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

// ------------------------------------------------------------------
// Excel (.xlsx) generation — dependency-free OOXML + ZIP (stored).
// Lets the admin export submissions as a real .xlsx without shipping
// a heavy spreadsheet library to the Worker bundle.
// ------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipDateTime(): { time: number; date: number } {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

// Build a ZIP archive using STORED (uncompressed) entries — valid for
// text XML parts and keeps the writer dependency-free and fast.
function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { time, date } = zipDateTime();
  let offset = 0;

  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const sz = e.data.length;

    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true); // version needed
    lh.setUint16(6, 0x0800, true); // UTF-8 filenames
    lh.setUint16(8, 0, true); // method: stored
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, sz, true);
    lh.setUint32(22, sz, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    localParts.push(new Uint8Array(lh.buffer), name, e.data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, sz, true);
    ch.setUint32(24, sz, true);
    ch.setUint16(28, name.length, true);
    ch.setUint16(30, 0, true);
    ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true);
    ch.setUint16(36, 0, true);
    ch.setUint32(38, 0, true);
    ch.setUint32(42, offset, true);
    centralParts.push(new Uint8Array(ch.buffer), name);

    offset += 30 + name.length + sz;
  }

  const centralLen = centralParts.reduce((n, p) => n + p.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true);
  eocd.setUint16(6, 0, true);
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralLen, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true);

  const out = new Uint8Array(offset + centralLen + 22);
  let pos = 0;
  for (const p of localParts) { out.set(p, pos); pos += p.length; }
  for (const p of centralParts) { out.set(p, pos); pos += p.length; }
  out.set(new Uint8Array(eocd.buffer), pos);
  return out;
}

function xlsxColLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xlsxEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateXlsx(headers: string[], rows: string[][]): Uint8Array {
  const enc = new TextEncoder();
  const esc = xlsxEscape;

  const sheetCells = (vals: string[], rowNum: number) =>
    vals
      .map((v, i) => `<c r="${xlsxColLetter(i)}${rowNum}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`)
      .join('');

  let sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`;
  sheetXml += `<row r="1">${sheetCells(headers, 1)}</row>`;
  rows.forEach((r, i) => {
    sheetXml += `<row r="${i + 2}">${sheetCells(r, i + 2)}</row>`;
  });
  sheetXml += `</sheetData></worksheet>`;

  const parts = [
    { name: '[Content_Types].xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`) },
    { name: '_rels/.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`) },
    { name: 'xl/workbook.xml', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Submissions" sheetId="1" r:id="rId1"/></sheets></workbook>`) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheetXml) },
  ];

  return buildZip(parts);
}

// ------------------------------------------------------------------
// Health Check
// ------------------------------------------------------------------
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'ICAIDIET Cloudflare API',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------
// Admin Login (username: snsadmin, password: admin123)
// ------------------------------------------------------------------
app.post('/api/admin/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => null);
    const username = (body?.username || '').trim();
    const password = body?.password || '';

    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password are required.' }, 400);
    }

    // Accept either the username ("admin" -> admin@snsct.org) or a full email address.
    const email = username.includes('@')
      ? username.toLowerCase()
      : `${username.toLowerCase()}@snsct.org`;

    const stored = await c.env.DB.prepare(
      `SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = 'ADMIN'`
    ).bind(email).first() as any;

    if (!stored) {
      return c.json({ success: false, error: 'Invalid username or password.' }, 401);
    }

    const hash = await sha256Hex(password);
    if (hash !== stored.password_hash) {
      return c.json({ success: false, error: 'Invalid username or password.' }, 401);
    }

    const token = await signToken(c, stored.id, 60 * 60 * 12); // 12 hours

    return c.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: stored.id, name: stored.name, email: stored.email, role: stored.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Reviewer Login (username: icaidiet, password: review123)
// Verifies against the `reviewers` table and returns a 12h HMAC token.
// Reviewer tokens are signed with subject `reviewer:<id>`.
// ------------------------------------------------------------------
app.post('/api/reviewer/login', async (c) => {
  try {
    const maintenance = portalMaintenanceActive(await loadSettingsRecord(c.env as Bindings), 'review');
    if (maintenance.active) {
      return c.json(
        {
          success: false,
          error: 'The reviewer portal is under maintenance. Please try again later.',
          maintenance_until: maintenance.until,
        },
        503
      );
    }

    const body = await c.req.json().catch(() => null);
    const username = (body?.username || '').trim().toLowerCase();
    const password = body?.password || '';

    if (!username || !password) {
      return c.json({ success: false, error: 'Username and password are required.' }, 400);
    }

    const stored = await c.env.DB.prepare(
      `SELECT id, username, name, email, password_hash FROM reviewers WHERE username = ?`
    ).bind(username).first() as any;

    if (!stored) {
      return c.json({ success: false, error: 'Invalid username or password.' }, 401);
    }

    const hash = await sha256Hex(password);
    if (hash !== stored.password_hash) {
      return c.json({ success: false, error: 'Invalid username or password.' }, 401);
    }

    const token = await signToken(c, `reviewer:${stored.id}`, 60 * 60 * 12); // 12 hours

    return c.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: stored.id, username: stored.username, name: stored.name, email: stored.email },
    });
  } catch (error) {
    console.error('Reviewer login error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// Middleware: require a valid reviewer (non-admin) token.
async function requireReviewerAuth(c: Context<AppEnv>, next: () => Promise<void>) {
  const token = getBearer(c);
  if (!token) {
    return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
  }
  const verified = await verifyToken(c, token);
  if (!verified.ok) {
    return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  const subject = verified.subject || '';
  if (!subject.startsWith('reviewer:')) {
    return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  const reviewerId = subject.slice('reviewer:'.length);
  const reviewer = await c.env.DB.prepare(
    `SELECT id, username, name, email FROM reviewers WHERE id = ?`
  ).bind(reviewerId).first() as any;
  if (!reviewer) {
    return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  c.set('reviewerId', reviewer.id);
  return next();
}

// ------------------------------------------------------------------
// Reviewer: Get all live submissions with authors + any saved review.
// Requires reviewer Bearer token.
// ------------------------------------------------------------------
app.get('/api/reviewer/submissions', requireReviewerAuth, async (c) => {
  try {
    const reviewerId = c.get('reviewerId') as string;

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.abstract, s.track, s.status, s.author_name, s.author_email, s.created_at, s.deleted_at,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'MANUSCRIPT' LIMIT 1) AS manuscript_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'PLAGIARISM' LIMIT 1) AS plagiarism_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'AI_PLAGIARISM' LIMIT 1) AS ai_plagiarism_file
       FROM submissions s
       WHERE s.deleted_at IS NULL
       ORDER BY s.created_at DESC`
    ).all();

    const submissions = results as any[];
    let authorsBySubmission: Record<string, any[]> = {};
    let reviewsBySubmission: Record<string, any> = {};

    if (submissions.length > 0) {
      const ids = submissions.map((s: any) => s.id as string);
      const chunks = chunkArray(ids, 50);

      const [authorResults, reviewResults] = await Promise.all([
        Promise.all(
          chunks.map(async (chunk) => {
            const placeholders = chunk.map(() => '?').join(',');
            const res = await c.env.DB.prepare(
              `SELECT id, submission_id, is_primary, first_name, last_name
               FROM authors
               WHERE submission_id IN (${placeholders})
               ORDER BY is_primary DESC, created_at ASC`
            ).bind(...chunk).all();
            return (res.results as any[]) || [];
          })
        ),
        Promise.all(
          chunks.map(async (chunk) => {
            const placeholders = chunk.map(() => '?').join(',');
            const res = await c.env.DB.prepare(
              `SELECT id, submission_id, reviewer_id, decision, feedback, resubmitted, created_at, updated_at
               FROM reviews
               WHERE submission_id IN (${placeholders}) AND reviewer_id = ?`
            ).bind(...chunk, reviewerId).all();
            return (res.results as any[]) || [];
          })
        ),
      ]);

      authorsBySubmission = authorResults.flat().reduce((acc: any, a: any) => {
        const sid = a.submission_id;
        (acc[sid] = acc[sid] || []).push(a);
        return acc;
      }, {});

      reviewsBySubmission = reviewResults.flat().reduce((acc: any, r: any) => {
        acc[r.submission_id] = r;
        return acc;
      }, {});
    }

    const enriched = submissions.map((s: any) => ({
      ...s,
      authors: authorsBySubmission[s.id] || [],
      review: reviewsBySubmission[s.id] || null,
    }));

    return c.json({ success: true, submissions: enriched });
  } catch (error) {
    console.error('Reviewer fetch submissions error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Reviewer: Stream a submission file (paper or plagiarism report).
// Requires reviewer Bearer token.
// ------------------------------------------------------------------
app.get('/api/reviewer/submissions/:id/file', requireReviewerAuth, async (c) => {
  try {
    const submissionId = c.req.param('id');
    let docType = (c.req.query('type') || '').toUpperCase();
    if (!docType) docType = 'MANUSCRIPT';
    if (docType !== 'PLAGIARISM' && docType !== 'AI_PLAGIARISM' && docType !== 'MANUSCRIPT') {
      return c.json({ success: false, error: 'Unsupported file type requested.' }, 400);
    }

    const file = await c.env.DB.prepare(
      `SELECT storage_key, original_filename, mime_type FROM submission_files
       WHERE submission_id = ? AND file_type = ? LIMIT 1`
    ).bind(submissionId, docType).first() as any;

    if (!file) {
      return c.json({
        success: false,
        error:
          docType === 'PLAGIARISM'
            ? 'No plagiarism report found for this submission.'
            : docType === 'AI_PLAGIARISM'
            ? 'No AI plagiarism report found for this submission.'
            : 'No manuscript file found for this submission.',
      }, 404);
    }

    const object = await c.env.BUCKET.get(file.storage_key);
    if (!object) {
      return c.json({ success: false, error: 'The file could not be found in storage.' }, 404);
    }

    const mime = file.mime_type || 'application/octet-stream';
    const safeName = encodeURIComponent(file.original_filename || 'manuscript');

    return new Response(object.body, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename*=UTF-8''${safeName}`,
        'Content-Length': String(object.size),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Reviewer file stream error:', error);
    return c.json({ success: false, error: 'Could not load the file.' }, 500);
  }
});

// ------------------------------------------------------------------
// Reviewer: Get the saved review for a submission (if any).
// Requires reviewer Bearer token.
// ------------------------------------------------------------------
app.get('/api/reviewer/submissions/:id/review', requireReviewerAuth, async (c) => {
  try {
    const reviewerId = c.get('reviewerId') as string;
    const submissionId = c.req.param('id');

    const review = await c.env.DB.prepare(
      `SELECT id, submission_id, reviewer_id, decision, feedback, created_at, updated_at
       FROM reviews
       WHERE submission_id = ? AND reviewer_id = ? LIMIT 1`
    ).bind(submissionId, reviewerId).first() as any;

    if (!review) {
      return c.json({ success: true, review: null });
    }
    return c.json({ success: true, review });
  } catch (error) {
    console.error('Reviewer fetch review error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Reviewer: Save (upsert) the review decision + feedback for a paper.
// Requires reviewer Bearer token.
// Decision must be ACCEPTED, ACCEPTED_WITH_MINOR_CHANGES,
// ACCEPTED_WITH_MAJOR_CHANGES or NOT_ACCEPTED. Feedback is required
// for every decision except ACCEPTED.
// ------------------------------------------------------------------
app.post('/api/reviewer/submissions/:id/review', requireReviewerAuth, async (c) => {
  try {
    const reviewerId = c.get('reviewerId') as string;
    const submissionId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const decision = ((body?.decision || '').toString()).trim().toUpperCase();
    const feedback = ((body?.feedback || '') as string).trim();

    const VALID_DECISIONS = ['ACCEPTED', 'ACCEPTED_WITH_MINOR_CHANGES', 'ACCEPTED_WITH_MAJOR_CHANGES', 'NOT_ACCEPTED'];
    if (!VALID_DECISIONS.includes(decision)) {
      return c.json({ success: false, error: 'Please choose a review decision for this paper.' }, 400);
    }
    if (decision !== 'ACCEPTED' && !feedback) {
      return c.json({ success: false, error: 'Feedback is required when the paper is not fully accepted.' }, 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT id FROM submissions WHERE id = ? AND deleted_at IS NULL`
    ).bind(submissionId).first() as any;
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    // Reviewing a paper updates its workflow status:
    //   ACCEPTED -> READY_FOR_REGISTRATION (shown to user + admin)
    //   ACCEPTED_WITH_MINOR_CHANGES / ACCEPTED_WITH_MAJOR_CHANGES /
    //   NOT_ACCEPTED -> UNDER_REVIEW (author must revise; shown to user + admin)
    const nextStatus = decision === 'ACCEPTED' ? 'READY_FOR_REGISTRATION' : 'UNDER_REVIEW';

    const now = new Date().toISOString();

    // Atomic upsert (UNIQUE(submission_id, reviewer_id)) so concurrent
    // save attempts for the same paper never race to the INSERT.
    const reviewId = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      c.env.DB.prepare(
        `INSERT INTO reviews (id, submission_id, reviewer_id, decision, feedback, resubmitted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(submission_id, reviewer_id) DO UPDATE SET
           decision = excluded.decision,
           feedback = excluded.feedback,
           resubmitted = 0,
           updated_at = excluded.updated_at`
      ).bind(reviewId, submissionId, reviewerId, decision, feedback, now, now),
      c.env.DB.prepare(
        `UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?`
      ).bind(nextStatus, now, submissionId),
    ];
    await c.env.DB.batch(statements);

    return c.json({
      success: true,
      message:
        decision === 'ACCEPTED'
          ? 'Paper marked as Accepted and moved to Ready for Registration.'
          : decision === 'ACCEPTED_WITH_MINOR_CHANGES'
            ? 'Paper marked as Accepted with Minor Changes and feedback saved.'
            : decision === 'ACCEPTED_WITH_MAJOR_CHANGES'
              ? 'Paper marked as Accepted with Major Changes and feedback saved.'
              : 'Paper marked as Not Accepted and feedback saved.',
      review: {
        id: reviewId,
        submission_id: submissionId,
        reviewer_id: reviewerId,
        decision,
        feedback,
        resubmitted: 0,
        updated_at: now,
      },
    });
  } catch (error) {
    console.error('Reviewer save review error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Clerk: Ensure the user exists in our D1 database.
// Called by the frontend after Clerk sign-up/sign-in.
// Only creates the users row; the profile row is created when the
// user fills out their profile (POST /api/users/profile).
// ------------------------------------------------------------------
app.post('/api/users/sync', async (c) => {
  try {
    const header = c.req.header('Authorization') || '';
    if (!header.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Authentication required.' }, 401);
    }
    const clerkToken = header.slice('Bearer '.length).trim();
    const authResult = await verifyClerkJwt(c, clerkToken);
    if (!authResult.ok || !authResult.userId) {
      return c.json({ success: false, error: 'Invalid authentication token.' }, 401);
    }

    const clerkId = authResult.userId;
    const body = await c.req.json().catch(() => null);
    // Same resolution requireClerkAuth applies, so the row created here is keyed
    // to the author's real address rather than a synthesized placeholder that
    // could never match the approved-email list.
    const verifiedEmail = await resolveClerkEmail(
      c.env as Bindings,
      clerkId,
      authResult.email || ''
    );
    const email = (body?.email || verifiedEmail).trim().toLowerCase();
    const name = (body?.name || '').trim() || email.split('@')[0] || 'User';

    // SECURITY: resolve the internal user strictly from the verified Clerk
    // identity (clerk linkage / token email), never from client data.
    // Only the display name is enriched from the body; email is never
    // taken from the client to avoid hijacking rows or colliding users.
    const userId = await ensureUserForClerk(c, clerkId, verifiedEmail);

    await c.env.DB.prepare(
      `UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(name, userId).run();

    return c.json({ success: true, user_id: userId });
  } catch (error) {
    console.error('User sync error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// User: Get the signed-in user's profile + completeness status.
// Used for gating submissions and for the "My Profile" page.
// ------------------------------------------------------------------
app.get('/api/users/me', requireClerkAuth, async (c) => {
  try {
    const clerkUserId = c.get('clerkUserId') as string;
    const clerkEmail = (c.get('clerkEmail') || '').trim();

    const profile = await resolveUserProfile(c, clerkUserId, clerkEmail);

    return c.json({
      success: true,
      hasProfile: isProfileComplete(profile),
      profile: profile
        ? {
          id: profile.profile_id,
          user_id: profile.user_id,
          name: profile.name || '',
          email: profile.email || clerkEmail,
          institution: profile.institution || '',
          department: profile.department || '',
          country: profile.country || '',
          phone: profile.phone || '',
        }
        : null,
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// User: Create or update the signed-in user's profile.
// Submission is only allowed once this returns hasProfile = true.
// ------------------------------------------------------------------
app.post('/api/users/profile', requireClerkAuth, async (c) => {
  try {
    const clerkUserId = c.get('clerkUserId') as string;
    const tokenEmail = (c.get('clerkEmail') || '').trim();

    const body = await c.req.json().catch(() => null);
    const institution = (body?.institution || '').trim();
    const department = (body?.department || '').trim();
    const country = (body?.country || '').trim();
    const phone = normalizePhone(body?.phone);

    if (!institution || !department || !country || !phone) {
      return c.json({ success: false, error: 'All profile fields are required.' }, 400);
    }
    if (!isValidPhone(phone)) {
      return c.json({ success: false, error: `Phone number must be ${PHONE_RULE}.` }, 400);
    }

    const name = (body?.name || '').trim() || 'User';

    // SECURITY: identity must come from the verified Clerk token / clerk linkage,
    // never from client-supplied data. This prevents one user overwriting
    // another user's profile (and records) by passing in a victim email.
    const user = { id: await ensureUserForClerk(c, clerkUserId, tokenEmail), name };

    await c.env.DB.prepare(
      `UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(name, user.id).run();

    // Race-safe upsert on the unique user_id (also covers legacy rows).
    const now = new Date().toISOString();
    const profileId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO user_profiles (id, user_id, institution, department, country, phone, clerk_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         institution = excluded.institution,
         department = excluded.department,
         country = excluded.country,
         phone = excluded.phone,
         clerk_id = excluded.clerk_id,
         updated_at = excluded.updated_at`
    ).bind(profileId, user.id, institution, department, country, phone, clerkUserId, now, now).run();

    const saved = await c.env.DB.prepare(
      `SELECT p.id, p.user_id, p.institution, p.department, p.country, p.phone, u.name, u.email
       FROM user_profiles p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ?`
    ).bind(user.id).first() as any;

    return c.json({ success: true, hasProfile: true, profile: saved });
  } catch (error) {
    console.error('Save profile error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Submission eligibility (requires Clerk auth)
//
// The same decision POST /api/submissions makes, asked one step earlier.
//
// Without it, an author who is not exempt walks the whole three-step wizard,
// picks a file, uploads it, and only then is told the window is closed to them
// -- which reads as the allowlist not working rather than as a closed window.
// Asking the server up front means the portal can say so before any work is
// wasted, and it is the only place the answer can come from: the list itself is
// redacted from the public settings endpoint, so the client cannot work it out.
//
// Deliberately returns a 200 with canSubmit=false rather than the gate's own
// refusal status: this is a question, not an attempt. The list is NEVER
// included, only whether this one author matched it.
// ------------------------------------------------------------------
app.get('/api/submission-eligibility', requireClerkAuth, async (c) => {
  try {
    const settings = await loadSettingsRecord(c.env as Bindings);
    const email = (c.get('clerkEmail') || '').trim();
    const refusal = userPortalGate(settings, email, 'submit');
    const maintenance = portalMaintenanceActive(settings, 'user');

    return c.json({
      success: true,
      can_submit: refusal === null,
      // The resolved address, so an author can see which of their accounts the
      // allowlist is being matched against when it disagrees with them. This is
      // the caller's own address, not anyone else's.
      email,
      // Enough for the portal to render an accurate explanation without the
      // list itself.
      reason: refusal ? String((refusal.body as any).code || 'CLOSED') : '',
      message: refusal ? String((refusal.body as any).error || '') : '',
      paper_acceptance_open: paperAcceptanceOpen(settings),
      approved_list_active: approvedMailListEnabled(settings),
      maintenance_active: maintenance.active,
      maintenance_until: maintenance.until,
    });
  } catch (error) {
    console.error('Fetch submission eligibility error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Create Submission (requires Clerk auth)
// ------------------------------------------------------------------
app.post('/api/submissions', requireClerkAuth, async (c) => {
  try {
    if (!rateLimit(c, 'submit', 10, 60000)) {
      return c.json({ success: false, error: 'Too many submission attempts. Please try again later.' }, 429);
    }

    // Paper acceptance off shuts the portal to everyone except the addresses on
    // the admin's approved list. The Clerk email is available on the context
    // because requireClerkAuth already verified it, so no client-supplied
    // address is ever trusted here.
    const submitGate = userPortalGate(
      await loadSettingsRecord(c.env as Bindings),
      c.get('clerkEmail') || '',
      'submit'
    );
    if (submitGate) return c.json(submitGate.body, submitGate.status);

    const clerkUserId = c.get('clerkUserId') as string;
    const clerkEmail = (c.get('clerkEmail') || '').trim();

    // Every signed-in Clerk user may submit; no profile is required.
    const userId = await ensureUserForClerk(c, clerkUserId, clerkEmail);

    const formData = await c.req.parseBody();

    const paperId = (formData['paperId'] as string || '').trim();
    const title = (formData['title'] as string || '').trim();
    const abstract = (formData['abstract'] as string || '').trim();
    const track = (formData['track'] as string || '').trim();
    const authorName = (formData['authorName'] as string || '').trim();
    const authorEmail = (formData['authorEmail'] as string || '').trim();
    const keywords = (formData['keywords'] as string || '').trim();
    const file = formData['file'] as File;
    const plagiarismFile = formData['plagiarismFile'] as File;
    const aiPlagiarismFile = formData['aiPlagiarismFile'] as File;

    let authors: { first_name: string; last_name: string; phone: string; email: string; college: string }[] = [];
    try {
      const rawAuthors = (formData['authors'] as string || '').trim();
      if (rawAuthors) {
        const parsed = JSON.parse(rawAuthors);
        if (Array.isArray(parsed)) {
          authors = parsed.map((a: any) => ({
            first_name: String(a?.first_name || '').trim(),
            last_name: String(a?.last_name || '').trim(),
            phone: normalizePhone(a?.phone),
            email: String(a?.email || '').trim(),
            college: String(a?.college || '').trim(),
          }));
        }
      }
    } catch {
      return c.json({ success: false, error: 'Invalid authors data.' }, 400);
    }

    if (!title || !abstract || !track) {
      return c.json({ success: false, error: 'Missing required fields: title, abstract, and track are required.' }, 400);
    }
    if (!authorName || !authorEmail) {
      return c.json({ success: false, error: 'Primary author name and email are required.' }, 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (authors.length === 0) {
      return c.json({ success: false, error: 'At least one author with a valid phone number is required.' }, 400);
    }
    for (let i = 0; i < authors.length; i++) {
      const a = authors[i];
      if (!a.first_name || !a.last_name) {
        return c.json({ success: false, error: `Author ${i + 1}: first and last name are required.` }, 400);
      }
      if (!a.phone) {
        return c.json({ success: false, error: `Author ${i + 1}: a phone number is required.` }, 400);
      }
      if (!isValidPhone(a.phone)) {
        return c.json({ success: false, error: `Author ${i + 1}: phone number must be ${PHONE_RULE}.` }, 400);
      }
      if (!emailRegex.test(a.email)) {
        return c.json({ success: false, error: `Author ${i + 1}: a valid email address is required.` }, 400);
      }
      if (!a.college) {
        return c.json({ success: false, error: `Author ${i + 1}: a college/institution is required.` }, 400);
      }
    }

    if (!file) {
      return c.json({ success: false, error: 'A manuscript file is required.' }, 400);
    }
    const fileCheck = validateFile(file);
    if (!fileCheck.ok) {
      return c.json({ success: false, error: fileCheck.reason }, 400);
    }

    if (!plagiarismFile) {
      return c.json({ success: false, error: 'A plagiarism report file is required.' }, 400);
    }
    const plagCheck = validateFile(plagiarismFile);
    if (!plagCheck.ok) {
      return c.json({ success: false, error: `Plagiarism report: ${plagCheck.reason}` }, 400);
    }

    if (!aiPlagiarismFile) {
      return c.json({ success: false, error: 'An AI plagiarism report file is required.' }, 400);
    }
    const aiPlagCheck = validateFile(aiPlagiarismFile);
    if (!aiPlagCheck.ok) {
      return c.json({ success: false, error: `AI plagiarism report: ${aiPlagCheck.reason}` }, 400);
    }

    const submissionId = crypto.randomUUID();
    // Cryptographically unique code (crypto.randomUUID) — no collision risk
    // under concurrent submissions. The `submission_code` column is UNIQUE,
    // so a math-random based code could 500 the request under burst load.
    const submissionCode = `SUB-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
    const now = new Date().toISOString();
    const paperKey = `submissions/${submissionId}-PAPER-${sanitizeFilename(file.name)}`;
    const plagKey = `submissions/${submissionId}-PLAGIARISM-${sanitizeFilename(plagiarismFile.name)}`;
    const aiPlagKey = `submissions/${submissionId}-AI_PLAGIARISM-${sanitizeFilename(aiPlagiarismFile.name)}`;

    const uploadedKeys: string[] = [];
    try {
      await c.env.BUCKET.put(paperKey, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });
      uploadedKeys.push(paperKey);

      await c.env.BUCKET.put(plagKey, plagiarismFile.stream(), {
        httpMetadata: { contentType: plagiarismFile.type || 'application/octet-stream' },
      });
      uploadedKeys.push(plagKey);

      await c.env.BUCKET.put(aiPlagKey, aiPlagiarismFile.stream(), {
        httpMetadata: { contentType: aiPlagiarismFile.type || 'application/octet-stream' },
      });
      uploadedKeys.push(aiPlagKey);

      const batchStatements: D1PreparedStatement[] = [
        c.env.DB.prepare(
          `INSERT INTO submissions
            (id, submission_code, paper_id, title, abstract, keywords, track, author_name, author_email, user_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          submissionId,
          submissionCode,
          paperId,
          title,
          abstract,
          keywords || track,
          track,
          authorName,
          authorEmail,
          userId,
          'SUBMITTED',
          now,
          now
        ),
        c.env.DB.prepare(
          `INSERT INTO submission_files
            (id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          submissionId,
          'MANUSCRIPT',
          file.name,
          paperKey,
          file.type || 'application/octet-stream',
          file.size,
          now
        ),
        c.env.DB.prepare(
          `INSERT INTO submission_files
            (id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          submissionId,
          'PLAGIARISM',
          plagiarismFile.name,
          plagKey,
          plagiarismFile.type || 'application/octet-stream',
          plagiarismFile.size,
          now
        ),
        c.env.DB.prepare(
          `INSERT INTO submission_files
            (id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          submissionId,
          'AI_PLAGIARISM',
          aiPlagiarismFile.name,
          aiPlagKey,
          aiPlagiarismFile.type || 'application/octet-stream',
          aiPlagiarismFile.size,
          now
        ),
      ];

      authors.forEach((a, idx) => {
        batchStatements.push(
          c.env.DB.prepare(
            `INSERT INTO authors
              (id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            submissionId,
            idx === 0 ? 1 : 0,
            a.first_name,
            a.last_name,
            a.phone,
            a.email,
            a.college,
            now
          )
        );
      });

      await c.env.DB.batch(batchStatements);

      return c.json({
        success: true,
        message: 'Your paper has been submitted successfully.',
        submission_id: submissionId,
        submission_code: submissionCode,
      });
    } catch (dbError) {
      // Best-effort cleanup of any uploaded file(s) if the DB write failed.
      for (const k of uploadedKeys) {
        await c.env.BUCKET.delete(k).catch(() => { });
      }
      console.error('Submission DB error:', dbError);
      return c.json({ success: false, error: 'Could not save your submission. Please try again.' }, 500);
    }
  } catch (error) {
    console.error('Submission error:', error);
    return c.json({ success: false, error: 'Internal Server Error. Please try again.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Get all submissions (requires admin Bearer token)
// Only non-deleted submissions are returned.
// ------------------------------------------------------------------
app.get('/api/admin/submissions', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.abstract, s.track, s.status, s.author_name, s.author_email, s.created_at, s.updated_at, s.deleted_at, s.enquired, s.no_corrections, s.registration_type, s.author_type, s.payment_proof_url, s.utr_transaction_id, s.payment_status, s.payment_approved_at, s.payment_submitted_at, s.fee_amount, s.fee_tier,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'MANUSCRIPT' LIMIT 1) AS manuscript_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'PLAGIARISM' LIMIT 1) AS plagiarism_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'AI_PLAGIARISM' LIMIT 1) AS ai_plagiarism_file,
              (SELECT decision FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_decision,
              (SELECT feedback FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_feedback,
              (SELECT updated_at FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_updated_at,
              (SELECT resubmitted FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_resubmitted,
              (SELECT status FROM mail_logs l WHERE l.submission_id = s.id ORDER BY l.created_at DESC LIMIT 1) AS mail_status,
              (SELECT updated_at FROM mail_logs l WHERE l.submission_id = s.id ORDER BY l.created_at DESC LIMIT 1) AS mail_sent_at
       FROM submissions s
       WHERE s.deleted_at IS NULL
       ORDER BY s.created_at DESC`
    ).all();

    const submissions = results as any[];
    let authorsBySubmission: Record<string, any[]> = {};
    if (submissions.length > 0) {
      const ids = submissions.map((s: any) => s.id as string);
      const chunks = chunkArray(ids, 50);
      const authorResults = await Promise.all(
        chunks.map(async (chunk) => {
          const placeholders = chunk.map(() => '?').join(',');
          const res = await c.env.DB.prepare(
            `SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at
             FROM authors
             WHERE submission_id IN (${placeholders})
             ORDER BY is_primary DESC, created_at ASC`
          ).bind(...chunk).all();
          return (res.results as any[]) || [];
        })
      );
      authorsBySubmission = authorResults.flat().reduce((acc: any, a: any) => {
        const sid = a.submission_id;
        (acc[sid] = acc[sid] || []).push(a);
        return acc;
      }, {});
    }

    const enriched = submissions.map((s: any) => ({ ...s, authors: authorsBySubmission[s.id] || [] }));

    return c.json({ success: true, submissions: enriched });
  } catch (error) {
    console.error('Fetch error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Get soft-deleted submissions for the "Deleted Files" tab.
// ------------------------------------------------------------------
app.get('/api/admin/submissions/deleted', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.abstract, s.track, s.status, s.author_name, s.author_email, s.created_at, s.deleted_at, s.enquired, s.no_corrections,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'MANUSCRIPT' LIMIT 1) AS manuscript_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'PLAGIARISM' LIMIT 1) AS plagiarism_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'AI_PLAGIARISM' LIMIT 1) AS ai_plagiarism_file,
              (CASE WHEN s.deleted_at < ? THEN 1 ELSE 0 END) AS expired,
              (SELECT decision FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_decision,
              (SELECT feedback FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_feedback,
              (SELECT updated_at FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_updated_at
       FROM submissions s
       WHERE s.deleted_at IS NOT NULL
       ORDER BY s.deleted_at DESC`
    ).bind(cutoff).all();

    const submissions = results as any[];
    let authorsBySubmission: Record<string, any[]> = {};
    if (submissions.length > 0) {
      const ids = submissions.map((s: any) => s.id as string);
      const chunks = chunkArray(ids, 50);
      const authorResults = await Promise.all(
        chunks.map(async (chunk) => {
          const placeholders = chunk.map(() => '?').join(',');
          const res = await c.env.DB.prepare(
            `SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at
             FROM authors
             WHERE submission_id IN (${placeholders})
             ORDER BY is_primary DESC, created_at ASC`
          ).bind(...chunk).all();
          return (res.results as any[]) || [];
        })
      );
      authorsBySubmission = authorResults.flat().reduce((acc: any, a: any) => {
        const sid = a.submission_id;
        (acc[sid] = acc[sid] || []).push(a);
        return acc;
      }, {});
    }

    const enriched = submissions.map((s: any) => ({ ...s, authors: authorsBySubmission[s.id] || [] }));

    return c.json({ success: true, submissions: enriched });
  } catch (error) {
    console.error('Fetch deleted submissions error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Stream a submission file (paper or plagiarism report)
// Requires admin Bearer token. Use ?type=MANUSCRIPT (default) or ?type=PLAGIARISM.
// ------------------------------------------------------------------
app.get('/api/admin/submissions/:id/file', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');
    let docType = (c.req.query('type') || '').toUpperCase();
    if (!docType) docType = 'MANUSCRIPT';
    if (docType !== 'PLAGIARISM' && docType !== 'AI_PLAGIARISM' && docType !== 'MANUSCRIPT') {
      return c.json({ success: false, error: 'Unsupported file type requested.' }, 400);
    }

    const file = await c.env.DB.prepare(
      `SELECT storage_key, original_filename, mime_type FROM submission_files
       WHERE submission_id = ? AND file_type = ? LIMIT 1`
    ).bind(submissionId, docType).first() as any;

    if (!file) {
      return c.json({
        success: false,
        error:
          docType === 'PLAGIARISM'
            ? 'No plagiarism report found for this submission.'
            : docType === 'AI_PLAGIARISM'
            ? 'No AI plagiarism report found for this submission.'
            : 'No manuscript file found for this submission.',
      }, 404);
    }

    const object = await c.env.BUCKET.get(file.storage_key);
    if (!object) {
      return c.json({ success: false, error: 'The file could not be found in storage.' }, 404);
    }

    const mime = file.mime_type || 'application/octet-stream';
    const safeName = encodeURIComponent(file.original_filename || 'manuscript');

    return new Response(object.body, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `inline; filename*=UTF-8''${safeName}`,
        'Content-Length': String(object.size),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('File stream error:', error);
    return c.json({ success: false, error: 'Could not load the manuscript file.' }, 500);
  }
});

// ------------------------------------------------------------------
// User: Get the signed-in user's own submissions only.
// ------------------------------------------------------------------
app.get('/api/submissions/mine', requireClerkAuth, async (c) => {
  try {
    const clerkUserId = c.get('clerkUserId') as string;
    const clerkEmail = (c.get('clerkEmail') || '').trim();

    const userId = await ensureUserForClerk(c, clerkUserId, clerkEmail);

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.abstract, s.track, s.status, s.author_name, s.created_at, s.updated_at, s.registration_type, s.author_type, s.payment_proof_url, s.utr_transaction_id, s.payment_status, s.payment_approved_at, s.payment_submitted_at, s.fee_amount, s.fee_tier,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'MANUSCRIPT' LIMIT 1) AS manuscript_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'PLAGIARISM' LIMIT 1) AS plagiarism_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'AI_PLAGIARISM' LIMIT 1) AS ai_plagiarism_file,
              (SELECT COUNT(*) FROM authors a WHERE a.submission_id = s.id) AS author_count,
              (SELECT decision FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_decision,
              (SELECT feedback FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_feedback,
              (SELECT updated_at FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_updated_at
       FROM submissions s
       WHERE s.deleted_at IS NULL
         AND (s.user_id = ? OR (lower(trim(s.author_email)) = lower(?) AND trim(coalesce(?, '')) <> ''))
       ORDER BY s.created_at DESC`
    ).bind(userId, clerkEmail, clerkEmail).all();

    return c.json({ success: true, submissions: results as any[] });
  } catch (error) {
    console.error('Fetch my submissions error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// User: Replace the files of the user's own submission.
// Details (title, abstract, track, authors, paper ID) can never be
// changed; only the uploaded manuscript / plagiarism report files may
// be replaced. The old R2 object is deleted and the submission_files
// row is updated so only the edited file remains visible.
// ------------------------------------------------------------------
app.post('/api/submissions/:id/files', requireClerkAuth, async (c) => {
  try {
    if (!rateLimit(c, 'edit-files', 10, 60000)) {
      return c.json({ success: false, error: 'Too many edit attempts. Please try again later.' }, 429);
    }

    const settings = await loadSettingsRecord(c.env as Bindings);
    // Same gate as POST /api/submissions, so an approved address can both start
    // a paper and finish one during the same closed window.
    const editGate = userPortalGate(settings, c.get('clerkEmail') || '', 'edit');
    if (editGate) return c.json(editGate.body, editGate.status);

    // Checked separately from maintenance so an admin can stop file replacement
    // while still accepting new submissions. 403 rather than 503: the portal is
    // up, this one action is closed.
    if (!fileEditsAllowed(settings)) {
      return c.json(
        {
          success: false,
          error: 'File updates have been closed by the conference team. Please contact us if you need to make a correction.',
          file_edits_enabled: false,
        },
        403
      );
    }

    const clerkUserId = c.get('clerkUserId') as string;
    const clerkEmail = (c.get('clerkEmail') || '').trim();
    const submissionId = c.req.param('id');

    const userId = await ensureUserForClerk(c, clerkUserId, clerkEmail);

    const submission = await c.env.DB.prepare(
      `SELECT id, user_id, status, created_at FROM submissions WHERE id = ? AND deleted_at IS NULL`
    ).bind(submissionId).first() as any;
    if (!submission) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }
    if (submission.user_id !== userId) {
      return c.json({ success: false, error: 'You can only edit files of your own submission.' }, 403);
    }

    const formData = await c.req.parseBody();
    const newPaper = formData['file'] as File;
    const newPlag = formData['plagiarismFile'] as File;
    const newAiPlag = formData['aiPlagiarismFile'] as File;

    const updates: { type: 'MANUSCRIPT' | 'PLAGIARISM' | 'AI_PLAGIARISM'; file: File }[] = [];
    if (newPaper) updates.push({ type: 'MANUSCRIPT', file: newPaper });
    if (newPlag) updates.push({ type: 'PLAGIARISM', file: newPlag });
    if (newAiPlag) updates.push({ type: 'AI_PLAGIARISM', file: newAiPlag });

    if (updates.length === 0) {
      return c.json({ success: false, error: 'Please choose at least one file to update.' }, 400);
    }

    for (const u of updates) {
      const check = validateFile(u.file);
      if (!check.ok) {
        return c.json({
          success: false,
          error: u.type === 'MANUSCRIPT'
            ? check.reason
            : u.type === 'PLAGIARISM'
            ? `Plagiarism report: ${check.reason}`
            : `AI plagiarism report: ${check.reason}`,
        }, 400);
      }
    }

    const now = new Date().toISOString();
    const uploadedKeys: string[] = [];
    const updatedFiles: { type: string; filename: string }[] = [];

    try {
      for (const u of updates) {
        const prefix = u.type === 'MANUSCRIPT' ? 'PAPER' : u.type === 'PLAGIARISM' ? 'PLAGIARISM' : 'AI_PLAGIARISM';
        const newKey = `submissions/${submissionId}-${prefix}-${sanitizeFilename(u.file.name)}-${Date.now().toString(36)}`;

        await c.env.BUCKET.put(newKey, u.file.stream(), {
          httpMetadata: { contentType: u.file.type || 'application/octet-stream' },
        });
        uploadedKeys.push(newKey);

        const existing = await c.env.DB.prepare(
          `SELECT id, storage_key FROM submission_files
           WHERE submission_id = ? AND file_type = ? LIMIT 1`
        ).bind(submissionId, u.type).first() as any;

        if (existing?.id) {
          await c.env.DB.prepare(
            `UPDATE submission_files
             SET original_filename = ?, storage_key = ?, mime_type = ?, file_size = ?, uploaded_at = ?
             WHERE id = ?`
          ).bind(
            u.file.name,
            newKey,
            u.file.type || 'application/octet-stream',
            u.file.size,
            now,
            existing.id
          ).run();
          if (existing.storage_key && existing.storage_key !== newKey) {
            await c.env.BUCKET.delete(existing.storage_key).catch(() => { });
          }
        } else {
          await c.env.DB.prepare(
            `INSERT INTO submission_files
              (id, submission_id, file_type, original_filename, storage_key, mime_type, file_size, uploaded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            submissionId,
            u.type,
            u.file.name,
            newKey,
            u.file.type || 'application/octet-stream',
            u.file.size,
            now
          ).run();
        }

        updatedFiles.push({ type: u.type, filename: u.file.name });
      }

      const editStatements: D1PreparedStatement[] = [
        // Author re-uploaded files => the submission changed, so the
        // admin's "Enquired" and "No Corrections" tracking flags are
        // reset to 0 (unticked) and the paper leaves those sections.
        c.env.DB.prepare(`UPDATE submissions SET updated_at = ?, enquired = 0, no_corrections = 0 WHERE id = ?`)
          .bind(now, submissionId),
      ];

      // Re-uploading files after a review moves the paper back to the
      // reviewer's "To Review" queue and out of the admin's Reviewed /
      // Not Accepted sections (resubmitted = 1) while keeping the
      // previous feedback available to the author.
      //
      // Exception: if the paper was Accepted (decision = ACCEPTED) by the
      // reviewer, the author's file updates are just the final/registration
      // resubmission, so the paper STAYS accepted in READY_FOR_REGISTRATION
      // and does NOT go back to the reviewer queue.
      const flagged = await c.env.DB.prepare(
        `SELECT id, decision FROM reviews
         WHERE submission_id = ? AND resubmitted = 0
         LIMIT 1`
      ).bind(submissionId).first() as any;
      if (flagged?.id && flagged.decision !== 'ACCEPTED') {
        editStatements.push(
          c.env.DB.prepare(
            `UPDATE reviews SET resubmitted = 1, updated_at = ? WHERE id = ?`
          ).bind(now, flagged.id)
        );
      }
      await c.env.DB.batch(editStatements);

      return c.json({
        success: true,
        message: 'Your files have been updated successfully.',
        files: updatedFiles,
      });
    } catch (dbError) {
      // Best-effort cleanup of any newly uploaded file(s) if a partial failure occurs.
      for (const k of uploadedKeys) {
        await c.env.BUCKET.delete(k).catch(() => { });
      }
      console.error('Edit files DB error:', dbError);
      return c.json({ success: false, error: 'Could not save your updated files. Please try again.' }, 500);
    }
  } catch (error) {
    console.error('Edit submission files error:', error);
    return c.json({ success: false, error: 'Internal Server Error. Please try again.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Soft-delete a submission (requires admin Bearer token)
// Marks the record as deleted so it moves to the "Deleted Files"
// tab. It can be recovered or is permanently purged after 30 days
// by the scheduled cron job.
// ------------------------------------------------------------------
app.delete('/api/admin/submissions/:id', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');

    const existing = await c.env.DB.prepare(
      `SELECT id FROM submissions WHERE id = ?`
    ).bind(submissionId).first();
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE submissions SET deleted_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, submissionId).run();

    return c.json({ success: true, message: 'Submission moved to Deleted Files.' });
  } catch (error) {
    console.error('Soft-delete submission error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Recover a soft-deleted submission (requires admin Bearer token)
// Restores the record to its original place (created_at is unchanged,
// so the created_at DESC ordering puts it back exactly where it was).
// ------------------------------------------------------------------
app.post('/api/admin/submissions/:id/recover', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');

    const existing = await c.env.DB.prepare(
      `SELECT id FROM submissions WHERE id = ?`
    ).bind(submissionId).first();
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE submissions SET deleted_at = NULL, updated_at = ? WHERE id = ?`
    ).bind(now, submissionId).run();

    const recovered = result.meta.changes > 0;
    return c.json({
      success: recovered,
      message: recovered ? 'Submission recovered successfully.' : 'Submission could not be recovered.',
    });
  } catch (error) {
    console.error('Recover submission error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Update the status of a submission (requires admin Bearer token)
// Allowed statuses: SUBMITTED, UNDER_REVIEW, READY_FOR_REGISTRATION,
// READY_FOR_CAMERA_READY. The user portal reflects the new status the
// next time the author loads their submissions.
// ------------------------------------------------------------------
app.post('/api/admin/submissions/:id/status', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const status = (body?.status || '').toString().trim().toUpperCase();

    if (!ALLOWED_SUBMISSION_STATUSES.has(status)) {
      return c.json({ success: false, error: 'Invalid status value.' }, 400);
    }

    const existing = await c.env.DB.prepare(`SELECT id FROM submissions WHERE id = ?`)
      .bind(submissionId).first();
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(status, now, submissionId).run();

    const updated = result.meta.changes > 0;
    return c.json({
      success: updated,
      message: updated ? 'Submission status updated.' : 'Submission status could not be updated.',
      status,
    });
  } catch (error) {
    console.error('Update submission status error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Toggle the "Enquired" (contacted) flag of a submission
// (requires admin Bearer token)
// Lets the admin track which authors have already been called for
// updates. When an author re-uploads files, this flag resets to 0 so
// the checkbox becomes unticked and the admin knows to call again.
// ------------------------------------------------------------------
app.post('/api/admin/submissions/:id/enquired', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const enquired = body?.enquired === true || body?.enquired === 1 || body?.enquired === '1';

    const existing = await c.env.DB.prepare(`SELECT id FROM submissions WHERE id = ?`)
      .bind(submissionId).first();
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE submissions SET enquired = ?, updated_at = ? WHERE id = ?`
    ).bind(enquired ? 1 : 0, now, submissionId).run();

    const updated = result.meta.changes > 0;
    return c.json({
      success: updated,
      message: updated ? 'Enquiry status updated.' : 'Enquiry status could not be updated.',
      enquired: updated ? (enquired ? 1 : 0) : undefined,
    });
  } catch (error) {
    console.error('Update submission enquiry error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Toggle the "No Corrections" flag of a submission
// (requires admin Bearer token)
// Lets the admin track whether a paper requires no further
// corrections. Mirrors the "Enquired" tracking flag.
// ------------------------------------------------------------------
app.post('/api/admin/submissions/:id/no-corrections', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const noCorrections = body?.noCorrections === true || body?.noCorrections === 1 || body?.noCorrections === '1';

    const existing = await c.env.DB.prepare(`SELECT id FROM submissions WHERE id = ?`)
      .bind(submissionId).first();
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE submissions SET no_corrections = ?, updated_at = ? WHERE id = ?`
    ).bind(noCorrections ? 1 : 0, now, submissionId).run();

    const updated = result.meta.changes > 0;
    return c.json({
      success: updated,
      message: updated ? 'No Corrections status updated.' : 'No Corrections status could not be updated.',
      noCorrections: updated ? (noCorrections ? 1 : 0) : undefined,
    });
  } catch (error) {
    console.error('Update submission no-corrections error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Replace the author list for a submission (phones, co-authors,
// college names, emails). Deletes existing author rows and inserts the
// new list atomically, and keeps submissions.author_name/author_email
// in sync with the primary author.
// ------------------------------------------------------------------
app.put('/api/admin/submissions/:id/authors', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const submissionId = c.req.param('id');
    const existing = await c.env.DB.prepare(`SELECT id FROM submissions WHERE id = ?`)
      .bind(submissionId).first();
    if (!existing) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    const body = await c.req.json().catch(() => null);
    const raw = Array.isArray(body?.authors) ? body.authors : null;
    if (!raw || raw.length === 0) {
      return c.json({ success: false, error: 'Provide at least one author.' }, 400);
    }

    const authors = (raw as any[]).map((a) => ({
      first_name: typeof a.first_name === 'string' ? a.first_name.trim() : '',
      last_name: typeof a.last_name === 'string' ? a.last_name.trim() : '',
      email: typeof a.email === 'string' ? a.email.trim() : '',
      phone: normalizePhone(a.phone),
      college: typeof a.college === 'string' ? a.college.trim() : '',
      is_primary: a.is_primary === true || a.is_primary === 1 || a.is_primary === '1' ? 1 : 0,
    }));

    if (authors.some((a) => !a.first_name || !a.last_name)) {
      return c.json({ success: false, error: 'Every author needs a first and last name.' }, 400);
    }
    const badPhoneIndex = authors.findIndex((a) => !isValidPhone(a.phone));
    if (badPhoneIndex !== -1) {
      return c.json({
        success: false,
        error: `Author ${badPhoneIndex + 1}: phone number must be ${PHONE_RULE}.`
      }, 400);
    }
    if (authors.filter((a) => a.is_primary === 1).length !== 1) {
      return c.json({ success: false, error: 'Exactly one author must be marked as the primary (corresponding) author.' }, 400);
    }
    const primary = authors.find((a) => a.is_primary === 1)!;
    if (!primary.email) {
      return c.json({ success: false, error: 'The primary author must have an email address.' }, 400);
    }

    const now = new Date().toISOString();
    const statements: D1PreparedStatement[] = [
      c.env.DB.prepare(`DELETE FROM authors WHERE submission_id = ?`).bind(submissionId),
    ];
    for (const a of authors) {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO authors (id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), submissionId, a.is_primary, a.first_name, a.last_name, a.phone, a.email, a.college, now)
      );
    }
    statements.push(
      c.env.DB.prepare(
        `UPDATE submissions SET author_name = ?, author_email = ?, updated_at = ? WHERE id = ?`
      ).bind(`${primary.first_name} ${primary.last_name}`, primary.email, now, submissionId)
    );

    await c.env.DB.batch(statements);

    const res = await c.env.DB.prepare(
      `SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at
       FROM authors WHERE submission_id = ? ORDER BY is_primary DESC, created_at ASC`
    ).bind(submissionId).all();

    return c.json({ success: true, authors: res.results });
  } catch (error) {
    console.error('Update author list error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Full database backup (on-demand, read-only).
// Every table is exported as JSON plus the R2 object manifest, and the
// snapshot is returned straight to the admin's browser to be saved on
// their own computer. Nothing is ever written or stored in the database
// (D1 has no temp/backup table for this) and no rows are modified.
// ------------------------------------------------------------------
app.get('/api/admin/backup', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const tableRes = await c.env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`
    ).all();
    const tables = ((tableRes.results as any[]) || []).map((r) => r.name as string);

    const backup: Record<string, any[]> = {};
    for (const table of tables) {
      const res = await c.env.DB.prepare(`SELECT * FROM "${table}"`).all();
      backup[table] = (res.results as any[]) || [];
    }

    // R2 object manifest (best-effort) so the file storage is restorable too.
    // Covers both buckets: the papers bucket (icaidietpdfs) and the payment
    // proofs bucket (proof).
    const r2Objects: { key: string; size: number; etag: string; bucket: string }[] = [];
    const listBucket = async (bucket: R2Bucket, bucketName: string) => {
      try {
        let cursor: string | undefined;
        do {
          const page = await bucket.list({ cursor, limit: 1000 });
          for (const obj of page.objects) {
            r2Objects.push({ key: obj.key, size: obj.size, etag: obj.etag, bucket: bucketName });
          }
          cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);
      } catch (err) {
        console.error(`R2 manifest error (${bucketName}):`, err);
      }
    };
    await listBucket(c.env.BUCKET, 'icaidietpdfs');
    await listBucket(c.env.PROOF_BUCKET, 'proof');

    const exported_at = new Date().toISOString();
    const backupData = {
      application: 'icaidiet-conference-portal',
      version: 1,
      exported_at,
      tables: backup,
      r2_objects: r2Objects,
    };

    return c.json({ success: true, exported_at, backup: backupData });
  } catch (error) {
    console.error('Backup export error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Export submissions data (requires admin Bearer token)
// Level 1 = a status/review filter; Level 2 = the columns to include.
// Returns a real .xlsx file: <date>_<FILTER>.xlsx
// ------------------------------------------------------------------

const EXPORT_STATUS_FILTERS = new Set(['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_REGISTRATION', 'READY_FOR_CAMERA_READY']);
const EXPORT_REVIEW_FILTERS = new Set(['ACCEPTED', 'ACCEPTED_WITH_MINOR_CHANGES', 'ACCEPTED_WITH_MAJOR_CHANGES', 'NOT_ACCEPTED']);
// These are export filter ids, not payment_status values, so the ids stay
// readable in the .xlsx filename and the two namespaces cannot collide with the
// status/review filters above. PAYMENT_NONE maps to a NULL payment_status.
const EXPORT_PAYMENT_FILTERS = new Set(['PAYMENT_APPROVED', 'PAYMENT_PENDING', 'PAYMENT_REJECTED', 'PAYMENT_NONE']);

const EXPORT_FILTER_LABELS: Record<string, string> = {
  ALL: 'ALL_ENTRIES',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  READY_FOR_REGISTRATION: 'READY_FOR_REGISTRATION',
  READY_FOR_CAMERA_READY: 'READY_FOR_CAMERA_READY',
  ACCEPTED: 'ACCEPTED',
  ACCEPTED_WITH_MINOR_CHANGES: 'ACCEPTED_WITH_MINOR_CHANGES',
  ACCEPTED_WITH_MAJOR_CHANGES: 'ACCEPTED_WITH_MAJOR_CHANGES',
  NOT_ACCEPTED: 'NOT_ACCEPTED',
  PAYMENT_APPROVED: 'PAYMENT_MADE',
  PAYMENT_PENDING: 'PAYMENT_PENDING_REVIEW',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  PAYMENT_NONE: 'NO_PAYMENT_SUBMITTED',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Review',
  APPROVED: 'Payment Made',
  REJECTED: 'Rejected',
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  READY_FOR_REGISTRATION: 'Ready for Registration',
  READY_FOR_CAMERA_READY: 'Ready for Camera Ready',
};

const DECISION_LABELS: Record<string, string> = {
  ACCEPTED: 'Accepted',
  ACCEPTED_WITH_MINOR_CHANGES: 'Accepted with Minor Changes',
  ACCEPTED_WITH_MAJOR_CHANGES: 'Accepted with Major Changes',
  NOT_ACCEPTED: 'Not Accepted',
};

const fmtExportDate = (v?: string | null): string =>
  v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') + ' UTC' : '';

const exportPrimaryAuthor = (s: any): any =>
  (s.authors || []).find((a: any) => a.is_primary === 1) || (s.authors || [])[0] || null;

const exportCoAuthors = (s: any): any[] => (s.authors || []).filter((a: any) => !a.is_primary);

// Every exportable column maps to a fixed picker — no user-controlled SQL.
const EXPORT_COLUMNS: { id: string; label: string; pick: (s: any) => string }[] = [
  { id: 'submission_code', label: 'Submission Code', pick: (s) => s.submission_code || '' },
  { id: 'paper_id', label: 'Paper ID', pick: (s) => s.paper_id || '' },
  { id: 'title', label: 'Title', pick: (s) => s.title || '' },
  { id: 'abstract', label: 'Abstract', pick: (s) => s.abstract || '' },
  { id: 'keywords', label: 'Keywords', pick: (s) => s.keywords || '' },
  { id: 'track', label: 'Track', pick: (s) => (s.track || '').replace(/-/g, ' ') },
  { id: 'status', label: 'Status', pick: (s) => STATUS_LABELS[s.status] || s.status || '' },
  { id: 'review_decision', label: 'Review Decision', pick: (s) => (s.review_decision ? DECISION_LABELS[s.review_decision] || s.review_decision : '') },
  { id: 'review_feedback', label: 'Review Feedback', pick: (s) => s.review_feedback || '' },
  { id: 'author_name', label: 'Primary Author Name', pick: (s) => s.author_name || '' },
  { id: 'author_email', label: 'Primary Author Email', pick: (s) => s.author_email || '' },
  { id: 'author_phone', label: 'Primary Author Phone', pick: (s) => (exportPrimaryAuthor(s)?.phone || '') as string },
  { id: 'author_institution', label: 'Primary Author Institution', pick: (s) => (exportPrimaryAuthor(s)?.college || '') as string },
  { id: 'co_authors', label: 'Co-Authors', pick: (s) => exportCoAuthors(s).map((a: any) => `${a.first_name} ${a.last_name}`.trim()).filter(Boolean).join('; ') },
  { id: 'co_author_emails', label: 'Co-Author Emails', pick: (s) => exportCoAuthors(s).map((a: any) => a.email || '').filter(Boolean).join('; ') },
  { id: 'submitted_at', label: 'Submitted At', pick: (s) => fmtExportDate(s.submitted_at) },
  { id: 'updated_at', label: 'Last Updated', pick: (s) => fmtExportDate(s.updated_at) },
  { id: 'enquired', label: 'Enquired', pick: (s) => (s.enquired ? 'Yes' : 'No') },
  { id: 'no_corrections', label: 'No Corrections', pick: (s) => (s.no_corrections ? 'Yes' : 'No') },
  { id: 'manuscript_file', label: 'Manuscript Filename', pick: (s) => s.manuscript_file || '' },
  { id: 'plagiarism_file', label: 'Plagiarism Filename', pick: (s) => s.plagiarism_file || '' },
  { id: 'ai_plagiarism_file', label: 'AI Plagiarism Filename', pick: (s) => s.ai_plagiarism_file || '' },
  // What the author selected at payment, and what it cost. fee_amount /
  // fee_tier are snapshots written at registration time, so these report the
  // price actually collected rather than today's fee matrix.
  { id: 'payment_status', label: 'Payment Status', pick: (s) => (s.payment_status ? PAYMENT_STATUS_LABELS[s.payment_status] || s.payment_status : '') },
  { id: 'author_type', label: 'Author Type', pick: (s) => s.author_type || '' },
  { id: 'registration_type', label: 'Registration Type', pick: (s) => s.registration_type || '' },
  { id: 'fee_amount', label: 'Amount Paid', pick: (s) => s.fee_amount || '' },
  { id: 'fee_tier', label: 'Fee Tier', pick: (s) => (s.fee_tier === 'EARLY' ? 'Early Bird' : s.fee_tier === 'STANDARD' ? 'Standard / Late' : '') },
  { id: 'utr_transaction_id', label: 'UTR / Transaction ID', pick: (s) => s.utr_transaction_id || '' },
  // A Yes/No rather than a filename: payment proofs are stored under a
  // generated R2 key (proof/<id>-<timestamp>.<ext>) and the author's original
  // filename is not kept, so there is no honest name to show.
  { id: 'payment_proof_uploaded', label: 'Payment Proof Uploaded', pick: (s) => (s.payment_proof_url ? 'Yes' : 'No') },
  { id: 'payment_submitted_at', label: 'Payment Submitted At', pick: (s) => fmtExportDate(s.payment_submitted_at) },
  { id: 'payment_approved_at', label: 'Payment Approved At', pick: (s) => fmtExportDate(s.payment_approved_at) },
  { id: 'mail_status', label: 'Mail Status', pick: (s) => s.mail_status || '' },
];

app.get('/api/admin/export/columns', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    return c.json({
      success: true,
      filters: Object.entries(EXPORT_FILTER_LABELS).map(([id, label]) => ({ id, label })),
      columns: EXPORT_COLUMNS.map(({ id, label }) => ({ id, label })),
    });
  } catch (error) {
    console.error('Export columns error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

app.post('/api/admin/export', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);

    const body = await c.req.json().catch(() => null);
    const filter = String(body?.filter || 'ALL').trim().toUpperCase();
    const requested = Array.isArray(body?.columns) ? body.columns.map(String) : [];

    if (filter !== 'ALL' && !EXPORT_STATUS_FILTERS.has(filter) && !EXPORT_REVIEW_FILTERS.has(filter) && !EXPORT_PAYMENT_FILTERS.has(filter)) {
      return c.json({ success: false, error: 'Invalid filter. Please choose a status, review or payment filter.' }, 400);
    }
    const selected = EXPORT_COLUMNS.filter((col) => requested.includes(col.id));
    if (selected.length === 0) {
      return c.json({ success: false, error: 'Please select at least one column to export.' }, 400);
    }

    // Deleted submissions are never exported; only live records.
    const conds: string[] = ['s.deleted_at IS NULL'];
    const params: string[] = [];
    if (filter === 'ALL') {
      // no extra condition
    } else if (EXPORT_STATUS_FILTERS.has(filter)) {
      conds.push('s.status = ?');
      params.push(filter);
    } else if (EXPORT_PAYMENT_FILTERS.has(filter)) {
      // A paper that never registered has no payment_status at all, so
      // "no payment submitted" is an explicit IS NULL rather than a sentinel.
      if (filter === 'PAYMENT_NONE') {
        conds.push('s.payment_status IS NULL');
      } else {
        conds.push('s.payment_status = ?');
        params.push(filter.replace('PAYMENT_', ''));
      }
    } else {
      conds.push(
        '(SELECT decision FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) = ?'
      );
      params.push(filter);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.abstract, s.keywords, s.track, s.status,
              s.author_name, s.author_email, s.created_at AS submitted_at, s.updated_at, s.enquired, s.no_corrections,
              s.registration_type, s.author_type, s.fee_amount, s.fee_tier,
              s.utr_transaction_id, s.payment_status, s.payment_approved_at, s.payment_submitted_at, s.payment_proof_url,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'MANUSCRIPT' LIMIT 1) AS manuscript_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'PLAGIARISM' LIMIT 1) AS plagiarism_file,
              (SELECT original_filename FROM submission_files
               WHERE submission_id = s.id AND file_type = 'AI_PLAGIARISM' LIMIT 1) AS ai_plagiarism_file,
              (SELECT decision FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_decision,
              (SELECT feedback FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_feedback,
              (SELECT status FROM mail_logs l WHERE l.submission_id = s.id ORDER BY l.created_at DESC LIMIT 1) AS mail_status
       FROM submissions s
       WHERE ${conds.join(' AND ')}
       ORDER BY s.created_at DESC`
    ).bind(...params).all();

    const subs = (results as any[] | undefined) || [];
    let authorsBySubmission: Record<string, any[]> = {};
    if (subs.length > 0) {
      const ids = subs.map((s: any) => s.id as string);
      const chunks = chunkArray(ids, 50);
      const authorResults = await Promise.all(
        chunks.map(async (chunk) => {
          const placeholders = chunk.map(() => '?').join(',');
          const res = await c.env.DB.prepare(
            `SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college
             FROM authors
             WHERE submission_id IN (${placeholders})
             ORDER BY is_primary DESC, created_at ASC`
          ).bind(...chunk).all();
          return (res.results as any[]) || [];
        })
      );
      authorsBySubmission = authorResults.flat().reduce((acc: any, a: any) => {
        const sid = a.submission_id;
        (acc[sid] = acc[sid] || []).push(a);
        return acc;
      }, {});
    }

    const headers = selected.map((col) => col.label);
    const rows = subs.map((s: any) => {
      s.authors = authorsBySubmission[s.id] || [];
      return selected.map((col) => col.pick(s));
    });

    const xlsx = generateXlsx(headers, rows);
    const fileName = `${new Date().toISOString().slice(0, 10)}_${EXPORT_FILTER_LABELS[filter]}.xlsx`;

    return new Response(xlsx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Export submissions error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Get all users + profiles (requires admin Bearer token)
// ------------------------------------------------------------------
app.get('/api/admin/users', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) {
      return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
    }
    const verified = await verifyToken(c, token);
    if (!verified.ok) {
      return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
              p.institution, p.department, p.country, p.phone,
              (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id AND s.deleted_at IS NULL) AS submission_count
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    ).all();

    return c.json({ success: true, users: results as any[] });
  } catch (error) {
    console.error('Fetch users error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Settings (Maintenance Mode, etc.)
// ------------------------------------------------------------------
async function loadSettingsRecord(env: Bindings): Promise<Record<string, string>> {
  const res = await env.DB.prepare('SELECT key, value FROM settings').all();
  const settings: Record<string, string> = {};
  for (const row of res.results as any[]) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ------------------------------------------------------------------
// Registration configuration helpers
//
// Reads are lenient: a malformed or partial document degrades field by field
// onto DEFAULT_REGISTRATION_CONFIG so a bad edit can never blank out the fee
// card a paying author is looking at. Writes (see POST /api/admin/settings)
// are strict instead, so a bad save is reported to the admin rather than
// silently coerced.
// ------------------------------------------------------------------

// Free-text display values: trim, collapse runs of whitespace, strip control
// characters and cap the length so one row cannot bloat the settings row.
function cleanDisplayText(value: unknown, maxLength = 80): string {
  if (typeof value !== 'string') return '';
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Coerce whatever is stored into a usable RegistrationConfig, falling back to
// the defaults per field. Never throws.
function parseRegistrationConfig(raw: unknown): RegistrationConfig {
  const fallback = JSON.parse(JSON.stringify(DEFAULT_REGISTRATION_CONFIG)) as RegistrationConfig;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const src = raw as Record<string, any>;

  const config: RegistrationConfig = { ...fallback, fees: {}, bank: { ...fallback.bank } };

  if (typeof src.early_bird_until === 'string' && isCalendarDate(src.early_bird_until)) {
    config.early_bird_until = src.early_bird_until;
  }

  if (src.fees && typeof src.fees === 'object' && !Array.isArray(src.fees)) {
    for (const [rawAuthorType, tiers] of Object.entries(src.fees as Record<string, unknown>)) {
      const authorType = cleanDisplayText(rawAuthorType);
      if (!authorType || !tiers || typeof tiers !== 'object' || Array.isArray(tiers)) continue;
      const rows: Record<string, RegistrationFeeRow> = {};
      for (const [rawRegType, amounts] of Object.entries(tiers as Record<string, unknown>)) {
        const regType = cleanDisplayText(rawRegType);
        if (!regType || !amounts || typeof amounts !== 'object' || Array.isArray(amounts)) continue;
        const early = cleanDisplayText((amounts as any).early, 40);
        const standard = cleanDisplayText((amounts as any).standard, 40);
        if (!early && !standard) continue;
        rows[regType] = { early: early || '\u2014', standard: standard || '\u2014' };
      }
      if (Object.keys(rows).length > 0) config.fees[authorType] = rows;
    }
  }
  // A document with no usable rows would render an empty fee card, so keep the
  // defaults instead.
  if (Object.keys(config.fees).length === 0) config.fees = fallback.fees;

  if (src.bank && typeof src.bank === 'object' && !Array.isArray(src.bank)) {
    for (const field of ['account_number', 'ifsc', 'branch', 'beneficiary', 'bank_name']) {
      const value = cleanDisplayText((src.bank as Record<string, unknown>)[field], 160);
      if (value) config.bank[field] = value;
    }
  }

  return config;
}

// Strict validation for the admin save path. Rejects rather than repairs, so a
// half-typed fee table never reaches D1.
const MAX_AUTHOR_TYPES = 20;
const MAX_REG_TYPES_PER_AUTHOR = 20;

function validateRegistrationConfig(
  input: unknown
): { ok: true; value: RegistrationConfig } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid registration configuration.' };
  }
  const src = input as Record<string, any>;

  const rawUntil = src.early_bird_until;
  if (rawUntil !== undefined && rawUntil !== null && typeof rawUntil !== 'string') {
    return { ok: false, error: 'The early-bird deadline must be a date.' };
  }
  const earlyBirdUntil = cleanDisplayText(rawUntil, 10);
  if (earlyBirdUntil && !isCalendarDate(earlyBirdUntil)) {
    return { ok: false, error: 'The early-bird deadline must be a valid date.' };
  }

  if (!src.fees || typeof src.fees !== 'object' || Array.isArray(src.fees)) {
    return { ok: false, error: 'At least one author type is required.' };
  }
  const feeEntries = Object.entries(src.fees as Record<string, unknown>);
  if (feeEntries.length === 0) return { ok: false, error: 'At least one author type is required.' };
  if (feeEntries.length > MAX_AUTHOR_TYPES) {
    return { ok: false, error: `Too many author types (maximum ${MAX_AUTHOR_TYPES}).` };
  }

  const fees: Record<string, Record<string, RegistrationFeeRow>> = {};
  for (const [rawAuthorType, tiers] of feeEntries) {
    const authorType = cleanDisplayText(rawAuthorType);
    if (!authorType) return { ok: false, error: 'Author type names cannot be empty.' };
    if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) {
      return { ok: false, error: `Fees for "${authorType}" are missing.` };
    }
    const tierEntries = Object.entries(tiers as Record<string, unknown>);
    if (tierEntries.length === 0) {
      return { ok: false, error: `Add at least one registration type for "${authorType}".` };
    }
    if (tierEntries.length > MAX_REG_TYPES_PER_AUTHOR) {
      return { ok: false, error: `Too many registration types for "${authorType}".` };
    }
    const rows: Record<string, RegistrationFeeRow> = {};
    for (const [rawRegType, amounts] of tierEntries) {
      const regType = cleanDisplayText(rawRegType);
      if (!regType) return { ok: false, error: `Registration type names cannot be empty for "${authorType}".` };
      if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) {
        return { ok: false, error: `Fees for "${authorType} / ${regType}" are missing.` };
      }
      const early = cleanDisplayText((amounts as any).early, 40);
      const standard = cleanDisplayText((amounts as any).standard, 40);
      if (!early || !standard) {
        return { ok: false, error: `Enter both an early-bird and a standard fee for "${authorType} / ${regType}".` };
      }
      rows[regType] = { early, standard };
    }
    fees[authorType] = rows;
  }

  const bank: Record<string, string> = {};
  const bankSource = src.bank && typeof src.bank === 'object' && !Array.isArray(src.bank) ? src.bank : {};
  for (const field of ['account_number', 'ifsc', 'branch', 'beneficiary', 'bank_name']) {
    bank[field] = cleanDisplayText(bankSource[field], 160);
  }
  if (!bank.account_number || !bank.ifsc) {
    return { ok: false, error: 'Enter the bank account number and IFSC code.' };
  }

  return {
    ok: true,
    value: {
      early_bird_until: earlyBirdUntil,
      fees,
      bank,
    },
  };
}

async function loadRegistrationConfig(env: Bindings): Promise<RegistrationConfig> {
  const settings = await loadSettingsRecord(env);
  const raw = settings['registration_config'];
  if (!raw) return parseRegistrationConfig(null);
  try {
    return parseRegistrationConfig(JSON.parse(raw));
  } catch {
    // Corrupt JSON must not take the fee card down; fall back to defaults.
    return parseRegistrationConfig(null);
  }
}

// The fee an author was actually shown, snapshotted at registration time so that
// later edits to the admin fee matrix cannot rewrite what historical payment
// records say was collected.
//
// `claimedAmount`/`claimedTier` are what the browser displayed. The cutoff is an
// INCLUSIVE calendar date and the author's clock and the Worker's can disagree by
// a day, so the cutoff alone would occasionally snapshot the opposite bracket
// from the one on screen. The claimed value is therefore accepted ONLY if it
// exactly matches one of the two amounts the admin configured for that pair --
// which makes it impossible to claim a cheaper early-bird price. Anything else
// is resolved here instead.
//
// Returns null when the pair is not in the matrix at all, which happens on the
// re-register escape hatch in POST /api/user/submissions/:id/register after an
// admin renames or removes a type.
function resolveFeeSnapshot(
  config: RegistrationConfig,
  authorType: string,
  registrationType: string,
  claimedAmount?: unknown,
  claimedTier?: unknown
): { amount: string; tier: 'EARLY' | 'STANDARD' } | null {
  const row = config.fees[authorType]?.[registrationType];
  if (!row) return null;

  const claimAmount = cleanDisplayText(claimedAmount, 40);
  const claimTier = (cleanDisplayText(claimedTier, 20) || '').toUpperCase();
  if (claimAmount && (claimTier === 'EARLY' || claimTier === 'STANDARD')) {
    const expected = claimTier === 'EARLY' ? row.early : row.standard;
    if (claimAmount === expected) return { amount: claimAmount, tier: claimTier };
  }

  const until = (config.early_bird_until || '').trim();
  const today = new Date().toISOString().slice(0, 10);
  const early = isCalendarDate(until) && today <= until;
  return { amount: early ? row.early : row.standard, tier: early ? 'EARLY' : 'STANDARD' };
}

// Detects the admin repricing an option while an author has the form open, and
// returns the 409 payload when it must be surfaced.
//
// The rule is deliberately narrow. Refusing only when the displayed amount is
// no longer a live price for that pair keeps two things true at once:
//   - a price the author agreed to is never overwritten with one they never saw
//   - moving the early-bird DATE alone (prices untouched) still honours what the
//     author was shown, so a long-lived tab is not penalised
//
// Returns null when the submit may proceed, which includes the honest case of an
// author who claimed no amount at all: with nothing on the record there is no
// agreement to honour, so the resolved price is simply what they pay.
function staleAmountRefusal(
  config: RegistrationConfig,
  authorType: string,
  registrationType: string,
  snapshot: { amount: string; tier: 'EARLY' | 'STANDARD' } | null,
  claimedAmount: unknown
):
  | { code: 'FEE_CHANGED'; displayed_amount: string; current_amount: string; current_tier: string }
  | null {
  const displayed = cleanDisplayText(claimedAmount, 40);
  if (!snapshot || !displayed || displayed === snapshot.amount) return null;
  return {
    code: 'FEE_CHANGED',
    displayed_amount: displayed,
    current_amount: snapshot.amount,
    current_tier: snapshot.tier,
  };
}

// Returns whether a portal is currently in maintenance and, when set, the
// end date/time the admin configured ("" otherwise). If the admin set an
// "until" time and it has already passed, maintenance is treated as off.
function portalMaintenanceActive(
  settings: Record<string, string>,
  portal: 'user' | 'review'
): { active: boolean; until: string | null } {
  const enabled = settings[`maintenance_${portal}_enabled`] === 'true';
  const until = (settings[`maintenance_${portal}_until`] || '').trim();
  let active = enabled;
  if (active && until) {
    const untilMs = new Date(until).getTime();
    if (!isNaN(untilMs)) {
      active = untilMs > Date.now();
    }
  }
  return { active, until: until || null };
}

// Admin can close file replacement for existing submissions independently of
// maintenance mode -- e.g. after revision deadlines, or while an admin
// reconciles author lists. An absent key means ALLOWED, so a missing setting can
// never silently block an author mid-revision; migration 0024_file_edits.sql
// seeds it explicitly. Anything other than 'false' is treated as open.
function fileEditsAllowed(settings: Record<string, string>): boolean {
  return settings['file_edits_enabled'] !== 'false';
}

// ------------------------------------------------------------------
// Approved email list (an EXEMPTION from a closed submission window)
//
// Closing submissions -- either via paper_acceptance_enabled or via user
// portal maintenance -- blocks every author. This list carves out specific
// addresses so a few people can still submit and replace files while the
// window is shut to everyone else: a late paper the chair has agreed to take,
// a co-author whose Google account uses a different address, and so on.
//
// Two properties are deliberate and should not be "simplified" away:
//
//  1. The list is INERT while the window is open. An enabled list never adds a
//     restriction on its own, only ever relaxes a closed state. A stale entry
//     can therefore never lock out an author who could previously have
//     submitted -- the failure mode of a whitelist that also filters the normal
//     open period is far worse than the one it would prevent.
//  2. Enabling the list with zero addresses blocks everyone, which is the same
//     as leaving it off. That is intentional: the admin portal surfaces the
//     count so an empty-but-enabled list is visibly a mistake rather than a
//     silent door slam.
//
// Addresses are lowercased and deduplicated on write and on compare, so a stray
// capital, trailing space or duplicate line cannot cause a silent miss. Split on
// whitespace as well as commas and semicolons: an email address cannot contain
// whitespace, so that is an unambiguous separator.
function approvedMailIdList(settings: Record<string, string>): string[] {
  const seen = new Set<string>();
  for (const part of (settings['approved_mail_ids'] || '').split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (email) seen.add(email);
  }
  return [...seen];
}

function approvedMailAllowed(settings: Record<string, string>, email: string): boolean {
  if (settings['approved_mail_ids_enabled'] !== 'true') return false;
  const candidate = (email || '').trim().toLowerCase();
  if (!candidate) return false;
  return approvedMailIdList(settings).includes(candidate);
}

// Whether authors may CREATE new submissions. Independent of
// maintenance_user_enabled, which is a portal-wide outage switch: closing the
// submission window no longer forces you to also announce a maintenance
// message to every visitor. An absent key means OPEN, so a missing setting can
// never silently close submissions; migration 0028 seeds it explicitly.
// Anything other than 'false' is treated as open.
function paperAcceptanceOpen(settings: Record<string, string>): boolean {
  return settings['paper_acceptance_enabled'] !== 'false';
}

// Whether the approved-email list is consulted at all. Kept separate from
// approvedMailAllowed so the refusal can distinguish "the list is off, so
// nobody is exempt" from "the list is on and you are not on it".
function approvedMailListEnabled(settings: Record<string, string>): boolean {
  return settings['approved_mail_ids_enabled'] === 'true';
}

// Normalizes what the admin portal submitted into the canonical stored form:
// lowercased, deduplicated, one address per line. Rejects obvious typos by name
// so a mistyped address surfaces at save time rather than silently never matching
// a real Google sign-in, which is the whole point of the list.
const APPROVED_MAIL_ID_MAX = 200;
const APPROVED_MAIL_ID_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeApprovedMailIds(
  raw: unknown
): { ok: true; value: string; count: number } | { ok: false; error: string } {
  const seen = new Set<string>();
  for (const part of String(raw ?? '').split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase();
    if (!email) continue;
    if (!APPROVED_MAIL_ID_PATTERN.test(email)) {
      return { ok: false, error: `"${email}" is not a valid email address.` };
    }
    seen.add(email);
  }
  const list = [...seen];
  if (list.length > APPROVED_MAIL_ID_MAX) {
    return { ok: false, error: `Please list at most ${APPROVED_MAIL_ID_MAX} email addresses.` };
  }
  // Store one per line so the admin portal can render it straight back into the
  // textarea without reformatting.
  return { ok: true, value: list.join('\n'), count: list.length };
}

// The single gate for "may this author create a submission or replace files".
// Returns null when the request may proceed, or the refusal to send.
//
// It takes INDEPENDENT inputs and the optional approved list, and which inputs
// apply depends on the action:
//
//   action 'submit' -> paperAcceptanceOpen() false closes it,
//                      plus user portal maintenance closes it
//   action 'edit'   -> paper acceptance is NOT consulted; only maintenance
//                      applies here, and file replacement is then governed by
//                      the independent file_edits_enabled switch in the handler
//
// This split is the point: the three switches close different things and must
// not bleed into each other. Closing the call for papers does not close file
// replacement, and maintenance is the only switch that closes both.
//
// The approved list is an EXEMPTION, never a restriction. It is consulted only
// once something is already blocking, so switching it on can never lock out an
// author who could previously have submitted, and switching it off can never
// re-block somebody the admin deliberately let in.
//
// Two refusals are kept distinguishable so the portal can explain itself:
//   503 -> closed to everyone, the list is off
//   403 + code NOT_APPROVED -> the window is open to a named list and this
//         author is not on it
// 403 rather than 404, and the list itself is never included in the response.
function userPortalGate(
  settings: Record<string, string>,
  email: string,
  action: 'submit' | 'edit'
): { status: 403 | 503; body: Record<string, unknown> } | null {
  const maintenance = portalMaintenanceActive(settings, 'user');

  // Paper acceptance governs CREATING papers only. It must not gate file edits:
  // 'Allow File Edits' is the independent switch for replacing files on an
  // existing submission, and is enforced separately by fileEditsAllowed in the
  // /files handler. Folding acceptance in here meant turning off "Accepting
  // Paper Submissions" silently closed file replacement too.
  const acceptanceOpen = action === 'submit' ? paperAcceptanceOpen(settings) : true;

  // Nothing is blocking: open submissions, no maintenance window. The approved
  // list is deliberately not read here -- it is an exemption, not a filter.
  if (acceptanceOpen && !maintenance.active) return null;

  // Something is blocking and this address is exempt, so let them through. The
  // identity is the address Clerk verified for the session, never a
  // client-supplied field.
  if (approvedMailAllowed(settings, email)) return null;

  const until = maintenance.active ? maintenance.until : '';

  // Something is blocking AND we could not establish this author's address at
  // all. That is a different fact from "not on the list", and reporting it as
  // NOT_APPROVED is actively misleading: the admin sees a correct allowlist
  // while a correctly-listed author is turned away with no way to tell why.
  // resolveClerkEmail normally prevents this, so reaching here means Clerk's
  // own lookup failed -- still refused (an unidentifiable caller is not an
  // approved one) but with its own code and a message that points at the fix.
  if (!(email || '').trim()) {
    return {
      status: 503,
      body: {
        success: false,
        code: 'EMAIL_UNAVAILABLE',
        error:
          'We could not read the email address of your signed-in account, so the approved list cannot be checked. Please sign out and sign in again, or contact the conference team.',
        maintenance_until: until,
      },
    };
  }

  if (approvedMailListEnabled(settings)) {
    return {
      status: 403,
      body: {
        success: false,
        code: 'NOT_APPROVED',
        error:
          action === 'submit'
            ? 'New submissions are currently limited to specific email addresses. Please contact the conference team if you need to be added to the list.'
            : 'File updates are currently limited to specific email addresses. Please contact the conference team if you need to be added to the list.',
        maintenance_until: until,
      },
    };
  }

  return {
    status: 503,
    body: {
      success: false,
      error:
        action === 'submit'
          ? maintenance.active
            ? 'The submission portal is under maintenance and new submissions are disabled. Please try again later.'
            : 'New submissions are currently closed. Please try again later.'
          : maintenance.active
            ? 'The submission portal is under maintenance and file updates are disabled. Please try again later.'
            : 'File updates are currently closed. Please try again later.',
      maintenance_until: until,
    },
  };
}

// Returns whether registration is currently open AND the submission is
// accepted, so that only eligible authors can register / upload proof.
async function registrationEligible(
  env: Bindings,
  submissionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await loadSettingsRecord(env);
  if (settings['registration_open'] !== 'true') {
    return { ok: false, error: 'Registration is currently closed.' };
  }
  const row = await env.DB.prepare(
    `SELECT s.status,
            (SELECT decision FROM reviews r WHERE r.submission_id = s.id ORDER BY r.updated_at DESC LIMIT 1) AS review_decision
     FROM submissions s
     WHERE s.id = ?`
  ).bind(submissionId).first() as any;
  if (!row) return { ok: false, error: 'Submission not found.' };
  const acceptedDecisions = ['ACCEPTED', 'ACCEPTED_WITH_MINOR_CHANGES', 'ACCEPTED_WITH_MAJOR_CHANGES'];
  const acceptedStatuses = ['ACCEPTED', 'READY_FOR_REGISTRATION', 'READY_FOR_CAMERA_READY'];
  const accepted = acceptedDecisions.includes(row.review_decision) || acceptedStatuses.includes(row.status);
  if (!accepted) {
    return { ok: false, error: 'This paper has not been accepted for registration yet.' };
  }
  return { ok: true };
}

app.get('/api/settings', async (c) => {
  const env = c.env as Bindings;
  try {
    const settings = await loadSettingsRecord(env);
    // `registration` is the parsed, default-merged configuration. The user
    // portal reads this to render fees, the early-bird cutoff and bank
    // details, so nothing there has to be hardcoded any more.
    const registration = await loadRegistrationConfig(env);
    // This endpoint is unauthenticated, so the approved email list is redacted
    // out of it: the addresses themselves are the admin's business and must not
    // be readable by anyone. The enabled flag is kept, because the user portal
    // benefits from being able to explain the refusal it will get. Admins read
    // the real list from GET /api/admin/settings, which is token-guarded.
    return c.json({
      success: true,
      settings: { ...settings, approved_mail_ids: '' },
      registration,
    });
  } catch (error) {
    console.error('Fetch settings error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// Authenticated read of the same settings document, WITHOUT the redaction. The
// admin portal needs the real approved-email list in order to edit it. Guarded by
// the /api/admin/* middleware above, so a reviewer token is rejected with 403.
app.get('/api/admin/settings', async (c) => {
  const env = c.env as Bindings;
  try {
    const settings = await loadSettingsRecord(env);
    const registration = await loadRegistrationConfig(env);
    return c.json({ success: true, settings, registration });
  } catch (error) {
    console.error('Fetch admin settings error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// Resolve the live price for one author/registration pair.
//
// The portal needs this the moment an author picks a registration type, because
// the config it rendered on page load can be stale: the admin may have repriced
// while the author was deciding. Authoritative server-side resolution is what
// removes the miscommunication, since the amount shown next to the payment
// instruction and the amount recorded on submit come from the same code path.
//
// Requires a signed-in author so this cannot be used to enumerate the fee
// matrix anonymously. Reads are trivial (one settings row), and it fires once
// per selection rather than on a timer.
app.get('/api/registration/fee', requireClerkAuth, async (c) => {
  const env = c.env as Bindings;
  try {
    const url = new URL(c.req.url);
    const authorType = cleanDisplayText(url.searchParams.get('authorType'), 80);
    const registrationType = cleanDisplayText(url.searchParams.get('registrationType'), 80);
    if (!authorType || !registrationType) {
      return c.json({ success: false, error: 'authorType and registrationType are required.' }, 400);
    }

    const config = await loadRegistrationConfig(env);
    const snapshot = resolveFeeSnapshot(config, authorType, registrationType);
    if (!snapshot) {
      // Author renamed or removed this pair while the form was open. Say so
      // rather than quoting a price that is not actually on offer.
      return c.json(
        { success: false, error: 'This registration type is no longer available. Please choose another.' },
        404
      );
    }

    // The counterfactual bracket is returned too, so the card can state when the
    // late fee kicks in using the admin's own figure and date rather than
    // anything the client worked out for itself.
    const row = config.fees[authorType]?.[registrationType];
    return c.json({
      success: true,
      fee_amount: snapshot.amount,
      fee_tier: snapshot.tier,
      early_bird_until: config.early_bird_until,
      other_amount: snapshot.tier === 'EARLY' ? row?.standard || '' : row?.early || '',
    });
  } catch (error) {
    console.error('Fetch registration fee error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

app.post('/api/admin/settings', async (c) => {
  const env = c.env as Bindings;

  const token = getBearer(c);
  if (!token) {
    return c.json({ success: false, error: 'Unauthorized. Please sign in.' }, 401);
  }
  const verified = await verifyToken(c, token);
  if (!verified.ok) {
    return c.json({ success: false, error: 'Invalid or expired session. Please sign in again.' }, 401);
  }
  try {
    const body = await c.req.json();
    const statements: D1PreparedStatement[] = [];

    // Legacy single-mode toggle (still honoured): maps onto the user portal.
    if (typeof body.maintenance_mode === 'boolean') {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('maintenance_user_enabled', body.maintenance_mode.toString())
      );
    }

    const str = (v: unknown): string | undefined =>
      typeof v === 'string' ? (v as string).trim() : typeof v === 'boolean' ? v.toString() : undefined;

    const userEnabled = str(body.maintenance_user_enabled);
    if (userEnabled !== undefined) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('maintenance_user_enabled', userEnabled)
      );
    }
    // Independent of maintenance_user_enabled: closing submissions to new
    // papers no longer requires also announcing a portal-wide outage.
    const paperAcceptance = str(body.paper_acceptance_enabled);
    if (paperAcceptance !== undefined) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('paper_acceptance_enabled', paperAcceptance)
      );
    }
    const userUntil = str(body.maintenance_user_until);
    if (userUntil !== undefined) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('maintenance_user_until', userUntil)
      );
    }
    const reviewEnabled = str(body.maintenance_review_enabled);
    if (reviewEnabled !== undefined) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('maintenance_review_enabled', reviewEnabled)
      );
    }
    const reviewUntil = str(body.maintenance_review_until);
    if (reviewUntil !== undefined) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('maintenance_review_until', reviewUntil)
      );
    }

    const registrationOpen = str(body.registration_open);
    if (registrationOpen !== undefined) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('registration_open', registrationOpen)
      );
    }

    // Whether authors may replace the files on a submission they have already
    // made. Independent of maintenance, and defaults to allowed when absent.
    if (typeof body.file_edits_enabled === 'boolean') {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('file_edits_enabled', body.file_edits_enabled.toString())
      );
    }

    // The approved email list, consulted only while paper acceptance is off.
    // Validated and normalized before anything is written, so a rejected save
    // leaves the previous list intact rather than half-applying it.
    let normalizedApprovedMailIds: string | null = null;
    if (body.approved_mail_ids !== undefined) {
      const normalized = normalizeApprovedMailIds(body.approved_mail_ids);
      if (!normalized.ok) {
        return c.json({ success: false, error: normalized.error }, 400);
      }
      normalizedApprovedMailIds = normalized.value;
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('approved_mail_ids', normalizedApprovedMailIds)
      );
    }
    if (typeof body.approved_mail_ids_enabled === 'boolean') {
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('approved_mail_ids_enabled', body.approved_mail_ids_enabled.toString())
      );
    }

    // Fees, early-bird cutoff and bank details. Validated as a whole before
    // anything is written, so a rejected save leaves the previous config in
    // place rather than half-applying it.
    if (body.registration_config !== undefined) {
      const validated = validateRegistrationConfig(body.registration_config);
      if (!validated.ok) {
        return c.json({ success: false, error: validated.error }, 400);
      }
      statements.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
        ).bind('registration_config', JSON.stringify(validated.value))
      );
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Cron: Permanently purge soft-deleted submissions older than 30 days.
// Removes the DB rows (authors, files, submission) and the R2 objects.
// ------------------------------------------------------------------
const PURGE_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function purgeExpiredDeleted(env: Bindings) {
  try {
    const cutoff = new Date(Date.now() - PURGE_AGE_MS).toISOString();

    const fileRes = await env.DB.prepare(
      `SELECT storage_key FROM submission_files
       WHERE submission_id IN (
         SELECT id FROM submissions WHERE deleted_at IS NOT NULL AND deleted_at < ?
       )`
    ).bind(cutoff).all();

    // Payment-proof blobs live in the proof bucket (key prefix `proof/`),
    // not in submission_files, so they must be collected separately.
    const proofRes = await env.DB.prepare(
      `SELECT payment_proof_url FROM submissions
       WHERE deleted_at IS NOT NULL AND deleted_at < ? AND payment_proof_url IS NOT NULL AND payment_proof_url <> ''`
    ).bind(cutoff).all();

    await env.DB.batch([
      env.DB.prepare(
        `DELETE FROM authors WHERE submission_id IN (
           SELECT id FROM submissions WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`
      ).bind(cutoff),
      env.DB.prepare(
        `DELETE FROM submission_files WHERE submission_id IN (
           SELECT id FROM submissions WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`
      ).bind(cutoff),
      env.DB.prepare(
        `DELETE FROM mail_logs WHERE submission_id IN (
           SELECT id FROM submissions WHERE deleted_at IS NOT NULL AND deleted_at < ?
         )`
      ).bind(cutoff),
      env.DB.prepare(
        `DELETE FROM submissions WHERE deleted_at IS NOT NULL AND deleted_at < ?`
      ).bind(cutoff),
    ]);

    for (const f of (fileRes.results as any[] || [])) {
      if (f && f.storage_key) {
        await env.BUCKET.delete(f.storage_key).catch(() => { });
      }
    }
    for (const p of (proofRes.results as any[] || [])) {
      if (p && p.payment_proof_url) {
        await env.PROOF_BUCKET.delete(p.payment_proof_url).catch(() => { });
        await env.BUCKET.delete(p.payment_proof_url).catch(() => { });
      }
    }
  } catch (error) {
    console.error('Purge deleted submissions error:', error);
  }
}

// ------------------------------------------------------------------
// User: Upload payment proof
// ------------------------------------------------------------------
// Payment proofs are capped tighter than manuscripts: they are phone
// screenshots, so anything near 10 MB is a camera photo rather than a receipt
// screenshot, and a smaller ceiling keeps each proof cheap to store and to scan.
const PAYMENT_PROOF_MAX_BYTES = 4 * 1024 * 1024; // 4MB
const PAYMENT_PROOF_ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const PAYMENT_PROOF_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

app.post('/api/user/submissions/:id/payment-proof', requireClerkAuth, async (c) => {
  try {
    const clerkUserId = c.get('clerkUserId') as string;
    const clerkEmail = (c.get('clerkEmail') || '').trim();
    const submissionId = c.req.param('id');
    const userId = await ensureUserForClerk(c, clerkUserId, clerkEmail);

    const submission = await c.env.DB.prepare(
      `SELECT id, user_id, author_email FROM submissions WHERE id = ? AND deleted_at IS NULL`
    ).bind(submissionId).first() as any;
    if (!submission) return c.json({ success: false, error: 'Submission not found.' }, 404);
    const ownsSubmission =
      submission.user_id === userId ||
      ((clerkEmail || '').trim().toLowerCase() !== '' &&
        (submission.author_email || '').trim().toLowerCase() === clerkEmail.trim().toLowerCase());
    if (!ownsSubmission) return c.json({ success: false, error: 'Unauthorized.' }, 403);

    const eligibility = await registrationEligible(c.env, submissionId as string);
    if (!eligibility.ok) return c.json({ success: false, error: eligibility.error }, 403);

    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    if (!file) return c.json({ success: false, error: 'No file provided.' }, 400);

    if (file.size > PAYMENT_PROOF_MAX_BYTES) {
      return c.json({ success: false, error: 'Payment proof file must be 4MB or smaller.' }, 400);
    }
    const name = file.name || 'proof.png';
    const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')).toLowerCase() : '';
    if (!PAYMENT_PROOF_EXT.has(ext) || !PAYMENT_PROOF_ALLOWED.includes(file.type)) {
      return c.json(
        { success: false, error: 'Payment proof must be a JPG, PNG, WebP or PDF file.' },
        400
      );
    }

    // Free any previous proof object so re-uploads can't orphan R2 blobs.
    const prev = await c.env.DB.prepare(
      `SELECT payment_proof_url FROM submissions WHERE id = ?`
    ).bind(submissionId).first() as any;
    if (prev?.payment_proof_url) {
      await c.env.PROOF_BUCKET.delete(prev.payment_proof_url).catch(() => { });
      await c.env.BUCKET.delete(prev.payment_proof_url).catch(() => { });
    }

    const storageKey = `proof/${submissionId}-${Date.now()}${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    await c.env.PROOF_BUCKET.put(storageKey, arrayBuffer, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE submissions
       SET payment_proof_url = ?, payment_status = 'PENDING', payment_approved_at = NULL, payment_submitted_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(storageKey, now, now, submissionId).run();

    // Read the text out of the proof in the background, so the author is not
    // held waiting on OCR and a slow or failed scan cannot block registration.
    // The admin's duplicate-payment tab picks the result up when it lands.
    c.executionCtx.waitUntil(
      scanProofOcr(c.env, {
        submissionId: submissionId as string,
        storageKey,
        originalFilename: file.name || name,
      })
    );

    return c.json({ success: true, payment_proof_url: storageKey, payment_status: 'PENDING' });
  } catch (err: any) {
    console.error('Payment proof upload error:', err);
    return c.json({ success: false, error: 'Failed to upload payment proof.' }, 500);
  }
});

// ------------------------------------------------------------------
// User: Complete registration / submit payment info
// ------------------------------------------------------------------
app.post('/api/user/submissions/:id/register', requireClerkAuth, async (c) => {
  try {
    const clerkUserId = c.get('clerkUserId') as string;
    const clerkEmail = (c.get('clerkEmail') || '').trim();
    const submissionId = c.req.param('id');
    const userId = await ensureUserForClerk(c, clerkUserId, clerkEmail);

    const submission = await c.env.DB.prepare(
      `SELECT id, user_id, author_email, payment_proof_url, registration_type, author_type, fee_amount, fee_tier FROM submissions WHERE id = ? AND deleted_at IS NULL`
    ).bind(submissionId).first() as any;
    if (!submission) return c.json({ success: false, error: 'Submission not found.' }, 404);
    const ownsSubmission =
      submission.user_id === userId ||
      ((clerkEmail || '').trim().toLowerCase() !== '' &&
        (submission.author_email || '').trim().toLowerCase() === clerkEmail.trim().toLowerCase());
    if (!ownsSubmission) return c.json({ success: false, error: 'Unauthorized.' }, 403);

    const eligibility = await registrationEligible(c.env, submissionId as string);
    if (!eligibility.ok) return c.json({ success: false, error: eligibility.error }, 403);

    const body = await c.req.json().catch(() => ({}));
    const { registration_type, author_type, utr_transaction_id, fee_amount, fee_tier } = body;
    const now = new Date().toISOString();

    const registrationType = (registration_type || '').trim();
    const authorType = (author_type || '').trim();
    const utr = (utr_transaction_id || '').trim();

    if (!registrationType || !authorType || !utr) {
      return c.json(
        { success: false, error: 'Registration type, author type, and transaction ID are required.' },
        400
      );
    }

    // The admin-editable fee matrix is the source of truth for which
    // registration/author type pairs exist, so a hand-rolled request cannot
    // invent a combination the admin never configured.
    //
    // Escape hatch: if the admin renamed or removed a type after this paper was
    // already registered, the author may resubmit the exact values already on
    // file, so a fee-table edit can never strand somebody mid-payment.
    const config = await loadRegistrationConfig(c.env);
    const knownPair = !!config.fees[authorType]?.[registrationType];
    const unchangedOnFile =
      registrationType === (submission.registration_type || '').trim() &&
      authorType === (submission.author_type || '').trim();
    if (!knownPair && !unchangedOnFile) {
      return c.json(
        { success: false, error: 'That registration type and author type combination is not available. Please pick from the listed options.' },
        400
      );
    }

    // Registration must never be submitted without an uploaded payment proof.
    if (!submission.payment_proof_url) {
      return c.json({ success: false, error: 'Please upload your payment proof before registering.' }, 400);
    }

    // Snapshot what this author was charged, so the admin export can report the
    // amount collected instead of re-deriving it from a fee matrix that may since
    // have been edited. On the re-register escape hatch above the pair is no
    // longer in the matrix, so the amount already on file is preserved rather than
    // blanked -- an admin rename must never erase a payment record.
    const snapshot = resolveFeeSnapshot(config, authorType, registrationType, fee_amount, fee_tier);

    // The admin can reprice while an author has this form open. Recording the new
    // figure against a payment the author agreed to at the old one would be a
    // silent price change, so refuse and let them re-confirm. Nothing is written
    // on this path, and the already-uploaded proof is untouched.
    const refusal = staleAmountRefusal(config, authorType, registrationType, snapshot, fee_amount);
    if (refusal) {
      return c.json(
        {
          success: false,
          error: 'The registration fee changed while you were filling this in.',
          ...refusal,
        },
        409
      );
    }

    const feeAmount = snapshot ? snapshot.amount : (submission.fee_amount || null);
    const feeTier = snapshot ? snapshot.tier : (submission.fee_tier || null);

    // Reset the workflow flags when re-registering after a decline so the
    // admin sees the submission as pending again (not silently re-approved).
    await c.env.DB.prepare(
      `UPDATE submissions SET registration_type = ?, author_type = ?, utr_transaction_id = ?, fee_amount = ?, fee_tier = ?, payment_status = 'PENDING', payment_approved_at = NULL, payment_submitted_at = ?, updated_at = ? WHERE id = ?`
    ).bind(registrationType, authorType, utr, feeAmount, feeTier, now, now, submissionId).run();

    return c.json({
      success: true,
      payment_status: 'PENDING',
      fee_amount: feeAmount,
      fee_tier: feeTier,
    });
  } catch (err: any) {
    console.error('Register submission error:', err);
    return c.json({ success: false, error: 'Failed to save registration details.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Stream payment proof image/pdf
// ------------------------------------------------------------------
app.get('/api/admin/submissions/:id/payment-proof', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid session.' }, 401);

    const submissionId = c.req.param('id');
    const sub = await c.env.DB.prepare(
      `SELECT payment_proof_url FROM submissions WHERE id = ?`
    ).bind(submissionId).first() as any;

    if (!sub || !sub.payment_proof_url) {
      return c.json({ success: false, error: 'No payment proof uploaded for this submission.' }, 404);
    }

    let object = await c.env.PROOF_BUCKET.get(sub.payment_proof_url);
    if (!object) {
      object = await c.env.BUCKET.get(sub.payment_proof_url);
    }
    if (!object) {
      return c.json({ success: false, error: 'Payment proof file not found in storage.' }, 404);
    }

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: any) {
    console.error('Payment proof stream error:', err);
    return c.json({ success: false, error: 'Failed to retrieve payment proof.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Duplicate payment report
//
// A declared UTR is self-reported and trivially faked, so the check pairs it
// with the text OCR read out of the uploaded proof. Two submissions are grouped
// when they share a UTR, share byte-identical OCR text (the same file uploaded
// twice), or their OCR texts overlap enough to be the same screenshot after a
// crop/resize/recompression -- see src/paymentOcr.ts for the thresholds.
//
// Only rows that actually have a payment are read: a submission with neither a
// UTR nor a proof cannot collide with anything.
// ------------------------------------------------------------------
const PROOF_OCR_EXCERPT_CHARS = 400;

const truncateExcerpt = (text: string | null | undefined) => {
  const trimmed = (text || '').replace(/\s+/g, ' ').trim();
  if (trimmed.length <= PROOF_OCR_EXCERPT_CHARS) return trimmed;
  return `${trimmed.slice(0, PROOF_OCR_EXCERPT_CHARS)}…`;
};

app.get('/api/admin/duplicate-payments', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid session.' }, 401);

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.author_name, s.author_email,
              s.registration_type, s.author_type, s.payment_status, s.utr_transaction_id,
              s.fee_amount, s.fee_tier, s.payment_submitted_at, s.payment_approved_at,
              s.payment_proof_url, s.created_at,
              o.original_filename AS proof_filename,
              o.ocr_text        AS proof_ocr_text,
              o.ocr_norm        AS proof_ocr_norm,
              o.ocr_hash        AS proof_ocr_hash,
              o.token_count     AS proof_ocr_token_count,
              o.status          AS proof_ocr_status,
              o.error           AS proof_ocr_error,
              o.scanned_at      AS proof_ocr_scanned_at,
              o.updated_at      AS proof_ocr_updated_at
       FROM submissions s
       LEFT JOIN payment_proof_ocr o ON o.submission_id = s.id
       WHERE s.deleted_at IS NULL
         AND (s.utr_transaction_id IS NOT NULL AND TRIM(s.utr_transaction_id) <> ''
              OR s.payment_proof_url IS NOT NULL)
       ORDER BY s.payment_submitted_at DESC, s.created_at DESC`
    ).all() as any;

    const rows = (results || []) as any[];

    const groups = findDuplicatePaymentGroups(
      rows.map((r) => ({
        id: r.id as string,
        utr: r.utr_transaction_id as string | null,
        hash: r.proof_ocr_hash as string | null,
        normalized: r.proof_ocr_norm as string | null,
        tokenCount: r.proof_ocr_token_count as number | null,
      }))
    );

    // A group can join several submissions; keep them in report order.
    const order = new Map(rows.map((r, i) => [r.id as string, i]));
    const groupIds = new Set<string>();
    groups.forEach((g) => g.submissionIds.forEach((id) => groupIds.add(id)));

    const toEntry = (r: any) => ({
      id: r.id,
      paper_id: r.paper_id,
      submission_code: r.submission_code,
      title: r.title,
      author_name: r.author_name,
      author_email: r.author_email,
      registration_type: r.registration_type,
      author_type: r.author_type,
      payment_status: r.payment_status,
      utr_transaction_id: r.utr_transaction_id,
      fee_amount: r.fee_amount,
      fee_tier: r.fee_tier,
      payment_submitted_at: r.payment_submitted_at,
      payment_approved_at: r.payment_approved_at,
      has_proof: !!r.payment_proof_url,
      proof_filename: r.proof_filename || null,
      ocr_status: r.proof_ocr_status || (r.payment_proof_url ? 'PENDING' : 'NONE'),
      ocr_error: r.proof_ocr_error || null,
      ocr_scanned_at: r.proof_ocr_scanned_at || null,
      ocr_excerpt: truncateExcerpt(r.proof_ocr_text),
    });

    // Proofs the admin still has to act on, surfaced as counts so the tab can
    // say "3 scans failed" instead of silently under-reporting duplicates.
    const needsScan = findProofsNeedingScan(rows, groupIds);
    const needsScanTotal = rows.filter((r) => proofNeedsScan(r)).length;

    return c.json({
      success: true,
      summary: {
        payments_with_reference: rows.length,
        flagged: groupIds.size,
        groups: groups.length,
        ocr_done: rows.filter((r) => r.proof_ocr_status === 'DONE').length,
        ocr_pending: rows.filter((r) => r.payment_proof_url && !r.proof_ocr_status).length,
        ocr_failed: rows.filter((r) => r.proof_ocr_status === 'FAILED').length,
        ocr_empty: rows.filter((r) => r.proof_ocr_status === 'EMPTY').length,
        needs_scan: needsScanTotal,
      },
      // Proofs that still have to be read, minus the ones already rendered
      // inside a duplicate group. Anything still waiting here is invisible to
      // the group list by definition -- a payment nobody has scanned cannot be
      // known to duplicate anything yet -- so it needs its own section or the
      // admin is never offered the button that would clear it.
      needs_scan: needsScan.slice(0, 200).map(toEntry),
      groups: groups.map((g) => ({
        id: g.id,
        reasons: g.reasons,
        entries: g.submissionIds
          .map((id) => rows.find((r) => r.id === id))
          .filter(Boolean)
          .sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
          .map(toEntry),
      })),
    });
  } catch (err: any) {
    console.error('Duplicate payments report error:', err);
    return c.json({ success: false, error: 'Failed to build the duplicate payment report.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Re-run OCR on a payment proof
//
// Used for proofs uploaded before OCR existed, for scans that failed (a
// transient OCR.space error, or a proof that was too large for the free key),
// and to pick up a proof whose filename changed.
// ------------------------------------------------------------------
app.post('/api/admin/submissions/:id/payment-ocr', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid session.' }, 401);

    const submissionId = c.req.param('id') as string;
    const sub = await c.env.DB.prepare(
      `SELECT id, payment_proof_url FROM submissions WHERE id = ?`
    ).bind(submissionId).first() as any;
    if (!sub) return c.json({ success: false, error: 'Submission not found.' }, 404);
    if (!sub.payment_proof_url) {
      return c.json({ success: false, error: 'This submission has no payment proof to scan.' }, 400);
    }

    // Reuse the filename from the previous scan so a rescan reports the same
    // file the admin clicked on.
    const prev = await c.env.DB.prepare(
      `SELECT original_filename FROM payment_proof_ocr WHERE submission_id = ?`
    ).bind(submissionId).first() as any;

    c.executionCtx.waitUntil(
      scanProofOcr(c.env, {
        submissionId,
        storageKey: sub.payment_proof_url as string,
        originalFilename: prev?.original_filename || null,
      })
    );

    return c.json({ success: true, status: 'PENDING' });
  } catch (err: any) {
    console.error('Payment OCR rescan error:', err);
    return c.json({ success: false, error: 'Failed to start the OCR scan.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Sweep proofs that have never been scanned
//
// Migration 0029 starts with an empty table, so every proof uploaded before it
// has no OCR text and therefore cannot appear in any duplicate group. Those are
// precisely the established registrations, i.e. the most likely place a reused
// screenshot is sitting unnoticed. This starts a bounded batch of them.
//
// Deliberately NOT limited to the rows the report's `needs_scan` list returns:
// that list drops proofs already shown in a duplicate group, but a group formed
// only from a matching UTR still has un-scanned screenshots that the screenshot
// comparison needs to see.
//
// Bounded on purpose. OCR.space's free key allows 500 requests/day per IP, so
// this fires a small batch per call and the admin sweeps repeatedly rather than
// launching hundreds of concurrent requests that would exhaust the quota and
// fail. The caller paces itself between batches.
// ------------------------------------------------------------------
app.post('/api/admin/duplicate-payments/scan-missing', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid session.' }, 401);

    const requested = Number(c.req.query('limit'));
    const limit = Number.isFinite(requested) ? Math.min(25, Math.max(1, Math.trunc(requested))) : 8;
    const cutoff = stuckScanCutoff();

    // Same predicate as `proofNeedsScan`, expressed in SQL because the sweep
    // must not trust the rows it was handed by the client.
    const NEEDS_SCAN_SQL = `
      FROM submissions s
      LEFT JOIN payment_proof_ocr o ON o.submission_id = s.id
      WHERE s.deleted_at IS NULL
        AND s.payment_proof_url IS NOT NULL
        AND (
              o.submission_id IS NULL
           OR o.status = 'FAILED'
           OR (o.status = 'PENDING' AND o.updated_at < ?)
        )`;

    const { results } = await c.env.DB.prepare(
      `SELECT s.id, s.payment_proof_url, o.original_filename ${NEEDS_SCAN_SQL}
       ORDER BY s.payment_submitted_at DESC, s.created_at DESC
       LIMIT ?`
    )
      .bind(cutoff, limit)
      .all() as any;

    const batch = (results || []) as any[];

    const remaining = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n ${NEEDS_SCAN_SQL}`
    )
      .bind(cutoff)
      .first<{ n: number }>();
    const outstanding = (remaining?.n ?? 0) - batch.length;

    for (const row of batch) {
      c.executionCtx.waitUntil(
        scanProofOcr(c.env, {
          submissionId: row.id as string,
          storageKey: row.payment_proof_url as string,
          originalFilename: row.original_filename || null,
        })
      );
    }

    return c.json({
      success: true,
      started: batch.length,
      // What is still queued after this batch, so the UI can show real progress
      // instead of guessing how many clicks are left.
      remaining: Math.max(0, outstanding),
    });
  } catch (err: any) {
    console.error('Duplicate payments sweep error:', err);
    return c.json({ success: false, error: 'Failed to start the scan sweep.' }, 500);
  }
});

// ------------------------------------------------------------------
// Admin: Approve / Update payment status
// ------------------------------------------------------------------
app.post('/api/admin/submissions/:id/payment-status', async (c) => {
  try {
    const token = getBearer(c);
    if (!token) return c.json({ success: false, error: 'Unauthorized.' }, 401);
    const verified = await verifyToken(c, token);
    if (!verified.ok) return c.json({ success: false, error: 'Invalid session.' }, 401);

    const submissionId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const status = body.status === 'APPROVED' ? 'APPROVED' : body.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
    const approvedAt = status === 'APPROVED' ? new Date().toISOString() : null;

    const exists = await c.env.DB.prepare(`SELECT id FROM submissions WHERE id = ?`)
      .bind(submissionId).first() as any;
    if (!exists) {
      return c.json({ success: false, error: 'Submission not found.' }, 404);
    }

    await c.env.DB.prepare(
      `UPDATE submissions SET payment_status = ?, payment_approved_at = ?, updated_at = ? WHERE id = ?`
    ).bind(status, approvedAt, new Date().toISOString(), submissionId).run();

    return c.json({ success: true, payment_status: status, payment_approved_at: approvedAt });
  } catch (err: any) {
    console.error('Update payment status error:', err);
    return c.json({ success: false, error: 'Failed to update payment status.' }, 500);
  }
});

async function scheduled(_controller: ScheduledController, env: Bindings, _ctx: ExecutionContext) {
  await purgeExpiredDeleted(env);
}

export default {
  fetch: app.fetch,
  scheduled,
};
