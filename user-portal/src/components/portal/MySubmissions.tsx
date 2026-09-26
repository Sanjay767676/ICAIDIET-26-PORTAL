import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Inbox,
  Loader2,
  Upload,
  ShieldCheck,
  ScanSearch,
  X,
  Pencil,
  XCircle,
  CreditCard,
  ExternalLink,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Popup, PopupInfo } from '../Popup';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

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
  author_type?: string | null;
  utr_transaction_id?: string | null;
  payment_proof_url?: string | null;
  payment_status?: string | null;
  payment_approved_at?: string | null;
  payment_submitted_at?: string | null;
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
  SUBMITTED: { label: 'Submitted', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  UNDER_REVIEW: { label: 'Under Review', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  READY_FOR_REGISTRATION: { label: 'Ready for Registration', cls: 'bg-green-100 text-green-800 border-green-300' },
  READY_FOR_CAMERA_READY: { label: 'Ready for Camera Ready', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
  ACCEPTED: { label: 'Accepted', cls: 'bg-green-100 text-green-800 border-green-300' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800 border-red-300' },
  REVISION_REQUIRED: { label: 'Revision Required', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
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
      cls: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function paymentBadge(sub: MySubmission) {
  const status = sub.payment_status;
  if (!status) return null;
  if (status === 'APPROVED') {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">
        Payment Confirmed
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
        Payment Declined
      </span>
    );
  }
  if (status === 'PENDING' || (sub.payment_proof_url && sub.utr_transaction_id)) {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
        Payment Submitted
      </span>
    );
  }
  return null;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
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
      ? 'Accepted'
      : 'Review Decision Available';
  const tone = decisionMeta?.box ?? 'bg-amber-50 border-amber-300';
  return (
    <div className={`mt-3 rounded-xl border p-3.5 ${tone}`}>
      <div className="flex items-center gap-2">
        {accepted ? (
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        ) : minor || major ? (
          <Pencil className="w-4 h-4 text-yellow-600 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
        )}
        <span className={`text-sm font-bold ${decisionMeta?.text ?? 'text-black'}`}>
          Review Status: {heading}
        </span>
      </div>
      {needsChanges && sub.review_feedback && (
        <p className="text-sm text-black/80 mt-2 leading-relaxed whitespace-pre-wrap">{sub.review_feedback}</p>
      )}
      {needsChanges && (
        <p className="text-xs text-black/60 mt-2">
          Please correct the paper based on the reviewer feedback, then use "Edit Files" to upload the revised
          files.
        </p>
      )}
      {sub.review_updated_at && (
        <p className="text-[11px] text-black/50 mt-1.5">Reviewer feedback · {formatDate(sub.review_updated_at)}</p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Payment Form Component
// ------------------------------------------------------------------
function isEarlyBird(): boolean {
  const now = new Date();
  const year = now.getFullYear();
  // Cutoff is Oct 24, 00:00:00 (month 9 is October in JavaScript Date)
  const lateCutoff = new Date(year, 9, 24, 0, 0, 0);
  return now < lateCutoff;
}

const REGISTRATION_FEES: Record<string, Record<string, { earlyBird: string; lateFee: string }>> = {
  'Indian Author': {
    'Conference alone': { earlyBird: '₹2,000', lateFee: '₹2,500' },
    'Conference with Scopus proceedings': { earlyBird: '₹10,000', lateFee: '₹11,000' },
  },
  'Foreign Author': {
    'Conference alone': { earlyBird: '$350', lateFee: '$400' },
    'Conference with Scopus proceedings': { earlyBird: '$400', lateFee: '$500' },
  },
  'Industry Delegate/Research Scholar': {
    'Conference alone': { earlyBird: '₹2,500', lateFee: '₹3,000' },
    'Conference with Scopus proceedings': { earlyBird: '₹12,000', lateFee: '₹13,000' },
  },
};

// The registration / payment form for one specific paper. Rendered by
// RegistrationForm below, which is responsible for choosing WHICH paper it
// applies to. resetKey changes whenever the author picks a different paper in
// the picker, and resets every field so values never carry across papers.
function RegistrationFormBody({
  sub,
  resetKey,
  getToken,
  onSaved,
}: {
  sub: MySubmission;
  resetKey: string;
  getToken: () => Promise<string | null>;
  onSaved: () => void;
}) {
  const [type, setType] = useState(sub.registration_type || '');
  const [authorType, setAuthorType] = useState(sub.author_type || '');
  const [utr, setUtr] = useState(sub.utr_transaction_id || '');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSubmitted, setEditingSubmitted] = useState(false);

  useEffect(() => {
    setType(sub.registration_type || '');
    setAuthorType(sub.author_type || '');
    setUtr(sub.utr_transaction_id || '');
    setFile(null);
    setError(null);
    setEditingSubmitted(false);
    setLoading(false);
  }, [resetKey]);

  // 1. APPROVED STATUS
  if (sub.payment_status === 'APPROVED') {
    return (
      <div className="p-6 bg-green-50 border-2 border-green-300 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-green-200">
          <div className="flex items-center gap-2.5 text-green-900 font-bold text-lg">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
            <span>Registration Complete!</span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-200 text-green-900 border border-green-400">
            Payment Approved
          </span>
        </div>

        <p className="text-sm text-green-800 leading-relaxed font-medium">
          Your payment has been successfully verified by the conference administration and your registration is confirmed.
        </p>

        <div className="bg-white/80 border border-green-200 rounded-xl p-4 text-sm text-black space-y-2">
          {sub.registration_type && (
            <div className="flex justify-between flex-wrap gap-1">
              <span className="text-black/60 font-medium">Registration Type:</span>
              <span className="font-bold text-black">{sub.registration_type}</span>
            </div>
          )}
          {sub.author_type && (
            <div className="flex justify-between flex-wrap gap-1">
              <span className="text-black/60 font-medium">Author Type:</span>
              <span className="font-bold text-black">{sub.author_type}</span>
            </div>
          )}
          {sub.utr_transaction_id && (
            <div className="flex justify-between flex-wrap gap-1">
              <span className="text-black/60 font-medium">UTR / Transaction ID:</span>
              <span className="font-mono font-bold text-brand-accent">{sub.utr_transaction_id}</span>
            </div>
          )}
          {sub.payment_approved_at && (
            <div className="flex justify-between flex-wrap gap-1 text-xs text-black/50 border-t border-green-100 pt-2">
              <span>Approved On:</span>
              <span>{formatDate(sub.payment_approved_at)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const hasSubmitted = !!(sub.payment_proof_url && sub.utr_transaction_id);
  const isRejected = sub.payment_status === 'REJECTED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) {
      setError('Please select a registration type.');
      return;
    }
    if (!authorType) {
      setError('Please select an author type.');
      return;
    }
    if (file && file.size > MAX_FILE_SIZE) {
      setError('The proof file must be 10MB or smaller.');
      return;
    }
    if (isRejected) {
      if (!file) {
        setError('Please upload a new, corrected payment proof after your payment was declined.');
        return;
      }
    } else if (!file && !sub.payment_proof_url) {
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

      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const fileRes = await fetch(`${API_URL}/api/user/submissions/${sub.id}/payment-proof`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const fileData = await fileRes.json().catch(() => null);
        if (!fileRes.ok || !fileData?.success) throw new Error(fileData?.error || 'Failed to upload proof.');
      }

      const regRes = await fetch(`${API_URL}/api/user/submissions/${sub.id}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_type: type,
          author_type: authorType,
          utr_transaction_id: utr.trim(),
        }),
      });
      const regData = await regRes.json().catch(() => null);
      if (!regRes.ok || !regData?.success) throw new Error(regData?.error || 'Failed to save registration details.');

      setEditingSubmitted(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // 2. SUBMITTED AND PENDING VERIFICATION (unless user clicks edit)
  if (hasSubmitted && !isRejected && !editingSubmitted) {
    return (
      <div className="p-6 bg-blue-50 border-2 border-blue-300 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-blue-200">
          <div className="flex items-center gap-2.5 text-blue-950 font-bold text-lg">
            <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
            <span>Payment Submitted</span>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-200 text-blue-900 border border-blue-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Awaiting Verification
          </span>
        </div>

        <p className="text-sm text-blue-900 leading-relaxed font-medium">
          Your payment details and proof screenshot have been received and are currently being verified by the admin team.
        </p>

        <div className="bg-white/90 border border-blue-200 rounded-xl p-4 text-sm text-black space-y-2.5">
          <div className="flex justify-between flex-wrap gap-1">
            <span className="text-black/60 font-medium">Live Status:</span>
            <span className="font-bold text-blue-700">Verification in Progress</span>
          </div>
          {sub.registration_type && (
            <div className="flex justify-between flex-wrap gap-1">
              <span className="text-black/60 font-medium">Registration Type:</span>
              <span className="font-bold text-black">{sub.registration_type}</span>
            </div>
          )}
          {sub.author_type && (
            <div className="flex justify-between flex-wrap gap-1">
              <span className="text-black/60 font-medium">Author Type:</span>
              <span className="font-bold text-black">{sub.author_type}</span>
            </div>
          )}
          {sub.utr_transaction_id && (
            <div className="flex justify-between flex-wrap gap-1">
              <span className="text-black/60 font-medium">UTR / Transaction ID:</span>
              <span className="font-mono font-bold text-brand-accent">{sub.utr_transaction_id}</span>
            </div>
          )}
          {sub.payment_submitted_at && (
            <div className="flex justify-between flex-wrap gap-1 text-xs text-black/50 border-t border-blue-100 pt-2">
              <span>Submitted On:</span>
              <span>{formatDate(sub.payment_submitted_at)}</span>
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setEditingSubmitted(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-300 text-blue-800 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit / Resubmit Details
          </button>
        </div>
      </div>
    );
  }

  // 3. DECLINED OR INITIAL FORM (OR EDITING SUBMITTED)
  return (
    <div className="space-y-4">
      {/* 3a. DECLINED BANNER */}
      {isRejected && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
            <div className="flex items-center gap-2 text-red-900 font-bold text-base">
              <XCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>Payment Declined — Please Verify Your Payment</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-red-200 text-red-900 border border-red-300">
              Declined
            </span>
          </div>
          <p className="text-sm text-red-700 leading-relaxed">
            Your previously submitted payment could not be verified. Please verify your payment details and re-upload the correct payment proof below.
          </p>
        </div>
      )}

      {/* 3b. EDITING NOTICE */}
      {editingSubmitted && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <span>You are editing your previously submitted payment details.</span>
          <button
            type="button"
            onClick={() => setEditingSubmitted(false)}
            className="font-bold underline hover:text-amber-950 text-xs"
          >
            Cancel
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border border-brand-accent/30 rounded-2xl p-6 sm:p-7 bg-brand-bg/20 shadow-sm space-y-6">
        <div className="border-b border-brand-accent/20 pb-3">
          <h3 className="text-2xl font-bold font-serif text-brand-text">Payment Form</h3>
        </div>

        {/* Step 1: Registration Type */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-black/90">
            Registration Type <span className="text-red-500">*</span>
          </label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
            }}
            className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 text-sm font-medium text-black transition-all"
            disabled={loading}
          >
            <option value="">-- Select Registration Type --</option>
            <option value="Conference alone">Conference alone</option>
            <option value="Conference with Scopus proceedings">Conference with Scopus proceedings</option>
          </select>
        </div>

        {/* Step 2: Author Type (Shown after completing registration type) */}
        {type && (
          <div className="space-y-2 animate-fadeIn">
            <label className="block text-sm font-bold text-black/90">
              Author Type <span className="text-red-500">*</span>
            </label>
            <select
              value={authorType}
              onChange={(e) => {
                setAuthorType(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 text-sm font-medium text-black transition-all"
              disabled={loading}
            >
              <option value="">-- Select Author Type --</option>
              <option value="Indian Author">Indian Author</option>
              <option value="Foreign Author">Foreign Author</option>
              <option value="Industry Delegate/Research Scholar">Industry Delegate/Research Scholar</option>
            </select>
          </div>
        )}

        {/* Step 3: Fee Details & Bank Info & Upload (Shown after completing author type) */}
        {type && authorType && (
          <div className="space-y-6 animate-fadeIn pt-2 border-t border-stone-200">
            {/* Dynamic Fee details card */}
            {REGISTRATION_FEES[authorType]?.[type] && (() => {
              const early = isEarlyBird();
              const fee = REGISTRATION_FEES[authorType][type];
              const activeAmount = early ? fee.earlyBird : fee.lateFee;
              const activeLabel = early ? 'Early registration' : 'Standard / late fee';

              return (
                <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-200 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
                        Applicable Fee
                      </span>
                      <span className="text-sm font-bold text-black">{authorType} • {type}</span>
                    </div>
                    <a
                      href="https://www.icaidiet26.tech/registration-fee"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-accent hover:underline"
                    >
                      Fee Schedule <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-base font-bold text-black flex items-center gap-2">
                        <span>{activeLabel}</span>
                        {early ? (
                          <span className="text-[11px] bg-green-100 text-green-800 border border-green-300 px-2 py-0.5 rounded-full font-semibold">
                            Early Bird till Oct 23
                          </span>
                        ) : (
                          <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-semibold">
                            Standard Fee (From Oct 24)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-black/60 mt-0.5">
                        {early
                          ? `Standard / late fee after Oct 23: ${fee.lateFee}`
                          : `Early registration ended on Oct 23`}
                      </div>
                    </div>
                    <div className="text-3xl font-bold font-mono text-brand-text">
                      {activeAmount}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Bank details */}
            <div className="bg-stone-50 border border-stone-300 p-4 rounded-xl text-sm text-black/90 font-mono leading-relaxed shadow-inner">
              <div className="font-bold text-xs uppercase tracking-wider text-black/60 mb-2 font-sans">
                Bank Transfer Details
              </div>
              <p><span className="font-semibold text-black">Account number:</span> 5904946502</p>
              <p><span className="font-semibold text-black">IFSC Code:</span> CBIN0281361 [Crosscut Road,CBE]</p>
              <p><span className="font-semibold text-black">Beneficiary Name:</span> SNSCT CH4 CS</p>
              <p><span className="font-semibold text-black">Bank Name:</span> CENTRAL BANK OF INDIA</p>
            </div>

            {/* Payment Proof Upload */}
            <div>
              <label className="block text-sm font-bold text-black/90 mb-1.5">
                Upload Payment Proof (Screenshot / PDF) <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-brand-text file:text-white hover:file:bg-brand-accent file:cursor-pointer transition-colors"
                disabled={loading}
              />
              {sub.payment_proof_url && !file && (
                <p className="text-xs text-green-700 font-medium mt-1">✓ A payment proof file has already been uploaded.</p>
              )}
            </div>

            {/* UTR / Transaction ID */}
            <div>
              <label className="block text-sm font-bold text-black/90 mb-1.5">
                UTR / RRN / Transaction ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="Enter Transaction ID / UTR number"
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 text-sm font-medium text-black transition-all"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-text text-white rounded-xl font-bold text-base hover:bg-brand-accent transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
                </>
              ) : (
                'Submit Payment Details'
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

// Mirrors registrationEligible() in backend/src/index.ts: a paper is payable
// once the admin has moved it to an accepted status. Single source of truth so
// the picker can never offer a paper whose payment form is hidden.
function isPayablePaper(sub: MySubmission) {
  return (
    sub.status === 'ACCEPTED' ||
    sub.status === 'READY_FOR_REGISTRATION' ||
    sub.status === 'READY_FOR_CAMERA_READY'
  );
}

// A paper leaves the picker once its money is either approved or sitting with
// the admin awaiting verification - paying twice for the same paper is exactly
// the confusion this picker exists to prevent. Declined payments stay
// selectable so the author can correct and resubmit.
function isStillPayable(sub: MySubmission) {
  return isPayablePaper(sub) && sub.payment_status !== 'APPROVED' && sub.payment_status !== 'PENDING';
}

// Payment form wrapper. Authors with more than one accepted paper pick which
// one this payment settles, so the amount received always maps to one paper.
// The inner form is keyed on the chosen id so switching papers resets the
// registration type, UTR and uploaded file instead of carrying them across.
function RegistrationForm({
  sub,
  payable,
  totalPapers,
  getToken,
  onSaved,
}: {
  sub: MySubmission;
  payable: MySubmission[];
  totalPapers: number;
  getToken: () => Promise<string | null>;
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState(sub.id);
  const active = payable.find((p) => p.id === selectedId) || sub;

  // The chooser only makes sense while the paper being shown is itself still
  // payable. Once it is PENDING or APPROVED the body below renders a status
  // panel for that specific paper, and putting a selector or a label naming a
  // different paper above it would contradict what is on screen. Deriving this
  // from the payable list also keeps the <select> value guaranteed-valid.
  const activeIsPayable = payable.some((p) => p.id === active.id);

  // Single accepted paper: state it plainly rather than showing a one-option
  // dropdown. Only reachable when the author submitted more than one paper,
  // which is the case where "which paper is this for?" is genuinely ambiguous.
  const showStaticLabel = activeIsPayable && payable.length === 1 && totalPapers > 1;
  const showPicker = activeIsPayable && payable.length > 1;

  return (
    <div className="space-y-4">
      {showPicker && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl">
          <label
            htmlFor="payment-paper-select"
            className="block text-sm font-bold text-amber-900 mb-1"
          >
            Which paper is this payment for?
          </label>
          <p className="text-xs text-amber-800 mb-2.5 leading-relaxed">
            You have {payable.length} accepted papers awaiting payment. Choose one - the
            registration fee and payment proof you enter below apply only to the paper you
            select, and it drops off this list once the payment is submitted.
          </p>
          <select
            id="payment-paper-select"
            value={active.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border-2 border-amber-300 bg-white text-sm text-black shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
          >
            {payable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-amber-700/80 mt-2 font-mono">
            {active.submission_code}
            {active.paper_id ? ` / Paper ${active.paper_id}` : ''}
          </p>
        </div>
      )}

      {showStaticLabel && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl">
          <p className="text-sm font-bold text-amber-900 mb-1">Paper being paid for</p>
          <p className="text-sm text-amber-900 leading-snug">{payable[0].title}</p>
          <p className="text-[11px] text-amber-700/80 mt-1.5 font-mono">
            {payable[0].submission_code}
            {payable[0].paper_id ? ` / Paper ${payable[0].paper_id}` : ''}
          </p>
        </div>
      )}

      <RegistrationFormBody
        sub={active}
        resetKey={active.id}
        getToken={getToken}
        onSaved={onSaved}
      />
    </div>
  );
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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

export function MySubmissions({
  getToken,
  onBack,
  onStart,
  maintenanceMode = false,
  maintenanceUntil = null,
  registrationOpen = false,
}: MySubmissionsProps) {
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MySubmission | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [expandedPaymentIds, setExpandedPaymentIds] = useState<Record<string, boolean>>({});

  // Accepted papers this author can still pay for. Papers already approved or
  // awaiting verification drop off, so the picker only ever offers a paper
  // that genuinely needs money against it.
  const payableSubs = useMemo(
    () => (subs || []).filter(isStillPayable),
    [subs]
  );

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
    loadSubmissions();
  }, [loadSubmissions]);

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

  const togglePayment = (id: string) => {
    setExpandedPaymentIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
        <div className="space-y-8">
          {subs.map((sub) => {
            const isSubAccepted = isPayablePaper(sub);
            const isPaymentOpen =
              expandedPaymentIds[sub.id] ||
              !!sub.payment_proof_url ||
              sub.payment_status === 'APPROVED';

            return (
              <div key={sub.id} className="space-y-4">
                {/* Top Box (Paper Card Layout matching Excalidraw mockup) */}
                <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-yellow-400 text-black">
                  {/* Top row: Title & Authors on Left, Paper Status on Right */}
                  <div className="flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-stone-200">
                    <div className="min-w-0 max-w-2xl">
                      <h3 className="font-serif text-xl sm:text-2xl font-bold leading-tight text-black">
                        {sub.title}
                      </h3>
                      <div className="text-sm font-medium text-black/70 mt-1.5 flex flex-wrap items-center gap-2">
                        <span>{sub.author_name || 'Author'}</span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs bg-stone-100 px-2.5 py-0.5 rounded-md font-mono text-stone-700">
                          {sub.paper_id || sub.submission_code}
                        </span>
                        {sub.author_count ? (
                          <>
                            <span className="text-stone-300">•</span>
                            <span className="text-xs text-black/60">Authors: {sub.author_count}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(sub.status)}
                      {paymentBadge(sub)}
                    </div>
                  </div>

                  {sub.abstract && (
                    <p className="text-sm text-black/80 mt-4 leading-relaxed line-clamp-3 font-normal">
                      {sub.abstract}
                    </p>
                  )}

                  {/* Uploaded files summary */}
                  <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 p-3.5 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-xs text-black/60 uppercase tracking-wide font-semibold mb-2">
                      <Upload className="w-3.5 h-3.5 text-brand-accent" /> Paper Uploads
                    </div>
                    {[
                      { label: 'Manuscript', ok: !!sub.manuscript_file, name: sub.manuscript_file },
                      { label: 'Plagiarism Report', ok: !!sub.plagiarism_file, name: sub.plagiarism_file },
                      { label: 'AI Plagiarism Report', ok: !!sub.ai_plagiarism_file, name: sub.ai_plagiarism_file },
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
                        <span className="text-xs text-black/50 truncate max-w-[50%]">
                          {f.ok ? f.name : 'Not uploaded'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Bottom row: Review Status on Left, Edit Files on Right */}
                  <div className="mt-4 pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-stone-100">
                    <div className="flex-1 min-w-0">
                      {reviewBanner(sub) || (
                        <div className="text-xs text-black/60 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-stone-400" />
                          <span>Review Status: <span className="font-semibold text-black/80">Pending Review</span></span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {!maintenanceMode && (
                        <button
                          onClick={() => setEditing(sub)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-text hover:bg-brand-accent transition-all shadow-sm hover:shadow"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit Files
                        </button>
                      )}
                    </div>
                  </div>

                  {maintenanceMode && (
                    <div className="mt-3 text-xs text-yellow-800 bg-yellow-50 border border-yellow-300 rounded-lg p-2.5">
                      File updates are disabled during maintenance.
                      {maintenanceUntil
                        ? <> Expected back online {new Date(maintenanceUntil).toLocaleString()}.</>
                        : null}
                    </div>
                  )}
                </div>

                {/* Bottom Box (Accepted Callout Card & Payment Form matching Excalidraw mockup) */}
                {isSubAccepted && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-yellow-400 text-center flex flex-col items-center">
                      <h4 className="text-xl sm:text-2xl font-bold font-serif text-brand-text mb-2">
                        Congratulations Your Paper is Accepted
                      </h4>
                      <p className="text-sm sm:text-base text-black/80 max-w-2xl mx-auto leading-relaxed mb-6 font-normal">
                        Please complete the payment as soon as possible because we accept a limited number of papers. Registration operates on a first-come, first-served basis.
                      </p>
                      {!isPaymentOpen ? (
                        <button
                          type="button"
                          onClick={() => togglePayment(sub.id)}
                          className="inline-flex items-center gap-2 px-8 py-3.5 bg-brand-text text-white rounded-xl font-bold text-sm sm:text-base hover:bg-brand-accent transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                        >
                          <CreditCard className="w-4 h-4" /> Complete Your payment <ChevronRight className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>

                    {/* Payment Form (Progressive Disclosure) */}
                    {isPaymentOpen && (
                      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border-2 border-yellow-400 text-black animate-fadeIn">
                        {registrationOpen || sub.payment_status === 'APPROVED' ? (
                          <RegistrationForm
                            sub={sub}
                            payable={payableSubs}
                            totalPapers={subs.length}
                            getToken={getToken}
                            onSaved={loadSubmissions}
                          />
                        ) : (
                          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                            Registration &amp; payment for accepted papers will open soon. Please check back here.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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