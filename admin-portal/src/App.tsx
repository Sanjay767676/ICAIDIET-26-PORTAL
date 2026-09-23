import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, AlertCircle, RefreshCw, LogOut, Download, Trash2, Loader2, Phone, X, FileText, RotateCcw, Users, Search, Mail, CheckCircle2, XCircle, PenSquare, Plus, UserRoundCheck } from 'lucide-react';
import DownloadPanel from './components/DownloadPanel';

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
  manuscript_file?: string | null;
  plagiarism_file?: string | null;
  ai_plagiarism_file?: string | null;
  review_decision?: string | null;
  review_feedback?: string | null;
  review_updated_at?: string | null;
  review_resubmitted?: number;
  mail_status?: string;
  authors?: Author[];
}

interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  created_at?: string;
  updated_at?: string;
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

const REVIEW_DECISION_META: Record<string, { label: string; box: string; text: string }> = {
  ACCEPTED: { label: 'Accepted', box: 'bg-green-50 border-green-300', text: 'text-green-800' },
  ACCEPTED_WITH_MINOR_CHANGES: { label: 'Accepted with Minor Changes', box: 'bg-yellow-50 border-yellow-300', text: 'text-yellow-800' },
  ACCEPTED_WITH_MAJOR_CHANGES: { label: 'Accepted with Major Changes', box: 'bg-orange-50 border-orange-300', text: 'text-orange-800' },
  NOT_ACCEPTED: { label: 'Not Accepted', box: 'bg-red-50 border-red-300', text: 'text-red-800' },
};

function reviewBadge(decision?: string | null, updatedAt?: string | null) {
  const meta = decision ? REVIEW_DECISION_META[decision] : undefined;
  const label = meta?.label ?? '—';
  const box = meta?.box ?? 'bg-gray-50 border-gray-300';
  const text = meta?.text ?? 'text-brand-text';
  return (
    <div className={`rounded-lg border px-2.5 py-1.5 ${box}`}>
      <div className={`text-xs font-semibold ${text}`}>{label}</div>
      {updatedAt && <div className="text-[11px] text-brand-text/50 mt-0.5">{formatDateTime(updatedAt)}</div>}
    </div>
  );
}

// Highlight badge shown when the author has re-uploaded a revised version
// after a review decision that required changes. It tells the admin/reviewer
// that the paper is ready for re-review.
function UpdatedBadge({ label = 'Updated by author' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-teal-100 text-teal-800 border border-teal-400 animate-pulse whitespace-nowrap">
      <RefreshCw className="w-3 h-3" /> {label}
    </span>
  );
}

// Mail delivery status shown in the Reviewed / Not Accepted sections.
//   queued / sending -> Sending (yellow)
//   delivered        -> Delivered (green)
//   failed           -> Not sent (red)
function mailStatusBadge(status?: string) {
  if (!status) return <span className="text-xs text-brand-text/40">—</span>;
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5" /> Not sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 whitespace-nowrap">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending
    </span>
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
// ------------------------------------------------------------------
// Admin: Edit a submission's author list (phones, co-authors, college
// names, emails). Saves via PUT /api/admin/submissions/:id/authors
// ------------------------------------------------------------------
interface AuthorDraft {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  college: string;
  is_primary: boolean;
}

function EditAuthorsModal({
  sub,
  token,
  onUnauthorized,
  onClose,
  onSaved,
}: {
  sub: Submission | null;
  token: string;
  onUnauthorized: () => void;
  onClose: () => void;
  onSaved: (authors: Author[]) => void;
}) {
  if (!sub) return null;
  const existing = sub.authors && sub.authors.length > 0 ? sub.authors : [];
  const seedDrafts = (): AuthorDraft[] =>
    existing.length > 0
      ? existing.map((a) => ({
          first_name: a.first_name || '',
          last_name: a.last_name || '',
          email: a.email || '',
          phone: a.phone || '',
          college: a.college || '',
          is_primary: a.is_primary === 1,
        }))
      : [
          {
            first_name: (sub.author_name || '').split(' ')[0] || '',
            last_name: (sub.author_name || '').split(' ').slice(1).join(' ') || '',
            email: sub.author_email || '',
            phone: '',
            college: '',
            is_primary: true,
          },
        ];

  const [drafts, setDrafts] = useState<AuthorDraft[]>(seedDrafts);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<AuthorDraft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const setPrimary = (i: number) =>
    setDrafts((d) => d.map((row, idx) => ({ ...row, is_primary: idx === i })));

  const addAuthor = () =>
    setDrafts((d) => [...d, { first_name: '', last_name: '', email: '', phone: '', college: '', is_primary: false }]);

  const removeAuthor = (i: number) =>
    setDrafts((d) => d.filter((_, idx) => idx !== i));

  const save = async () => {
    setError(null);
    if (drafts.length === 0) {
      setError('Add at least one author.');
      return;
    }
    if (drafts.some((a) => !a.first_name.trim() || !a.last_name.trim())) {
      setError('Every author needs a first and last name.');
      return;
    }
    if (drafts.filter((a) => a.is_primary).length !== 1) {
      setError('Exactly one author must be marked as the primary author.');
      return;
    }
    const primary = drafts.find((a) => a.is_primary)!;
    if (!primary.email.trim()) {
      setError('The primary author must have an email address.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions/${sub.id}/authors`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          authors: drafts.map((a) => ({
            first_name: a.first_name.trim(),
            last_name: a.last_name.trim(),
            email: a.email.trim(),
            phone: a.phone.trim(),
            college: a.college.trim(),
            is_primary: a.is_primary ? 1 : 0,
          })),
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save authors.');
      }
      onSaved((data.authors as Author[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save authors.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }} />
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border-2 border-brand-accent overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 bg-brand-text text-white">
          <h2 className="font-serif font-bold text-lg sm:text-xl min-w-0 truncate">Edit Authors</h2>
          <span className="text-xs font-medium text-white/70 shrink-0">{sub.paper_id || sub.submission_code}</span>
          <button
            onClick={() => { if (!saving) onClose(); }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-brand-text/60 mb-4">
            <span className="font-semibold text-brand-text">{sub.title}</span> — fill in phone numbers, co-authors and
            college names. Mark exactly one author as <span className="font-semibold text-brand-text">Primary</span> (the
            corresponding author).
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="space-y-4">
            {drafts.map((a, i) => (
              <div key={i} className="border border-brand-accent/40 bg-brand-bg/40 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text">
                    <UserRoundCheck className="w-4 h-4 text-brand-accent" /> Author {i + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text/80 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="primary-author"
                        checked={a.is_primary}
                        onChange={() => setPrimary(i)}
                        className="w-4 h-4 accent-brand-accent cursor-pointer"
                      />
                      Primary
                    </label>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAuthor(i)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-brand-text/70 mb-1">First name</label>
                    <input
                      value={a.first_name}
                      onChange={(e) => update(i, { first_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-text/70 mb-1">Last name</label>
                    <input
                      value={a.last_name}
                      onChange={(e) => update(i, { last_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-text/70 mb-1">Email</label>
                    <input
                      type="email"
                      value={a.email}
                      onChange={(e) => update(i, { email: e.target.value })}
                      placeholder="author@university.edu"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-brand-text/70 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={a.phone}
                      onChange={(e) => update(i, { phone: e.target.value })}
                      placeholder="+91 00000 00000"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-brand-text/70 mb-1">College / Institution</label>
                    <input
                      value={a.college}
                      onChange={(e) => update(i, { college: e.target.value })}
                      placeholder="University / College name"
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addAuthor}
            disabled={saving}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-brand-text rounded-lg border border-brand-text/15 hover:bg-brand-text/5 hover:border-brand-accent transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add Co-author
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t-2 border-brand-accent/40 bg-brand-bg/40">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Authors'}
          </button>
          <button
            onClick={() => { if (!saving) onClose(); }}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-brand-text/70 hover:bg-brand-text/5 transition-colors disabled:opacity-50 ml-auto"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function MoreInfoModal({
  sub,
  onClose,
  onEditAuthors,
}: {
  sub: Submission | null;
  onClose: () => void;
  onEditAuthors?: (sub: Submission) => void;
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
                className={`rounded-xl border p-3 ${REVIEW_DECISION_META[sub.review_decision]?.box ?? 'bg-amber-50 border-amber-300'
                  }`}
              >
                <div className={`flex flex-wrap items-center gap-2 font-semibold ${REVIEW_DECISION_META[sub.review_decision]?.text ?? 'text-brand-text'}`}>
                  <span>{REVIEW_DECISION_META[sub.review_decision]?.label ?? (sub.review_decision || 'No decision recorded')}</span>
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
          {onEditAuthors && (
            <button
              onClick={() => onEditAuthors(sub)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-text hover:bg-brand-accent transition-colors"
            >
              <PenSquare className="w-4 h-4" /> Edit Authors
            </button>
          )}
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
// Reusable full submissions listing: search/filters + desktop table +
// mobile cards with the complete action set (status editing, file
// views, delete). Used by the Submissions (main) tab.
// ------------------------------------------------------------------
function SubmissionListing({
  rows,
  total,
  loading,
  error,
  filtersActive,
  emptyMsg,
  emptyFilteredMsg,
  searchTerm,
  onSearchChange,
  trackFilter,
  onTrackFilterChange,
  paperIdFilter,
  onPaperIdFilterChange,
  tracks,
  paperIds,
  onClear,
  token,
  refresh,
  onUnauthorized,
  onStatusError,
  onOpenPdf,
  onViewInfo,
  onEditAuthors,
  onDelete,
  enquiredSaving,
  onToggleEnquired,
}: {
  rows: Submission[];
  total: number;
  loading: boolean;
  error: string | null;
  filtersActive: boolean;
  emptyMsg: string;
  emptyFilteredMsg: string;
  searchTerm: string;
  onSearchChange: (v: string) => void;
  trackFilter: string;
  onTrackFilterChange: (v: string) => void;
  paperIdFilter: string;
  onPaperIdFilterChange: (v: string) => void;
  tracks: string[];
  paperIds: string[];
  onClear: () => void;
  token: string;
  refresh: () => void;
  onUnauthorized: () => void;
  onStatusError: (msg: string) => void;
  onOpenPdf: (id: string, kind: 'paper' | 'plagiarism' | 'ai_plagiarism', filename: string) => void;
  onViewInfo: (sub: Submission) => void;
  onEditAuthors: (sub: Submission) => void;
  onDelete: (sub: Submission) => void;
  enquiredSaving: string | null;
  onToggleEnquired: (sub: Submission) => void;
}) {
  return (
    <>
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        </div>
      )}

      <FilterPanel
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        trackFilter={trackFilter}
        onTrackFilterChange={onTrackFilterChange}
        paperIdFilter={paperIdFilter}
        onPaperIdFilterChange={onPaperIdFilterChange}
        tracks={tracks}
        paperIds={paperIds}
        resultCount={rows.length}
        totalCount={total}
        onClear={onClear}
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-brand-text/60">
                  {filtersActive ? emptyFilteredMsg : emptyMsg}
                </td>
              </tr>
            ) : (
              rows.map((sub, idx) => (
                <tr key={sub.id} className="bg-white">
                  <td className={`py-4 px-5 align-top ${idx === rows.length - 1 ? 'rounded-bl-xl' : ''}`}>
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
                      onChanged={refresh}
                      onUnauthorized={onUnauthorized}
                      onError={onStatusError}
                    />
                  </td>
                  <td className="py-4 px-5 align-top">
                    <div className="flex flex-col items-start gap-2">
                      <button
                        onClick={() => onOpenPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                        title={sub.manuscript_file || 'Paper PDF'}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View Paper
                      </button>
                      {sub.plagiarism_file && (
                        <button
                          onClick={() => onOpenPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                          title={sub.plagiarism_file || 'Plagiarism report'}
                          className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                        >
                          <Eye className="w-4 h-4" /> View Plag.
                        </button>
                      )}
                      {sub.ai_plagiarism_file && (
                        <button
                          onClick={() => onOpenPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                          title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                          className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                        >
                          <Eye className="w-4 h-4" /> View AI Plag.
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={`py-4 px-5 align-top ${idx === rows.length - 1 ? 'rounded-br-xl' : ''}`}>
                    <div className="flex flex-col items-start gap-2">
                      <button
                        onClick={() => onViewInfo(sub)}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View Info
                      </button>
                      <button
                        onClick={() => onEditAuthors(sub)}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                      >
                        <PenSquare className="w-4 h-4" /> Edit Authors
                      </button>
                      <button
                        onClick={() => onDelete(sub)}
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
                            onChange={() => onToggleEnquired(sub)}
                            className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                          />
                          Enquired
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
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
            {filtersActive ? emptyFilteredMsg : emptyMsg}
          </div>
        ) : (
          rows.map((sub) => (
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
                    onChanged={refresh}
                    onUnauthorized={onUnauthorized}
                    onError={onStatusError}
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
                  onClick={() => onOpenPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                  title={sub.manuscript_file || 'Paper PDF'}
                  className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View Paper
                </button>
                {sub.plagiarism_file && (
                  <button
                    onClick={() => onOpenPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                    title={sub.plagiarism_file || 'Plagiarism report'}
                    className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Plag.
                  </button>
                )}
                {sub.ai_plagiarism_file && (
                  <button
                    onClick={() => onOpenPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                    title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                    className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> View AI Plag.
                  </button>
                )}
                <button
                  onClick={() => onViewInfo(sub)}
                  className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View Info
                </button>
                <button
                  onClick={() => onDelete(sub)}
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
                    onChange={() => onToggleEnquired(sub)}
                    className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                  />
                  Enquired
                </label>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Reusable listing for reviewed papers (Accepted and Not Accepted
// tabs): header, search/filters, desktop table and mobile cards.
// This section is view-only for the admin.
// ------------------------------------------------------------------
function ReviewSection({
  title,
  subtitle,
  rows,
  total,
  loading,
  error,
  emptyMsg,
  onOpenPdf,
  onViewInfo,
  onEditAuthors,
  onDelete,
  mailTemplates,
  selectedTemplateId,
  onSelectedTemplateChange,
  mailSelected,
  onToggleMailSelect,
  onToggleMailSelectAll,
  onSendMail,
  mailSending,
}: {
  title: string;
  subtitle: string;
  rows: Submission[];
  total: number;
  loading: boolean;
  error: string | null;
  emptyMsg: string;
  onOpenPdf: (id: string, kind: 'paper' | 'plagiarism' | 'ai_plagiarism', filename: string) => void;
  onViewInfo: (sub: Submission) => void;
  onEditAuthors: (sub: Submission) => void;
  onDelete: (sub: Submission) => void;
  mailTemplates: MailTemplate[];
  selectedTemplateId: string;
  onSelectedTemplateChange: (v: string) => void;
  mailSelected: string[];
  onToggleMailSelect: (id: string) => void;
  onToggleMailSelectAll: (list: Submission[]) => void;
  onSendMail: () => void;
  mailSending: boolean;
}) {
  const allSelected = rows.length > 0 && rows.every((s) => mailSelected.includes(s.id));
  return (
    <>
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-xl font-bold">{title}</h3>
          <p className="text-xs text-brand-text/60 mt-1 max-w-2xl">{subtitle}</p>
        </div>

        {/* Mail controls */}
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border-2 border-brand-accent px-3 py-2.5 shadow-sm">
          <label
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-text/80 cursor-pointer select-none"
            title="Select / deselect all visible papers"
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onToggleMailSelectAll(rows)}
              className="w-4 h-4 rounded accent-brand-accent cursor-pointer"
            />
            Select all
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => onSelectedTemplateChange(e.target.value)}
            disabled={mailSending}
            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all disabled:opacity-50"
          >
            <option value="">Choose template...</option>
            {mailTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            onClick={onSendMail}
            disabled={mailSending || mailSelected.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50"
          >
            <Mail className={`w-4 h-4 ${mailSending ? 'animate-pulse' : ''}`} />
            {mailSending
              ? 'Sending...'
              : mailSelected.length > 0
                ? `Send Email (${mailSelected.length})`
                : 'Send Email'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden lg:block bg-white rounded-xl shadow-sm border-2 border-brand-accent">
        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="bg-brand-bg/60 border-b-2 border-brand-accent">
              <th className="py-4 px-3 font-semibold text-sm text-brand-text uppercase tracking-wider w-[6%] rounded-tl-xl">Select</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[9%]">Paper ID</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[15%]">Paper Title</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[9%]">Track</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%]">Primary Author</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[11%]">Submitted On</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[13%]">Review Decision</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[11%]">Mail Status</th>
              <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[14%] rounded-tr-xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-accent/40">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-brand-text/60">Loading submissions...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-brand-text/60">
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              rows.map((sub, idx) => (
                <tr key={sub.id} className={`${sub.review_resubmitted === 1 ? 'animate-updated-pulse bg-teal-50/50' : 'bg-white'}`}>
                  <td className={`py-4 px-3 align-top ${idx === rows.length - 1 ? 'rounded-bl-xl' : ''}`}>
                    <input
                      type="checkbox"
                      checked={mailSelected.includes(sub.id)}
                      onChange={() => onToggleMailSelect(sub.id)}
                      disabled={mailSending}
                      className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                      aria-label={`Select ${sub.paper_id || sub.title}`}
                    />
                  </td>
                  <td className="py-4 px-5 align-top">
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
                    {sub.review_resubmitted === 1 && (
                      <div className="mt-1.5"><UpdatedBadge /></div>
                    )}
                    {sub.review_feedback && (
                      <p className="text-xs text-brand-text/70 leading-relaxed whitespace-pre-wrap mt-1.5 max-h-24 overflow-y-auto">
                        {sub.review_feedback}
                      </p>
                    )}
                  </td>
                  <td className="py-4 px-5 align-top">{mailStatusBadge(sub.mail_status)}</td>
                  <td className={`py-4 px-5 align-top ${idx === rows.length - 1 ? 'rounded-br-xl' : ''}`}>
                    <div className="flex flex-col items-start gap-2">
                      <button
                        onClick={() => onOpenPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                        title={sub.manuscript_file || 'Paper PDF'}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View Paper
                      </button>
                      {sub.plagiarism_file && (
                        <button
                          onClick={() => onOpenPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                          title={sub.plagiarism_file || 'Plagiarism report'}
                          className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                        >
                          <Eye className="w-4 h-4" /> View Plag.
                        </button>
                      )}
                      {sub.ai_plagiarism_file && (
                        <button
                          onClick={() => onOpenPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                          title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                          className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                        >
                          <Eye className="w-4 h-4" /> View AI Plag.
                        </button>
                      )}
                      <button
                        onClick={() => onViewInfo(sub)}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View Info
                      </button>
                      <button
                        onClick={() => onEditAuthors(sub)}
                        className="inline-flex items-center gap-1.5 text-brand-text font-medium text-xs whitespace-nowrap hover:underline"
                      >
                        <PenSquare className="w-4 h-4" /> Edit Authors
                      </button>
                      <button
                        onClick={() => onDelete(sub)}
                        className="inline-flex items-center gap-1.5 text-red-600 font-medium text-xs whitespace-nowrap hover:text-red-700 hover:underline"
                      >
                        <Trash2 className="w-4 h-4" /> Delete
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
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
            {emptyMsg}
          </div>
        ) : (
          rows.map((sub) => (
            <div key={sub.id} className={`${sub.review_resubmitted === 1 ? 'animate-updated-pulse bg-teal-50/50 border-2 border-teal-400' : 'bg-white rounded-xl shadow-sm border-2 border-brand-accent'} rounded-xl shadow-sm p-4 sm:p-5`}>
              <div className="flex items-start justify-between gap-3">
                <label className="shrink-0 cursor-pointer select-none" title="Select for mail">
                  <input
                    type="checkbox"
                    checked={mailSelected.includes(sub.id)}
                    onChange={() => onToggleMailSelect(sub.id)}
                    disabled={mailSending}
                    className="w-4 h-4 rounded accent-brand-accent cursor-pointer disabled:cursor-wait"
                    aria-label={`Select ${sub.paper_id || sub.title}`}
                  />
                </label>
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
                {sub.review_resubmitted === 1 && (
                  <div className="mt-1.5"><UpdatedBadge /></div>
                )}
                {sub.review_feedback && (
                  <p className="text-xs text-brand-text/70 leading-relaxed whitespace-pre-wrap mt-1.5">
                    {sub.review_feedback}
                  </p>
                )}
              </div>

              <div className="mt-3">
                <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide mb-1.5">Mail Status</div>
                {mailStatusBadge(sub.mail_status)}
              </div>

              <div className="mt-4 flex flex-col items-start gap-1.5 border-t-2 border-brand-accent/40 pt-3">
                <button
                  onClick={() => onOpenPdf(sub.id, 'paper', sub.manuscript_file || sub.title)}
                  title={sub.manuscript_file || 'Paper PDF'}
                  className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View Paper
                </button>
                {sub.plagiarism_file && (
                  <button
                    onClick={() => onOpenPdf(sub.id, 'plagiarism', sub.plagiarism_file || `${sub.title} — Plagiarism Report`)}
                    title={sub.plagiarism_file || 'Plagiarism report'}
                    className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Plag.
                  </button>
                )}
                {sub.ai_plagiarism_file && (
                  <button
                    onClick={() => onOpenPdf(sub.id, 'ai_plagiarism', sub.ai_plagiarism_file || `${sub.title} — AI Plagiarism Report`)}
                    title={sub.ai_plagiarism_file || 'AI plagiarism report'}
                    className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                  >
                    <Eye className="w-3.5 h-3.5" /> View AI Plag.
                  </button>
                )}
                <button
                  onClick={() => onViewInfo(sub)}
                  className="flex items-center gap-1.5 text-brand-text font-medium text-xs hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" /> View Info
                </button>
                <button
                  onClick={() => onDelete(sub)}
                  className="flex items-center gap-1.5 text-red-600 font-medium text-xs hover:text-red-700 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Main app
// ------------------------------------------------------------------
export default function App() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('icaidiet_admin_token') || '');
  const [adminEmail, setAdminEmail] = useState<string>(() => sessionStorage.getItem('icaidiet_admin_user') || '');
  const [activeTab, setActiveTab] = useState<'submissions' | 'accepted' | 'minorChanges' | 'majorChanges' | 'duplicates' | 'deleted' | 'downloads' | 'settings'>('submissions');
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
  const [editAuthorsTarget, setEditAuthorsTarget] = useState<Submission | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Submission | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [enquiredSaving, setEnquiredSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackFilter, setTrackFilter] = useState('');
  const [paperIdFilter, setPaperIdFilter] = useState('');
  const [mtUserEnabled, setMtUserEnabled] = useState<boolean>(false);
  const [mtUserUntil, setMtUserUntil] = useState<string>('');
  const [mtReviewEnabled, setMtReviewEnabled] = useState<boolean>(false);
  const [mtReviewUntil, setMtReviewUntil] = useState<string>('');
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
  const [mailTemplatesLoading, setMailTemplatesLoading] = useState(false);
  const [mailTemplatesError, setMailTemplatesError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [mailSelected, setMailSelected] = useState<string[]>([]);
  const [mailSending, setMailSending] = useState<boolean>(false);
  const [mailSendError, setMailSendError] = useState<string | null>(null);
  const [mailSendMessage, setMailSendMessage] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<MailTemplate | null>(null);

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

  const handleAuthorsSaved = (authors: Author[]) => {
    const subId = editAuthorsTarget?.id;
    setEditAuthorsTarget(null);
    if (subId) {
      setMoreInfoTarget((prev) => (prev && prev.id === subId ? { ...prev, authors } : prev));
    }
    fetchSubmissions({ silent: true });
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

  const downloadBackup = async () => {
    setBackingUp(true);
    setBackupError(null);
    setBackupMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.backup) {
        throw new Error(data?.error || 'Failed to create backup.');
      }
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = (data.exported_at || new Date().toISOString()).slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `icaidiet-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const tableCount = Object.keys(data.backup.tables || {}).length;
      const r2Count = Array.isArray(data.backup.r2_objects) ? data.backup.r2_objects.length : 0;
      setBackupMessage(
        `Backup downloaded to your computer (${tableCount} tables, ${r2Count} files on record). Stored only on your machine — nothing was written to or kept in the database.`
      );
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Backup failed.');
    } finally {
      setBackingUp(false);
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

  // ------------------------------------------------------------------
  // Mail (Resend) — template management + one-at-a-time queue draining
  // ------------------------------------------------------------------

  const fetchMailTemplates = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setMailTemplatesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/mail-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load mail templates.');
      }
      setMailTemplates(data.templates || []);
      setMailTemplatesError(null);
    } catch (err) {
      if (opts?.silent) {
        console.error(err);
      } else {
        setMailTemplatesError(err instanceof Error ? err.message : 'Failed to load mail templates.');
      }
    } finally {
      if (!opts?.silent) setMailTemplatesLoading(false);
    }
  };

  const saveMailTemplate = async (tpl: MailTemplate) => {
    setSavingTemplate(true);
    setMailTemplatesError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/mail-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: tpl.id || '', name: tpl.name, subject: tpl.subject, body: tpl.body }),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save mail template.');
      }
      await fetchMailTemplates({ silent: true });
      setTemplateDraft(null);
    } catch (err) {
      setMailTemplatesError(err instanceof Error ? err.message : 'Failed to save mail template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteMailTemplate = async (id: string) => {
    if (!window.confirm('Delete this mail template?')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/mail-templates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to delete mail template.');
      }
      await fetchMailTemplates({ silent: true });
    } catch (err) {
      setMailTemplatesError(err instanceof Error ? err.message : 'Failed to delete mail template.');
    }
  };

  const toggleMailSelect = (id: string) => {
    setMailSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleMailSelectAll = (list: Submission[]) => {
    const ids = list.map((s) => s.id);
    setMailSelected((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      if (allSelected) return prev.filter((id) => !ids.includes(id));
      return [...new Set([...prev, ...ids])];
    });
  };

  const processMailQueue = async () => {
    let processed = false;
    let failed = false;
    let runs = 0;
    // Guard against an unbounded drain loop: always stop after a fixed
    // number of batches; the admin can press Send again / Refresh to
    // continue processing.
    const MAX_RUNS = 200;
    try {
      while (token && runs < MAX_RUNS) {
        runs += 1;
        const res = await fetch(`${API_URL}/api/admin/mail/process`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          handleLogout();
          setMailSending(false);
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Failed to process the mail queue.');
        }
        if (data.processed) {
          processed = true;
          fetchSubmissions({ silent: true });
        }
        if (Number(data.remaining || 0) <= 0) break;
        // Pace sends at ~1 per second to respect Resend's free-tier limit.
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (err) {
      failed = true;
      setMailSendError(err instanceof Error ? err.message : 'Failed to process the mail queue.');
    } finally {
      setMailSending(false);
    }
    if (processed) {
      setMailSendMessage('All selected mails have been sent.');
    } else if (!failed && runs < MAX_RUNS) {
      setMailSendMessage('No mails were waiting in the queue.');
    }
  };

  const handleSendMail = async () => {
    if (mailSelected.length === 0) {
      setMailSendError('Please select at least one paper to send mail to.');
      return;
    }
    if (!selectedTemplateId) {
      setMailSendError('Please choose a mail template before sending.');
      return;
    }
    setMailSendError(null);
    setMailSendMessage(null);
    setMailSending(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/mail/enqueue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submission_ids: mailSelected, template_id: selectedTemplateId }),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to queue the mails.');
      }
      setMailSelected([]);
      setMailSendMessage(data.message || 'Mails queued.');
      fetchSubmissions({ silent: true });
      await processMailQueue();
    } catch (err) {
      setMailSendError(err instanceof Error ? err.message : 'Failed to send mails.');
      setMailSending(false);
    }
  };

  React.useEffect(() => {
    if (token) {
      fetchSubmissions();
      fetchDeletedSubmissions();
      fetchUsers();
      fetchSettings();
      fetchMailTemplates({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  React.useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (['submissions', 'accepted', 'minorChanges', 'majorChanges', 'duplicates'].includes(activeTab)) fetchSubmissions({ silent: true });
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
  const q = searchTerm.trim().toLowerCase();
  const filtersActive = !!(q || trackFilter || paperIdFilter);
  const hasReview = (s: Submission) => !!s.review_decision;
  // Section membership is driven by the review decision / status strings so a
  // paper is never ambiguous: any decision declaring "Accepted" (pure, or with
  // minor/major changes) plus any accepted workflow status lands in Reviewed;
  // anything explicitly not accepted or pending revision lands in Needs
  // Revisions; everything else is still pending.
  const ACCEPTED_DECISIONS = ['ACCEPTED', 'ACCEPTED_WITH_MINOR_CHANGES', 'ACCEPTED_WITH_MAJOR_CHANGES'];
  const ACCEPTED_STATUSES = ['ACCEPTED', 'READY_FOR_REGISTRATION', 'READY_FOR_CAMERA_READY'];
  const REVISION_STATUSES = ['REVISION_REQUIRED', 'REJECTED'];
  const isAccepted = (s: Submission) =>
    ACCEPTED_DECISIONS.includes(s.review_decision) || ACCEPTED_STATUSES.includes(s.status);
  const isPendingRevision = (s: Submission) => (hasReview(s) && !isAccepted(s)) || REVISION_STATUSES.includes(s.status);
  const updatedFirst = (a: Submission, b: Submission) => Number(b.review_resubmitted === 1) - Number(a.review_resubmitted === 1);
      const mainSubmissionsList = submissions.filter(s => s.status === 'SUBMITTED');
    const minorSubmissionsList = submissions.filter(s => s.review_decision === 'ACCEPTED_WITH_MINOR_CHANGES');
    const majorSubmissionsList = submissions.filter(s => s.review_decision === 'ACCEPTED_WITH_MAJOR_CHANGES');
    const acceptedSubmissionsList = submissions.filter(s => s.review_decision === 'ACCEPTED' || s.status === 'READY_FOR_REGISTRATION' || s.status === 'READY_FOR_CAMERA_READY');

    const applyFilters = (list: Submission[]) =>
      list.filter((s) => {
        const matchSearch = matchesSearch(s, q);
        const matchTrack = !trackFilter || s.track === trackFilter;
        const matchPaper = !paperIdFilter || s.paper_id === paperIdFilter;
        return matchSearch && matchTrack && matchPaper;
      });

    const masterApply = (fallbackList: Submission[]) => q ? applyFilters(submissions) : applyFilters(fallbackList);

    const filteredSubmissions = masterApply(mainSubmissionsList);
    const filteredMinor = masterApply(minorSubmissionsList);
    const filteredMajor = masterApply(majorSubmissionsList);
    const filteredAccepted = masterApply(acceptedSubmissionsList);
    const filteredDeleted = masterApply(deletedSubmissions);
    // Find titles that appear more than once (case insensitive)
    const titleCounts: Record<string, number> = {};
    submissions.forEach(s => {
      const t = (s.title || '').trim().toLowerCase();
      if (t) {
        titleCounts[t] = (titleCounts[t] || 0) + 1;
      }
    });
    const duplicatesSubmissionsList = submissions.filter(s => {
      const t = (s.title || '').trim().toLowerCase();
      return t && titleCounts[t] > 1;
    });

    const filteredDuplicates = masterApply(duplicatesSubmissionsList);

  const clearFilters = () => {
    setSearchTerm('');
    setTrackFilter('');
    setPaperIdFilter('');
  };

  // Switching tabs resets the mail selection so checked papers from the
  // Reviewed section do not leak into the Needs Revisions section (and
  // vice versa), and clears any stale send progress/result messages.
  const changeTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setMailSelected([]);
    setMailSendError(null);
    setMailSendMessage(null);
    clearFilters();
  };

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
                  onClick={() => changeTab('submissions')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'submissions' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
                >
                  Submissions
                  {mainSubmissionsList.length > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'submissions' ? 'bg-amber-500 text-white' : 'bg-brand-text text-white'}`}>
                      {mainSubmissionsList.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => changeTab('accepted')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'accepted' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
                >
                  Accepted
                  {acceptedSubmissionsList.length > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'accepted' ? 'bg-green-500 text-white' : 'bg-green-600 text-white'}`}>
                      {acceptedSubmissionsList.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => changeTab('minorChanges')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'minorChanges' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
                >
                  Accepted with minor changes
                  {minorSubmissionsList.length > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'minorChanges' ? 'bg-green-500 text-white' : 'bg-brand-text text-white'}`}>
                      {minorSubmissionsList.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => changeTab('majorChanges')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'majorChanges' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
                >
                  Accepted with major changes
                  {majorSubmissionsList.length > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'majorChanges' ? 'bg-amber-600 text-white' : 'bg-brand-text text-white'}`}>
                      {majorSubmissionsList.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => changeTab('deleted')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'deleted' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
                >
                  Deleted Files
                  {deletedSubmissions.length > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'deleted' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                      {deletedSubmissions.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => changeTab('duplicates')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'duplicates' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
                >
                  Duplicates
                  {duplicatesSubmissionsList.length > 0 && (
                    <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'duplicates' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                      {duplicatesSubmissionsList.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => changeTab('settings')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'settings' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'}`}
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

            <SubmissionListing
              rows={filteredSubmissions}
              total={submissions.length}
              loading={loading}
              error={error ? `Error loading submissions: ${error}` : null}
              filtersActive={filtersActive}
              emptyMsg="No submissions found."
              emptyFilteredMsg="No submissions match your search or filters."
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              trackFilter={trackFilter}
              onTrackFilterChange={setTrackFilter}
              paperIdFilter={paperIdFilter}
              onPaperIdFilterChange={setPaperIdFilter}
              tracks={tracks}
              paperIds={paperIds}
              onClear={clearFilters}
              token={token}
              refresh={fetchSubmissions}
              onUnauthorized={handleLogout}
              onStatusError={setError}
              onOpenPdf={openPdf}
              onViewInfo={setMoreInfoTarget}
              onEditAuthors={setEditAuthorsTarget}
              onDelete={setDeleteTarget}
              enquiredSaving={enquiredSaving}
              onToggleEnquired={handleEnquiredToggle}
            />
          </>
        )}

                {['accepted', 'minorChanges', 'majorChanges', 'duplicates'].includes(activeTab) && (
          <SubmissionListing
            rows={
              activeTab === 'minorChanges' ? filteredMinor :
              activeTab === 'majorChanges' ? filteredMajor :
              activeTab === 'accepted' ? filteredAccepted :
              activeTab === 'duplicates' ? filteredDuplicates :
              filteredAccepted
            }
            total={submissions.length}
            loading={loading}
            error={error ? `Error loading submissions: ${error}` : null}
            filtersActive={filtersActive}
            emptyMsg="No papers in this section."
            emptyFilteredMsg="No submissions match your search or filters."
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            trackFilter={trackFilter}
            onTrackFilterChange={setTrackFilter}
            paperIdFilter={paperIdFilter}
            onPaperIdFilterChange={setPaperIdFilter}
            tracks={tracks}
            paperIds={paperIds}
            onClear={clearFilters}
            token={token}
            refresh={fetchSubmissions}
            onUnauthorized={handleLogout}
            onStatusError={setError}
            onOpenPdf={openPdf}
            onViewInfo={setMoreInfoTarget}
            onEditAuthors={setEditAuthorsTarget}
            onDelete={setDeleteTarget}
            enquiredSaving={enquiredSaving}
            onToggleEnquired={handleEnquiredToggle}
          />
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

            <div className="space-y-4">
              {deletedLoading ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  Loading deleted files...
                </div>
              ) : filteredDeleted.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
                  No deleted files. Deleted submissions will appear here.
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
        {activeTab === 'downloads' && (
          <DownloadPanel token={token} onUnauthorized={handleLogout} />
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
                  <h4 className="font-semibold text-brand-text">Accepting Paper Submissions</h4>
                  <p className="text-sm text-brand-text/60 mt-1">
                    When on, the user portal accepts new paper submissions. When off, users cannot submit new
                    papers (file updates are also blocked).
                  </p>
                </div>
                <button
                  onClick={() => setMtUserEnabled(!mtUserEnabled)}
                  disabled={savingSettings}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 ${mtUserEnabled ? 'bg-gray-200' : 'bg-brand-accent'} ${savingSettings ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="switch"
                  aria-checked={!mtUserEnabled}
                >
                  <span className="sr-only">Toggle accepting paper submissions</span>
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${mtUserEnabled ? 'translate-x-0' : 'translate-x-5'}`}
                  />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${mtUserEnabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${mtUserEnabled ? 'bg-red-600' : 'bg-green-600'}`} />
                  {mtUserEnabled ? 'Not accepting submissions' : 'Accepting submissions'}
                </span>
                <span className="text-xs text-brand-text/50">
                  Save the settings below to apply this change to the user portal.
                </span>
              </div>
            </div>

            <div className="border border-brand-text/10 rounded-xl mt-4">
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

            <div className="border border-brand-text/10 rounded-xl mt-4">
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b-2 border-brand-accent/40">
                <div>
                  <h4 className="font-semibold text-brand-text">Mail Templates</h4>
                  <p className="text-sm text-brand-text/60 mt-1">
                    Templates used when sending emails to authors from the Reviewed / Needs Revisions sections. Add
                    placeholders and the system fills them automatically per paper.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="text-brand-text/50">Available placeholders:</span>
                    <code className="bg-brand-bg px-1.5 py-0.5 rounded text-brand-text font-semibold">{'{name}'}</code>
                    <span className="text-brand-text/50">→ primary author name</span>
                    <code className="bg-brand-bg px-1.5 py-0.5 rounded text-brand-text font-semibold">{'{paper_title}'}</code>
                    <span className="text-brand-text/50">→ paper title</span>
                    <code className="bg-brand-bg px-1.5 py-0.5 rounded text-brand-text font-semibold">{'{paper_id}'}</code>
                    <span className="text-brand-text/50">→ paper ID</span>
                  </div>
                </div>
                <button
                  onClick={() => setTemplateDraft({ id: '', name: '', subject: '', body: '' })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all shrink-0"
                >
                  <Mail className="w-4 h-4" /> New Template
                </button>
              </div>

              {mailTemplatesError && (
                <div className="px-5 py-3 text-sm text-red-600 flex items-center gap-2 border-b-2 border-brand-accent/40">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {mailTemplatesError}
                </div>
              )}

              {templateDraft && (
                <div className="px-5 py-4 border-b-2 border-brand-accent/40 bg-brand-bg/40">
                  <h5 className="font-semibold text-brand-text mb-3">{templateDraft.id ? 'Edit Template' : 'New Template'}</h5>
                  <div className="grid gap-3">
                    <div>
                      <label className="block text-sm font-medium text-brand-text/80 mb-1">Template Name</label>
                      <input
                        value={templateDraft.name}
                        onChange={(e) => setTemplateDraft({ ...templateDraft, name: e.target.value })}
                        placeholder="e.g. Accepted paper intimation"
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-text/80 mb-1">Subject</label>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-xs text-brand-text/40">Insert:</span>
                        {['{name}', '{paper_title}', '{paper_id}'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTemplateDraft(d => d ? { ...d, subject: d.subject + p } : d)}
                            className="text-xs px-1.5 py-0.5 rounded bg-white border border-brand-text/15 text-brand-text/70 hover:border-brand-accent hover:text-brand-accent transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <input
                        value={templateDraft.subject}
                        onChange={(e) => setTemplateDraft({ ...templateDraft, subject: e.target.value })}
                        placeholder="e.g. Regarding your paper {paper_title}"
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-brand-text/80 mb-1">Body</label>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-xs text-brand-text/40">Insert:</span>
                        {['{name}', '{paper_title}', '{paper_id}'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTemplateDraft(d => d ? { ...d, body: d.body + p } : d)}
                            className="text-xs px-1.5 py-0.5 rounded bg-white border border-brand-text/15 text-brand-text/70 hover:border-brand-accent hover:text-brand-accent transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={templateDraft.body}
                        onChange={(e) => setTemplateDraft({ ...templateDraft, body: e.target.value })}
                        rows={6}
                        placeholder={'Dear {name},\n\nYour paper "{paper_title}" has been...'}
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all resize-y font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveMailTemplate(templateDraft)}
                        disabled={savingTemplate}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50"
                      >
                        {savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {savingTemplate ? 'Saving...' : 'Save Template'}
                      </button>
                      <button
                        onClick={() => setTemplateDraft(null)}
                        disabled={savingTemplate}
                        className="px-4 py-2 text-sm font-medium text-brand-text rounded-lg border border-brand-text/15 hover:bg-brand-text/5 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="divide-y divide-brand-text/10">
                {mailTemplatesLoading ? (
                  <div className="px-5 py-4 text-sm text-brand-text/60">Loading templates...</div>
                ) : mailTemplates.length === 0 ? (
                  <div className="px-5 py-4 text-sm text-brand-text/60">
                    No mail templates yet. Create one to send emails to authors.
                  </div>
                ) : (
                  mailTemplates.map((t) => (
                    <div key={t.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h5 className="font-semibold text-brand-text">{t.name}</h5>
                        <p className="text-xs text-brand-text/50 font-medium mt-0.5 break-words">{t.subject}</p>
                        <p className="text-sm text-brand-text/70 mt-1.5 whitespace-pre-wrap break-words">{t.body}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setTemplateDraft({ id: t.id, name: t.name, subject: t.subject, body: t.body })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-brand-text rounded-lg border border-brand-text/15 hover:bg-brand-text/5 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMailTemplate(t.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border border-brand-text/10 rounded-xl mt-4">
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b-2 border-brand-accent/40">
                <div>
                  <h4 className="font-semibold text-brand-text">Full Backup / Download</h4>
                  <p className="text-sm text-brand-text/60 mt-1">
                    Download a complete snapshot of all data (every table, plus the record of stored paper files) as a
                    single JSON file saved straight to your computer. The backup is generated on demand, is never stored
                    in the database, and is deleted from our servers the moment it leaves — keep a copy somewhere safe.
                    Take one before any risky maintenance.
                  </p>
                </div>
                <button
                  onClick={downloadBackup}
                  disabled={backingUp}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all shrink-0 disabled:opacity-50 shadow"
                >
                  {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {backingUp ? 'Creating backup...' : 'Download Backup'}
                </button>
              </div>
              {backupError && (
                <div className="px-5 py-3 text-sm text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {backupError}
                </div>
              )}
              {backupMessage && (
                <div className="px-5 py-3 text-sm text-green-700 flex items-center gap-2 bg-green-50">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {backupMessage}
                </div>
              )}
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
            ? `Move "${deleteTarget.paper_id || deleteTarget.submission_code}" — ${deleteTarget.title} to Deleted Files?\n\nAuthor: ${deleteTarget.author_name || 'Unknown'} <${deleteTarget.author_email || 'no email'}>\n\nThe submitter will no longer see this paper in their portal. You can recover it from the "Deleted Files" tab within 30 days, after which it will be permanently removed.`
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
        onEditAuthors={setEditAuthorsTarget}
      />

      <EditAuthorsModal
        sub={editAuthorsTarget}
        token={token}
        onUnauthorized={handleLogout}
        onClose={() => setEditAuthorsTarget(null)}
        onSaved={handleAuthorsSaved}
      />
    </div>
  );
}
