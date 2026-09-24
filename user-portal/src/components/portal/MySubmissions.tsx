import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, CheckCircle2, FileText, Inbox, Loader2, Upload, ShieldCheck, ScanSearch, X, Pencil, XCircle } from 'lucide-react';
import { Popup, PopupInfo } from '../Popup';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

function RegistrationForm({ sub, getToken, onSaved }: { sub: MySubmission; getToken: () => Promise<string | null>; onSaved: () => void }) {
  const [type, setType] = useState('Conference alone');
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

if (sub.payment_status === 'APPROVED') {
    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center gap-2 text-green-800 font-semibold">
          <CheckCircle2 className="w-5 h-5" /> Registration Complete!
        </div>
        <p className="text-sm text-green-700 mt-1">Your payment has been verified and your registration is confirmed.</p>
        <p className="text-sm text-green-700 mt-1">Type: {sub.registration_type} | UTR: {sub.utr_transaction_id}</p>
      </div>
    );
  }

  const awaitingVerification = !!(sub.payment_proof_url && sub.utr_transaction_id) && sub.payment_status !== 'REJECTED';
  const isRejected = sub.payment_status === 'REJECTED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload a payment proof screenshot.');
      return;
    }
    if (!utr.trim()) {
      setError('Please enter the UTR / Transaction ID.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', file);

      const fileRes = await fetch(`${API_URL}/api/user/submissions/${sub.id}/payment-proof`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const fileData = await fileRes.json().catch(() => null);
      if (!fileRes.ok || !fileData?.success) throw new Error(fileData?.error || 'Failed to upload proof.');

      const regRes = await fetch(`${API_URL}/api/user/submissions/${sub.id}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_type: type, utr_transaction_id: utr }),
      });
      const regData = await regRes.json().catch(() => null);
      if (!regRes.ok || !regData?.success) throw new Error(regData?.error || 'Failed to save registration details.');

      onSaved();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

return (
    <>
      {isRejected && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 text-red-800 font-semibold">
            <XCircle className="w-5 h-5" /> Payment Proof Rejected
          </div>
          <p className="text-sm text-red-700 mt-1">
            Your payment proof was rejected. Please upload a valid screenshot and resubmit the details below.
          </p>
        </div>
      )}
      {awaitingVerification && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800 font-semibold">
            <ShieldCheck className="w-5 h-5" /> Payment Under Verification
          </div>
          <p className="text-sm text-amber-700 mt-1">
            Your payment details have been received and are awaiting admin verification. You can update them below if
            needed.
          </p>
        </div>
      )}
    <form onSubmit={handleSubmit} className="mt-6 border border-brand-accent/30 rounded-xl p-5 bg-brand-bg/10">
      <h4 className="text-lg font-bold font-serif text-brand-text mb-2">
        Congratulations {sub.author_name?.split(',')[0]} your paper is accepted.. Please Complete the payment below
      </h4>
      <a href="https://www.icaidiet26.tech/registration-fee" target="_blank" rel="noreferrer" className="text-brand-accent hover:underline text-sm font-semibold mb-4 inline-block">
        Fee details
      </a>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-black/80 mb-1">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent text-sm" disabled={loading}>
            <option value="Conference alone">Conference alone</option>
            <option value="Conference With Scopus proceedings">Conference With Scopus proceedings</option>
          </select>
        </div>

        <div className="bg-stone-50 border border-stone-200 p-3 rounded-lg text-sm text-black/80 leading-relaxed font-mono">
          <p>Account number : 5904946502</p>
          <p>IFSC Code: CBIN0281361 [Crosscut Road,CBE]</p>
          <p>Beneficiary Name: SNSCT CH4 CS</p>
          <p>Bank Name: CENTRAL BANK OF INDIA</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-black/80 mb-1">Upload Payment Proof (Screenshot)</label>
          <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-text file:text-white hover:file:bg-brand-accent transition-colors" disabled={loading} />
        </div>

        <div>
          <label className="block text-sm font-medium text-black/80 mb-1">UTR/RRN/Transaction ID</label>
          <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter Transaction ID" className="w-full px-3 py-2 border border-stone-300 rounded-lg outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent text-sm" disabled={loading} />
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

<button type="submit" disabled={loading} className="w-full py-2.5 bg-brand-text text-white rounded-lg font-semibold hover:bg-brand-accent transition-all disabled:opacity-50">
          {loading ? 'Submitting...' : 'Submit Payment Details'}
        </button>
      </div>
    </form>
    </>
  );
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface MySubmission {
  id: string;
  submission_code: string;
  paper_id: string;
  title: string;
  abstract: string;
  track: string;
  status: string;
  author_name?: string | null;
  created_at: string;
  updated_at: string;
  author_count: number;
  manuscript_file?: string | null;
  plagiarism_file?: string | null;
  ai_plagiarism_file?: string | null;
  review_decision?: string | null;
  review_feedback?: string | null;
  review_updated_at?: string | null;
registration_type?: string | null;
  utr_transaction_id?: string | null;
  payment_proof_url?: string | null;
  payment_status?: string | null;
  payment_approved_at?: string | null;
}

interface MySubmissionsProps {
  getToken: () => Promise<string | null>;
  onBack: () => void;
  onStart: () => void;
  maintenanceMode?: boolean;
  maintenanceUntil?: string | null;
  registrationOpen?: boolean;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  SUBMITTED: { label: 'Submitted', cls: 'bg-amber-100 text-amber-800' },
  UNDER_REVIEW: { label: 'Under Review', cls: 'bg-blue-100 text-blue-800' },
  READY_FOR_REGISTRATION: { label: 'Ready for Registration', cls: 'bg-green-100 text-green-800' },
  READY_FOR_CAMERA_READY: { label: 'Ready for Camera Ready', cls: 'bg-purple-100 text-purple-800' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800' },
  REVISION_REQUIRED: { label: 'Revision Required', cls: 'bg-purple-100 text-purple-800' },
};

const REVIEW_DECISION_META: Record<string, { label: string; text: string; box: string }> = {
  ACCEPTED: { label: 'Accepted', text: 'text-green-800', box: 'bg-green-50 border-green-300' },
  ACCEPTED_WITH_MINOR_CHANGES: { label: 'Accepted with Minor Changes', text: 'text-yellow-800', box: 'bg-yellow-50 border-yellow-300' },
  ACCEPTED_WITH_MAJOR_CHANGES: { label: 'Accepted with Major Changes', text: 'text-orange-800', box: 'bg-orange-50 border-orange-300' },
  NOT_ACCEPTED: { label: 'Not Accepted', text: 'text-red-800', box: 'bg-red-50 border-red-300' },
};

function statusBadge(status: string) {
  const meta =
    STATUS_META[status] || {
      label: (status || 'SUBMITTED').replace(/_/g, ' '),
      cls: 'bg-amber-100 text-amber-800',
    };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function isEdited(sub: MySubmission) {
  return sub.updated_at && sub.created_at && sub.updated_at !== sub.created_at;
}

function reviewBanner(sub: MySubmission) {
  const hasReview = sub.review_decision || sub.review_feedback;
  if (!hasReview) return null;
  const decision = sub.review_decision || '';
  const accepted = decision === 'ACCEPTED';
  const minor = decision === 'ACCEPTED_WITH_MINOR_CHANGES';
  const major = decision === 'ACCEPTED_WITH_MAJOR_CHANGES';
  const rejected = decision === 'NOT_ACCEPTED';
  const needsChanges = minor || major || rejected;
  const decisionMeta = REVIEW_DECISION_META[decision];
  const heading = decisionMeta
    ? decisionMeta.label
    : accepted
      ? 'Accepted — Ready for Registration'
      : 'Not Accepted';
  const tone = decisionMeta?.box ?? 'bg-amber-50 border-amber-300';
  return (
    <div
      className={`mt-4 rounded-xl border p-4 ${tone}`}
    >
      <div className="flex items-center gap-2">
        {accepted ? (
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        ) : minor || major ? (
          <Pencil className="w-4 h-4 text-yellow-600 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
        )}
        <span className={`text-sm font-bold ${decisionMeta?.text ?? 'text-black'}`}>
          {heading}
        </span>
      </div>
      {needsChanges && sub.review_feedback && (
        <p className="text-sm text-black/80 mt-2 leading-relaxed whitespace-pre-wrap">{sub.review_feedback}</p>
      )}
      {needsChanges && (
        <p className="text-xs text-black/60 mt-2">
          Please correct the paper based on the reviewer feedback, then use "Edit Files" to upload the revised
          files. Your paper will be sent back to the reviewer for a new review.
        </p>
      )}
      {sub.review_updated_at && (
        <p className="text-[11px] text-black/50 mt-2">Reviewer feedback · {formatDate(sub.review_updated_at)}</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Edit modal: only the uploaded files can be replaced, never the details.
// ------------------------------------------------------------------
function EditFilesModal({
  sub,
  onClose,
  onSaved,
  getToken,
}: {
  sub: MySubmission;
  onClose: () => void;
  onSaved: () => void;
  getToken: () => Promise<string | null>;
}) {
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [plagiarismFile, setPlagiarismFile] = useState<File | null>(null);
  const [aiPlagiarismFile, setAiPlagiarismFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manuscriptRef = useRef<HTMLInputElement>(null);
  const plagiarismRef = useRef<HTMLInputElement>(null);
  const aiPlagiarismRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (
    setter: (f: File | null) => void
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    if (selected.size > MAX_FILE_SIZE) {
      setError('The selected file is larger than 10MB. Please choose a smaller PDF.');
      e.target.value = '';
      return;
    }
    if (!/\.pdf$/i.test(selected.name)) {
      setError('Only PDF files (.pdf) are accepted.');
      e.target.value = '';
      return;
    }
    setError(null);
    setter(selected);
  };

  const handleSave = async () => {
    if (!manuscriptFile && !plagiarismFile && !aiPlagiarismFile) {
      setError('Please choose at least one file to update, or cancel.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Please sign in before updating your files.');
        setSaving(false);
        return;
      }
      const formData = new FormData();
      if (manuscriptFile) formData.append('file', manuscriptFile);
      if (plagiarismFile) formData.append('plagiarismFile', plagiarismFile);
      if (aiPlagiarismFile) formData.append('aiPlagiarismFile', aiPlagiarismFile);

      const res = await fetch(`${API_URL}/api/submissions/${sub.id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error || 'Your files could not be updated. Please try again.');
        setSaving(false);
        return;
      }
      setSaving(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server. Please try again.');
      setSaving(false);
    }
  };

  const dropZone = (
    currentName: string | null | undefined,
    hasNew: boolean,
    newName: string | null,
    onClick: () => void,
    icon: React.ReactNode,
    title: string
  ) => (
    <div
      onClick={onClick}
      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer group shadow-sm ${
        hasNew ? 'border-green-500 bg-green-50' : 'border-stone-300 bg-white hover:bg-stone-50'
      }`}
    >
      <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h4 className="text-base font-bold mb-1">{hasNew ? 'New file selected' : title}</h4>
      <p className="text-sm text-brand-text/60 break-words">
        {hasNew
          ? newName
          : currentName || 'PDF format only. Maximum file size 10MB.'}
      </p>
      {hasNew && <p className="text-xs text-green-600 font-medium mt-1">Will replace the current file</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-brand-card shadow-2xl border-2 border-brand-accent overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 bg-brand-text text-white">
          <h2 className="font-serif font-bold text-lg sm:text-xl min-w-0 truncate">Edit Files</h2>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          <div>
            <div className="text-xs text-brand-text/50 uppercase tracking-wide font-medium">Paper Title</div>
            <h3 className="font-serif text-lg font-bold leading-snug break-words mt-1">{sub.title}</h3>
            <p className="text-xs text-brand-text/60 mt-2">
              You can only replace the files you uploaded. Submission details (title, abstract, authors, track)
              cannot be changed.
            </p>
          </div>

          <div className="space-y-4">
            {dropZone(
              sub.manuscript_file,
              !!manuscriptFile,
              manuscriptFile?.name || null,
              () => manuscriptRef.current?.click(),
              manuscriptFile ? <FileText className="w-6 h-6 text-green-500" /> : <Upload className="w-6 h-6 text-brand-accent" />,
              'Click to replace manuscript'
            )}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              ref={manuscriptRef}
              onChange={handleFileSelect(setManuscriptFile)}
            />

            {dropZone(
              sub.plagiarism_file,
              !!plagiarismFile,
              plagiarismFile?.name || null,
              () => plagiarismRef.current?.click(),
              plagiarismFile ? <ShieldCheck className="w-6 h-6 text-green-500" /> : <ShieldCheck className="w-6 h-6 text-brand-accent" />,
              'Click to replace plagiarism report'
            )}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              ref={plagiarismRef}
              onChange={handleFileSelect(setPlagiarismFile)}
            />

            {dropZone(
              sub.ai_plagiarism_file,
              !!aiPlagiarismFile,
              aiPlagiarismFile?.name || null,
              () => aiPlagiarismRef.current?.click(),
              aiPlagiarismFile ? <ScanSearch className="w-6 h-6 text-green-500" /> : <ScanSearch className="w-6 h-6 text-brand-accent" />,
              'Click to replace AI plagiarism report'
            )}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              ref={aiPlagiarismRef}
              onChange={handleFileSelect(setAiPlagiarismFile)}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-200 text-sm">{error}</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t-2 border-brand-accent/40 bg-brand-bg/40">
          <button
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-brand-text/70 hover:bg-brand-text/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all ml-auto disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function MySubmissions({ getToken, onBack, onStart, maintenanceMode = false, maintenanceUntil = null, registrationOpen = false }: MySubmissionsProps) {
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MySubmission | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setError('Please sign in to view your submissions.');
        return;
      }
      const res = await fetch(`${API_URL}/api/submissions/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError('Could not load your submissions. Please try again.');
        return;
      }
      const data = await res.json().catch(() => null);
      setSubs(data?.submissions || []);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setError('Please sign in to view your submissions.');
          return;
        }
        const res = await fetch(`${API_URL}/api/submissions/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setError('Could not load your submissions. Please try again.');
          return;
        }
        const data = await res.json().catch(() => null);
        if (!cancelled) setSubs(data?.submissions || []);
      } catch {
        if (!cancelled) setError('Could not reach the server. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const handleSaved = () => {
    const neededRevisions = editing?.review_decision && editing.review_decision !== 'ACCEPTED';
    setPopup({
      type: 'success',
      title: 'Files Updated',
      message: neededRevisions
        ? 'Your revised files have been uploaded. Your paper has been sent back to the reviewer for a new review.'
        : 'Your uploaded files have been replaced with the edited versions.',
    });
    setEditing(null);
    loadSubmissions();
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold mb-2">My Submissions</h1>
          <p className="text-brand-text/70">All papers submitted by you to ICAIDIET&apos;26.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
      </div>

      {error ? (
        <div className="bg-brand-card rounded-2xl p-8 shadow-xl border border-brand-text/5 text-center">
          <div className="text-lg text-brand-text/70 mb-4">{error}</div>
          <button
            onClick={onStart}
            className="px-8 py-3 bg-brand-text text-white rounded-xl font-medium hover:bg-brand-accent transition-all shadow"
          >
            Go to Submission Portal
          </button>
        </div>
      ) : subs === null ? (
        <div className="bg-brand-card rounded-2xl p-12 shadow-xl border border-brand-text/5 flex items-center justify-center gap-3 text-brand-text/70">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your submissions...
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-brand-card rounded-2xl p-16 shadow-xl border border-brand-text/5 text-center">
          <Inbox className="w-14 h-14 text-brand-accent mx-auto mb-4" />
          <h2 className="text-2xl font-serif font-bold mb-2">No submissions yet</h2>
          <p className="text-brand-text/70 mb-6">You haven&apos;t submitted any papers yet.</p>
          <button
            onClick={onStart}
            className="px-8 py-3 bg-brand-text text-white rounded-xl font-medium hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow-lg"
          >
            Submit Your First Paper
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {subs.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-2xl p-6 shadow-xl border-2 border-yellow-400 text-black"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center shadow-sm shrink-0 mt-1">
                    <FileText className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-bold leading-snug text-black">{sub.title}</h3>
                    <div className="text-sm text-black/70 mt-1">
                      {sub.submission_code}
                      {sub.paper_id ? ` · CMT ID: ${sub.paper_id}` : ''}
                      {sub.author_count ? ` · Authors: ${sub.author_count}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-black/60">{formatDate(sub.created_at)}</span>
                  {statusBadge(sub.status)}
                </div>
              </div>

              {sub.abstract && (
                <p className="text-sm text-black/80 mt-4 leading-relaxed line-clamp-3">{sub.abstract}</p>
              )}

              {reviewBanner(sub)}

              {registrationOpen && (sub.status === 'ACCEPTED' || sub.status === 'READY_FOR_REGISTRATION' || sub.review_decision === 'ACCEPTED') && (
                 <RegistrationForm sub={sub} getToken={getToken} onSaved={loadSubmissions} />
              )}

      {maintenanceMode && (
        <div className="mt-4 rounded-xl border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
          The submission portal is under maintenance and file updates are disabled.
          {maintenanceUntil
            ? <> We expect the portal to be back online {new Date(maintenanceUntil).toLocaleString()}.</>
            : ' Please check back again later.'}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/10 pt-4">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="text-sm text-black/80 capitalize">{sub.track?.replace(/-/g, ' ')}</span>
          {isEdited(sub) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <Pencil className="w-3 h-3" /> Files edited
            </span>
          )}
        </div>
        {!maintenanceMode && (
          <button
            onClick={() => setEditing(sub)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white bg-brand-text hover:bg-brand-accent transition-all shadow"
          >
            <Pencil className="w-4 h-4" /> Edit Files
          </button>
        )}
      </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditFilesModal
          sub={editing}
          getToken={getToken}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {popup && (
        <Popup
          info={popup}
          onClose={() => {
            setPopup(null);
          }}
        />
      )}
    </div>
  );
}