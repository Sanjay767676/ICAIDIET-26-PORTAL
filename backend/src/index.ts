import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { verifyToken as clerkVerifyToken } from '@clerk/backend';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  AUTH_SECRET: string;
  CLERK_SECRET_KEY: string;
};

type Variables = {
  clerkUserId: string;
  clerkEmail: string;
};

type AppEnv = { Bindings: Bindings; Variables: Variables };

const app = new Hono<AppEnv>();

// ------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:8787',
];

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
  return cors({ origin, allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'], maxAge: 86400 })(c, next);
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
    const [payload, sig] = parts;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(await getAuthSecret(c)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(sig), new TextEncoder().encode(payload));
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
  // Attach userId to context for downstream handlers
  c.set('clerkUserId', result.userId);
  c.set('clerkEmail', result.email || '');
  return next();
}

function getBearer(c: any): string | null {
  const header = c.req.header('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function clientIp(c: any): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || 'unknown';
}

function rateLimit(c: any, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const fullKey = `${clientIp(c)}:${key}`;
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
    return { ok: false, reason: 'Invalid file type. Only PDF (.pdf), DOC (.doc), or DOCX (.docx) manuscripts are accepted.' };
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

    const stored = await c.env.DB.prepare(
      `SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = 'ADMIN'`
    ).bind(`${username}@snsct.edu`).first() as any;

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
      user: { id: stored.id, name: 'SNSCT Admin', email: stored.email, role: stored.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ success: false, error: 'Internal Server Error.' }, 500);
  }
});

// ------------------------------------------------------------------
// Clerk: Sync user profile from webhook / manual call
// Called by the frontend after Clerk sign-up/sign-in to ensure
// the user exists in our D1 database.
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
    const email = authResult.email || '';

    const body = await c.req.json().catch(() => null);
    const name = (body?.name || '').trim() || email.split('@')[0] || 'User';

    // Check if user already exists by clerk_id
    const existing = await c.env.DB.prepare(
      `SELECT id FROM user_profiles WHERE clerk_id = ?`
    ).bind(clerkId).first() as any;

    if (existing) {
      // Update last login
      await c.env.DB.prepare(
        `UPDATE user_profiles SET updated_at = datetime('now') WHERE clerk_id = ?`
      ).bind(clerkId).run();
      return c.json({ success: true, user_id: existing.id });
    }

    // Create new user + profile
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, name, email, 'clerk-managed', 'USER', now, now),
      c.env.DB.prepare(
        `INSERT INTO user_profiles (id, user_id, institution, department, country, phone, clerk_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), userId, '', '', '', '', clerkId, now, now),
    ]);

    return c.json({ success: true, user_id: userId });
  } catch (error) {
    console.error('User sync error:', error);
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

    const clerkUserId = c.get('clerkUserId') as string;

    // Resolve the internal user_id from clerk_id
    const userProfile = await c.env.DB.prepare(
      `SELECT user_id FROM user_profiles WHERE clerk_id = ?`
    ).bind(clerkUserId).first() as any;

    if (!userProfile) {
      return c.json({ success: false, error: 'User profile not found. Please sign in again.' }, 401);
    }

    const userId = userProfile.user_id;

    const formData = await c.req.parseBody();

    const paperId = (formData['paperId'] as string || '').trim();
    const title = (formData['title'] as string || '').trim();
    const abstract = (formData['abstract'] as string || '').trim();
    const track = (formData['track'] as string || '').trim();
    const authorName = (formData['authorName'] as string || '').trim();
    const authorEmail = (formData['authorEmail'] as string || '').trim();
    const keywords = (formData['keywords'] as string || '').trim();
    const file = formData['file'] as File;

    let authors: { first_name: string; last_name: string; phone: string; email: string; college: string }[] = [];
    try {
      const rawAuthors = (formData['authors'] as string || '').trim();
      if (rawAuthors) {
        const parsed = JSON.parse(rawAuthors);
        if (Array.isArray(parsed)) {
          authors = parsed.map((a: any) => ({
            first_name: String(a?.first_name || '').trim(),
            last_name: String(a?.last_name || '').trim(),
            phone: String(a?.phone || '').trim(),
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
    const hasAuthors = authors.length > 0;
    for (let i = 0; i < authors.length; i++) {
      const a = authors[i];
      if (!a.first_name || !a.last_name) {
        return c.json({ success: false, error: `Author ${i + 1}: first and last name are required.` }, 400);
      }
      if (!a.phone) {
        return c.json({ success: false, error: `Author ${i + 1}: a phone number is required.` }, 400);
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

    const submissionId = crypto.randomUUID();
    const submissionCode = `SUB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const now = new Date().toISOString();
    const safeFilename = sanitizeFilename(file.name);
    const fileKey = `submissions/${submissionId}-${safeFilename}`;

    let uploaded = false;
    try {
      await c.env.BUCKET.put(fileKey, file.stream(), {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
      });
      uploaded = true;

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
          fileKey,
          file.type || 'application/octet-stream',
          file.size,
          now
        ),
      ];

      const authorRows = hasAuthors
        ? authors
        : [{
            first_name: authorName.split(' ').slice(0, -1).join(' ') || authorName.split(' ')[0] || '',
            last_name: authorName.split(' ').slice(-1)[0] || '',
            phone: '',
            email: authorEmail,
            college: '',
          }];

      authorRows.forEach((a, idx) => {
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
      if (uploaded) {
        await c.env.BUCKET.delete(fileKey).catch(() => {});
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
      `SELECT s.id, s.submission_code, s.paper_id, s.title, s.abstract, s.track, s.status, s.author_name, s.author_email, s.created_at
       FROM submissions s
       ORDER BY s.created_at DESC`
    ).all();

    const submissions = results as any[];
    let authorsBySubmission: Record<string, any[]> = {};
    if (submissions.length > 0) {
      const ids = submissions.map((s: any) => s.id as string);
      const placeholders = ids.map(() => '?').join(',');
      const authorRes = await c.env.DB.prepare(
        `SELECT id, submission_id, is_primary, first_name, last_name, phone, email, college, created_at
         FROM authors
         WHERE submission_id IN (${placeholders})
         ORDER BY is_primary DESC, created_at ASC`
      ).bind(...ids).all();
      authorsBySubmission = (authorRes.results as any[] || []).reduce((acc: any, a: any) => {
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
// Admin: Stream a manuscript file (requires admin Bearer token)
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
    const file = await c.env.DB.prepare(
      `SELECT storage_key, original_filename, mime_type FROM submission_files
       WHERE submission_id = ? AND file_type = 'MANUSCRIPT' LIMIT 1`
    ).bind(submissionId).first() as any;

    if (!file) {
      return c.json({ success: false, error: 'No manuscript file found for this submission.' }, 404);
    }

    const object = await c.env.BUCKET.get(file.storage_key);
    if (!object) {
      return c.json({ success: false, error: 'The manuscript file could not be found in storage.' }, 404);
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

export default app;
