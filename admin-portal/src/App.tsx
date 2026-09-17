import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, AlertCircle, RefreshCw, LogOut, Download, Trash2, Loader2, Phone, X, FileText, RotateCcw, Users, Search } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Author {
  id: string;
  submission_id: string;
  is_primary: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  college: string;
  created_at: string;
}

interface Submission {
  id: string;
  submission_code: string;
  paper_id: string;
  title: string;
  abstract: string;
  track: string;
  author_name: string;
  author_email: string;
  status: string;
  created_at: string;
  deleted_at?: string | null;
  enquired?: number;
  no_corrections?: number;
  manuscript_file?: string | null;
  plagiarism_file?: string | null;
  ai_plagiarism_file?: string | null;
  review_decision?: string | null;
  review_feedback?: string | null;
  review_updated_at?: string | null;
  review_resubmitted?: number;
  authors?: Author[];
}

interface FileView {
  open: boolean;
  url?: string;
  filename?: string;
  kind?: 'paper' | 'plagiarism' | 'ai_plagiarism';
  error?: string;
}

interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  institution: string;
  department: string;
  country: string;
  phone: string;
  submission_count: number;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Submitted', cls: 'bg-amber-100 text-amber-800' },
  UNDER_REVIEW: { label: 'Under Review', cls: 'bg-blue-100 text-blue-800' },
  READY_FOR_REGISTRATION: { label: 'Ready for Registration', cls: 'bg-green-100 text-green-800' },
  READY_FOR_CAMERA_READY: { label: 'Moved to Camera Ready\nSubmission', cls: 'bg-purple-100 text-purple-800' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
  REVISION_REQUIRED: { label: 'Revision Required', cls: 'bg-purple-100 text-purple-800' },
};

const STATUS_OPTIONS = ['SUBMITTED', 'UNDER_REVIEW', 'READY_FOR_REGISTRATION', 'READY_FOR_CAMERA_READY'];

function statusMeta(status: string) {
  return (
    STATUS_META[status] || {
      label: (status || 'SUBMITTED').replace(/_/g, ' '),
      cls: 'bg-amber-100 text-amber-800',
    }
  );
}

function statusBadge(status: string) {
  const meta = statusMeta(status);
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function reviewBadge(decision?: string | null, updatedAt?: string | null) {
  const ok = decision === 'ACCEPTED';
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${ok ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
      <div className={`text-xs font-semibold ${ok ? 'text-green-800' : 'text-red-800'}`}>
        {decision === 'ACCEPTED' ? 'Accepted' : decision === 'NOT_ACCEPTED' ? 'Not Accepted' : '—'}
      </div>
      {updatedAt && <div className="text-[11px] text-brand-text/50 mt-0.5">{formatDateTime(updatedAt)}</div>}
    </div>
  );
}

// ------------------------------------------------------------------
// Inline status editor in the Submissions list
// ------------------------------------------------------------------
function StatusSelect({
  sub,
  token,
  onChanged,
  onUnauthorized,
  onError,
}: {
  sub: Submission;
  token: string;
  onChanged: () => void;
  onUnauthorized: () => void;
  onError: (msg: string) => void;
}) {
  const [current, setCurrent] = useState(sub.status || 'SUBMITTED');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrent(sub.status || 'SUBMITTED');
  }, [sub.status]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const applyStatus = async (next: string) => {
    setOpen(false);
    if (next === current) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${sub.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update status.');
      }
      setCurrent(next);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  const meta = statusMeta(current);
  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`inline-flex items-center gap-1 pl-2.5 pr-2 py-1 max-w-full rounded-2xl text-xs font-medium border-2 transition-colors disabled:opacity-60 ${meta.cls}`}
        aria-label={`Change status for ${sub.title}, currently ${meta.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="max-w-[8.5rem] whitespace-pre-line text-left leading-tight py-0.5">{meta.label}</span>
        <svg
          className={`w-3 h-3 shrink-0 ${saving ? 'opacity-30' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-30 w-max min-w-[10rem] max-h-56 overflow-y-auto bg-white border border-brand-text/10 rounded-lg shadow-xl py-1"
          role="listbox"
        >
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === current}
              onClick={() => applyStatus(s)}
              className={`block w-full text-left px-3 py-1.5 text-xs font-medium whitespace-pre-line leading-tight transition-colors ${s === current ? STATUS_META[s].cls : 'text-brand-text hover:bg-brand-text/5'
                }`}
            >
              {STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}
      {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-text/60 shrink-0" />}
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function primaryAuthorLines(sub: Submission) {
  const primary = (sub.authors || []).find((a) => a.is_primary === 1);
  if (primary) {
    return (
      <>
        <div className="font-medium text-brand-text break-words">
          {[primary.first_name, primary.last_name].filter(Boolean).join(' ') || '—'}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-text/60 font-normal mt-0.5 break-words">
          {primary.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="w-3 h-3 shrink-0" /> {primary.phone}
            </span>
          )}
        </div>
        <div className="text-xs text-brand-text/60 font-normal break-words">{primary.email || ''}</div>
      </>
    );
  }
  const fallbackName = (sub.author_name || '').trim();
  return (
    <>
      <div className="font-medium text-brand-text break-words">{fallbackName || 'N/A'}</div>
      <div className="text-xs text-brand-text/60 font-normal break-words">{sub.author_email || ''}</div>
    </>
  );
}

// ------------------------------------------------------------------
// Keyword search: checks every available text field of a submission.
// ------------------------------------------------------------------
function matchesSearch(sub: Submission, q: string) {
  if (!q) return true;
  const haystack = [
    sub.title,
    sub.paper_id,
    sub.submission_code,
    sub.abstract,
    sub.track,
    sub.author_name,
    sub.author_email,
    sub.review_decision,
    sub.review_feedback,
    ...(sub.authors || []).flatMap((a) => [
      a.first_name,
      a.last_name,
      a.email,
      a.phone,
      a.college,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

// ------------------------------------------------------------------
// Login screen (hardcoded admin auth against backend)
// ------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (token: string, email: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.token) {
        setError(data?.error || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }
      onLogin(data.token, data.user?.email || username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
      <div className="bg-brand-card w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-xl border border-brand-text/5">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Admin Portal</h2>
          <p className="text-brand-text/60 text-sm">Sign in to manage ICAIDIET'26 submissions</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
              placeholder="Enter Your username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
              placeholder="Enter Your Password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-text text-white py-2.5 rounded-lg font-medium hover:bg-brand-accent hover:-translate-y-0.5 hover:shadow-lg transition-all mt-6 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// PDF viewer modal (fetches the file with the auth token)
// ------------------------------------------------------------------
function PdfViewer({ file, token, onClose }: { file: FileView; token: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const loadPdf = useCallback(async () => {
    if (!file.url) return;
    setError(null);
    const res = await fetch(file.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setError('Could not load this manuscript. It may have been removed.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (frameRef.current) frameRef.current.src = url;
  }, [file.url, token]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  const downloadPdf = async () => {
    if (!file.url) return;
    setError(null);
    const res = await fetch(file.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setError('Could not download this document. It may have been removed.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      file.filename ||
      (file.kind === 'plagiarism'
        ? 'plagiarism-report.pdf'
        : file.kind === 'ai_plagiarism'
          ? 'ai-plagiarism-report.pdf'
          : 'manuscript.pdf');
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[90vh] sm:h-[85vh] flex flex-col bg-brand-card rounded-2xl overflow-hidden shadow-2xl border border-brand-text/10">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-brand-text text-white">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 shrink-0" />
            <span className="font-medium truncate">
              {file.filename ||
                (file.kind === 'plagiarism'
                  ? 'Plagiarism Report'
                  : file.kind === 'ai_plagiarism'
                    ? 'AI Plagiarism Report'
                    : 'Manuscript')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
              aria-label="Download"
            >
              <Download className="w-4 h-4" /> Download
            </button>
            <button
              onClick={() => {
                setError(null);
                loadPdf();
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Reload"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" aria-label="Close">
              &times;
            </button>
          </div>
        </div>
        <div className="flex-1 bg-white relative">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-red-600 bg-red-50 border border-red-200 px-5 py-3 rounded-lg text-sm">
                {error}
              </div>
            </div>
          ) : (
            <iframe ref={frameRef} title="Manuscript" className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Confirm dialog for destructive actions (e.g. delete a submission)
// ------------------------------------------------------------------
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 bg-brand-card shadow-2xl border border-brand-text/10 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-7 h-7" />
        </div>
        <h2 className="font-serif text-2xl font-bold mb-2">{title}</h2>
        <p className="text-brand-text/70 text-sm mb-6 whitespace-pre-line">{message}</p>
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs text-left border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-3 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// More info modal: full record details (no file actions)
// ------------------------------------------------------------------
function MoreInfoModal({
  sub,
  onClose,
}: {
  sub: Submission | null;
  onClose: () => void;
}) {
  if (!sub) return null;
  const authors = sub.authors || [];
  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border-2 border-brand-accent overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 bg-brand-text text-white">
          <h2 className="font-serif font-bold text-lg sm:text-xl min-w-0 truncate">Submission Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Paper Title</div>
              <h3 className="font-serif text-lg sm:text-xl font-bold leading-snug break-words mt-1">{sub.title}</h3>
            </div>
            {statusBadge(sub.status)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Paper ID</div>
              <div className="font-semibold break-words mt-0.5">{sub.paper_id || 'NA'}</div>
            </div>
            <div>
              <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Submission Code</div>
              <div className="font-semibold break-words mt-0.5">{sub.submission_code}</div>
            </div>
            <div>
              <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Track</div>
              <div className="font-semibold capitalize break-words mt-0.5">{sub.track?.replace(/-/g, ' ') || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Submitted</div>
              <div className="font-semibold mt-0.5">{formatDateTime(sub.created_at) || '—'}</div>
            </div>
          </div>

          {sub.abstract && (
            <div>
              <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Abstract</div>
              <p className="text-sm text-brand-text/80 leading-relaxed mt-1 whitespace-pre-line">{sub.abstract}</p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 text-xs text-brand-text/50 uppercase tracking-wide font-medium mb-2">
              <Users className="w-3.5 h-3.5" /> Authors ({authors.length || 1})
            </div>
            {authors.length === 0 ? (
              <p className="text-sm text-brand-text/70">
                {(sub.author_name || 'N/A').split(' ')[0] || 'N/A'} {sub.author_email && `· ${sub.author_email}`}
              </p>
            ) : (
              <div className="space-y-3">
                {authors.map((a) => (
                  <div key={a.id} className="bg-brand-bg/50 border border-brand-accent/40 rounded-xl p-3">
                    <div className="flex flex-wrap items-center gap-2 font-semibold text-brand-text">
                      <FileText className="w-4 h-4 shrink-0 text-brand-accent" />
                      <span className="break-words">{a.first_name} {a.last_name}</span>
                      {a.is_primary === 1 && (
                        <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-brand-text/70 mt-1 space-y-0.5">
                      {a.email && (
                        <div className="flex items-center gap-1.5 break-words">
                          <span className="shrink-0">✉</span> {a.email}
                        </div>
                      )}
                      {a.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 shrink-0" /> {a.phone}
                        </div>
                      )}
                      {a.college && <div className="break-words">{a.college}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(sub.review_decision || sub.review_feedback) && (
            <div>
              <div className="flex items-center gap-1.5 text-xs text-brand-text/50 uppercase tracking-wide font-medium mb-2">
                <FileText className="w-3.5 h-3.5" /> Review Feedback
              </div>
              <div
                className={`rounded-xl border p-3 ${sub.review_decision === 'ACCEPTED'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-amber-50 border-amber-300'
                  }`}
              >
                <div className="flex flex-wrap items-center gap-2 font-semibold text-brand-text">
                  <span>{sub.review_decision || 'No decision recorded'}</span>
                  {sub.review_updated_at && (
                    <span className="text-[11px] text-brand-text/50 font-medium ml-auto">
                      {formatDateTime(sub.review_updated_at)}
                    </span>
                  )}
                </div>
                {sub.review_feedback && (
                  <p className="text-sm text-brand-text/80 leading-relaxed whitespace-pre-wrap mt-1.5">
                    {sub.review_feedback}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t-2 border-brand-accent/40 bg-brand-bg/40">
          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-brand-text/70 hover:bg-brand-text/5 transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Reusable search + track + paper ID filter panel (used in every tab)
// ------------------------------------------------------------------
function FilterPanel({
  searchTerm,
  onSearchChange,
  trackFilter,
  onTrackFilterChange,
  paperIdFilter,
  onPaperIdFilterChange,
  tracks,
  paperIds,
  resultCount,
  totalCount,
  onClear,
}: {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  trackFilter: string;
  onTrackFilterChange: (v: string) => void;
  paperIdFilter: string;
  onPaperIdFilterChange: (v: string) => void;
  tracks: string[];
  paperIds: string[];
  resultCount: number;
  totalCount: number;
  onClear: () => void;
}) {
  const filtersActive = !!(searchTerm.trim() || trackFilter || paperIdFilter);
  return (
    <div className="bg-white rounded-xl shadow-sm border-2 border-brand-accent p-4 mb-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text/40 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by title, abstract, track, author, co-author, review feedback..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-brand-text/20 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
        {tracks.length > 0 && (
          <select
            value={trackFilter}
            onChange={(e) => onTrackFilterChange(e.target.value)}
            className="w-full lg:w-52 px-3 py-2 rounded-lg border border-brand-text/20 text-sm text-brand-text bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="">All Tracks</option>
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t.replace(/-/g, ' ')}
              </option>
            ))}
          </select>
        )}
        {paperIds.length > 0 && (
          <select
            value={paperIdFilter}
            onChange={(e) => onPaperIdFilterChange(e.target.value)}
            className="w-full lg:w-48 px-3 py-2 rounded-lg border border-brand-text/20 text-sm text-brand-text bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="">All Paper IDs</option>
            {paperIds.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {filtersActive && (
          <button
            onClick={onClear}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-brand-text/20 text-sm font-medium text-brand-text hover:bg-brand-text/5 transition-colors whitespace-nowrap"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>
      {filtersActive && (
        <div className="mt-2 text-xs text-brand-text/60">
          Showing {resultCount} of {totalCount}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main app
// ------------------------------------------------------------------
export default function App() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('icaidiet_admin_token') || '');
  const [adminEmail, setAdminEmail] = useState<string>(() => sessionStorage.getItem('icaidiet_admin_user') || '');
  const [activeTab, setActiveTab] = useState<'submissions' | 'reviewed' | 'users' | 'deleted' | 'settings'>('submissions');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [deletedSubmissions, setDeletedSubmissions] = useState<Submission[]>([]);
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, underReview: 0, readyForRegistration: 0, readyForCameraReady: 0 });
  const [loading, setLoading] = useState(false);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfView, setPdfView] = useState<FileView>({ open: false });
  const [moreInfoTarget, setMoreInfoTarget] = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [enquiredSaving, setEnquiredSaving] = useState<string | null>(null);
  const [noCorrectionsSaving, setNoCorrectionsSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [paperIdFilter, setPaperIdFilter] = useState('');
  const [mtUserEnabled, setMtUserEnabled] = useState<boolean>(false);
  const [mtUserUntil, setMtUserUntil] = useState<string>('');
  const [mtReviewEnabled, setMtReviewEnabled] = useState<boolean>(false);
  const [mtReviewUntil, setMtReviewUntil] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  const handleLogin = (newToken: string, email: string) => {
    setToken(newToken);
    setAdminEmail(email);
    sessionStorage.setItem('icaidiet_admin_token', newToken);
    sessionStorage.setItem('icaidiet_admin_user', email);
    setError(null);
  };

  const handleLogout = () => {
    setToken('');
    setAdminEmail('');
    setSubmissions([]);
    setDeletedSubmissions([]);
    setUsers([]);
    setPdfView({ open: false });
    sessionStorage.removeItem('icaidiet_admin_token');
    sessionStorage.removeItem('icaidiet_admin_user');
  };

  const fetchUsers = async (opts?: { silent?: boolean }) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load users.');
      }
      setUsers(data.users || []);
    } catch (err) {
      if (opts?.silent) {
        console.error(err);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load users.');
      }
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const s = data.settings || {};
        setMtUserEnabled(s.maintenance_user_enabled === 'true' || s.maintenance_mode === 'true');
        setMtUserUntil(s.maintenance_user_until || '');
        setMtReviewEnabled(s.maintenance_review_enabled === 'true');
        setMtReviewUntil(s.maintenance_review_until || '');
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const savePortalSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          maintenance_user_enabled: mtUserEnabled,
          maintenance_user_until: mtUserUntil,
          maintenance_review_enabled: mtReviewEnabled,
          maintenance_review_until: mtReviewUntil,
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setError(null);
      } else {
        throw new Error(data?.error || 'Failed to update settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchSubmissions = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load submissions.');
      }
      const list: Submission[] = data.submissions || [];
      setSubmissions(list);
      setStats({
        total: list.length,
        submitted: list.filter((s) => s.status === 'SUBMITTED').length,
        underReview: list.filter((s) => s.status === 'UNDER_REVIEW').length,
        readyForRegistration: list.filter((s) => s.status === 'READY_FOR_REGISTRATION').length,
        readyForCameraReady: list.filter((s) => s.status === 'READY_FOR_CAMERA_READY').length,
      });
    } catch (err) {
      if (silent) {
        console.error(err);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load submissions.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchDeletedSubmissions = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    if (!silent) setDeletedLoading(true);
    if (!silent) setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load deleted submissions.');
      }
      setDeletedSubmissions(data.submissions || []);
    } catch (err) {
      if (silent) {
        console.error(err);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load deleted submissions.');
      }
    } finally {
      if (!silent) setDeletedLoading(false);
    }
  };

  const handleRecover = async (id: string) => {
    setRecovering(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${id}/recover`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to recover submission.');
      }
      setDeletedSubmissions((prev) => prev.filter((s) => s.id !== id));
      await Promise.all([fetchSubmissions(), fetchDeletedSubmissions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recover submission.');
    } finally {
      setRecovering(false);
    }
  };

  React.useEffect(() => {
    if (token) {
      fetchSubmissions();
      fetchDeletedSubmissions();
      fetchUsers();
      fetchSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (activeTab === 'submissions' || activeTab === 'reviewed') fetchSubmissions({ silent: true });
      else if (activeTab === 'deleted') fetchDeletedSubmissions({ silent: true });
      else if (activeTab === 'users') fetchUsers({ silent: true });
    }, 180000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  const openPdf = (id: string, kind: 'paper' | 'plagiarism' | 'ai_plagiarism', filename: string) => {
    const type =
      kind === 'plagiarism' ? 'PLAGIARISM' : kind === 'ai_plagiarism' ? 'AI_PLAGIARISM' : 'MANUSCRIPT';
    setPdfView({
      open: true,
      url: `${API_URL}/api/admin/submissions/${id}/file?type=${type}`,
      filename,
      kind,
    });
  };

  const closePdf = () => {
    setPdfView({ open: false, url: undefined, filename: undefined, kind: undefined, error: undefined });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete submission.');
      }
      setSubmissions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      setDeleteTarget(null);
      await fetchDeletedSubmissions();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete submission.');
    } finally {
      setDeleting(false);
    }
  };

  const handleEnquiredToggle = async (sub: Submission) => {
    const next = sub.enquired ? 0 : 1;
    setEnquiredSaving(sub.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${sub.id}/enquired`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enquired: next === 1 }),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update enquiry status.');
      }
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, enquired: next } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update enquiry status.');
    } finally {
      setEnquiredSaving(null);
    }
  };

  const handleNoCorrectionsToggle = async (sub: Submission) => {
    const next = sub.no_corrections ? 0 : 1;
    setNoCorrectionsSaving(sub.id);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${sub.id}/no-corrections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ noCorrections: next === 1 }),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to update No Corrections status.');
      }
      setSubmissions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, no_corrections: next } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update No Corrections status.');
    } finally {
      setNoCorrectionsSaving(null);
    }
  };

  const authButtons = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 min-w-0">
      <span className="text-xs sm:text-sm text-brand-text/60 truncate max-w-[45vw] sm:max-w-none">{adminEmail}</span>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-text/70 hover:text-brand-text transition-colors whitespace-nowrap"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );

  const tracks = Array.from(new Set(submissions.map((s) => s.track).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );
  const paperIds = Array.from(new Set(submissions.map((s) => s.paper_id).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );
  const deletedTracks = Array.from(new Set(deletedSubmissions.map((s) => s.track).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );
  const deletedPaperIds = Array.from(new Set(deletedSubmissions.map((s) => s.paper_id).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b)
  );
  const q = searchTerm.trim().toLowerCase();
  const filtersActive = !!(q || trackFilter || paperIdFilter);
  const isReviewed = (s: Submission) => !!s.review_decision && s.review_resubmitted !== 1;
  const reviewedSubmissions = submissions.filter(isReviewed);
  const pendingSubmissions = submissions.filter((s) => !isReviewed(s));
  const applyFilters = (list: Submission[]) =>
    list.filter((s) => {
      const matchSearch = matchesSearch(s, q);
      const matchTrack = !trackFilter || s.track === trackFilter;
      const matchPaper = !paperIdFilter || s.paper_id === paperIdFilter;
      return matchSearch && matchTrack && matchPaper;
    });
  const filteredSubmissions = applyFilters(pendingSubmissions).sort((a, b) => {
    const aNC = a.no_corrections ? 1 : 0;
    const bNC = b.no_corrections ? 1 : 0;
    if (aNC !== bNC) return bNC - aNC;
    const aE = a.enquired ? 1 : 0;
    const bE = b.enquired ? 1 : 0;
    return bE - aE;
  });
  const filteredReviewed = applyFilters(reviewedSubmissions);
  const filteredDeleted = applyFilters(deletedSubmissions);

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
        <div className="flex-1 flex flex-col">
          <header className="border-b border-brand-text/10 bg-brand-bg/80 backdrop-blur-md">
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <h1 className="font-serif font-bold text-xl tracking-tight">Admin of ICAIDIET'26</h1>
            </div>
          </header>
          <LoginScreen onLogin={handleLogin} />
          <footer className="bg-brand-footer text-white py-6">
            <div className="container mx-auto px-4 sm:px-6">
              <p className="text-white/60 text-xs text-center">
                &copy; 2026 ICAIDIET. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
      <header className="bg-brand-bg/80 backdrop-blur-md border-b border-brand-text/10 sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-serif font-bold text-lg sm:text-2xl tracking-tight">ICAIDIET'26 Admin</h1>
          {authButtons}
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3 md:mb-2">Admin Dashboard</h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setActiveTab('submissions')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'submissions' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
                  }`}
              >
                Submissions
                {pendingSubmissions.length > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'submissions' ? 'bg-amber-500 text-white' : 'bg-brand-text text-white'}`}>
                    {pendingSubmissions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('reviewed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reviewed' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
                  }`}
              >
                Reviewed
                {reviewedSubmissions.length > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'reviewed' ? 'bg-green-500 text-white' : 'bg-green-500 text-white'}`}>
                    {reviewedSubmissions.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('deleted')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'deleted' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
                  }`}
              >
                Deleted Files
                {deletedSubmissions.length > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'deleted' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                    {deletedSubmissions.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
                  }`}
              >
                Settings
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              fetchSubmissions();
              fetchDeletedSubmissions();
              fetchUsers();
              fetchSettings();
            }}
            disabled={loading || deletedLoading}
            className="w-full sm:w-auto px-4 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow"
          >
            <RefreshCw className={`w-4 h-4 ${loading || deletedLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {activeTab === 'submissions' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
              <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold font-serif">{stats.total}</div>
                <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Total</div>
              </div>
              <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold font-serif text-amber-700">{stats.submitted}</div>
                <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Submitted</div>
              </div>
              <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold font-serif text-blue-700">{stats.underReview}</div>
                <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Under Review</div>
              </div>
              <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold font-serif text-green-700">{stats.readyForRegistration}</div>
                <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Ready for Registration</div>
              </div>
              <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold font-serif text-purple-700">{stats.readyForCameraReady}</div>
                <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Proceeded for Camera Ready</div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Error loading submissions: {error}
                </div>
              </div>
            )}

            {/* Search & Filters */}
            <FilterPanel
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              trackFilter={trackFilter}
              onTrackFilterChange={setTrackFilter}
              paperIdFilter={paperIdFilter}
              onPaperIdFilterChange={setPaperIdFilter}
              tracks={tracks}
              paperIds={paperIds}
              resultCount={filteredSubmissions.length}
              totalCount={pendingSubmissions.length}
              onClear={() => {
                setSearchTerm('');
                setTrackFilter('');
                setPaperIdFilter('');
              }}
            />

            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-xl shadow-sm border-2 border-brand-accent">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-brand-bg/60 border-b-2 border-brand-accent">
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[10%] rounded-tl-xl">Paper ID</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[16%]">Paper Title</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[10%]">Track</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%]">Primary Author</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%]">Submitted On</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%]">Status</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[17%]">Actions</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[11%] rounded-tr-xl">More Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-accent/40">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-brand-text/60">Loading submissions...</td>
                    </tr>
                  ) : filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-brand-text/60">
                        {filtersActive ? 'No submissions match your search or filters.' : 'No submissions found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub, idx) => (
                      <tr key={sub.id} className="bg-white">
                        <td className={`py-4 px-5 align-top ${idx === filteredSubmissions.length - 1 ? 'rounded-bl-xl' : ''}`}>
                          <div className="font-semibold text-brand-text break-words">{sub.paper_id || 'NA'}</div>
                          <div className="text-xs text-brand-text/50 font-normal mt-0.5 break-words">{sub.submission_code}</div>
                        </td>
                        <td className="py-4 px-5 align-top">
                          <div className="font-semibold text-brand-text break-words leading-snug">{sub.title}</div>
                          {sub.abstract && (
                            <div className="text-xs text-brand-text/50 font-normal mt-1 line-clamp-2 break-words">
                              {sub.abstract}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-5 align-top text-sm text-brand-text/70 capitalize break-words">{sub.track?.replace(/-/g, ' ') || '—'}</td>
                        <td className="py-4 px-5 align-top">
                          {primaryAuthorLines(sub)}
                        </td>
                        <td className="py-4 px-5 align-top text-sm text-brand-text/70 break-words">
                          {formatDateTime(sub.created_at) || '—'}
                        </td>
                        <td className="py-4 px-5 align-top">
                          <StatusSelect
                            sub={sub}
                            token={token}
                            onChanged={fetchSubmissions}
                            onUnauthorized={handleLogout}
                            onError={setError}
                          />
                        </td>
                        <td className="py-4 px-5 align-top">
                          <div className="flex flex-col items-start gap-2">
                            <button
                              onClick={() => openPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                              title={sub.manuscript_file || 'Paper PDF'}
                              className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                            >
                              <Eye className="w-4 h-4" /> View Paper
                            </button>
                            {sub.plagiarism_file && (
                              <button
                                onClick={() => openPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                                title={sub.plagiarism_file || 'Plagiarism report'}
                                className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                              >
                                <Eye className="w-4 h-4" /> View Plag.
                              </button>
                            )}
                            {sub.ai_plagiarism_file && (
                              <button
                                onClick={() => openPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                                title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                                className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                              >
                                <Eye className="w-4 h-4" /> View AI Plag.
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`py-4 px-5 align-top ${idx === filteredSubmissions.length - 1 ? 'rounded-br-xl' : ''}`}>
                          <div className="flex flex-col items-start gap-2">
                            <button
                              onClick={() => setMoreInfoTarget(sub)}
                              className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                            >
                              <Eye className="w-4 h-4" /> View Info
                            </button>
                            <button
                              onClick={() => setDeleteTarget(sub)}
                              className="inline-flex items-center gap-1.5 text-red-600 font-medium text-xs whitespace-nowrap hover:text-red-700 hover:underline"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                            <div className="mt-2 pt-2 border-t border-brand-text/10 w-full">
                              <label
                                className="inline-flex items-center gap-1.5 text-xs text-brand-text/70 cursor-pointer select-none"
                                title={sub.enquired ? 'Author contacted — uncheck if they update their submission.' : 'Mark author as contacted'}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!sub.enquired}
                                  disabled={enquiredSaving === sub.id}
                                  onChange={() => handleEnquiredToggle(sub)}
                                  className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                                />
                                Enquired
                              </label>
                            </div>
                            <div className="w-full">
                              <label
                                className="inline-flex items-center gap-1.5 text-xs text-brand-text/70 cursor-pointer select-none"
                                title={sub.no_corrections ? 'Marked — no corrections required.' : 'Mark submission as requiring no corrections'}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!sub.no_corrections}
                                  disabled={noCorrectionsSaving === sub.id}
                                  onChange={() => handleNoCorrectionsToggle(sub)}
                                  className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                                />
                                No Corrections
                              </label>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-4 lg:hidden">
              {loading ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  Loading submissions...
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  {filtersActive ? 'No submissions match your search or filters.' : 'No submissions found.'}
                </div>
              ) : (
                filteredSubmissions.map((sub) => (
                  <div key={sub.id} className="bg-white rounded-xl shadow-sm border-2 border-brand-accent p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Paper ID</div>
                        <div className="font-semibold text-brand-text break-words">{sub.paper_id || 'NA'}</div>
                        <div className="text-xs text-brand-text/60 mt-1">{sub.submission_code}</div>
                      </div>
                      <div className="shrink-0">
                        <StatusSelect
                          sub={sub}
                          token={token}
                          onChanged={fetchSubmissions}
                          onUnauthorized={handleLogout}
                          onError={setError}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Paper Title</div>
                      <div className="font-semibold text-brand-text break-words leading-snug">{sub.title}</div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Track</div>
                        <div className="font-medium capitalize break-words">{sub.track?.replace(/-/g, ' ') || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Primary Author</div>
                        <div className="text-brand-text/90">{primaryAuthorLines(sub)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Submitted On</div>
                        <div className="text-brand-text/90 break-words">{formatDateTime(sub.created_at) || '—'}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col items-start gap-1.5 border-t-2 border-brand-accent/40 pt-3">
                      <button
                        onClick={() => openPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                        title={sub.manuscript_file || 'Paper PDF'}
                        className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Paper
                      </button>
                      {sub.plagiarism_file && (
                        <button
                          onClick={() => openPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                          title={sub.plagiarism_file || 'Plagiarism report'}
                          className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Plag.
                        </button>
                      )}
                      {sub.ai_plagiarism_file && (
                        <button
                          onClick={() => openPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                          title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                          className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> View AI Plag.
                        </button>
                      )}
                      <button
                        onClick={() => setMoreInfoTarget(sub)}
                        className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Info
                      </button>
                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="flex items-center gap-1.5 text-red-600 font-medium text-xs hover:text-red-700 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                      <label
                        className="mt-1.5 pt-1.5 border-t border-brand-text/10 w-full flex items-center gap-1.5 text-xs text-brand-text/70 cursor-pointer select-none"
                        title={sub.enquired ? 'Author contacted — uncheck if they update their submission.' : 'Mark author as contacted'}
                      >
                        <input
                          type="checkbox"
                          checked={!!sub.enquired}
                          disabled={enquiredSaving === sub.id}
                          onChange={() => handleEnquiredToggle(sub)}
                          className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                        />
                        Enquired
                      </label>
                      <label
                        className="w-full flex items-center gap-1.5 text-xs text-brand-text/70 cursor-pointer select-none"
                        title={sub.no_corrections ? 'Marked — no corrections required.' : 'Mark submission as requiring no corrections'}
                      >
                        <input
                          type="checkbox"
                          checked={!!sub.no_corrections}
                          disabled={noCorrectionsSaving === sub.id}
                          onChange={() => handleNoCorrectionsToggle(sub)}
                          className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                        />
                        No Corrections
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'reviewed' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-serif text-xl font-bold">Reviewed Files</h3>
              <p className="text-xs text-brand-text/60">
                Papers that reviewers have decided on. This section is view-only.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Error loading submissions: {error}
                </div>
              </div>
            )}

            <FilterPanel
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              trackFilter={trackFilter}
              onTrackFilterChange={setTrackFilter}
              paperIdFilter={paperIdFilter}
              onPaperIdFilterChange={setPaperIdFilter}
              tracks={tracks}
              paperIds={paperIds}
              resultCount={filteredReviewed.length}
              totalCount={reviewedSubmissions.length}
              onClear={() => {
                setSearchTerm('');
                setTrackFilter('');
                setPaperIdFilter('');
              }}
            />

            {/* Desktop table */}
            <div className="hidden lg:block bg-white rounded-xl shadow-sm border-2 border-brand-accent">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-brand-bg/60 border-b-2 border-brand-accent">
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[10%] rounded-tl-xl">Paper ID</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[18%]">Paper Title</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[11%]">Track</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[13%]">Primary Author</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[13%]">Submitted On</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[16%]">Review Decision</th>
                    <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[19%] rounded-tr-xl">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-accent/40">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-brand-text/60">Loading submissions...</td>
                    </tr>
                  ) : filteredReviewed.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-brand-text/60">
                        {filtersActive ? 'No reviewed papers match your search or filters.' : 'No reviewed papers yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredReviewed.map((sub, idx) => (
                      <tr key={sub.id} className="bg-white">
                        <td className={`py-4 px-5 align-top ${idx === filteredReviewed.length - 1 ? 'rounded-bl-xl' : ''}`}>
                          <div className="font-semibold text-brand-text break-words">{sub.paper_id || 'NA'}</div>
                          <div className="text-xs text-brand-text/50 font-normal mt-0.5 break-words">{sub.submission_code}</div>
                        </td>
                        <td className="py-4 px-5 align-top">
                          <div className="font-semibold text-brand-text break-words leading-snug">{sub.title}</div>
                          <div className="mt-1">{statusBadge(sub.status)}</div>
                        </td>
                        <td className="py-4 px-5 align-top text-sm text-brand-text/70 capitalize break-words">{sub.track?.replace(/-/g, ' ') || '—'}</td>
                        <td className="py-4 px-5 align-top">{primaryAuthorLines(sub)}</td>
                        <td className="py-4 px-5 align-top text-sm text-brand-text/70 break-words">
                          {formatDateTime(sub.created_at) || '—'}
                        </td>
                        <td className="py-4 px-5 align-top">
                          {reviewBadge(sub.review_decision, sub.review_updated_at)}
                          {sub.review_feedback && (
                            <p className="text-xs text-brand-text/70 leading-relaxed whitespace-pre-wrap mt-1.5 max-h-24 overflow-y-auto">
                              {sub.review_feedback}
                            </p>
                          )}
                        </td>
                        <td className={`py-4 px-5 align-top ${idx === filteredReviewed.length - 1 ? 'rounded-br-xl' : ''}`}>
                          <div className="flex flex-col items-start gap-2">
                            <button
                              onClick={() => openPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                              title={sub.manuscript_file || 'Paper PDF'}
                              className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                            >
                              <Eye className="w-4 h-4" /> View Paper
                            </button>
                            {sub.plagiarism_file && (
                              <button
                                onClick={() => openPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                                title={sub.plagiarism_file || 'Plagiarism report'}
                                className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                              >
                                <Eye className="w-4 h-4" /> View Plag.
                              </button>
                            )}
                            {sub.ai_plagiarism_file && (
                              <button
                                onClick={() => openPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                                title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                                className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                              >
                                <Eye className="w-4 h-4" /> View AI Plag.
                              </button>
                            )}
                            <button
                              onClick={() => setMoreInfoTarget(sub)}
                              className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                            >
                              <Eye className="w-4 h-4" /> View Info
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-4 lg:hidden">
              {loading ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  Loading submissions...
                </div>
              ) : filteredReviewed.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  {filtersActive ? 'No reviewed papers match your search or filters.' : 'No reviewed papers yet.'}
                </div>
              ) : (
                filteredReviewed.map((sub) => (
                  <div key={sub.id} className="bg-white rounded-xl shadow-sm border-2 border-brand-accent p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Paper ID</div>
                        <div className="font-semibold text-brand-text break-words">{sub.paper_id || 'NA'}</div>
                        <div className="text-xs text-brand-text/60 mt-1">{sub.submission_code}</div>
                      </div>
                      <div className="shrink-0">{statusBadge(sub.status)}</div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Paper Title</div>
                      <div className="font-semibold text-brand-text break-words leading-snug">{sub.title}</div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Track</div>
                        <div className="font-medium capitalize break-words">{sub.track?.replace(/-/g, ' ') || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Primary Author</div>
                        <div className="text-brand-text/90">{primaryAuthorLines(sub)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Submitted On</div>
                        <div className="text-brand-text/90 break-words">{formatDateTime(sub.created_at) || '—'}</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide mb-1.5">Review Decision</div>
                      {reviewBadge(sub.review_decision, sub.review_updated_at)}
                      {sub.review_feedback && (
                        <p className="text-xs text-brand-text/70 leading-relaxed whitespace-pre-wrap mt-1.5">
                          {sub.review_feedback}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col items-start gap-1.5 border-t-2 border-brand-accent/40 pt-3">
                      <button
                        onClick={() => openPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                        title={sub.manuscript_file || 'Paper PDF'}
                        className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Paper
                      </button>
                      {sub.plagiarism_file && (
                        <button
                          onClick={() => openPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                          title={sub.plagiarism_file || 'Plagiarism report'}
                          className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Plag.
                        </button>
                      )}
                      {sub.ai_plagiarism_file && (
                        <button
                          onClick={() => openPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                          title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                          className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" /> View AI Plag.
                        </button>
                      )}
                      <button
                        onClick={() => setMoreInfoTarget(sub)}
                        className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Info
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}



        {activeTab === 'deleted' && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="font-serif text-xl font-bold">Deleted Files</h3>
              <p className="text-xs text-brand-text/60">
                Records are kept for 30 days, then permanently removed. Recover to restore them to the list.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Error loading deleted submissions: {error}
                </div>
              </div>
            )}

            <FilterPanel
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              trackFilter={trackFilter}
              onTrackFilterChange={setTrackFilter}
              paperIdFilter={paperIdFilter}
              onPaperIdFilterChange={setPaperIdFilter}
              tracks={deletedTracks}
              paperIds={deletedPaperIds}
              resultCount={filteredDeleted.length}
              totalCount={deletedSubmissions.length}
              onClear={() => {
                setSearchTerm('');
                setTrackFilter('');
                setPaperIdFilter('');
              }}
            />

            <div className="space-y-4">
              {deletedLoading ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  Loading deleted files...
                </div>
              ) : filteredDeleted.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  {filtersActive
                    ? 'No deleted files match your search or filters.'
                    : 'No deleted files. Deleted submissions will appear here.'}
                </div>
              ) : (
                filteredDeleted.map((sub) => {
                  const deletedAt = sub.deleted_at ? new Date(sub.deleted_at) : null;
                  const daysLeft = deletedAt
                    ? Math.max(0, 30 - Math.floor((Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000)))
                    : 30;
                  const expired = daysLeft === 0;
                  return (
                    <div key={sub.id} className="bg-white rounded-xl shadow-sm border-2 border-brand-accent p-4 sm:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs bg-brand-text text-white px-2 py-0.5 rounded-full font-medium tracking-wide">
                              {sub.paper_id || 'NA'}
                            </span>
                            <span className="text-xs text-brand-text/50">{sub.submission_code}</span>
                          </div>
                          <h4 className="font-serif font-bold text-lg mt-2 break-words leading-snug">{sub.title}</h4>
                          <p className="text-sm text-brand-text/70 mt-1 capitalize break-words">
                            {sub.track?.replace(/-/g, ' ') || '—'}
                          </p>
                        </div>
                        <div className="shrink-0 flex flex-col items-start lg:items-end gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${expired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                              }`}
                          >
                            {expired ? 'Expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                          </span>
                          <span className="text-xs text-brand-text/60">
                            Deleted {deletedAt ? formatDate(deletedAt.toISOString()) : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t-2 border-brand-accent/40 pt-3">
                        <button
                          onClick={() => handleRecover(sub.id)}
                          disabled={recovering}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50"
                        >
                          <RotateCcw className={`w-4 h-4 ${recovering ? 'animate-spin' : ''}`} /> Recover
                        </button>
                        <button
                          onClick={() => setMoreInfoTarget(sub)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-brand-text text-sm font-medium border border-brand-text/10 rounded-lg hover:bg-brand-text/5 transition-colors"
                        >
                          <Eye className="w-4 h-4" /> View Info
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-brand-accent p-6 sm:p-8 max-w-3xl mt-6">
            <h3 className="font-serif text-xl font-bold mb-1">Portal Settings</h3>
            <p className="text-sm text-brand-text/60 mb-6">
              Turn maintenance on per portal. While a portal is under maintenance, the end date/time you set is
              shown to visitors; the user portal blocks new submissions and the reviewer portal blocks sign-in.
              Leave the date/time blank for maintenance with no scheduled end.
            </p>

            <div className="border border-brand-text/10 rounded-xl">
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b-2 border-brand-accent/40">
                <div>
                  <h4 className="font-semibold text-brand-text">User Portal Maintenance</h4>
                  <p className="text-sm text-brand-text/60 mt-1">
                    When on, users cannot create or update submissions and see a maintenance message.
                  </p>
                </div>
                <button
                  onClick={() => setMtUserEnabled(!mtUserEnabled)}
                  disabled={savingSettings}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 ${mtUserEnabled ? 'bg-brand-accent' : 'bg-gray-200'} ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="switch"
                  aria-checked={mtUserEnabled}
                >
                  <span className="sr-only">Toggle user portal maintenance</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${mtUserEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <label className="text-sm font-medium text-brand-text/80">Resume date &amp; time</label>
                <input
                  type="datetime-local"
                  value={mtUserUntil}
                  disabled={savingSettings}
                  onChange={(e) => setMtUserUntil(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                />
                {mtUserUntil && (
                  <span className="text-xs text-brand-text/50">
                    Shown as "back online {new Date(mtUserUntil).toLocaleString()}"
                  </span>
                )}
              </div>
            </div>

            <div className="border border-brand-text/10 rounded-xl mt-4">
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b-2 border-brand-accent/40">
                <div>
                  <h4 className="font-semibold text-brand-text">Reviewer Portal Maintenance</h4>
                  <p className="text-sm text-brand-text/60 mt-1">
                    When on, reviewers cannot sign in and see a maintenance message.
                  </p>
                </div>
                <button
                  onClick={() => setMtReviewEnabled(!mtReviewEnabled)}
                  disabled={savingSettings}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 ${mtReviewEnabled ? 'bg-brand-accent' : 'bg-gray-200'} ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="switch"
                  aria-checked={mtReviewEnabled}
                >
                  <span className="sr-only">Toggle reviewer portal maintenance</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${mtReviewEnabled ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <label className="text-sm font-medium text-brand-text/80">Resume date &amp; time</label>
                <input
                  type="datetime-local"
                  value={mtReviewUntil}
                  disabled={savingSettings}
                  onChange={(e) => setMtReviewUntil(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                />
                {mtReviewUntil && (
                  <span className="text-xs text-brand-text/50">
                    Shown as "back online {new Date(mtReviewUntil).toLocaleString()}"
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={savePortalSettings}
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50 shadow"
              >
                {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {savingSettings ? 'Saving...' : 'Save Portal Settings'}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-brand-footer text-white py-6 mt-auto">
        <div className="container mx-auto px-4 sm:px-6">
          <p className="text-white/60 text-xs text-center">
            &copy; 2026 ICAIDIET. All rights reserved.
          </p>
        </div>
      </footer>

      {pdfView.open && pdfView.url && <PdfViewer file={pdfView} token={token} onClose={closePdf} />}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Submission?"
        message={
          deleteTarget
            ? `Move "${deleteTarget.paper_id || deleteTarget.submission_code}" — ${deleteTarget.title} to Deleted Files?\n\nIt will be hidden from the submissions list. You can recover it from the "Deleted Files" tab within 30 days, after which it will be permanently removed.`
            : ''
        }
        confirmLabel="Delete"
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      />

      <MoreInfoModal
        sub={moreInfoTarget}
        onClose={() => setMoreInfoTarget(null)}
      />
    </div>
  );
}