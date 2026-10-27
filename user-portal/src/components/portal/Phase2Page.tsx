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
import { CONFERENCE_TRACKS } from '../../data/conferenceTracks';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AttendanceMode = 'ONLINE' | 'OFFLINE';

// Head-count options for offline attendees (compulsory for offline).
const HEAD_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6];

interface Phase2Status {
  submission_code: string | null;
  title: string | null;
  phase2_open: boolean;
  eligible: boolean;
  reason: string | null;
  submitted: boolean;
  // Editing rules: allowed before the first submit, and after a reviewer asks
  // for changes. Locked otherwise (including while awaiting review).
  can_edit: boolean;
  locked: boolean;
  phase2: {
    submitted_at: string;
    attendance_mode: string | null;
    head_count: number | null;
    track: string | null;
    declaration_confirmed: boolean;
    camera_ready_file: string | null;
    copyright_form_file: string | null;
  } | null;
  // Set by a reviewer from the reviewer portal's "View Camera Ready" tab.
  // ACCEPTED = approved; MINOR_CHANGES = comments explain what to fix.
  camera_ready_review: {
    status: 'ACCEPTED' | 'MINOR_CHANGES' | 'MAJOR_CHANGES' | null;
    comments: string | null;
    reviewed_at: string | null;
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
  // Set when the status request itself failed (offline, server error, expired
  // session). Without this the page rendered its header and nothing else, which
  // reads as a broken portal rather than a retryable failure.
  const [loadError, setLoadError] = useState('');

  const [attendance, setAttendance] = useState<AttendanceMode | null>(null);
  const [track, setTrack] = useState('');
  const [headCount, setHeadCount] = useState('');
  const [cameraReady, setCameraReady] = useState<File | null>(null);
  const [copyrightForm, setCopyrightForm] = useState<File | null>(null);
  const [declared, setDeclared] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState<'camera-ready' | 'copyright' | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  // After a successful submit the page closes (returns to My Submissions)
  // once the success popup is dismissed — submitting is a one-shot action.
  const [closeAfterPopup, setCloseAfterPopup] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!submissionId) {
      setLoading(false);
      setAccessDenied(true);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      let token = await getToken();
      // Clerk can briefly return a null token right after a hard refresh; retry
      // instead of reporting "not available" to a signed-in author.
      for (let attempt = 0; attempt < 3 && !token; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        token = await getToken();
      }
      if (!token) {
        setStatus(null);
        setLoadError('Your session has expired. Please sign in again.');
        return;
      }
      const res = await fetch(`${API_URL}/api/submissions/${submissionId}/phase2`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        setStatus(null);
        setLoadError('Your session has expired. Please sign in again.');
        return;
      }
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
      setLoadError('Could not load your Phase 2 status. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [submissionId, getToken]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // When a submitted package is reopened (reviewer asked for changes), keep the
  // author's previous attendance/track/head count selected instead of resetting
  // the whole form.
  useEffect(() => {
    const p = status?.phase2;
    if (!p || !status?.can_edit) return;
    setAttendance((prev) =>
      prev ?? (p.attendance_mode === 'ONLINE' || p.attendance_mode === 'OFFLINE' ? p.attendance_mode : null)
    );
    setTrack((prev) => prev || p.track || '');
    setHeadCount((prev) => prev || (p.head_count ? String(p.head_count) : ''));
  }, [status]);

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
      // Use the filename the server sends (the camera-ready template is a
      // .docx, the copyright form a .pdf) so the saved file opens correctly.
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        match?.[1]?.trim() ||
        (kind === 'copyright' ? 'Copyright_Form_Template.docx' : 'Camera_Ready_Template.docx');
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
    if (attendance === 'OFFLINE' && !headCount) {
      setFormError('Please select how many people will be attending (1 to 6).');
      return;
    }
    if (!track) {
      setFormError('Please select the track you will be attending for.');
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
      fd.append('track', track);
      if (attendance === 'OFFLINE') fd.append('head_count', headCount);
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
      setCloseAfterPopup(true);
      setAttendance(null);
      setTrack('');
      setHeadCount('');
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
        {status?.title && (
          <div className="mt-2 rounded-xl bg-stone-50 border border-stone-200 px-3.5 py-2.5">
            <div className="text-[10px] uppercase tracking-wide font-semibold text-black/45">
              Paper{status.submission_code ? ` · ${status.submission_code}` : ''}
            </div>
            <div className="text-sm font-semibold text-brand-text break-words">{status.title}</div>
          </div>
        )}
        <p className="text-sm text-black/70 mt-2 leading-relaxed">
          Download the templates below, then upload your camera-ready manuscript and signed
          copyright form to complete the final phase for your accepted paper. Once submitted,
          Phase 2 is final and cannot be edited — unless the reviewer asks for changes, which
          reopens editing for that paper.
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

        {/* Sample copyright form shipped with the portal (public folder).
            A plain anchor with `download` so one tap/click saves the file. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
          <span className="text-black/60">Need a filled example?</span>
          <a
            href={`${import.meta.env.BASE_URL}sample_copyright.docx`}
            download="Sample_Copyright_Form.docx"
            className="inline-flex items-center gap-1.5 font-semibold text-brand-text underline underline-offset-2 hover:text-brand-accent transition-colors"
          >
            <FileDown className="w-4 h-4 shrink-0" /> Download Sample Copyright Form
          </a>
        </div>
      </div>

      {loading && (
        <div className="mt-8 bg-white rounded-2xl p-10 shadow-lg border border-brand-text/5 flex items-center justify-center gap-3 text-black/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your Phase 2 status...
        </div>
      )}

      {/* The status request itself failed. Show the reason with a retry, rather
          than leaving the page with only its header. */}
      {!loading && loadError && (
        <div className="mt-8 bg-white rounded-2xl p-8 sm:p-10 shadow-lg border-2 border-red-300 text-center">
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-red-800 mb-2">
            Could Not Load Phase 2
          </h3>
          <p className="text-sm text-black/70 max-w-xl mx-auto leading-relaxed">{loadError}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={loadStatus}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all shadow-md"
            >
              Try Again
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black border-2 border-stone-300 rounded-xl font-semibold text-sm hover:border-stone-500 transition-all shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back to My Submissions
            </button>
          </div>
        </div>
      )}

      {/* The status endpoint is ownership-gated server-side; a tampered or
          foreign submission id lands here instead of exposing anything. */}
      {!loading && !loadError && accessDenied && (
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

          {/* Reviewer's camera-ready decision: green when accepted, amber with
              the comments when minor changes were requested (the author is
              prompted to update the files using the form below). */}
          {status.submitted && (
            <div className="mt-8">
              {status.camera_ready_review?.status === 'ACCEPTED' ? (
                <div className="rounded-2xl border-2 border-green-300 bg-green-50 p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-green-900 text-sm">Camera-Ready Accepted</div>
                    <p className="text-xs text-green-800 mt-0.5 leading-relaxed">
                      Your Phase 2 submission has been reviewed and accepted. No further action is needed.
                    </p>
                  </div>
                </div>
              ) : status.camera_ready_review?.status === 'MINOR_CHANGES' ||
                status.camera_ready_review?.status === 'MAJOR_CHANGES' ? (
                <div
                  className={`rounded-2xl border-2 p-4 ${
                    status.camera_ready_review?.status === 'MAJOR_CHANGES'
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-amber-400 bg-amber-50'
                  }`}
                >
                  <div
                    className={`font-bold text-sm ${
                      status.camera_ready_review?.status === 'MAJOR_CHANGES'
                        ? 'text-orange-900'
                        : 'text-amber-900'
                    }`}
                  >
                    {status.camera_ready_review?.status === 'MAJOR_CHANGES'
                      ? 'Major Changes Requested'
                      : 'Minor Changes Requested'}
                  </div>
                  <p
                    className={`text-xs mt-0.5 leading-relaxed ${
                      status.camera_ready_review?.status === 'MAJOR_CHANGES'
                        ? 'text-orange-800'
                        : 'text-amber-800'
                    }`}
                  >
                    Please update your files as per the reviewer's comments below, then submit the
                    Phase 2 form again. Editing is reopened for this paper until you re-submit.
                  </p>
                  {status.camera_ready_review.comments && (
                    <div
                      className={`mt-2.5 text-sm bg-white border rounded-xl p-3 whitespace-pre-wrap ${
                        status.camera_ready_review?.status === 'MAJOR_CHANGES'
                          ? 'text-orange-900 border-orange-200'
                          : 'text-amber-900 border-amber-200'
                      }`}
                    >
                      {status.camera_ready_review.comments}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-stone-300 bg-stone-50 p-4">
                  <div className="font-bold text-stone-800 text-sm">Awaiting Review</div>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Your Phase 2 files have been submitted and are waiting for the reviewer's decision.
                  </p>
                </div>
              )}
            </div>
          )}

          {status.submitted && status.phase2 && (
            <div className="mt-4 bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-yellow-400">
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
                  ...(status.phase2.attendance_mode === 'OFFLINE'
                    ? [
                        {
                          label: 'Head Count Attending',
                          ok: !!status.phase2.head_count,
                          name: status.phase2.head_count ? String(status.phase2.head_count) : null,
                        },
                      ]
                    : []),
                  {
                    label: 'Track',
                    ok: !!status.phase2.track,
                    name:
                      CONFERENCE_TRACKS.find((t) => t.value === status.phase2?.track)?.label ||
                      status.phase2.track,
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
              {status.locked ? (
                <div className="mt-3 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-xs text-black/70">
                  <span className="font-semibold text-black/80">Locked.</span> Your Phase 2 package
                  has been accepted/finalised — editing is not allowed. Contact the organizers if a
                  change is required.
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <span className="font-semibold">Editing available.</span> The reviewer requested
                  changes, so you can upload corrected files below. Re-submitting locks the package
                  again.
                </div>
              )}
            </div>
          )}

          {status.eligible && status.can_edit && (
            <div className="mt-8 bg-white rounded-2xl p-6 sm:p-8 shadow-xl border-2 border-yellow-400 text-black">
              <h3 className="text-lg sm:text-xl font-bold font-serif text-brand-text mb-1">
                {status.submitted ? 'Update Your Submission' : 'Submit for Phase 2'}
              </h3>
              <p className="text-xs text-black/60 mb-5">
                {status.submitted
                  ? 'Submitting again replaces your previously uploaded Phase 2 files and locks them until the next review.'
                  : 'All fields below are compulsory.'}
              </p>

              {/* Mode of Attending (compulsory) */}
              <div className="mb-5">
                <div className="text-sm font-semibold text-black mb-2 flex items-center gap-2">
                  Mode of Attending <span className="text-red-600">*</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-100 border border-red-300 rounded-full px-2 py-0.5">
                    Important
                  </span>
                </div>
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
                      onClick={() => {
                        setAttendance(opt.value);
                        // Head count only applies to offline attendance.
                        if (opt.value === 'ONLINE') setHeadCount('');
                      }}
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
                <p className="mt-1.5 text-[11px] text-black/55">
                  Please choose carefully — this decides how your paper will be presented.
                </p>
              </div>

              {/* Offline attendees first tell us how many people are coming. */}
              {attendance === 'OFFLINE' && (
                <div className="mb-5">
                  <label
                    htmlFor="phase2-head-count"
                    className="block text-sm font-semibold text-black mb-2"
                  >
                    Head Count Attending *
                  </label>
                  <select
                    id="phase2-head-count"
                    value={headCount}
                    onChange={(e) => setHeadCount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white text-black border-2 border-stone-300 focus:border-black focus:ring-2 focus:ring-black/10 outline-none transition-all"
                  >
                    <option value="">Select head count</option>
                    {HEAD_COUNT_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-black/55">
                    Total number of people attending the conference, including you.
                  </p>
                </div>
              )}

              {/* Track: online asks right away, offline asks after the head count. */}
              {attendance && (
                <div className="mb-5">
                  <label htmlFor="phase2-track" className="block text-sm font-semibold text-black mb-2">
                    Track *
                  </label>
                  <select
                    id="phase2-track"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white text-black border-2 border-stone-300 focus:border-black focus:ring-2 focus:ring-black/10 outline-none transition-all"
                  >
                    <option value="">Select a track</option>
                    {CONFERENCE_TRACKS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11px] text-black/55">
                    Select the track you will be attending for.
                  </p>
                </div>
              )}

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

              {/* Bold warning: submitting is final. */}
              <p className="mb-3 text-sm font-bold text-red-800 leading-relaxed">
                This submission will be considered as final; no changes can be accepted hereafter.
              </p>

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
            if (closeAfterPopup) {
              setCloseAfterPopup(false);
              onBack();
            }
          }}
        />
      )}
    </div>
  );
}
