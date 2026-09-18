import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Download, Eye, Loader2, LogOut, PenLine, RefreshCw, Users, X, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Author {
  id: string;
  submission_id: string;
  is_primary: number;
  first_name: string;
  last_name: string;
}

type ReviewDecision = 'ACCEPTED' | 'ACCEPTED_WITH_MINOR_CHANGES' | 'ACCEPTED_WITH_MAJOR_CHANGES' | 'NOT_ACCEPTED';

interface Review {
  id: string;
  submission_id: string;
  reviewer_id: string;
  decision: ReviewDecision;
  feedback: string;
  resubmitted?: number;
  created_at: string;
  updated_at: string;
}

interface Submission {
  id: string;
  submission_code: string;
  paper_id: string;
  title: string;
  track: string;
  status: string;
  author_name: string;
  author_email: string;
  created_at: string;
  manuscript_file?: string | null;
  plagiarism_file?: string | null;
  ai_plagiarism_file?: string | null;
  authors?: Author[];
  review?: Review | null;
}

interface FileView {
  open: boolean;
  url?: string;
  filename?: string;
  kind?: 'paper' | 'plagiarism' | 'ai_plagiarism';
  error?: string;
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

const DECISION_META: Record<ReviewDecision, { label: string; cls: string }> = {
  ACCEPTED: { label: 'Accepted', cls: 'bg-green-100 text-green-800 border-green-400' },
  ACCEPTED_WITH_MINOR_CHANGES: { label: 'Accepted with Minor Changes', cls: 'bg-yellow-100 text-yellow-800 border-yellow-400' },
  ACCEPTED_WITH_MAJOR_CHANGES: { label: 'Accepted with Major Changes', cls: 'bg-orange-100 text-orange-800 border-orange-400' },
  NOT_ACCEPTED: { label: 'Not Accepted', cls: 'bg-red-100 text-red-800 border-red-400' },
};

function decisionMeta(decision: ReviewDecision) {
  return DECISION_META[decision] || DECISION_META.NOT_ACCEPTED;
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

function AuthorNames({ sub }: { sub: Submission }) {
  const authors = sub.authors || [];
  const names =
    authors.length > 0
      ? authors.map((a) => [a.first_name, a.last_name].filter(Boolean).join(' ')).filter(Boolean)
      : [(sub.author_name || 'N/A').trim()];
  if (names.length === 0) names.push('N/A');
  return (
    <div className="flex flex-col items-start gap-1">
      {names.map((n, i) => (
        <span key={i} className="text-sm text-brand-text/80 break-words leading-snug">
          {n}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Login screen (matches the admin portal's visual style)
// ------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (token: string, name: string) => void }) {
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
      const res = await fetch(`${API_URL}/api/reviewer/login`, {
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
      onLogin(data.token, data.user?.name || data.user?.username || username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
      <div className="bg-brand-card w-full max-w-md rounded-2xl p-6 sm:p-8 shadow-xl border border-brand-text/5">
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Reviewer Portal</h2>
          <p className="text-brand-text/60 text-sm">Sign in to review ICAIDIET'26 paper submissions</p>
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
// PDF viewer modal (fetches the file with the reviewer token)
// ------------------------------------------------------------------
function PdfViewer({ file, token, onClose }: { file: FileView; token: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const loadPdf = useCallback(async () => {
    if (!file.url) return;
    setError(null);
    const res = await fetch(file.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setError('Could not load this document. It may have been removed.');
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
            <iframe ref={frameRef} title="Document" className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Feedback pop-up (shown when a paper is marked Not Accepted)
// ------------------------------------------------------------------
function FeedbackModal({
  open,
  title,
  value,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  open: boolean;
  title: string;
  value: string;
  saving: boolean;
  error: string | null;
  onChange: (feedback: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-lg rounded-2xl p-6 sm:p-8 bg-brand-card shadow-2xl border-2 border-brand-accent">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-serif text-xl font-bold text-brand-text">Reviewer Feedback</h3>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 hover:bg-brand-text/10 rounded-lg transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-sm text-brand-text/70 mb-4 whitespace-pre-line">{title}</div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-sm border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <label className="block text-sm font-medium text-brand-text mb-1">
          Feedback <span className="text-red-600">* required</span>
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Explain your decision and tell the author what to improve..."
          className="w-full px-4 py-2 rounded-lg bg-white border-stone-200 shadow-sm text-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all resize-y mb-4"
        />

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-medium bg-brand-text text-white hover:bg-brand-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save Feedback
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Decision editor shown in the "More Actions" column
// Selecting "Not Accepted" opens the feedback pop-up; saving the
// review moves the paper into the Reviewed section.
// ------------------------------------------------------------------
function ReviewEditor({
  sub,
  token,
  onSaved,
  onUnauthorized,
  onError,
}: {
  sub: Submission;
  token: string;
  onSaved: () => void;
  onUnauthorized: () => void;
  onError: (msg: string) => void;
}) {
  const [decision, setDecision] = useState<ReviewDecision | ''>(sub.review?.decision || '');
  const [feedback, setFeedback] = useState(sub.review?.feedback || '');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(sub.review?.updated_at || null);

  useEffect(() => {
    setDecision(sub.review?.decision || '');
    setFeedback(sub.review?.feedback || '');
    setSavedAt(sub.review?.updated_at || null);
  }, [sub.review]);

  const requiresFeedback = (d: ReviewDecision | '') => !!d && d !== 'ACCEPTED';

  const chooseDecision = (d: ReviewDecision) => {
    setDecision(d);
    if (d !== 'ACCEPTED') {
      setModalError(null);
      setFeedbackOpen(true);
    }
  };

  const save = async () => {
    if (!decision) {
      onError('Please choose a review decision for this paper.');
      return;
    }
    if (requiresFeedback(decision) && !feedback.trim()) {
      setModalError('Feedback is required for this decision.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/reviewer/submissions/${sub.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, feedback: feedback.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save your review.');
      }
      setSavedAt(new Date().toISOString());
      setFeedbackOpen(false);
      setModalError(null);
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save your review.';
      if (feedbackOpen) setModalError(msg);
      else onError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (!decision) {
      onError('Please choose a review decision for this paper.');
      return;
    }
    if (decision !== 'ACCEPTED') {
      setModalError(null);
      setFeedbackOpen(true);
      return;
    }
    await save();
  };

  const decisionButtons: ReviewDecision[] = ['ACCEPTED', 'ACCEPTED_WITH_MINOR_CHANGES', 'ACCEPTED_WITH_MAJOR_CHANGES', 'NOT_ACCEPTED'];

  const decisionIcon = (d: ReviewDecision) =>
    d === 'ACCEPTED' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : d === 'NOT_ACCEPTED' ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : d === 'ACCEPTED_WITH_MINOR_CHANGES' ? <PenLine className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {decisionButtons.map((d) => {
          const meta = decisionMeta(d);
          const active = decision === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => chooseDecision(d)}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border-2 transition-colors ${active
                ? meta.cls
                : 'border-brand-text/15 text-brand-text/70 hover:bg-brand-text/5'
                }`}
              aria-pressed={active}
            >
              {decisionIcon(d)} {meta.label}
            </button>
          );
        })}
      </div>

      {savedAt && (
        <span className="text-[11px] font-medium">
          {sub.review?.resubmitted === 1 ? (
            <span className="text-amber-700">
              Resubmitted · author updated the files, please re-review.
            </span>
          ) : (
            <span className="text-green-700">
              {sub.review ? `Reviewed · ${decisionMeta(sub.review.decision).label} · ${formatDateTime(savedAt)}` : `Review saved · ${formatDateTime(savedAt)}`}
            </span>
          )}
        </span>
      )}

      <button
        type="button"
        onClick={handleSaveClick}
        disabled={saving || !decision}
        className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-1.5 bg-brand-text text-white rounded-lg text-xs font-medium hover:bg-brand-accent transition-all disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {sub.review?.resubmitted === 1 ? 'Save Review' : sub.review ? 'Update Review' : 'Save Review'}
      </button>

      <FeedbackModal
        open={feedbackOpen}
        title={`Paper ID: ${sub.paper_id || 'NA'} · ${sub.title}`}
        value={feedback}
        saving={saving}
        error={modalError}
        onChange={setFeedback}
        onSave={save}
        onClose={() => {
          if (saving) return;
          setFeedbackOpen(false);
          setModalError(null);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------
// Main app
// ------------------------------------------------------------------
export default function App() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('icaidiet_reviewer_token') || '');
  const [reviewerName, setReviewerName] = useState<string>(() => sessionStorage.getItem('icaidiet_reviewer_user') || '');
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed' | 'notAccepted'>('pending');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, accepted: 0, notAccepted: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfView, setPdfView] = useState<FileView>({ open: false });
  const [reviewMaintenance, setReviewMaintenance] = useState<{ active: boolean; until: string | null }>({ active: false, until: null });
  const [settingsChecked, setSettingsChecked] = useState<boolean>(false);

  const handleLogin = (newToken: string, name: string) => {
    setToken(newToken);
    setReviewerName(name);
    sessionStorage.setItem('icaidiet_reviewer_token', newToken);
    sessionStorage.setItem('icaidiet_reviewer_user', name);
    setError(null);
  };

  const handleLogout = () => {
    setToken('');
    setReviewerName('');
    setSubmissions([]);
    setPdfView({ open: false });
    sessionStorage.removeItem('icaidiet_reviewer_token');
    sessionStorage.removeItem('icaidiet_reviewer_user');
  };

  const fetchSubmissions = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await fetch(`${API_URL}/api/reviewer/submissions`, {
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
        pending: list.filter((s) => !s.review || s.review?.resubmitted === 1).length,
        accepted: list.filter((s) => s.review && s.review.resubmitted !== 1 && s.review.decision === 'ACCEPTED').length,
        notAccepted: list.filter((s) => s.review && s.review.resubmitted !== 1 && s.review.decision !== 'ACCEPTED').length,
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

  useEffect(() => {
    if (token) {
      fetchSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      fetchSubmissions({ silent: true });
    }, 180000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/settings`);
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          const s = data.settings || {};
          const enabled = s.maintenance_review_enabled === 'true';
          const until = s.maintenance_review_until || null;
          let active = enabled;
          if (active && until) {
            const untilMs = new Date(until).getTime();
            if (!isNaN(untilMs)) active = untilMs > Date.now();
          }
          setReviewMaintenance({ active, until });
          if (active) {
            handleLogout();
          }
        }
      } catch {
        // ignore; the portal stays usable if settings cannot be fetched
      } finally {
        setSettingsChecked(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPdf = (id: string, kind: 'paper' | 'plagiarism' | 'ai_plagiarism', filename: string) => {
    const type =
      kind === 'plagiarism' ? 'PLAGIARISM' : kind === 'ai_plagiarism' ? 'AI_PLAGIARISM' : 'MANUSCRIPT';
    setPdfView({
      open: true,
      url: `${API_URL}/api/reviewer/submissions/${id}/file?type=${type}`,
      filename,
      kind,
    });
  };

  const closePdf = () => {
    setPdfView({ open: false, url: undefined, filename: undefined, kind: undefined, error: undefined });
  };

  const pendingCount = submissions.filter((s) => !s.review || s.review?.resubmitted === 1).length;
  const reviewedCount = submissions.filter((s) => s.review && s.review.resubmitted !== 1 && s.review.decision === 'ACCEPTED').length;
  const notAcceptedCount = submissions.filter((s) => s.review && s.review.resubmitted !== 1 && s.review.decision !== 'ACCEPTED').length;
  const visible = activeTab === 'pending'
    ? submissions.filter((s) => !s.review || s.review?.resubmitted === 1)
    : activeTab === 'notAccepted'
      ? submissions.filter((s) => s.review && s.review.resubmitted !== 1 && s.review.decision !== 'ACCEPTED')
      : submissions.filter((s) => s.review && s.review.resubmitted !== 1 && s.review.decision === 'ACCEPTED');

  const emptyMessage = activeTab === 'pending'
    ? 'No papers pending review.'
    : activeTab === 'notAccepted'
      ? 'No papers awaiting revision yet. Papers you marked with changes or as not accepted will appear here.'
      : 'No accepted papers yet.';

  const authButtons = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 min-w-0">
      <span className="text-xs sm:text-sm text-brand-text/60 truncate max-w-[45vw] sm:max-w-none">{reviewerName}</span>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-text/70 hover:text-brand-text transition-colors whitespace-nowrap"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </button>
    </div>
  );

  if (!settingsChecked) {
    return (
      <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
        <div className="flex-1 flex flex-col">
          <header className="border-b border-brand-text/10 bg-brand-bg/80 backdrop-blur-md">
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <h1 className="font-serif font-bold text-xl tracking-tight">Reviewer of ICAIDIET'26</h1>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-brand-text/70">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading portal...
            </div>
          </main>
          <footer className="bg-brand-footer text-white py-6">
            <div className="container mx-auto px-4 sm:px-6">
              <p className="text-white/60 text-xs text-center">&copy; 2026 ICAIDIET. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  if (reviewMaintenance.active) {
    return (
      <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
        <div className="flex-1 flex flex-col">
          <header className="border-b border-brand-text/10 bg-brand-bg/80 backdrop-blur-md">
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <h1 className="font-serif font-bold text-xl tracking-tight">Reviewer of ICAIDIET'26</h1>
            </div>
          </header>
          <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
            <div className="bg-brand-card w-full max-w-lg rounded-2xl p-6 sm:p-8 shadow-xl border border-brand-text/5 text-center">
              <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-4" />
              <h2 className="font-serif text-2xl sm:text-3xl font-bold mb-3">Under Maintenance</h2>
              <p className="text-brand-text/70 leading-relaxed">
                The reviewer portal is currently under maintenance and sign-in is temporarily disabled.
                {reviewMaintenance.until ? (
                  <> We expect to be back online{' '}<span className="font-semibold">{new Date(reviewMaintenance.until).toLocaleString()}</span>.</>
                ) : (
                  ' Please check back again later.'
                )}
              </p>
            </div>
          </main>
          <footer className="bg-brand-footer text-white py-6">
            <div className="container mx-auto px-4 sm:px-6">
              <p className="text-white/60 text-xs text-center">&copy; 2026 ICAIDIET. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
        <div className="flex-1 flex flex-col">
          <header className="border-b border-brand-text/10 bg-brand-bg/80 backdrop-blur-md">
            <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
              <h1 className="font-serif font-bold text-xl tracking-tight">Reviewer of ICAIDIET'26</h1>
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
          <h1 className="font-serif font-bold text-lg sm:text-2xl tracking-tight">ICAIDIET'26 Reviewer</h1>
          {authButtons}
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3 md:mb-2">Reviewer Dashboard</h2>
            <p className="text-sm text-brand-text/60">Review each paper and record your decision (Accepted / With Changes / Not Accepted).</p>
          </div>
          <button
            onClick={fetchSubmissions}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif">{stats.total}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Total Papers</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif text-amber-700">{stats.pending}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Pending Review</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif text-green-700">{stats.accepted}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Accepted</div>
          </div>
          <div className="bg-brand-card rounded-xl shadow-sm border border-brand-text/5 p-3 sm:p-4">
            <div className="text-2xl sm:text-3xl font-bold font-serif text-red-700">{stats.notAccepted}</div>
            <div className="text-xs sm:text-sm text-brand-text/60 mt-1">Needs Revisions</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'pending' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
              }`}
          >
            To Review
            <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'pending' ? 'bg-amber-500 text-white' : 'bg-brand-text text-white'
              }`}>
              {pendingCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'reviewed' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
              }`}
          >
            Reviewed
            <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'reviewed' ? 'bg-green-500 text-white' : 'bg-green-500 text-white'
              }`}>
              {reviewedCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('notAccepted')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'notAccepted' ? 'bg-brand-text text-white' : 'hover:bg-brand-text/10 text-brand-text'
              }`}
          >
            Needs Revisions
            <span className={`ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold ${activeTab === 'notAccepted' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'
              }`}>
              {notAcceptedCount}
            </span>
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block bg-white rounded-xl shadow-sm border-2 border-brand-accent">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-brand-bg/60 border-b-2 border-brand-accent">
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%] rounded-tl-xl">Paper ID</th>
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[20%]">Paper Title</th>
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%]">Track</th>
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[14%]">Authors</th>
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[12%]">Submitted On</th>
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[17%]">Actions</th>
                <th className="py-4 px-5 font-semibold text-sm text-brand-text uppercase tracking-wider w-[13%] rounded-tr-xl">More Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-accent/40">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-brand-text/60">Loading submissions...</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-brand-text/60">
{emptyMessage}
                  </td>
                </tr>
              ) : (
                visible.map((sub, idx) => (
                  <tr key={sub.id} className="bg-white">
                    <td className={`py-4 px-5 align-top ${idx === visible.length - 1 ? 'rounded-bl-xl' : ''}`}>
                      <div className="font-semibold text-brand-text break-words">{sub.paper_id || 'NA'}</div>
                      <div className="text-xs text-brand-text/50 font-normal mt-0.5 break-words">{sub.submission_code}</div>
                    </td>
                    <td className="py-4 px-5 align-top">
                      <div className="font-semibold text-brand-text break-words leading-snug">{sub.title}</div>
                      <div className="mt-1">{statusBadge(sub.status)}</div>
                    </td>
                    <td className="py-4 px-5 align-top text-sm text-brand-text/70 capitalize break-words">{sub.track?.replace(/-/g, ' ') || '—'}</td>
                    <td className="py-4 px-5 align-top">
                      <div className="flex items-start gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand-accent shrink-0 mt-0.5" />
                        <div className="flex-1"><AuthorNames sub={sub} /></div>
                      </div>
                    </td>
                    <td className="py-4 px-5 align-top text-sm text-brand-text/70 break-words">
                      {formatDateTime(sub.created_at) || '—'}
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
                    <td className={`py-4 px-5 align-top ${idx === visible.length - 1 ? 'rounded-br-xl' : ''}`}>
                      <ReviewEditor
                        sub={sub}
                        token={token}
                        onSaved={fetchSubmissions}
                        onUnauthorized={handleLogout}
                        onError={setError}
                      />
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
          ) : visible.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-brand-text/60 border-2 border-brand-accent">
              {emptyMessage}
            </div>
          ) : (
            visible.map((sub) => (
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
                    <div className="text-xs text-brand-text/50 font-medium uppercase tracking-wide">Authors</div>
                    <div className="mt-1"><AuthorNames sub={sub} /></div>
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
                </div>

                <div className="mt-4 border-t-2 border-brand-accent/40 pt-3">
                  <ReviewEditor
                    sub={sub}
                    token={token}
                    onSaved={fetchSubmissions}
                    onUnauthorized={handleLogout}
                    onError={setError}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <footer className="bg-brand-footer text-white py-6 mt-auto">
        <div className="container mx-auto px-4 sm:px-6">
          <p className="text-white/60 text-xs text-center">
            &copy; 2026 ICAIDIET. All rights reserved.
          </p>
        </div>
      </footer>

      {pdfView.open && <PdfViewer file={pdfView} token={token} onClose={closePdf} />}
    </div>
  );
}