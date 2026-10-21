import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileDown,
  Loader2,
  Upload,
  Wifi,
  MapPin,
} from 'lucide-react';
import { Popup, PopupInfo } from '../Popup';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AttendanceMode = 'ONLINE' | 'OFFLINE';

interface Phase2Status {
  phase2_open: boolean;
  eligible: boolean;
  reason: string | null;
  submitted: boolean;
  phase2: {
    submitted_at: string;
    attendance_mode: string | null;
    declaration_confirmed: boolean;
    camera_ready_file: string | null;
    copyright_form_file: string | null;
  } | null;
}

interface Phase2PageProps {
  submissionId: string;
  getToken: () => Promise<string | null>;
  onBack: () => void;
}

const MAX_PDF_SIZE = 10 * 1024 * 1024;

// Phase 2 page: download the two template PDFs, then submit the camera-ready
// manuscript + signed copyright form + attendance mode + declaration in one
// request. Reachable only for a submission this signed-in author owns AND that
// is accepted with an approved payment — the backend status endpoint is the
// real gate (it returns 403); the not-authorised state below just presents it.
export function Phase2Page({ submissionId, getToken, onBack }: Phase2PageProps) {
  const [status, setStatus] = useState<Phase2Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [attendance, setAttendance] = useState<AttendanceMode | null>(null);
  const [cameraReady, setCameraReady] = useState<File | null>(null);
  const [copyrightForm, setCopyrightForm] = useState<File | null>(null);
  const [declared, setDeclared] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState<'camera-ready' | 'copyright' | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const loadStatus = useCallback(async () => {
    if (!submissionId) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setStatus(null);
        return;
      }
      const res = await fetch(`${API_URL}/api/submissions/${submissionId}/phase2`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setStatus(null);
        setAccessDenied(true);
        return;
      }
      setAccessDenied(false);
      setStatus(data as Phase2Status);
    } catch (err) {
      console.error('Failed to load Phase 2 status:', err);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [submissionId, getToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const downloadTemplate = async (kind: 'camera-ready' | 'copyright') => {
    setDownloading(kind);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch(`${API_URL}/api/phase2/templates/${kind}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not download the template.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        kind === 'copyright' ? 'Copyright_Form_Template.pdf' : 'Camera_Ready_Template.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setPopup({
        type: 'error',
        title: 'Download Failed',
        message: err instanceof Error ? err.message : 'Could not download the template.',
      });
    } finally {
      setDownloading(null);
    }
  };

  const submit = async () => {
    setFormError('');
    if (!attendance) {
      setFormError('Please select whether you will attend Online or Offline.');
      return;
    }
    if (!cameraReady) {
      setFormError('Please attach the camera-ready manuscript as a PDF file.');
      return;
    }
    if (!copyrightForm) {
      setFormError('Please attach the signed copyright form as a PDF file.');
      return;
    }
    for (const f of [cameraReady, copyrightForm]) {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setFormError(`"${f.name}" is not a PDF file. Only PDF uploads are allowed.`);
        return;
      }
      if (f.size > MAX_PDF_SIZE) {
        setFormError(`"${f.name}" is larger than the 10MB limit.`);
        return;
      }
    }
    if (!declared) {
      setFormError(
        'Please tick the declaration confirming your documents are verified and plagiarism-free.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const fd = new FormData();
      fd.append('attendance_mode', attendance);
      fd.append('declaration', 'true');
      fd.append('camera_ready', cameraReady);
      fd.append('copyright_form', copyrightForm);
      const res = await fetch(`${API_URL}/api/submissions/${submissionId}/phase2`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Could not submit your Phase 2 files. Please try again.');
      }
      setPopup({
        type: 'success',
        title: 'Phase 2 Submitted',
        message: data.message || 'Your Phase 2 submission is complete.',
      });
      setAttendance(null);
      setCameraReady(null);
      setCopyrightForm(null);
      setDeclared(false);
      await loadStatus();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : 'Could not submit your Phase 2 files. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fileRow = (
    label: string,
    file: File | null,
    onPick: (f: File | null) => void,
    hint: string
  ) => (
    <div className="rounded-xl border border-stone-300 bg-stone-50/80 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-black">
            <Upload className="w-4 h-4 text-brand-accent shrink-0" />
            {label}
          </div>
          <p className="text-xs text-black/60 mt-1">{hint}</p>
        </div>
        <label className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-text hover:bg-brand-accent transition-all shadow-sm cursor-pointer">
          {file ? 'Change PDF' : 'Choose PDF'}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
          />
        </label>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-xs">
        {file ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-black/70 truncate">{file.name}</span>
            <span className="text-black/40 shrink-0">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 text-stone-400 shrink-0" />
            <span className="text-black/50">No file chosen</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:text-brand-accent transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to My Submissions
      </button>

      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border-2 border-yellow-400 text-black">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-text">
          Phase 2 — Camera Ready & Copyright
        </h2>
        <p className="text-sm text-black/70 mt-2 leading-relaxed">
          Download the templates below, then upload your camera-ready manuscript and signed
          copyright form to complete the final phase for your accepted paper.
        </p>

        {/* Template downloads — black buttons matching the site's download style,
            streamed from the Phase2 R2 bucket. */}
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => downloadTemplate('camera-ready')}
            disabled={downloading !== null}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-semibold text-sm sm:text-base hover:bg-gray-800 transition-all shadow-xl hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {downloading === 'camera-ready' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileDown className="w-5 h-5" />
            )}
            Camera Ready Template
          </button>
          <button
            type="button"
            onClick={() => downloadTemplate('copyright')}
            disabled={downloading !== null}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-semibold text-sm sm:text-base hover:bg-gray-800 transition-all shadow-xl hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {downloading === 'copyright' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FileDown className="w-5 h-5" />
            )}
            Copyright Form
          </button>
        </div>
      </div>

      {loading && (
        <div className="mt-8 bg-white rounded-2xl p-10 shadow-lg border border-brand-text/5 flex items-center justify-center gap-3 text-black/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your Phase 2 status...
        </div>
      )}

      {/* The status endpoint is ownership-gated server-side; a tampered or
          foreign submission id lands here instead of exposing anything. */}
      {!loading && accessDenied && (
        <div className="mt-8 bg-white rounded-2xl p-8 sm:p-10 shadow-lg border-2 border-red-300 text-center">
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-red-800 mb-2">
            Not Available
          </h3>
          <p className="text-sm text-black/70 max-w-xl mx-auto leading-relaxed">
            The Phase 2 page is not available for this submission. It can only be opened by the
            author of an accepted paper whose registration payment has been approved.
          </p>
          <button
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all shadow-md"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Submissions
          </button>
        </div>
      )}

      {!loading && !accessDenied && status && (
        <>
          {!status.eligible && status.reason && (
            <div className="mt-8 text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-4">
              {status.reason}
            </div>
          )}

          {status.submitted && status.phase2 && (
            <div className="mt-8 bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-yellow-400">
              <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-stone-200">
                <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text">
                  Your Phase 2 Submission
                </h3>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Submitted
                </span>
              </div>
              <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 space-y-2 text-sm">
                {[
                  {
                    label: 'Camera-Ready Manuscript',
                    ok: !!status.phase2.camera_ready_file,
                    name: status.phase2.camera_ready_file,
                  },
                  {
                    label: 'Copyright Form',
                    ok: !!status.phase2.copyright_form_file,
                    name: status.phase2.copyright_form_file,
                  },
                  {
                    label: 'Mode of Attending',
                    ok: !!status.phase2.attendance_mode,
                    name:
                      status.phase2.attendance_mode === 'ONLINE'
                        ? 'Online'
                        : status.phase2.attendance_mode === 'OFFLINE'
                        ? 'Offline'
                        : status.phase2.attendance_mode,
                  },
                ].map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-black/80 text-xs sm:text-sm">
                      {f.ok ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                      )}
                      {f.label}
                    </span>
                    <span className="text-xs text-black/50 truncate max-w-[55%]">
                      {f.ok ? f.name : '—'}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-black/60">
                Submitted on {new Date(status.phase2.submitted_at).toLocaleString()}.
              </p>
            </div>
          )}

          {status.eligible && (
            <div className="mt-8 bg-white rounded-2xl p-6 sm:p-8 shadow-xl border-2 border-yellow-400 text-black">
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text mb-1">
                {status.submitted ? 'Update Your Submission' : 'Submit for Phase 2'}
              </h3>
              <p className="text-xs text-black/60 mb-5">
                {status.submitted
                  ? 'Submitting again replaces your previously uploaded Phase 2 files.'
                  : 'All fields below are compulsory.'}
              </p>

              {/* Mode of Attending (compulsory) */}
              <div className="mb-5">
                <div className="text-sm font-semibold text-black mb-2">Mode of Attending *</div>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { value: 'ONLINE', label: 'Online', icon: <Wifi className="w-4 h-4" /> },
                      { value: 'OFFLINE', label: 'Offline', icon: <MapPin className="w-4 h-4" /> },
                    ] as { value: AttendanceMode; label: string; icon: React.ReactNode }[]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAttendance(opt.value)}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                        attendance === opt.value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-stone-300 hover:border-stone-500'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* The two compulsory PDF uploads */}
              <div className="space-y-3 mb-5">
                {fileRow(
                  'Camera-Ready Manuscript *',
                  cameraReady,
                  setCameraReady,
                  'The final camera-ready version of your paper. PDF only, up to 10MB.'
                )}
                {fileRow(
                  'Copyright Form *',
                  copyrightForm,
                  setCopyrightForm,
                  'The signed copyright form. PDF only, up to 10MB.'
                )}
              </div>

              {/* Compulsory declaration */}
              <label className="flex items-start gap-3 rounded-xl border border-stone-300 bg-stone-50/80 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-black shrink-0"
                />
                <span className="text-sm text-black/80 leading-relaxed">
                  I declare that the documents submitted have been verified, checked for
                  plagiarism, and are not copied from any other sources. *
                </span>
              </label>

              {formError && (
                <div className="mt-4 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
                  {formError}
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white rounded-xl font-bold text-sm sm:text-base hover:bg-gray-800 transition-all shadow-xl hover:shadow-lg disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit for Phase 2'
                )}
              </button>
            </div>
          )}
        </>
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
