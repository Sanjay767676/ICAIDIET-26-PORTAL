import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Users,
  Upload,
  Loader2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import paperIcon from '../../assets/images/paper.png';
import infoIcon from '../../assets/images/info.png';
import { Popup, PopupInfo } from '../Popup';

interface SubmissionWizardProps {
  onComplete: () => void;
  onBack: () => void;
  getToken: (options?: { skipCache?: boolean; template?: string } | undefined) => Promise<string | null>;
  clerkUser?: any;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function SubmissionWizard({ onComplete, onBack, getToken, clerkUser }: SubmissionWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  // Step 1: Details
  const [paperId, setPaperId] = useState('');
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [track, setTrack] = useState('');
  const [showPaperIdInfo, setShowPaperIdInfo] = useState(false);

  // Step 2: Authors (multi-author, first is primary)
  interface AuthorField {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    college: string;
    sameAsPrimary: boolean;
  }
  const [numAuthors, setNumAuthors] = useState(2);
  const [authors, setAuthors] = useState<AuthorField[]>(() =>
    Array.from({ length: 2 }, () => ({
      first_name: '',
      last_name: '',
      phone: '',
      email: '',
      college: '',
      sameAsPrimary: false,
    }))
  );

  // Step 3: Upload
  const [file, setFile] = useState<File | null>(null);
  const [plagiarismFile, setPlagiarismFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const plagiarismInputRef = useRef<HTMLInputElement>(null);

  // Sync the Clerk user profile to the backend on mount
  useEffect(() => {
    const syncUser = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        await fetch(`${apiUrl}/api/users/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: clerkUser?.fullName || '',
            email: clerkUser?.primaryEmailAddress?.emailAddress || '',
          }),
        });
      } catch {
        // Non-fatal; the profile sync is best-effort.
      }
    };
    syncUser();
  }, [getToken, clerkUser]);

  // Pre-fill the primary author from the signed-in Clerk account.
  useEffect(() => {
    if (!clerkUser) return;
    const email = clerkUser.primaryEmailAddress?.emailAddress || '';
    const parts = (clerkUser.fullName || '').trim().split(/\s+/);
    setAuthors((prev) => {
      const next = [...prev];
      if (!prev[0].first_name && !prev[0].last_name && parts.length) {
        next[0] = { ...prev[0], first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' };
      }
      if (!prev[0].email && email) {
        next[0] = { ...next[0], email };
      }
      return next;
    });
  }, [clerkUser]);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 2) {
      const result = validateAuthors();
      if (!result.ok) {
        setPopup({
          type: 'error',
          title: 'Validation Error',
          message: result.msg || 'Please complete all author details before continuing.',
        });
        return;
      }
    }

    if (step === 3) {
      if (!file) {
        setPopup({
          type: 'error',
          title: 'Manuscript Required',
          message: 'Please upload a manuscript PDF before submitting. Maximum file size is 10MB.',
        });
        return;
      }
      if (!plagiarismFile) {
        setPopup({
          type: 'error',
          title: 'Plagiarism Report Required',
          message: 'Please upload the plagiarism report PDF before submitting. Maximum file size is 10MB.',
        });
        return;
      }
    }

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Submit
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('paperId', paperId);
      formData.append('title', title);
      formData.append('abstract', abstract);
      formData.append('track', track);
      formData.append(
        'authors',
        JSON.stringify(
          authors.map((a) => ({
            first_name: a.first_name.trim(),
            last_name: a.last_name.trim(),
            phone: a.phone.trim(),
            email: a.email.trim(),
            college: a.college.trim(),
          }))
        )
      );
      formData.append(
        'authorName',
        `${authors[0].first_name.trim()} ${authors[0].last_name.trim()}`
      );
      formData.append('authorEmail', authors[0].email.trim());
      formData.append('file', file);
      formData.append('plagiarismFile', plagiarismFile);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const token = await getToken();
      if (!token) {
        setPopup({
          type: 'error',
          title: 'Authentication Required',
          message: 'Please sign in before submitting your paper.',
        });
        setIsSubmitting(false);
        return;
      }
      const res = await fetch(`${apiUrl}/api/submissions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        const msg =
          data?.message ||
          data?.error ||
          (res.status === 413
            ? 'The submitted file is too large. Maximum file size is 10MB.'
            : res.status === 429
              ? 'Too many attempts. Please wait a few minutes and try again.'
              : 'Your paper could not be submitted. Please try again.');
        setPopup({ type: 'error', title: 'Submission Failed', message: msg });
        setIsSubmitting(false);
        return;
      }

      const code = data.submission_code || data.submission_id;
      setPopup({
        type: 'success',
        title: 'Submission Successful',
        message: `Your paper has been submitted to ICAIDIET'26 successfully.\n\nSubmission ID: ${code}\n\nYou will be notified once the peer-review process is complete.`,
      });
      setIsSubmitting(false);
    } catch (err) {
      setPopup({
        type: 'error',
        title: 'Connection Error',
        message:
          err instanceof Error
            ? err.message
            : 'Could not reach the server. Please check your connection and try again.',
      });
      setIsSubmitting(false);
    }
  };

  const handlePopupClose = () => {
    setPopup(null);
    if (popup?.type === 'success') {
      onComplete();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setPopup({
          type: 'error',
          title: 'File Too Large',
          message: 'The selected file is larger than 10MB. Please choose a smaller PDF manuscript.',
        });
        setFile(null);
        e.target.value = '';
        return;
      }
      if (!/\.pdf$/i.test(selectedFile.name)) {
        setPopup({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please upload a PDF manuscript (only .pdf files are accepted).',
        });
        setFile(null);
        e.target.value = '';
        return;
      }
      setFile(selectedFile);
    }
  };

  const handlePlagiarismChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > MAX_FILE_SIZE) {
        setPopup({
          type: 'error',
          title: 'File Too Large',
          message: 'The plagiarism report is larger than 10MB. Please choose a smaller PDF.',
        });
        setPlagiarismFile(null);
        e.target.value = '';
        return;
      }
      if (!/\.pdf$/i.test(selectedFile.name)) {
        setPopup({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please upload the plagiarism report as a PDF.',
        });
        setPlagiarismFile(null);
        e.target.value = '';
        return;
      }
      setPlagiarismFile(selectedFile);
    }
  };

  // Resize the authors list when the dropdown value changes (2-6 total, primary always index 0).
  const handleNumAuthorsChange = (value: number) => {
    setNumAuthors(value);
    setAuthors((prev) => {
      const next = prev.slice(0, Math.max(1, value));
      while (next.length < value) {
        next.push({ first_name: '', last_name: '', phone: '', email: '', college: '', sameAsPrimary: false });
      }
      return next;
    });
  };

  const updateAuthor = (index: number, field: keyof AuthorField, value: string | boolean) => {
    setAuthors((prev) => {
      const next = prev.map((a, i) => (i === index ? { ...a, [field]: value } : a));
      // When "Same as Primary Author" is ticked on a co-author, copy the primary's college.
      if (field === 'sameAsPrimary' && value === true && index > 0) {
        next[index].college = prev[0].college;
      }
      // Unticking keeps the copied value but re-enables editing.
      return next;
    });
  };

  const primaryCollege = authors[0]?.college || '';

  const validateAuthors = (): { ok: boolean; msg?: string } => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (let i = 0; i < authors.length; i++) {
      const a = authors[i];
      if (!a.first_name.trim() || !a.last_name.trim()) {
        return { ok: false, msg: `Author ${i + 1}: please provide both a first and last name.` };
      }
      if (!a.phone.trim()) {
        return { ok: false, msg: `Author ${i + 1}: please provide a phone number.` };
      }
      if (!emailRegex.test(a.email.trim())) {
        return { ok: false, msg: `Author ${i + 1}: please provide a valid email address.` };
      }
      if (!a.college.trim()) {
        return { ok: false, msg: `Author ${i + 1}: please provide a college/institution.` };
      }
    }
    return { ok: true };
  };

  const stepLabel = (num: number) =>
    num === 1 ? 'Details' : num === 2 ? 'Author' : 'Upload';

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-12 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold mb-4">Submit Your Paper</h1>
          <p className="text-brand-text/70 text-lg">
            Complete the steps below to submit your research to ICAIDIET'26.
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex-1">
            <div
              className={`h-2 rounded-full mb-2 transition-colors ${step >= num ? 'bg-brand-text' : 'bg-brand-text/10'
                }`}
            />
            <span
              className={`text-sm font-medium ${step >= num ? 'text-brand-text' : 'text-brand-text/40'
                }`}
            >
              Step {num}: {stepLabel(num)}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-brand-card rounded-2xl p-8 shadow-xl border border-brand-text/5">
        <form onSubmit={handleNext}>
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                <img src={paperIcon} alt="Paper" className="w-6 h-6 object-contain" />
                Paper Details
              </h2>

              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                  Paper ID
                  <span className="relative inline-flex items-center">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="What is a Paper ID?"
                      onClick={() => setShowPaperIdInfo(!showPaperIdInfo)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowPaperIdInfo(!showPaperIdInfo);
                        }
                      }}
                      className="flex items-center justify-center w-5 h-5 rounded-full cursor-pointer select-none hover:opacity-80 transition-opacity"
                    >
                      <img src={infoIcon} alt="" className="w-4 h-4" draggable={false} />
                    </span>
                    {showPaperIdInfo && (
                      <span className="absolute left-0 top-full mt-2 z-20 w-72 max-w-[80vw] bg-stone-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-normal">
                        Your paper ID from the CMT Portal. You can find it after submitting your paper through the CMT
                        (Conference Management Tool) system.
                      </span>
                    )}
                  </span>
                </label>
                <input
                  type="text"
                  value={paperId}
                  onChange={(e) => setPaperId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-lg"
                  placeholder="Your paper ID in CMT or Enter NA if you don't have one"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Paper Title</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-lg"
                  placeholder="e.g. Advancements in Deep Learning for Healthcare"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Abstract</label>
                <textarea
                  required
                  rows={5}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all resize-none"
                  placeholder="Provide a summary of your research..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conference Track</label>
                <select
                  required
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                >
                  <option value="">Select a track</option>
                  <option value="ai-intelligent-systems">Artificial Intelligence &amp; Intelligent Systems</option>
                  <option value="ml-advanced-analytics">Machine Learning &amp; Advanced Analytics</option>
                  <option value="data-science-decision-intelligence">Data Science &amp; Decision Intelligence</option>
                  <option value="iot-edge-embedded">IoT, Edge Computing &amp; Embedded Systems</option>
                  <option value="communication-network">Communication Systems &amp; Network Technologies</option>
                  <option value="cybersecurity">Cybersecurity &amp; Secure Computing</option>
                  <option value="robotics-automation">Robotics, Automation &amp; Smart Industry</option>
                  <option value="emerging-tech-sustainability">Emerging Technologies, Sustainability &amp; AI Management</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-serif font-bold mb-4 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-brand-accent" />
                Authors
              </h2>
              <p className="text-sm text-brand-text/70 mb-4">
                Add up to 6 authors. The first author is the primary (corresponding) author.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1">Number of Authors</label>
                <select
                  value={numAuthors}
                  onChange={(e) => handleNumAuthorsChange(parseInt(e.target.value, 10))}
                  className="w-full sm:w-64 px-4 py-3 rounded-xl bg-white border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} Author{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {authors.map((author, idx) => {
                const isPrimary = idx === 0;
                const sameAsPrimary = isPrimary ? false : author.sameAsPrimary;
                return (
                  <div
                    key={idx}
                    className="bg-white p-5 rounded-xl border border-white/40 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-brand-accent" />
                      <h3 className="font-medium text-brand-text">
                        {isPrimary ? 'Primary Author' : `Author ${idx + 1}`}
                      </h3>
                      {isPrimary && (
                        <span className="text-xs bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-full font-medium">
                          Corresponding
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="First Name"
                        value={author.first_name}
                        onChange={(e) => updateAuthor(idx, 'first_name', e.target.value)}
                        className="px-4 py-2 rounded-lg bg-white outline-none border border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={author.last_name}
                        onChange={(e) => updateAuthor(idx, 'last_name', e.target.value)}
                        className="px-4 py-2 rounded-lg bg-white outline-none border border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={author.phone}
                        onChange={(e) => updateAuthor(idx, 'phone', e.target.value.replace(/[^0-9+\-\s()]/g, ''))}
                        className="px-4 py-2 rounded-lg bg-white outline-none border border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                      <input
                        type="email"
                        placeholder="Email ID"
                        value={author.email}
                        onChange={(e) => updateAuthor(idx, 'email', e.target.value)}
                        className="px-4 py-2 rounded-lg bg-white outline-none border border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                      />
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          placeholder="College"
                          value={author.college}
                          disabled={sameAsPrimary}
                          onChange={(e) => updateAuthor(idx, 'college', e.target.value)}
                          className="w-full px-4 py-2 rounded-lg bg-white outline-none border border-stone-200 shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 disabled:bg-white disabled:text-stone-400"
                        />
                        {!isPrimary && (
                          <label className="flex items-center gap-2 mt-2 text-sm text-brand-text/70 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={sameAsPrimary}
                              onChange={(e) => updateAuthor(idx, 'sameAsPrimary', e.target.checked)}
                              className="w-4 h-4 accent-brand-accent"
                            />
                            Same as primary author's college
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                <Upload className="w-6 h-6 text-brand-accent" />
                Upload Manuscript
              </h2>

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer group shadow-sm ${file
                  ? 'border-green-500 bg-green-50'
                  : 'border-stone-300 bg-white hover:bg-stone-50'
                  }`}
              >
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  {file ? (
                    <FileText className="w-8 h-8 text-green-500" />
                  ) : (
                    <Upload className="w-8 h-8 text-brand-accent" />
                  )}
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {file ? 'File Selected' : 'Click to upload or drag and drop'}
                </h3>
                <p className="text-sm text-brand-text/60">
                  {file ? file.name : 'PDF format only. Maximum file size 10MB.'}
                </p>
                {file && <p className="text-xs text-brand-text/50 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>


              <div>
                <h3 className="text-xl font-serif font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-accent" />
                  Plagiarism Report
                </h3>
                <p className="text-sm text-brand-text/60 mb-3">
                  Upload the plagiarism/verification report for this paper (e.g. Turnitin/iThenticate). PDF only.
                </p>
                <div
                  onClick={() => plagiarismInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer group shadow-sm ${plagiarismFile
                    ? 'border-green-500 bg-green-50'
                    : 'border-stone-300 bg-white hover:bg-stone-50'
                    }`}
                >
                  <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm group-hover:scale-110 transition-transform">
                    {plagiarismFile ? (
                      <FileText className="w-7 h-7 text-green-500" />
                    ) : (
                      <ShieldCheck className="w-7 h-7 text-brand-accent" />
                    )}
                  </div>
                  <h4 className="text-lg font-bold mb-1">
                    {plagiarismFile ? 'Report Selected' : 'Click to upload the plagiarism report'}
                  </h4>
                  <p className="text-sm text-brand-text/60">
                    {plagiarismFile ? plagiarismFile.name : 'PDF format only. Maximum file size 10MB.'}
                  </p>
                  {plagiarismFile && (
                    <p className="text-xs text-brand-text/50 mt-1">
                      {(plagiarismFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    ref={plagiarismInputRef}
                    onChange={handlePlagiarismChange}
                  />
                </div>
              </div>


            </div>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-brand-text/10">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={isSubmitting}
                className="px-6 py-3 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Home
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-text text-white px-8 py-3 rounded-xl font-medium hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                </>
              ) : step === 3 ? (
                'Submit Paper'
              ) : (
                <>
                  Continue <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {popup && <Popup info={popup} onClose={handlePopupClose} />}
    </div>
  );
}
