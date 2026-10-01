import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileWarning,
  Loader2,
  RefreshCw,
  ScanLine,
  Search,
  ShieldAlert,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type OcrStatus = 'NONE' | 'PENDING' | 'DONE' | 'EMPTY' | 'FAILED';

type DuplicateEntry = {
  id: string;
  paper_id: string;
  submission_code: string;
  title: string;
  author_name: string;
  author_email: string;
  registration_type: string | null;
  author_type: string | null;
  payment_status: string | null;
  utr_transaction_id: string | null;
  fee_amount: string | null;
  fee_tier: string | null;
  payment_submitted_at: string | null;
  payment_approved_at: string | null;
  has_proof: boolean;
  proof_filename: string | null;
  ocr_status: OcrStatus;
  ocr_error: string | null;
  ocr_scanned_at: string | null;
  ocr_excerpt: string;
};

type DuplicateReason = {
  code: 'utr' | 'ocr_exact' | 'ocr_similar';
  detail: string;
  score?: number;
};

type DuplicateGroup = {
  id: string;
  reasons: DuplicateReason[];
  entries: DuplicateEntry[];
};

type DuplicateReport = {
  summary: {
    payments_with_reference: number;
    flagged: number;
    groups: number;
    ocr_done: number;
    ocr_pending: number;
    ocr_failed: number;
    ocr_empty: number;
    /** Every proof still owing a scan, including ones shown inside a group. */
    needs_scan?: number;
  };
  groups: DuplicateGroup[];
  /** The ones not already rendered inside a duplicate group. */
  needs_scan?: DuplicateEntry[];
};

const OCR_STATUS_META: Record<OcrStatus, { label: string; cls: string }> = {
  NONE: { label: 'No proof', cls: 'bg-brand-text/10 text-brand-text/70' },
  PENDING: { label: 'Scanning…', cls: 'bg-amber-100 text-amber-700' },
  DONE: { label: 'Scanned', cls: 'bg-green-100 text-green-700' },
  EMPTY: { label: 'No text found', cls: 'bg-amber-100 text-amber-700' },
  FAILED: { label: 'Scan failed', cls: 'bg-red-100 text-red-700' },
};

const REASON_META: Record<DuplicateReason['code'], { label: string; cls: string; hint: string }> = {
  utr: {
    label: 'Same UTR',
    cls: 'bg-red-100 text-red-700',
    hint: 'These submissions declare the same transaction reference.',
  },
  ocr_exact: {
    label: 'Identical proof',
    cls: 'bg-purple-100 text-purple-800',
    hint: 'The text read out of these payment proofs is byte-for-byte identical, so the same file was uploaded more than once.',
  },
  ocr_similar: {
    label: 'Same screenshot',
    cls: 'bg-orange-100 text-orange-800',
    hint: 'The text read out of these proofs overlaps heavily, which is what the same screenshot looks like after a crop, resize or re-compression.',
  },
};

const PAYMENT_STATUS_CLS: Record<string, string> = {
  APPROVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Filter that runs over the declared UTR, the file name and the OCR text. */
function entryMatches(entry: DuplicateEntry, q: string) {
  if (!q) return true;
  return [
    entry.paper_id,
    entry.submission_code,
    entry.title,
    entry.author_name,
    entry.author_email,
    entry.utr_transaction_id,
    entry.proof_filename,
    entry.ocr_excerpt,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

function OcrBadge({ status }: { status: OcrStatus }) {
  const meta = OCR_STATUS_META[status] || OCR_STATUS_META.NONE;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}>
      {status === 'PENDING' && <Loader2 className="w-3 h-3 animate-spin" />}
      {meta.label}
    </span>
  );
}

export default function DuplicatePaymentsPanel({
  token,
  onUnauthorized,
  onOpenProof,
}: {
  token: string;
  onUnauthorized: () => void;
  onOpenProof: (id: string, filename: string) => void;
}) {
  const [report, setReport] = useState<DuplicateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rescanning, setRescanning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepProgress, setSweepProgress] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/admin/duplicate-payments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to load the duplicate payment report.');
        }
        setReport(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load the duplicate payment report.');
      } finally {
        setLoading(false);
      }
    },
    [token, onUnauthorized]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // OCR runs detached after the author uploads a proof, so a report built
  // moments earlier can be missing a scan. Re-read shortly after a rescan, and
  // slowly otherwise, so the tab converges without hammering the endpoint.
  useEffect(() => {
    const quick = setTimeout(() => fetchReport({ silent: true }), 12000);
    const slow = setInterval(() => fetchReport({ silent: true }), 90000);
    return () => {
      clearTimeout(quick);
      clearInterval(slow);
    };
  }, [fetchReport]);

  const rescan = async (id: string) => {
    setRescanning(id);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${id}/payment-ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to start the scan.');
      }
      setNotice('Scan started. This page refreshes itself in a few seconds.');
    } catch (err: any) {
      setError(err?.message || 'Failed to start the scan.');
    } finally {
      setRescanning(null);
    }
  };

  /**
   * Walk the backlog in small batches until nothing is left to scan.
   *
   * Paced deliberately: OCR.space's free key allows 500 requests/day per IP, so
   * the batches are small and separated. Firing hundreds of scans at once would
   * blow the daily quota and mark perfectly good proofs as failed, which is
   * worse than not scanning them at all. Progress comes from the server's
   * `remaining` count rather than a local tally, so it stays honest if a batch
   * partially fails.
   */
  const sweepMissing = useCallback(async () => {
    setSweeping(true);
    setError(null);
    try {
      for (let batch = 1; batch <= 200; batch += 1) {
        const res = await fetch(`${API_URL}/api/admin/duplicate-payments/scan-missing?limit=8`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to start the scan sweep.');
        }

        const started: number = data.started ?? 0;
        const remaining: number = data.remaining ?? 0;
        setSweepProgress(
          started === 0
            ? 'Nothing left to scan.'
            : `Batch ${batch}: started ${started} scan${started === 1 ? '' : 's'}, ${remaining} left.`
        );
        if (started === 0 || remaining === 0) break;

        // Refresh between batches so completed scans leave the list and newly
        // flagged duplicates surface while the sweep is still running.
        await fetchReport({ silent: true });
        await new Promise((r) => setTimeout(r, 4000));
      }
      setSweepProgress('Sweep finished. Every uploaded proof has now been read at least once.');
      await fetchReport({ silent: true });
    } catch (err: any) {
      setError(err?.message || 'The scan sweep was interrupted.');
    } finally {
      setSweeping(false);
    }
  }, [token, onUnauthorized, fetchReport]);

  const q = search.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!report) return [];
    if (!q) return report.groups;
    // A group survives the filter if any of its members match, and only the
    // matching members are shown -- otherwise the admin sees a group of four
    // when they searched for one of them.
    return report.groups
      .map((g) => ({ ...g, entries: g.entries.filter((e) => entryMatches(e, q)) }))
      .filter((g) => g.entries.length > 0);
  }, [report, q]);

  const flaggedVisible = groups.reduce((n, g) => n + g.entries.length, 0);
  const summary = report?.summary;
  const scanIssues = (summary?.ocr_failed || 0) + (summary?.ocr_pending || 0);
  const needsScanTotal = summary?.needs_scan ?? 0;

  const unscanned = useMemo(() => {
    const rows = report?.needs_scan ?? [];
    if (!q) return rows;
    return rows.filter((e) => entryMatches(e, q));
  }, [report, q]);

  // "No duplicates found" is only safe to claim once the proofs have actually
  // been read. With a backlog outstanding the honest answer is "not checked
  // yet", so the empty state must not appear in that case.
  const nothingToShow = groups.length === 0 && unscanned.length === 0;
  const awaitingFirstScan = groups.length === 0 && needsScanTotal > 0;

  return (
    <div>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-serif text-xl font-bold">Duplicate Payments</h3>
          <p className="text-xs text-brand-text/60 mt-1 max-w-3xl">
            A declared UTR is self-reported and can be faked, so each submission is also compared against the text
            read out of its uploaded payment proof. Two submissions are grouped when they share a UTR, upload the same
            proof file, or upload screenshots whose text overlaps enough to be the same image.
          </p>
        </div>
        <button
          onClick={() => fetchReport()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-text/10 text-brand-text hover:bg-brand-text/20 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-4 border border-red-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        </div>
      )}

      {notice && (
        <div className="bg-amber-50 text-amber-800 p-3 rounded-xl mb-4 border border-amber-200 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> {notice}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-5">
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif text-red-700">{summary.flagged}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Flagged submissions</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif">{summary.groups}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Duplicate groups</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif">{summary.payments_with_reference}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Payments checked</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif text-green-700">{summary.ocr_done}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Proofs scanned</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className={`text-2xl sm:text-3xl font-bold font-serif ${scanIssues ? 'text-amber-700' : ''}`}>
              {scanIssues}
            </div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Scans needing attention</div>
          </div>
        </div>
      )}

      {summary && scanIssues > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <FileWarning className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                {summary.ocr_failed} scan{failedPlural(summary.ocr_failed)} failed
                {summary.ocr_pending > 0 && `, ${summary.ocr_pending} still scanning`}.
              </span>{' '}
              A proof that was never read cannot be compared, so a reused screenshot could be hiding in there. Use
              &ldquo;Scan all unread proofs&rdquo; below, rescan an individual proof, or ask the author for a smaller
              screenshot if the free OCR key rejected the file size.
              {summary.ocr_empty > 0 && ` ${summary.ocr_empty} proof(s) contained no readable text.`}
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="sr-only" htmlFor="dup-payments-search">
          Search duplicate payments
        </label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/40 pointer-events-none" />
          <input
            id="dup-payments-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search paper, author, UTR, file name or proof text"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-brand-accent bg-white text-sm text-brand-text placeholder:text-brand-text/40 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
          />
        </div>
      </div>

      {loading && !report ? (
        <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
          Checking payments for duplicates...
        </div>
      ) : nothingToShow ? (
        <div className="bg-white rounded-xl p-8 text-center text-brand-text/70 border-2 border-brand-accent">
          <div className="flex flex-col items-center gap-2">
            {awaitingFirstScan ? (
              <>
                <ScanLine className="w-6 h-6 text-amber-600" />
                <div className="font-semibold">Not checked yet.</div>
                <div className="text-xs text-brand-text/60 max-w-md">
                  {needsScanTotal} uploaded payment proof{needsScanTotal === 1 ? ' has' : 's have'} not been read, so
                  none of them have been compared yet. A reused screenshot cannot be detected without reading it.
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div className="font-semibold">
                  {q ? 'No matches in the duplicate groups.' : 'No duplicate payments found.'}
                </div>
                {!q && (
                  <div className="text-xs text-brand-text/60 max-w-md">
                    No two submissions share a UTR or a payment-proof screenshot.
                    {summary && summary.payments_with_reference === 0 && ' No payment has been submitted yet.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {unscanned.length > 0 && (
            <NeedsScanCard
              entries={unscanned}
              total={needsScanTotal}
              scanning={sweeping}
              progress={sweepProgress}
              rescanning={rescanning}
              onSweep={sweepMissing}
              onRescan={rescan}
              onOpenProof={onOpenProof}
            />
          )}
          {q && (
            <p className="text-xs text-brand-text/60">
              {flaggedVisible} matching submission{flaggedVisible === 1 ? '' : 's'} across {groups.length} group
              {groups.length === 1 ? '' : 's'}.
            </p>
          )}
          {groups.map((group) => (
            <DuplicateGroupCard
              key={group.id}
              group={group}
              rescanning={rescanning}
              onRescan={rescan}
              onOpenProof={onOpenProof}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function failedPlural(n: number) {
  return n === 1 ? '' : 's';
}

/**
 * The backlog: proofs with no usable OCR text that are not already visible in a
 * duplicate group.
 *
 * This exists because a payment nobody has scanned cannot be known to duplicate
 * anything, so it can never appear in the group list. Without its own list the
 * admin would be shown a clean "No duplicate payments found" while every older
 * proof sat unread.
 */
function NeedsScanCard({
  entries,
  total,
  scanning,
  progress,
  rescanning,
  onSweep,
  onRescan,
  onOpenProof,
}: {
  entries: DuplicateEntry[];
  total: number;
  scanning: boolean;
  progress: string | null;
  rescanning: string | null;
  onSweep: () => void;
  onRescan: (id: string) => void;
  onOpenProof: (id: string, filename: string) => void;
}) {
  const shown = entries.length;
  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-amber-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 bg-amber-50 border-b-2 border-amber-100 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ScanLine className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-serif font-bold text-amber-900">
            {total} payment proof{total === 1 ? '' : 's'} not read yet
          </span>
        </div>
        <button
          onClick={onSweep}
          disabled={scanning}
          className="sm:ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {scanning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…
            </>
          ) : (
            <>
              <ScanLine className="w-3.5 h-3.5" /> Scan all unread proofs
            </>
          )}
        </button>
      </div>

      <div className="px-4 sm:px-5 py-2.5 bg-brand-bg/40 border-b border-brand-accent text-xs text-brand-text/70">
        These proofs have never been read, so they cannot be compared against each other yet. Scanning reads the text
        out of each one; the free OCR key is rate-limited, so the sweep runs a few at a time and may take a moment.
        {progress && (
          <span className="block mt-1 font-medium text-brand-text">{progress}</span>
        )}
      </div>

      <div className="divide-y divide-brand-accent/30">
        {entries.map((entry) => (
          <div key={entry.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-brand-text break-words">
                {entry.paper_id || 'NA'}
                <span className="font-normal text-brand-text/50 text-xs"> · {entry.submission_code}</span>
              </div>
              <div className="text-xs text-brand-text/70 break-words">{entry.title}</div>
              <div className="text-xs text-brand-text/50 break-words">
                {entry.author_name}
                {entry.utr_transaction_id && ` · UTR ${entry.utr_transaction_id}`}
                {entry.proof_filename && ` · ${entry.proof_filename}`}
              </div>
              {entry.ocr_error && <div className="text-xs text-red-600 break-words mt-0.5">{entry.ocr_error}</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <OcrBadge status={entry.ocr_status} />
              <button
                onClick={() => onRescan(entry.id)}
                disabled={rescanning === entry.id}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-text/10 text-brand-text hover:bg-brand-text/20 transition-colors disabled:opacity-50"
              >
                {rescanning === entry.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Scan
              </button>
              {entry.has_proof && (
                <button
                  onClick={() => onOpenProof(entry.id, entry.proof_filename || 'payment proof')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-text/10 text-brand-text hover:bg-brand-text/20 transition-colors"
                >
                  <Eye className="w-3 h-3" /> View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {shown < total && (
        <div className="px-4 sm:px-5 py-2.5 bg-brand-bg/40 border-t border-brand-accent text-xs text-brand-text/60">
          Showing {shown} of {total}. Search or scan to clear the rest.
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({
  group,
  rescanning,
  onRescan,
  onOpenProof,
}: {
group: DuplicateGroup;
  rescanning: string | null;
  onRescan: (id: string) => void;
  onOpenProof: (id: string, filename: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 bg-red-50 border-b-2 border-red-100 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-serif font-bold text-red-800 whitespace-nowrap">
            {group.entries.length} submissions share a payment
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          {group.reasons.map((reason) => {
            const meta = REASON_META[reason.code] || REASON_META.utr;
            return (
              <span
                key={`${reason.code}-${reason.detail}`}
                title={`${meta.hint} ${reason.detail}`}
                className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}
              >
                {meta.label}
                <span className="font-normal opacity-80">{reason.detail}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-brand-bg/60 border-b border-brand-accent">
              <th className="py-3 px-5 font-semibold text-xs text-brand-text uppercase tracking-wider w-[9%]">Paper</th>
              <th className="py-3 px-5 font-semibold text-xs text-brand-text uppercase tracking-wider w-[22%]">Title</th>
              <th className="py-3 px-5 font-semibold text-xs text-brand-text uppercase tracking-wider w-[16%]">Author</th>
              <th className="py-3 px-5 font-semibold text-xs text-brand-text uppercase tracking-wider w-[13%]">Declared UTR</th>
              <th className="py-3 px-5 font-semibold text-xs text-brand-text uppercase tracking-wider w-[16%]">Proof file</th>
              <th className="py-3 px-5 font-semibold text-xs text-brand-text uppercase tracking-wider w-[24%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-accent/40">
            {group.entries.map((entry) => (
              <tr key={entry.id}>
                <td className="py-4 px-5 align-top">
                  <div className="font-semibold text-brand-text break-words">{entry.paper_id || 'NA'}</div>
                  <div className="text-xs text-brand-text/50 break-words">{entry.submission_code}</div>
                  <span
                    className={`inline-flex items-center mt-1.5 text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                      PAYMENT_STATUS_CLS[entry.payment_status || ''] || 'bg-brand-text/10 text-brand-text/70'
                    }`}
                  >
                    {entry.payment_status || 'NO STATUS'}
                  </span>
                </td>
                <td className="py-4 px-5 align-top">
                  <div className="font-semibold text-brand-text break-words leading-snug">{entry.title}</div>
                  <div className="text-xs text-brand-text/50 mt-1 capitalize">
                    {entry.registration_type || '—'}
                    {entry.author_type ? ` · ${entry.author_type}` : ''}
                    {entry.fee_amount ? ` · ${entry.fee_amount}` : ''}
                  </div>
                </td>
                <td className="py-4 px-5 align-top text-sm text-brand-text/80 break-words">
                  {entry.author_name || '—'}
                  <div className="text-xs text-brand-text/50 break-words">{entry.author_email}</div>
                </td>
                <td className="py-4 px-5 align-top">
                  <div className="font-mono text-sm text-brand-text break-all">
                    {entry.utr_transaction_id || <span className="text-brand-text/40">Not given</span>}
                  </div>
                  <div className="text-xs text-brand-text/50 mt-1">
                    Paid {formatDateTime(entry.payment_submitted_at)}
                  </div>
                </td>
                <td className="py-4 px-5 align-top">
                  {entry.has_proof ? (
                    <>
                      <div className="text-sm text-brand-text/80 break-all">
                        {entry.proof_filename || 'Proof uploaded'}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <OcrBadge status={entry.ocr_status} />
                      </div>
                      {entry.ocr_excerpt && (
                        <details className="mt-2">
                          <summary className="text-xs text-brand-text/60 cursor-pointer hover:text-brand-text">
                            Show text read from proof
                          </summary>
                          <p className="mt-1.5 text-[11px] text-brand-text/70 bg-brand-bg/50 rounded-lg p-2 leading-relaxed break-words max-h-40 overflow-y-auto">
                            {entry.ocr_excerpt}
                          </p>
                        </details>
                      )}
                      {entry.ocr_error && <p className="mt-1.5 text-[11px] text-red-600">{entry.ocr_error}</p>}
                    </>
                  ) : (
                    <span className="text-sm text-brand-text/40">No proof uploaded</span>
                  )}
                </td>
                <td className="py-4 px-5 align-top">
                  <div className="flex flex-col items-start gap-1.5">
                    {entry.has_proof && (
                      <button
                        onClick={() => onOpenProof(entry.id, entry.proof_filename || `${entry.paper_id || entry.submission_code} payment proof`)}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View Proof
                      </button>
                    )}
                    <button
                      onClick={() => onRescan(entry.id)}
                      disabled={!entry.has_proof || rescanning === entry.id}
                      className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                      title={
                        entry.has_proof
                          ? 'Read the text out of this payment proof again'
                          : 'This submission has no payment proof to scan'
                      }
                    >
                      {rescanning === entry.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ScanLine className="w-4 h-4" />
                      )}{' '}
                      Rescan proof
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 p-3 lg:hidden">
        {group.entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-brand-accent p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-brand-text break-words text-sm">{entry.paper_id || entry.submission_code}</div>
                <div className="text-sm text-brand-text/80 break-words leading-snug mt-0.5">{entry.title}</div>
              </div>
              <span
                className={`shrink-0 inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                  PAYMENT_STATUS_CLS[entry.payment_status || ''] || 'bg-brand-text/10 text-brand-text/70'
                }`}
              >
                {entry.payment_status || 'NO STATUS'}
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-brand-text/50 uppercase tracking-wide font-medium">Author</div>
                <div className="text-brand-text/80 break-words">{entry.author_name || '—'}</div>
                <div className="text-brand-text/50 break-words">{entry.author_email}</div>
              </div>
              <div>
                <div className="text-brand-text/50 uppercase tracking-wide font-medium">Declared UTR</div>
                <div className="font-mono text-brand-text break-all">{entry.utr_transaction_id || 'Not given'}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-brand-text/50 uppercase tracking-wide font-medium">Proof</div>
                <div className="text-brand-text/80 break-all">
                  {entry.has_proof ? entry.proof_filename || 'Proof uploaded' : 'No proof uploaded'}
                </div>
                {entry.has_proof && (
                  <div className="mt-1">
                    <OcrBadge status={entry.ocr_status} />
                  </div>
                )}
              </div>
            </div>

            {entry.ocr_excerpt && (
              <details className="mt-2">
                <summary className="text-xs text-brand-text/60 cursor-pointer">Show text read from proof</summary>
                <p className="mt-1.5 text-[11px] text-brand-text/70 bg-brand-bg/50 rounded-lg p-2 leading-relaxed break-words">
                  {entry.ocr_excerpt}
                </p>
              </details>
            )}
            {entry.ocr_error && <p className="mt-2 text-[11px] text-red-600">{entry.ocr_error}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-brand-text/10 pt-2.5">
              {entry.has_proof && (
                <button
                  onClick={() => onOpenProof(entry.id, entry.proof_filename || `${entry.paper_id || entry.submission_code} payment proof`)}
                  className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View Proof
                </button>
              )}
              <button
                onClick={() => onRescan(entry.id)}
                disabled={!entry.has_proof || rescanning === entry.id}
                className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {rescanning === entry.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ScanLine className="w-3.5 h-3.5" />
                )}{' '}
                Rescan proof
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}