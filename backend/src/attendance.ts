// ==================================================================
// ICAIDIET'26 paper attendance — one secret QR per offline paper
//
// Who gets a QR: every live paper whose attendance mode is OFFLINE, plus
// paper 1271 (offline by arrangement). One QR per paper, shown to every
// author of that paper who signs in to the user portal.
//
// QR text (53 chars):   ICD26.<token:24 hex>.<sig:22 base64url>
//   token = random value stored in paper_attendance_qr (one per paper)
//   sig   = first 16 bytes of HMAC-SHA256(QR key, "ICD26|" + token)
// The QR key never leaves the Worker, so a QR cannot be forged, and any other
// QR (UPI, URLs, another event) is rejected by the scanner and the server.
//
// Flow: scanner (no sign-in, no location check)
//   POST /api/attendance/scan  -> paper details + a 15-minute signed ticket
//   POST /api/attendance/mark  -> ticket + which authors are present
// paper_attendance.submission_id is the PRIMARY KEY, so a paper is marked
// once, even if two scanners submit at the same moment.
// ==================================================================

import type { Hono } from 'hono';

type Env = {
  DB: D1Database;
  AUTH_SECRET: string;
  QR_SIGNING_SECRET?: string;
};

export type AttendanceDeps = {
  signToken: (c: any, subject: string, ttlSeconds: number) => Promise<string>;
  verifyToken: (c: any, token: string) => Promise<{ ok: boolean; subject?: string }>;
  rateLimit: (c: any, key: string, limit: number, windowMs: number) => boolean;
  generateXlsx: (headers: string[], rows: string[][]) => Uint8Array;
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

// Papers that attend offline even though their attendance_mode says otherwise.
export const OFFLINE_SPECIAL_PAPER_IDS = ['1271'];

const ELIGIBLE_SQL = `s.deleted_at IS NULL AND (s.attendance_mode = 'OFFLINE' OR s.paper_id IN (${OFFLINE_SPECIAL_PAPER_IDS.map(
  (p) => `'${p}'`
).join(',')}))`;

// ------------------------------------------------------------------
// Scanner settings. There is no location check: the scanner works anywhere.
// `scanning_enabled` lets the organisers pause scanning without a deploy
// (POST /api/admin/attendance/config {"scanning_enabled": false}).
// ------------------------------------------------------------------
type ScannerConfig = {
  venue_name: string;
  scanning_enabled: boolean;
};

const DEFAULT_CONFIG: ScannerConfig = {
  venue_name: 'SNS College of Technology, Coimbatore',
  scanning_enabled: true,
};

let configCache: { value: ScannerConfig; at: number } | null = null;

function parseConfig(raw: unknown): ScannerConfig {
  let o: any = {};
  try {
    o = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
  } catch {
    o = {};
  }
  return {
    venue_name: typeof o.venue_name === 'string' && o.venue_name.trim() ? o.venue_name.trim().slice(0, 120) : DEFAULT_CONFIG.venue_name,
    scanning_enabled: o.scanning_enabled !== false,
  };
}

async function loadConfig(env: Env, fresh = false): Promise<ScannerConfig> {
  if (!fresh && configCache && Date.now() - configCache.at < 15_000) return configCache.value;
  const row = (await env.DB.prepare(`SELECT value FROM settings WHERE key = 'attendance_scanner_config'`).first()) as any;
  const value = parseConfig(row?.value ?? null);
  configCache = { value, at: Date.now() };
  return value;
}

// ------------------------------------------------------------------
// QR crypto
// ------------------------------------------------------------------
const enc = new TextEncoder();
const QR_PATTERN = /^ICD26\.([a-f0-9]{24})\.([A-Za-z0-9_-]{22})$/;
let qrKeyCache: { base: string; key: CryptoKey } | null = null;

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// QR_SIGNING_SECRET if set (recommended), otherwise a key derived from
// AUTH_SECRET. Changing whichever is in use invalidates every QR on screen.
async function qrKey(env: Env): Promise<CryptoKey> {
  const base = env.QR_SIGNING_SECRET || env.AUTH_SECRET;
  if (!base) throw new Error('AUTH_SECRET / QR_SIGNING_SECRET is not configured');
  if (qrKeyCache?.base === base) return qrKeyCache.key;
  let material: BufferSource = enc.encode(base);
  if (!env.QR_SIGNING_SECRET) {
    const k = await crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    material = await crypto.subtle.sign('HMAC', k, enc.encode('icaidiet26-attendance-qr-v1'));
  }
  const key = await crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  qrKeyCache = { base, key };
  return key;
}

async function sigFor(env: Env, token: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', await qrKey(env), enc.encode(`ICD26|${token}`))).slice(0, 16);
}

async function qrTextFor(env: Env, token: string): Promise<string> {
  return `ICD26.${token}.${b64url(await sigFor(env, token))}`;
}

async function verifyQr(env: Env, raw: unknown): Promise<string | null> {
  const m = QR_PATTERN.exec(String(raw || '').trim());
  if (!m) return null;
  let given: Uint8Array;
  try {
    given = b64urlDecode(m[2]);
  } catch {
    return null;
  }
  const want = await sigFor(env, m[1]);
  if (given.length !== want.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= given[i] ^ want[i];
  return diff === 0 ? m[1] : null;
}

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// Makes sure every eligible paper has its own QR stored in the database:
// a random per-paper token plus the full signed QR text (qr_payload). Never
// replaces an existing token, so a QR an author has already seen stays valid.
// Also rewrites qr_payload if it is missing or was signed with an old key.
// Runs on the hourly cron, on the admin list, and when an author opens the QR.
export async function syncAttendanceQrs(env: Env, submissionId?: string): Promise<{ created: number; filled: number }> {
  const filter = submissionId ? 'AND s.id = ?' : '';
  const args = submissionId ? [submissionId] : [];
  const { results: missing } = await env.DB.prepare(
    `SELECT s.id FROM submissions s
     WHERE ${ELIGIBLE_SQL} ${filter}
       AND NOT EXISTS (SELECT 1 FROM paper_attendance_qr q WHERE q.submission_id = s.id)`
  ).bind(...args).all();
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];
  for (const r of (missing || []) as any[]) {
    const token = newToken();
    stmts.push(
      env.DB.prepare(`INSERT OR IGNORE INTO paper_attendance_qr (submission_id, qr_token, qr_payload, created_at) VALUES (?, ?, ?, ?)`)
        .bind(r.id, token, await qrTextFor(env, token), now)
    );
  }
  const { results: existing } = await env.DB.prepare(
    `SELECT q.submission_id, q.qr_token, q.qr_payload FROM paper_attendance_qr q JOIN submissions s ON s.id = q.submission_id
     WHERE ${ELIGIBLE_SQL} ${filter}`
  ).bind(...args).all();
  let filled = 0;
  for (const r of (existing || []) as any[]) {
    const want = await qrTextFor(env, r.qr_token);
    if (r.qr_payload !== want) {
      stmts.push(env.DB.prepare(`UPDATE paper_attendance_qr SET qr_payload = ? WHERE submission_id = ?`).bind(want, r.submission_id));
      filled++;
    }
  }
  for (let i = 0; i < stmts.length; i += 80) await env.DB.batch(stmts.slice(i, i + 80));
  return { created: (missing || []).length, filled };
}

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------
function istDay(d = new Date()) {
  return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

function ip(c: any) {
  return c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || '';
}

function displayPaperId(s: { paper_id?: string | null; submission_code?: string | null }) {
  const p = String(s.paper_id || '').trim();
  return p && p.toUpperCase() !== 'NA' ? p : String(s.submission_code || '');
}

function authorName(a: any) {
  return [a.title, a.first_name, a.last_name].map((x) => String(x || '').trim()).filter(Boolean).join(' ');
}

async function loadPaper(env: Env, submissionId: string) {
  const [subRes, authRes, attRes] = await env.DB.batch([
    env.DB.prepare(
      `SELECT s.id, s.paper_id, s.submission_code, s.title, s.phase2_head_count, s.phase2_track
       FROM submissions s WHERE s.id = ?`
    ).bind(submissionId),
    env.DB.prepare(
      `SELECT id, is_primary, title, first_name, last_name, college FROM authors WHERE submission_id = ? ORDER BY is_primary DESC, created_at, id`
    ).bind(submissionId),
    env.DB.prepare(`SELECT marked_at, presented_count, authors_json FROM paper_attendance WHERE submission_id = ?`).bind(submissionId),
  ]);
  const sub = (subRes.results || [])[0] as any;
  if (!sub) return null;
  const authors = ((authRes.results || []) as any[]).map((a) => ({
    id: a.id as string,
    name: authorName(a) || 'Author',
    title: (a.title || '') as string,
    first_name: (a.first_name || '') as string,
    last_name: (a.last_name || '') as string,
    college: String(a.college || '').trim(),
    is_primary: !!a.is_primary,
  }));
  const colleges = Array.from(new Set(authors.map((a) => a.college).filter(Boolean)));
  const att = (attRes.results || [])[0] as any;
  return {
    submission_id: sub.id as string,
    paper_id: displayPaperId(sub),
    title: sub.title as string,
    track: (sub.phase2_track || '') as string,
    head_count: (sub.phase2_head_count ?? null) as number | null,
    colleges,
    authors,
    attendance: att
      ? { marked_at: att.marked_at as string, presented_count: att.presented_count as number, authors: JSON.parse(att.authors_json || '[]') }
      : null,
  };
}

function log(c: any, row: { submission_id?: string | null; result: string; detail?: string; lat?: unknown; lng?: unknown; acc?: unknown }) {
  const env = c.env as Env;
  const n = (v: unknown) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const p = env.DB.prepare(
    `INSERT INTO attendance_scan_log (submission_id, result, detail, lat, lng, accuracy, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(row.submission_id || null, row.result, (row.detail || '').slice(0, 200), n(row.lat), n(row.lng), n(row.acc), ip(c), (c.req.header('User-Agent') || '').slice(0, 200), new Date().toISOString())
    .run()
    .catch(() => undefined);
  try {
    c.executionCtx.waitUntil(p);
  } catch {
    /* no execution context */
  }
}

// ------------------------------------------------------------------
// routes
// ------------------------------------------------------------------
export function registerAttendanceRoutes(app: Hono<any>, deps: AttendanceDeps) {
  // Public: the scanner reads whether scanning is paused.
  app.get('/api/attendance/config', async (c) => {
    const cfg = await loadConfig(c.env as Env);
    return c.json({ success: true, ...cfg });
  });

  app.post('/api/attendance/scan', async (c) => {
    const env = c.env as Env;
    if (!deps.rateLimit(c, 'att-scan', 120, 60_000)) {
      return c.json({ success: false, code: 'RATE', error: 'Too many scans from this device. Wait a moment.' }, 429);
    }
    const body = (await c.req.json().catch(() => null)) as any;
    const { lat, lng, accuracy } = body || {};
    const cfg = await loadConfig(env);
    if (!cfg.scanning_enabled) return c.json({ success: false, code: 'PAUSED', error: 'Attendance scanning is paused by the organisers.' }, 403);


    const token = await verifyQr(env, body?.qr);
    if (!token) {
      log(c, { result: 'INVALID_QR', detail: String(body?.qr || '').slice(0, 80), lat, lng, acc: accuracy });
      return c.json({ success: false, code: 'INVALID_QR', error: "This is not an ICAIDIET'26 attendance QR." }, 400);
    }

    const row = (await env.DB.prepare(
      `SELECT q.submission_id FROM paper_attendance_qr q JOIN submissions s ON s.id = q.submission_id
       WHERE q.qr_token = ? AND (q.qr_payload IS NULL OR q.qr_payload = ?) AND ${ELIGIBLE_SQL}`
    ).bind(token, String(body?.qr || '').trim()).first()) as any;
    if (!row) {
      log(c, { result: 'UNKNOWN_QR', detail: token, lat, lng, acc: accuracy });
      return c.json({ success: false, code: 'UNKNOWN_QR', error: 'This QR is no longer valid for attendance.' }, 404);
    }

    const paper = await loadPaper(env, row.submission_id);
    if (!paper) return c.json({ success: false, code: 'UNKNOWN_QR', error: 'Paper not found.' }, 404);
    log(c, { submission_id: paper.submission_id, result: paper.attendance ? 'SCAN_ALREADY_MARKED' : 'SCAN_OK', lat, lng, acc: accuracy });

    if (paper.attendance) return c.json({ success: true, already_marked: true, paper });
    const ticket = await deps.signToken(c, `attscan:${paper.submission_id}`, 15 * 60);
    return c.json({ success: true, already_marked: false, paper, ticket });
  });

  app.post('/api/attendance/mark', async (c) => {
    const env = c.env as Env;
    if (!deps.rateLimit(c, 'att-mark', 60, 60_000)) {
      return c.json({ success: false, code: 'RATE', error: 'Too many requests from this device. Wait a moment.' }, 429);
    }
    const body = (await c.req.json().catch(() => null)) as any;
    const { lat, lng, accuracy } = body || {};
    const cfg = await loadConfig(env);
    if (!cfg.scanning_enabled) return c.json({ success: false, code: 'PAUSED', error: 'Attendance scanning is paused by the organisers.' }, 403);

    const v = await deps.verifyToken(c, String(body?.ticket || ''));
    if (!v.ok || !v.subject?.startsWith('attscan:')) {
      return c.json({ success: false, code: 'TICKET', error: 'This scan has expired. Scan the QR again.' }, 401);
    }
    const submissionId = v.subject.slice('attscan:'.length);
    const paper = await loadPaper(env, submissionId);
    if (!paper) return c.json({ success: false, code: 'UNKNOWN_QR', error: 'Paper not found.' }, 404);
    if (paper.attendance) return c.json({ success: false, code: 'ALREADY_MARKED', already_marked: true, paper }, 409);

    const presentIds = new Set<string>(Array.isArray(body?.present_author_ids) ? body.present_author_ids.map(String) : []);
    const roster = paper.authors.map((a) => ({
      id: a.id,
      name: a.name,
      college: a.college,
      status: presentIds.has(a.id) ? 'PRESENT' : 'ABSENT',
    }));
    const presented = roster.filter((r) => r.status === 'PRESENT').length;
    if (presented < 1) {
      return c.json({ success: false, code: 'NONE_PRESENT', error: 'Mark at least one author as present.' }, 400);
    }

    const now = new Date().toISOString();
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO paper_attendance
         (submission_id, paper_id, title, head_count, author_count, presented_count, authors_json, colleges, marked_at, event_day, lat, lng, accuracy, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        submissionId,
        paper.paper_id,
        paper.title,
        paper.head_count,
        roster.length,
        presented,
        JSON.stringify(roster),
        paper.colleges.join('; '),
        now,
        istDay(),
        Number.isFinite(Number(lat)) && lat !== null ? Number(lat) : null,
        Number.isFinite(Number(lng)) && lng !== null ? Number(lng) : null,
        Number.isFinite(Number(accuracy)) && accuracy !== null ? Number(accuracy) : null,
        ip(c),
        (c.req.header('User-Agent') || '').slice(0, 200)
      )
      .run();

    if ((res.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, code: 'ALREADY_MARKED', already_marked: true, paper: await loadPaper(env, submissionId) }, 409);
    }
    log(c, { submission_id: submissionId, result: 'MARKED', detail: `${presented}/${roster.length}`, lat, lng, acc: accuracy });
    return c.json({ success: true, marked_at: now, presented_count: presented, roster });
  });

  // ---- author-facing (user portal) ---------------------------------------
  app.get('/api/submissions/:id/attendance', deps.requireClerkAuth, async (c) => {
    try {
      const env = c.env as Env;
      const submission = (await env.DB.prepare(
        `SELECT s.id, s.user_id, s.author_email, s.deleted_at, CASE WHEN ${ELIGIBLE_SQL} THEN 1 ELSE 0 END AS eligible
         FROM submissions s WHERE s.id = ?`
      ).bind(c.req.param('id')).first()) as any;
      if (!submission || submission.deleted_at) return c.json({ success: false, error: 'Submission not found.' }, 404);

      const clerkUserId = (c as any).get('clerkUserId') as string;
      const clerkEmail = (((c as any).get('clerkEmail') as string) || '').trim();
      const userId = await deps.ensureUserForClerk(c, clerkUserId, clerkEmail);
      if (!(await deps.isAuthorizedForSubmission(env, submission, userId, clerkUserId, clerkEmail))) {
        return c.json({ success: false, error: 'Forbidden.' }, 403);
      }
      if (!submission.eligible) return c.json({ success: true, eligible: false });

      const marked = (await env.DB.prepare(`SELECT marked_at, presented_count FROM paper_attendance WHERE submission_id = ?`)
        .bind(submission.id)
        .first()) as any;
      if (marked) {
        return c.json({ success: true, eligible: true, marked: true, marked_at: marked.marked_at, presented_count: marked.presented_count });
      }
      await syncAttendanceQrs(env, submission.id);
      const q = (await env.DB.prepare(`SELECT qr_payload FROM paper_attendance_qr WHERE submission_id = ?`).bind(submission.id).first()) as any;
      if (!q?.qr_payload) return c.json({ success: false, error: 'QR not available yet.' }, 500);
      return c.json({ success: true, eligible: true, marked: false, qr: q.qr_payload });
    } catch (e) {
      console.error('attendance qr', e);
      return c.json({ success: false, error: 'Internal Server Error.' }, 500);
    }
  });

  // ---- admin (guarded by the /api/admin/* middleware in index.ts) ---------
  app.get('/api/admin/attendance', async (c) => {
    const env = c.env as Env;
    await syncAttendanceQrs(env);
    const { results } = await env.DB.prepare(
      `SELECT s.id AS submission_id, s.paper_id, s.submission_code, s.title, s.phase2_head_count AS head_count,
              (SELECT COUNT(*) FROM authors a WHERE a.submission_id = s.id) AS author_count,
              pa.presented_count, pa.marked_at, pa.authors_json
       FROM submissions s LEFT JOIN paper_attendance pa ON pa.submission_id = s.id
       WHERE ${ELIGIBLE_SQL}
       ORDER BY pa.marked_at IS NULL, pa.marked_at DESC, s.paper_id`
    ).all();
    const papers = ((results || []) as any[]).map(({ authors_json, ...r }) => ({
      ...r,
      paper_id: displayPaperId(r),
      authors: authors_json ? JSON.parse(authors_json) : null,
    }));
    return c.json({
      success: true,
      total: papers.length,
      marked: papers.filter((p) => p.marked_at).length,
      people_present: papers.reduce((a, p) => a + (p.presented_count || 0), 0),
      papers,
    });
  });

  app.get('/api/admin/attendance/export', async (c) => {
    const env = c.env as Env;
    const { results } = await env.DB.prepare(
      `SELECT s.id, s.paper_id, s.submission_code, s.title, s.phase2_head_count, pa.presented_count, pa.marked_at, pa.authors_json, pa.colleges,
              (SELECT group_concat(trim(coalesce(a.title,'') || ' ' || a.first_name || ' ' || a.last_name), '; ') FROM authors a WHERE a.submission_id = s.id) AS all_authors,
              (SELECT group_concat(DISTINCT a.college) FROM authors a WHERE a.submission_id = s.id) AS all_colleges
       FROM submissions s LEFT JOIN paper_attendance pa ON pa.submission_id = s.id
       WHERE ${ELIGIBLE_SQL} ORDER BY s.paper_id`
    ).all();
    const fmt = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().replace('T', ' ').slice(0, 19);
    const rows = ((results || []) as any[]).map((r) => {
      const roster: any[] = r.authors_json ? JSON.parse(r.authors_json) : [];
      return [
        displayPaperId(r),
        r.title,
        r.marked_at ? 'Marked' : 'Not marked',
        r.marked_at ? fmt(r.marked_at) + ' IST' : '',
        r.phase2_head_count != null ? String(r.phase2_head_count) : '',
        r.presented_count != null ? String(r.presented_count) : '',
        roster.filter((a) => a.status === 'PRESENT').map((a) => a.name).join('; '),
        roster.filter((a) => a.status === 'ABSENT').map((a) => a.name).join('; '),
        r.all_authors || '',
        r.colleges || r.all_colleges || '',
      ];
    });
    const xlsx = deps.generateXlsx(
      ['Paper ID', 'Title', 'Status', 'Marked at', 'Head count (camera-ready)', 'Presented count', 'Present authors', 'Absent authors', 'All authors', 'College / Industry'],
      rows
    );
    return new Response(xlsx as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ICAIDIET26_Attendance_${istDay()}.xlsx"`,
      },
    });
  });

  // Generate / refresh the stored QR for every eligible paper right now
  // (the hourly cron does the same).
  app.post('/api/admin/attendance/generate', async (c) => c.json({ success: true, ...(await syncAttendanceQrs(c.env as Env)) }));

  // Undo a mistaken mark: the author's QR comes back in the user portal.
  app.post('/api/admin/attendance/:submissionId/reset', async (c) => {
    const res = await (c.env as Env).DB.prepare(`DELETE FROM paper_attendance WHERE submission_id = ?`).bind(c.req.param('submissionId')).run();
    return c.json({ success: true, removed: res.meta?.changes ?? 0 });
  });

  app.get('/api/admin/attendance/config', async (c) => c.json({ success: true, config: await loadConfig(c.env as Env, true) }));

  app.post('/api/admin/attendance/config', async (c) => {
    const env = c.env as Env;
    const body = (await c.req.json().catch(() => null)) as any;
    const merged = parseConfig({ ...(await loadConfig(env, true)), ...(body || {}) });
    await env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('attendance_scanner_config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).bind(JSON.stringify(merged)).run();
    configCache = { value: merged, at: Date.now() };
    return c.json({ success: true, config: merged });
  });
}
