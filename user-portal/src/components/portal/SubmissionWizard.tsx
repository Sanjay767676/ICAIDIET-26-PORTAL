import React, { useState, useRef } from 'react';
import {
  FileUp,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Upload,
  Loader2,
  FileText,
} from 'lucide-react';
import { Popup, PopupInfo } from '../../components/Popup';

interface SubmissionWizardProps {
  onComplete: () => void;
  onBack: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function SubmissionWizard({ onComplete, onBack }: SubmissionWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  // Step 1: Details
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [track, setTrack] = useState('');

  // Step 2: Author (primary)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');

  // Step 3: Upload
  const [file, setFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 2) {
      if (!firstName.trim() || !lastName.trim() || !authorEmail.trim()) {
        setPopup({
          type: 'error',
          title: 'Author Required',
          message: 'Please fill in the primary author\'s first name, last name, and email address before continuing.',
        });
        return;
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail.trim());
      if (!emailOk) {
        setPopup({
          type: 'error',
          title: 'Invalid Email',
          message: 'Please enter a valid email address (e.g. jane@university.edu).',
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
    }

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Submit
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('abstract', abstract);
      formData.append('track', track);
      formData.append('authorName', `${firstName.trim()} ${lastName.trim()}`);
      formData.append('authorEmail', authorEmail.trim());
      formData.append('file', file);

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const res = await fetch(`${apiUrl}/api/submissions`, {
        method: 'POST',
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
              className={`h-2 rounded-full mb-2 transition-colors ${
                step >= num ? 'bg-brand-accent' : 'bg-brand-text/10'
              }`}
            />
            <span
              className={`text-sm font-medium ${
                step >= num ? 'text-brand-accent' : 'text-brand-text/40'
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
                <FileUp className="w-6 h-6 text-brand-accent" />
                Paper Details
              </h2>

              <div>
                <label className="block text-sm font-medium mb-1">Paper Title</label>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-lg"
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
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all resize-none"
                  placeholder="Provide a summary of your research..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conference Track</label>
                <select
                  required
                  value={track}
                  onChange={(e) => setTrack(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
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
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-brand-accent" />
                Primary Author
              </h2>
              <p className="text-sm text-brand-text/70 mb-4">
                Provide the primary (corresponding) author's details.
              </p>

              <div className="space-y-4">
                <div className="flex gap-4 items-center bg-white/50 p-4 rounded-xl border border-white/40">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="px-4 py-2 rounded-lg bg-white outline-none border border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="px-4 py-2 rounded-lg bg-white outline-none border border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      required
                      value={authorEmail}
                      onChange={(e) => setAuthorEmail(e.target.value)}
                      className="col-span-2 px-4 py-2 rounded-lg bg-white outline-none border border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                    />
                  </div>
                </div>
              </div>
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
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer group ${
                  file
                    ? 'border-green-500 bg-green-50'
                    : 'border-brand-accent/40 bg-brand-accent/5 hover:bg-brand-accent/10'
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

              <div className="flex items-center gap-2 text-sm text-brand-text/70 bg-white/50 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>I confirm that this submission complies with the IEEE formatting guidelines.</span>
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
