import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface VerificationAuthor {
  id?: string;
  is_primary?: number | boolean;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college?: string;
  title?: string;
  designation?: string;
}

export interface AuthorVerificationRequest {
  submission_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  rejection_note?: string | null;
  submission_code?: string | null;
  paper_id?: string | null;
  title: string;
  author_name?: string | null;
  payment_status?: string | null;
  attendance_mode?: string | null;
  authors_finalised_at?: string | null;
  camera_ready_file?: string | null;
  proposed_authors: VerificationAuthor[];
  current_authors: VerificationAuthor[];
}

interface Props {
  requests: AuthorVerificationRequest[];
  loading: boolean;
  error: string | null;
  token: string;
  onOpenPdf: (id: string, kind: 'camera_ready', filename: string) => void;
  onUnauthorized: () => void;
  onRefresh: () => void;
}

type Filter = 'PENDING' | 'REJECTED' | 'APPROVED' | 'ALL';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Awaiting verification', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  APPROVED: { label: 'Approved', cls: 'bg-green-100 text-green-800 border-green-300' },
  REJECTED: { label: 'Sent back to author', cls: 'bg-red-100 text-red-800 border-red-300' },
};

const authorName = (a: VerificationAuthor) =>
  `${a.title || ''} ${a.first_name || ''} ${a.last_name || ''}`.replace(/\s+/g, ' ').trim() || 'Unnamed author';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
};

function AuthorColumn({
  title,
  authors,
  tone,
}: {
  title: string;
  authors: VerificationAuthor[];
  tone: 'current' | 'proposed';
}) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 ${
        tone === 'proposed'
          ? 'border-purple-200 bg-purple-50/40'
          : 'border-brand-text/10 bg-brand-card'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users className={`w-4 h-4 ${tone === 'proposed' ? 'text-purple-700' : 'text-brand-text/60'}`} />
        <h4 className="text-sm font-bold text-brand-text">{title}</h4>
        <span className="text-[11px] text-brand-text/50">({authors.length})</span>
      </div>
      {authors.length === 0 ? (
        <p className="text-xs text-brand-text/50">No authors on record.</p>
      ) : (
        <div className="space-y-2">
          {authors.map((a, i) => (
            <div
              key={a.id || `${a.email || 'author'}-${i}`}
              className="rounded-lg border border-brand-text/10 bg-white/70 px-3 py-2 text-xs text-brand-text"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">{authorName(a)}</span>
                {a.is_primary ? (
                  <span className="px-1.5 py-0.5 rounded-full bg-brand-text/10 text-[10px] font-bold">
                    Primary
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-brand-text/70">
                {a.designation || '—'} · {a.college || '—'}
              </div>
              <div className="text-brand-text/60 break-all">{a.email || '—'}</div>
              <div className="text-brand-text/60">{a.phone || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthorCard({
  request,
  busy,
  onApprove,
  onReject,
  onOpenPdf,
}: {
  request: AuthorVerificationRequest;
  busy: boolean;
  onApprove: (request: AuthorVerificationRequest) => void;
  onReject: (request: AuthorVerificationRequest) => void;
  onOpenPdf: (id: string, kind: 'camera_ready', filename: string) => void;
}) {
  const meta = STATUS_META[request.status] || STATUS_META.PENDING;
  return (
    <div className="bg-brand-card rounded-xl border border-brand-text/10 shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-brand-text/50">
              {request.paper_id || request.submission_code || request.submission_id}
            </span>
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${meta.cls}`}>
              {meta.label}
            </span>
            {request.attendance_mode ? (
              <span className="px-2 py-0.5 rounded-full border border-brand-text/10 text-[10px] font-bold text-brand-text/60">
                {request.attendance_mode}
              </span>
            ) : null}
          </div>
          <h3 className="font-serif font-bold text-base sm:text-lg text-brand-text mt-1 break-words">
            {request.title}
          </h3>
          <p className="text-xs text-brand-text/60 mt-1">
            Submitted {formatDate(request.submitted_at)}
            {request.author_name ? ` · by ${request.author_name}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenPdf(request.submission_id, 'camera_ready', request.camera_ready_file || 'camera-ready.pdf')}
          disabled={!request.camera_ready_file}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-text/15 text-xs font-semibold text-brand-text hover:bg-brand-text/5 disabled:opacity-40 disabled:cursor-not-allowed"
          title={request.camera_ready_file || 'No camera-ready file uploaded'}
        >
          <FileText className="w-3.5 h-3.5" />
          View camera-ready PDF
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {request.status === 'REJECTED' && request.rejection_note ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <span className="font-bold">Note sent to author: </span>
          {request.rejection_note}
        </div>
      ) : null}
      {request.status === 'APPROVED' ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
          Approved {formatDate(request.reviewed_at)}
          {request.reviewed_by ? ` by ${request.reviewed_by}` : ''}. The proposed list is now saved for certificates.
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        <AuthorColumn title="Currently saved authors" authors={request.current_authors || []} tone="current" />
        <AuthorColumn title="Submitted author details" authors={request.proposed_authors || []} tone="proposed" />
      </div>

      {request.status === 'PENDING' ? (
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-brand-text/10">
          <button
            type="button"
            onClick={() => onApprove(request)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-xs font-semibold hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-4 h-4" /> Approve details
          </button>
          <button
            type="button"
            onClick={() => onReject(request)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4" /> Reject & send back
          </button>
          <span className="text-[11px] text-brand-text/50 ml-auto">
            Compare with the camera-ready paper before deciding.
          </span>
        </div>
      ) : null}
    </div>
  );
}

export default function AuthorVerificationPanel({
  requests,
  loading,
  error,
  token,
  onOpenPdf,
  onUnauthorized,
  onRefresh,
}: Props) {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AuthorVerificationRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  useEffect(() => {
    setActionError(null);
    setSuccessMessage(null);
  }, [filter]);

  const counts = {
    PENDING: requests.filter((r) => r.status === 'PENDING').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    ALL: requests.length,
  };

  const visible = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);

  const callAction = async (
    request: AuthorVerificationRequest,
    action: 'approve' | 'reject',
    note = ''
  ) => {
    setBusyId(request.submission_id);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/author-detail-requests/${encodeURIComponent(request.submission_id)}/${action}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(action === 'reject' ? { note } : {}),
        }
      );
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Could not ${action} the author details.`);
      }
      setSuccessMessage(
        action === 'approve'
          ? 'Author details approved and saved for certificates.'
          : 'Author details rejected. The author can now edit and resubmit them.'
      );
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `Could not ${action} the author details.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = (request: AuthorVerificationRequest) => {
    void callAction(request, 'approve');
  };

  const handleReject = (request: AuthorVerificationRequest) => {
    setRejectTarget(request);
    setRejectNote('');
    setActionError(null);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    setRejectBusy(true);
    await callAction(rejectTarget, 'reject', rejectNote.trim());
    setRejectBusy(false);
    setRejectTarget(null);
  };

  return (
    <>
      <div className="bg-brand-card rounded-xl border border-brand-text/10 shadow-sm p-4 sm:p-5 mb-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-serif font-bold text-xl text-brand-text flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Author detail verification
            </h2>
            <p className="text-xs sm:text-sm text-brand-text/60 mt-1">
              Authors submit their certificate details here. Open the camera-ready PDF, compare it
              with the submitted names, then approve or send the request back. Approval writes the
              proposed list to the database and locks it; rejection reopens the Edit Authors button
              in the user portal.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-brand-text/15 text-xs font-semibold text-brand-text hover:bg-brand-text/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {(['PENDING', 'REJECTED', 'APPROVED', 'ALL'] as Filter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filter === key
                  ? 'bg-brand-text text-white'
                  : 'bg-brand-text/5 text-brand-text hover:bg-brand-text/10'
              }`}
            >
              {key === 'PENDING' ? 'Awaiting verification' : key === 'REJECTED' ? 'Sent back' : key === 'APPROVED' ? 'Approved' : 'All'}
              <span className="ml-1.5 opacity-70">{counts[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {actionError}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-brand-text/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading author detail requests…
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-brand-card rounded-xl border border-brand-text/10 p-10 text-center">
          {filter === 'PENDING' ? (
            <CheckCircle2 className="w-8 h-8 mx-auto text-green-600" />
          ) : (
            <Clock className="w-8 h-8 mx-auto text-brand-text/40" />
          )}
          <p className="text-sm font-semibold text-brand-text mt-3">
            {filter === 'PENDING'
              ? 'No author details are waiting for verification.'
              : 'No requests in this view.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((request) => (
            <AuthorCard
              key={request.submission_id}
              request={request}
              busy={busyId === request.submission_id}
              onApprove={handleApprove}
              onReject={handleReject}
              onOpenPdf={onOpenPdf}
            />
          ))}
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center p-3">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (!rejectBusy) setRejectTarget(null);
            }}
          />
          <div className="relative w-full max-w-lg bg-brand-card rounded-2xl shadow-2xl border border-brand-text/10 flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-brand-text/10">
              <div>
                <h3 className="font-serif font-bold text-lg text-brand-text">Send author details back</h3>
                <p className="text-xs text-brand-text/60 mt-0.5 break-words">{rejectTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={rejectBusy}
                className="p-1 rounded-lg text-brand-text/60 hover:bg-brand-text/10 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-semibold text-brand-text mb-2" htmlFor="reject-note">
                Note for the author (optional)
              </label>
              <textarea
                id="reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={4}
                maxLength={300}
                placeholder="e.g. The third author's name does not match the camera-ready paper. Please correct it and resubmit."
                className="w-full rounded-lg border border-brand-text/20 bg-white px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-text/20"
              />
              <p className="text-[11px] text-brand-text/50 mt-1">
                The author will see this note and the Edit Authors button will be available again.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-brand-text/10">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={rejectBusy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-brand-text/70 hover:bg-brand-text/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={rejectBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50"
              >
                {rejectBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject & send back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
