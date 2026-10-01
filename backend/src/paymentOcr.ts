/**
 * Payment-proof OCR.
 *
 * The UTR an author types into the registration form is self-reported and can be
 * anything. The screenshot they attach cannot. So every uploaded proof is run
 * through OCR once, and the extracted text is stored next to the submission.
 * The duplicate-payment check then compares three things:
 *
 *   1. the declared UTR / transaction number (`submissions.utr_transaction_id`),
 *   2. an exact hash of the normalised OCR text (the same file re-uploaded), and
 *   3. word-level similarity of the normalised OCR text, which catches the same
 *      screenshot after it has been cropped, resized or re-compressed.
 *
 * OCR runs through OCR.space, which needs no new infrastructure: the Worker
 * just POSTs the stored object to their parse endpoint and reads back plain
 * text. The key is a secret (`OCR_SPACE_API_KEY`); the public `helloworld`
 * key is used as a local-dev fallback.
 */

/** OCR.space parse endpoint. */
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';

/** Public demo key so local dev works with no secrets configured. */
const OCR_SPACE_FALLBACK_KEY = 'helloworld';

/**
 * OCR.space's FREE plan caps *every* upload at 1 MB (the 5 MB figure is the
 * $30/month PRO plan). The portal itself accepts proofs up to 4 MB, so a
 * perfectly valid proof can be too large to read. Refuse those ourselves rather
 * than paying for a round trip that can only fail, and say why -- the admin tab
 * surfaces the message so they can ask the author for a smaller screenshot
 * instead of silently missing a reused one.
 *
 * Raise this to 5 MB once a PRO key is configured.
 *
 * 1.5 MB is the ceiling OCR.space actually enforces on the free key, measured
 * rather than assumed: a 1.18 MB file is accepted, a 3 MB file is refused with
 * `E556: File too large. Max 1.5 MB for Free Plan`. The website advertises 1 MB,
 * which is stricter than the service and would needlessly reject real proofs.
 */
const OCR_MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

/** Give up on the request rather than holding a background task open. */
const OCR_TIMEOUT_MS = 25000;

/**
 * Similarity above which two OCR texts are treated as the same screenshot.
 *
 * Token-set Jaccard is deliberately strict: two unrelated bank receipts still
 * share boilerplate ("NEFT", "IMPS", "HDFC BANK", dates), so a loose threshold
 * would bury the admin in false positives. 0.75 plus the shared-token floor
 * below keeps it to screenshots that really are the same image.
 */
export const OCR_SIMILARITY_THRESHOLD = 0.75;

/** Ignore a text pair that shares fewer distinct words than this. */
export const OCR_MIN_SHARED_TOKENS = 12;

/** A text shorter than this carries too little signal to compare at all. */
export const OCR_MIN_TOKENS = 12;

export type ProofOcrStatus = 'PENDING' | 'DONE' | 'EMPTY' | 'FAILED';

/**
 * A PENDING row is only treated as abandoned once it has been quiet this long.
 * Scans run detached (`waitUntil`), so anything newer is a scan genuinely still
 * in flight and must not be restarted underneath the author who just uploaded.
 */
export const OCR_STUCK_PENDING_MS = 10 * 60 * 1000;

export function stuckScanCutoff(nowMs: number = Date.now()): string {
  return new Date(nowMs - OCR_STUCK_PENDING_MS).toISOString();
}

type ScanStateRow = {
  payment_proof_url?: string | null;
  proof_ocr_status?: string | null;
  proof_ocr_updated_at?: string | null;
};

/**
 * Whether a payment still owes a scan: never scanned (no row at all), a scan
 * that failed, or one that has been stuck in PENDING long enough to be dead.
 *
 * A submission with no proof has nothing to read and is not "needing" anything.
 * EMPTY is a completed scan that found no text, so it is not retried -- an
 * unreadable photo would just fail again and churn the OCR quota.
 *
 * Used by both the report and the sweep endpoint, so "shows in the list" and
 * "gets picked up by the sweep" cannot drift apart.
 */
export function proofNeedsScan(
  r: ScanStateRow,
  cutoff: string = stuckScanCutoff(),
  groupIds?: ReadonlySet<string>
): boolean {
  if (!r.payment_proof_url) return false;
  if (groupIds && groupIds.has((r as { id?: string }).id as string)) return false;
  const status = r.proof_ocr_status;
  if (!status) return true;
  if (status === 'FAILED') return true;
  if (status === 'PENDING') return (r.proof_ocr_updated_at || '') < cutoff;
  return false;
}

/**
 * Rows the admin must still act on, minus the ones already shown inside a
 * duplicate group (those are reachable from the group cards).
 */
export function findProofsNeedingScan<T extends ScanStateRow & { id: string }>(
  rows: readonly T[],
  groupIds: ReadonlySet<string>,
  cutoff: string = stuckScanCutoff()
): T[] {
  return rows.filter((r) => proofNeedsScan(r, cutoff, groupIds));
}

export type ProofOcrEnv = {
  DB: D1Database;
  PROOF_BUCKET: R2Bucket;
  BUCKET: R2Bucket;
  OCR_SPACE_API_KEY?: string;
};

export type ProofOcrScan = {
  submissionId: string;
  storageKey: string;
  originalFilename?: string | null;
};

/**
 * Lowercase, drop punctuation, collapse runs of whitespace.
 *
 * OCR engines are inconsistent about punctuation and spacing between the same
 * image, and they disagree between engines, so any comparison has to happen on
 * a normalised form or the same screenshot will read as two different ones.
 * Letters and digits survive; everything else becomes a single space.
 */
export function normalizeOcrText(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(normalized: string): string[] {
  return normalized ? normalized.split(' ') : [];
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Collapse an OCR.space error blob into one short line for the admin. */
function describeOcrError(raw: unknown): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return 'OCR.space returned no text for this file.';
  // OCR.space returns the whole HTML-free error paragraph; keep the first line.
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || text;
  return firstLine.trim().slice(0, 300);
}

/**
 * Pull `ParsedText` out of an OCR.space response, throwing only on a real error.
 *
 * An empty result is returned as an empty string rather than raised: OCR.space
 * answers a blank or unreadable image with `ParsedText: ""` and
 * `IsErroredOnProcessing: false`, which is a successful scan of an empty page,
 * not a failure. Throwing here would record it as FAILED, and since a FAILED row
 * is retryable that would make the sweep re-scan the same unusable photo on
 * every run forever. The caller maps "" to the EMPTY status.
 */
function parseOcrSpaceResponse(payload: any): string {
  // Rejections that never reach the parser -- an oversized file, a bad key --
  // come back as a bare top-level `error` with no ParsedResults at all:
  //   {"error":"E556: File too large. Max 1.5 MB for Free Plan (...)"}
  // Without this branch the admin is told the file had no text, which is both
  // wrong and hides the one thing they need to know: ask for a smaller image.
  if (typeof payload?.error === 'string' && payload.error.trim()) {
    throw new Error(describeOcrError(payload.error));
  }
  if (payload?.IsErroredOnProcessing) {
    throw new Error(describeOcrError(payload?.ErrorMessage));
  }
  const results = payload?.ParsedResults;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(describeOcrError(payload?.ErrorMessage));
  }
  return (results[0]?.ParsedText || '').trim();
}

/**
 * Read the stored proof and OCR it, writing the result to `payment_proof_ocr`.
 *
 * Never throws: a failure is recorded against the submission so the admin tab
 * can show it and offer a retry. Callers run it detached (`waitUntil`), so an
 * exception escaping here would only surface as an opaque Worker error log.
 */
export async function scanProofOcr(env: ProofOcrEnv, scan: ProofOcrScan): Promise<void> {
  const { submissionId, storageKey } = scan;
  const now = new Date().toISOString();

  await upsertOcrRow(env.DB, {
    submissionId,
    storageKey,
    originalFilename: scan.originalFilename ?? null,
    status: 'PENDING',
    error: null,
  });

  try {
    let object = await env.PROOF_BUCKET.get(storageKey);
    if (!object) object = await env.BUCKET.get(storageKey);
    if (!object) throw new Error('Payment proof file not found in storage.');

    const contentType = object.httpMetadata?.contentType || 'application/octet-stream';
    const bytes = new Uint8Array(await object.arrayBuffer());

    const limit = OCR_MAX_BYTES;
    if (bytes.byteLength > limit) {
      throw new Error(
        `Proof is ${Math.round((bytes.byteLength / 1024 / 1024) * 10) / 10} MB; the free OCR.space key only reads up to ` +
          `${Math.floor(OCR_MAX_BYTES / 1024 / 1024 * 10) / 10} MB. Ask the author for a screenshot (not a camera ` +
          `photo) of the receipt, or configure a PRO key.`
      );
    }

    const text = await runOcrSpace(env.OCR_SPACE_API_KEY, bytes, contentType, scan.originalFilename);
    const normalized = normalizeOcrText(text);

    if (!normalized) {
      await upsertOcrRow(env.DB, {
        submissionId,
        storageKey,
        originalFilename: scan.originalFilename ?? null,
        status: 'EMPTY',
        error: 'No readable text found in this proof. It may be a photo of a receipt rather than a screenshot.',
        ocrText: text || null,
        scannedAt: now,
      });
      return;
    }

    await upsertOcrRow(env.DB, {
      submissionId,
      storageKey,
      originalFilename: scan.originalFilename ?? null,
      status: 'DONE',
      error: null,
      ocrText: text,
      normalized,
      hash: await sha256Hex(normalized),
      tokenCount: tokenize(normalized).length,
      scannedAt: now,
    });
  } catch (err: any) {
    console.error('Payment proof OCR error:', submissionId, err?.message || err);
    await upsertOcrRow(env.DB, {
      submissionId,
      storageKey,
      originalFilename: scan.originalFilename ?? null,
      status: 'FAILED',
      error: err?.message ? String(err.message).slice(0, 300) : 'OCR failed.',
      scannedAt: now,
    });
  }
}

/** POST the proof to OCR.space and return the text it read. */
async function runOcrSpace(
  apiKey: string | undefined,
  bytes: Uint8Array,
  contentType: string,
  originalFilename?: string | null,
): Promise<string> {
  const key = (apiKey || '').trim() || OCR_SPACE_FALLBACK_KEY;
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1] || 'png';
  const name = (originalFilename || '').trim() || `proof.${ext}`;

  const form = new FormData();
  form.set('apikey', key);
  form.set('language', 'eng');
  form.set('isOverlayRequired', 'false');
  form.set('detectOrientation', 'true');
  form.set('scale', 'true');
  form.set('OCREngine', '2');
  form.set('file', new Blob([bytes], { type: contentType }), name);

  const res = await fetch(OCR_SPACE_URL, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(OCR_TIMEOUT_MS),
  });

  const bodyText = await res.text();
  if (!res.ok && !bodyText.trim().startsWith('{')) {
    throw new Error(`OCR.space returned HTTP ${res.status}.`);
  }

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error(describeOcrError(bodyText));
  }
  return parseOcrSpaceResponse(payload);
}

type OcrRowInput = {
  submissionId: string;
  storageKey: string;
  originalFilename: string | null;
  status: ProofOcrStatus;
  error: string | null;
  ocrText?: string | null;
  normalized?: string;
  hash?: string;
  tokenCount?: number;
  scannedAt?: string;
};

/**
 * Insert or replace the scan row.
 *
 * A re-scan clears the previous text: leaving a stale hash behind would keep
 * matching the old image against newer submissions after the author replaced
 * their proof.
 */
async function upsertOcrRow(db: D1Database, row: OcrRowInput): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO payment_proof_ocr
         (submission_id, storage_key, original_filename, ocr_text, ocr_norm, ocr_hash,
          token_count, status, error, scanned_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(submission_id) DO UPDATE SET
         storage_key       = excluded.storage_key,
         original_filename = excluded.original_filename,
         ocr_text          = excluded.ocr_text,
         ocr_norm          = excluded.ocr_norm,
         ocr_hash          = excluded.ocr_hash,
         token_count       = excluded.token_count,
         status            = excluded.status,
         error             = excluded.error,
         scanned_at        = excluded.scanned_at,
         updated_at        = excluded.updated_at`
    )
    .bind(
      row.submissionId,
      row.storageKey,
      row.originalFilename,
      row.ocrText ?? null,
      row.normalized ?? null,
      row.hash ?? null,
      row.tokenCount ?? 0,
      row.status,
      row.error,
      row.scannedAt ?? null,
      now,
      now
    )
    .run();
}

// ------------------------------------------------------------------
// Duplicate analysis
// ------------------------------------------------------------------

/** A payment record as the duplicate check sees it. */
export type PaymentCheckRecord = {
  id: string;
  utr?: string | null;
  hash?: string | null;
  normalized?: string | null;
  tokenCount?: number | null;
};

export type DuplicateReasonCode = 'utr' | 'ocr_exact' | 'ocr_similar';

export type DuplicateReason = {
  code: DuplicateReasonCode;
  detail: string;
  /** Highest similarity observed for this reason, 0..1. Absent for exact matches. */
  score?: number;
};

export type DuplicateGroup = {
  id: string;
  reasons: DuplicateReason[];
  submissionIds: string[];
};

/** UTRs are compared with case and punctuation removed: "UTR-12 34" == "utr1234". */
function normalizeUtr(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function tokenSet(normalized: string): Set<string> {
  return new Set(tokenize(normalized));
}

/**
 * Word-level Jaccard similarity of two normalised OCR texts, or `null` when the
 * pair is not comparable — too little text on either side, or too little in
 * common. `null` matters: returning a number for an incomparable pair would let
 * a threshold decide, and two short texts can cross any threshold by accident.
 */
export function ocrSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
): { score: number; shared: number } | null {
  if (!a || !b) return null;

  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size < OCR_MIN_TOKENS || setB.size < OCR_MIN_TOKENS) return null;

  let shared = 0;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  small.forEach((t) => {
    if (large.has(t)) shared += 1;
  });
  if (shared < OCR_MIN_SHARED_TOKENS) return null;

  const union = setA.size + setB.size - shared;
  return union > 0 ? { score: shared / union, shared } : null;
}

/**
 * Merge every connected set of colliding submissions into one group.
 *
 * Union-find rather than pairwise output: if A shares a UTR with B and B's
 * screenshot matches C, the admin should see one group of three, not two
 * overlapping groups they have to reconcile by hand.
 */
function collectGroups(
  parent: Map<string, string>,
  links: Map<string, DuplicateReason[]>,
  find: (id: string) => string,
): DuplicateGroup[] {
  const reasonsByRoot = new Map<string, DuplicateReason[]>();
  links.forEach((reasons, key) => {
    const root = find(key);
    const existing = reasonsByRoot.get(root) || [];
    reasons.forEach((r) => {
      const match = existing.find((e) => e.code === r.code && e.detail === r.detail);
      if (match) {
        if (typeof r.score === 'number' && (typeof match.score !== 'number' || r.score > match.score)) {
          match.score = r.score;
        }
      } else {
        existing.push(r);
      }
    });
    reasonsByRoot.set(root, existing);
  });

  const membersByRoot = new Map<string, string[]>();
  parent.forEach((_p, id) => {
    const root = find(id);
    const list = membersByRoot.get(root) || [];
    list.push(id);
    membersByRoot.set(root, list);
  });

  const groups: DuplicateGroup[] = [];
  membersByRoot.forEach((submissionIds, root) => {
    if (submissionIds.length < 2) return;
    groups.push({
      id: root,
      reasons: (reasonsByRoot.get(root) || []).sort((a, b) => a.code.localeCompare(b.code)),
      submissionIds: submissionIds.slice().sort(),
    });
  });
  return groups.sort((a, b) => b.submissionIds.length - a.submissionIds.length);
}

/**
 * Group payments that collide on declared UTR or on OCR text.
 *
 * Only records whose OCR text is long enough to be meaningful take part in the
 * text comparison; a short or failed scan simply contributes its UTR.
 */
export function findDuplicatePaymentGroups(records: PaymentCheckRecord[]): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const links = new Map<string, DuplicateReason[]>();
  const byId = new Map(records.map((r) => [r.id, r]));

  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) && parent.get(root) !== root) root = parent.get(root) as string;
    // Path compression, so a long chain stays cheap.
    let cur = id;
    while (parent.get(cur) && parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    parent.set(ra, rb);
  };
  const link = (id: string, reason: DuplicateReason) => {
    const list = links.get(id) || [];
    list.push(reason);
    links.set(id, list);
  };

  records.forEach((r) => parent.set(r.id, r.id));

  // 1. Declared UTR / transaction number.
  const byUtr = new Map<string, string[]>();
  records.forEach((r) => {
    const utr = normalizeUtr(r.utr);
    if (!utr) return;
    const list = byUtr.get(utr) || [];
    list.push(r.id);
    byUtr.set(utr, list);
  });
  byUtr.forEach((ids, utr) => {
    if (ids.length < 2) return;
    const first = ids[0];
    ids.slice(1).forEach((id) => union(first, id));
    const reason: DuplicateReason = {
      code: 'utr',
      detail: (byId.get(first)?.utr || utr).trim(),
    };
    ids.forEach((id) => link(id, reason));
  });

  // 2. Byte-identical OCR text (same file re-uploaded).
  const byHash = new Map<string, string[]>();
  records.forEach((r) => {
    const hash = (r.hash || '').trim();
    if (!hash) return;
    const list = byHash.get(hash) || [];
    list.push(r.id);
    byHash.set(hash, list);
  });
  byHash.forEach((ids) => {
    if (ids.length < 2) return;
    const first = ids[0];
    ids.slice(1).forEach((id) => union(first, id));
    ids.forEach((id) => link(id, { code: 'ocr_exact', detail: 'Identical proof text' }));
  });

  // 3. Near-identical OCR text (same screenshot, cropped or re-compressed).
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const a = records[i];
      const b = records[j];
      if (!a.normalized || !b.normalized || a.normalized === b.normalized) continue;
      const sim = ocrSimilarity(a.normalized, b.normalized);
      if (!sim || sim.score < OCR_SIMILARITY_THRESHOLD) continue;
      union(a.id, b.id);
      const reason: DuplicateReason = {
        code: 'ocr_similar',
        detail: `${Math.round(sim.score * 100)}% of ${sim.shared} words match`,
        score: sim.score,
      };
      link(a.id, reason);
      link(b.id, reason);
    }
  }

  return collectGroups(parent, links, find);
}