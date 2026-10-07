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
  ChevronRight,
  AlertCircle,
  Info
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
  // Snapshotted by the backend at registration time, so the amount the author
  // was charged stays on record even after an admin edits the fee matrix.
  fee_amount?: string | null;
  fee_tier?: string | null;
}

export interface BankAccount {
  id: string;
  account_number: string;
  ifsc: string;
  branch: string;
  beneficiary: string;
  bank_name: string;
  show_in_portal: boolean;
}

export interface RegistrationConfig {
  early_bird_until: string;
  fees: Record<string, Record<string, { early: string; standard: string }>>;
  bank?: Record<string, string>;
  banks?: BankAccount[];
}

interface MySubmissionsProps {
  getToken: () => Promise<string | null>;
  onBack: () => void;
  onStart: () => void;
  maintenanceMode?: boolean;
  maintenanceUntil?: string | null;
  registrationOpen?: boolean;
  registration?: RegistrationConfig | null;
  fileEditsEnabled?: boolean;
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
// Registration configuration
//
// Fees, the early-bird cutoff and the bank details all come from the backend
// (GET /api/settings -> `registration`), which the admin edits in the dashboard.
// The keys of `fees` double as the options in the registration and author type
// selects, so adding a fee row in the admin portal adds a choice here with no
// code change.
//
// FALLBACK below is only reached if the settings request itself failed. The
// backend always returns a parsed, default-merged `registration` object, so a
// successful response never uses it. It exists so a network blip does not hide
// the amount from an author who is about to transfer money, and it mirrors
// DEFAULT_REGISTRATION_CONFIG in backend/src/index.ts -- change one, change the
// other.
//
// It is a last-resort display fallback ONLY. The amount an author actually
// agrees to and that gets recorded comes from GET /api/registration/fee at the
// moment they pick a registration type, so a stale fallback can never become
// the price on a payment record.
// ------------------------------------------------------------------
const FALLBACK_REGISTRATION: RegistrationConfig = {
  early_bird_until: '2026-10-10',
  fees: {
    'Indian Author': {
      'Conference alone': { early: '₹2,000', standard: '₹2,500' },
      'Conference with Scopus proceedings': { early: '₹10,000', standard: '₹11,000' },
    },
    'Foreign Author': {
      'Conference alone': { early: '$350', standard: '$400' },
      'Conference with Scopus proceedings': { early: '$400', standard: '$500' },
    },
    'Industry Delegate/Research Scholar': {
      'Conference alone': { early: '₹2,500', standard: '₹3,000' },
      'Conference with Scopus proceedings': { early: '₹12,000', standard: '₹13,000' },
    },
  },
  bank: {
    account_number: '5904946502',
    ifsc: 'CBIN0281361',
    branch: 'Crosscut Road, CBE',
    beneficiary: 'SNSCT CH4 CS',
    bank_name: 'CENTRAL BANK OF INDIA',
  },
  banks: [
    {
      id: 'default',
      account_number: '5904946502',
      ifsc: 'CBIN0281361',
      branch: 'Crosscut Road, CBE',
      beneficiary: 'SNSCT CH4 CS',
      bank_name: 'CENTRAL BANK OF INDIA',
      show_in_portal: true
    }
  ]
};

function useRegistrationConfig(registration?: RegistrationConfig | null): RegistrationConfig {
  return useMemo(() => {
    if (!registration || !registration.fees || Object.keys(registration.fees).length === 0) {
      return FALLBACK_REGISTRATION;
    }
    const banks = registration.banks || (registration.bank && Object.keys(registration.bank).length > 0 ? [{
      id: 'legacy',
      account_number: registration.bank.account_number || '',
      ifsc: registration.bank.ifsc || '',
      branch: registration.bank.branch || '',
      beneficiary: registration.bank.beneficiary || '',
      bank_name: registration.bank.bank_name || '',
      show_in_portal: true
    }] : []);
    
    return {
      early_bird_until: registration.early_bird_until || '',
      fees: registration.fees,
      bank: registration.bank || {},
      banks,
    };
  }, [registration]);
}

// Today's date as YYYY-MM-DD in the author's own timezone. Compared as a string
// against the admin's cutoff, which keeps the comparison free of timezone and
// clock-time drift -- the old version compared against a local-midnight Date and
// so flipped an hour early for anyone east of UTC.
function todayCalendarDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// The cutoff is an INCLUSIVE date on which early bird still applies, so
// standard pricing begins the following day. Whether an author is inside the
// window is decided server-side (the Worker owns the fee matrix) and arrives as
// fee_tier; nothing here re-derives it from a date, because that is what let
// the card and the recorded amount disagree.
function formatCutoffDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const parsed = new Date(`${value}T00:00:00`);
  return isNaN(parsed.getTime())
    ? ''
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// The registration / payment form for one specific paper. Rendered by
// RegistrationForm below, which is responsible for choosing WHICH paper it
// applies to. resetKey changes whenever the author picks a different paper in
// the picker, and resets every field so values never carry across papers.
function RegistrationFormBody({
  sub,
  resetKey,
  getToken,
  onSaved,
  config,
}: {
  sub: MySubmission;
  resetKey: string;
  getToken: () => Promise<string | null>;
  onSaved: () => void;
  config: RegistrationConfig;
}) {
  const [type, setType] = useState(sub.registration_type || '');
  const [authorType, setAuthorType] = useState(sub.author_type || '');
  const [utr, setUtr] = useState(sub.utr_transaction_id || '');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSubmitted, setEditingSubmitted] = useState(false);
  // The price the server quoted for the currently selected pair, fetched fresh
  // on every selection change. Null until it arrives, and deliberately NOT
  // seeded from `config`: the config was fetched once when the app mounted, so
  // it can be arbitrarily stale, and a stale number is exactly the
  // miscommunication this replaces.
  const [liveFee, setLiveFee] = useState<{
    amount: string;
    tier: 'EARLY' | 'STANDARD';
    otherAmount: string;
    cutoff: string;
  } | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  // The author must tick this before submitting, so the amount on the record is
  // something they affirmatively agreed to rather than something inferred.
  const [confirmedPaid, setConfirmedPaid] = useState(false);
  // Set while the picked screenshot is being re-encoded, and used afterwards to
  // tell the author their file was shrunk before it was sent.
  const [compressing, setCompressing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setType(sub.registration_type || '');
    setAuthorType(sub.author_type || '');
    setUtr(sub.utr_transaction_id || '');
    setFile(null);
    setError(null);
    setLiveFee(null);
    setFeeError(null);
    setConfirmedPaid(false);
    setEditingSubmitted(false);
    setLoading(false);
    setCompressing(false);
    setNotice(null);
  }, [resetKey]);

  // The options are the keys of the admin-editable fee matrix, so the choices
  // an author can make are exactly the ones the admin priced. Registration
  // types are the union across author types, since the author picks the
  // registration type first.
  const authorTypeOptions = useMemo(() => Object.keys(config.fees), [config.fees]);
  const registrationTypeOptions = useMemo(() => {
    const all = new Set<string>();
    for (const tiers of Object.values(config.fees)) {
      for (const regType of Object.keys(tiers || {})) all.add(regType);
    }
    return Array.from(all);
  }, [config.fees]);

  // Ask the server what this exact pair costs, every time the selection
  // changes. The config object on the props was fetched once when the app
  // mounted, so reading a price out of it is what produced the "page says
  // ₹10,000, admin had already moved it" confusion. One request per selection,
  // no polling, and the number shown next to the bank details is the same one
  // the submit path will record.
  useEffect(() => {
    let cancelled = false;
    if (!type || !authorType) {
      setLiveFee(null);
      setFeeError(null);
      return;
    }
    setLiveFee(null);
    setFeeError(null);
    setConfirmedPaid(false);

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(
          `${API_URL}/api/registration/fee?authorType=${encodeURIComponent(authorType)}&registrationType=${encodeURIComponent(type)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setFeeError(data?.error || 'Could not load the current fee for this registration type.');
          return;
        }
        setLiveFee({
          amount: data.fee_amount,
          tier: data.fee_tier,
          otherAmount: data.other_amount || '',
          cutoff: data.early_bird_until || '',
        });
      } catch {
        if (!cancelled) setFeeError('Could not load the current fee. Please check your connection and try again.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [type, authorType, getToken]);

  // Hide the block entirely rather than print a heading over nothing
  const visibleBanks = (config.banks || []).filter(b => b.show_in_portal);
  const hasBankDetails = visibleBanks.length > 0;

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

  const submitRegistration = async () => {
    if (!type) {
      setError('Please select a registration type.');
      return;
    }
    if (!authorType) {
      setError('Please select an author type.');
      return;
    }
    // No price could be fetched, or the one on offer vanished. Either way the
    // author must not be asked to confirm an amount we cannot state.
    if (!liveFee) {
      setError(feeError || 'Please wait for the fee to load, or pick another registration type.');
      return;
    }
    if (!confirmedPaid) {
      setError('Please confirm you have paid the amount shown above.');
      return;
    }
    if (file && file.size > MAX_PAYMENT_PROOF_SIZE) {
      setError('The proof file must be 4MB or smaller. Please crop or screenshot the receipt again.');
      return;
    }
    if (isRejected) {
      // The declined proof is still stored on the submission, so
      // `!sub.payment_proof_url` can never be true here -- checking it made this
      // branch unreachable, and the banner told the author to re-upload a
      // corrected proof without the form actually requiring one. Require the
      // new file outright, which is both what the banner promises and what
      // keeps a proof the admin already refused from being resubmitted as-is.
      if (!file) {
        setError('Please upload a new, corrected payment proof before resubmitting.');
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
    setNotice(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');

      if (file) {
        // Shrink an oversized screenshot before sending it, so the text in it
        // can actually be read back for the duplicate check.
        let uploadFile = file;
        if (file.size > OCR_PROOF_TARGET_BYTES && file.type !== 'application/pdf') {
          setCompressing(true);
          try {
            uploadFile = await compressProofForOcr(file);
          } finally {
            setCompressing(false);
          }
          if (uploadFile !== file) {
            setNotice(
              `Your screenshot was reduced from ${(file.size / 1024 / 1024).toFixed(1)}MB to ` +
                `${Math.max(0.1, uploadFile.size / 1024 / 1024).toFixed(1)}MB so the transfer details can be read ` +
                `automatically. The admin still sees the full receipt.`
            );
          }
        }

        const formData = new FormData();
        formData.append('file', uploadFile);

        const fileRes = await fetch(`${API_URL}/api/user/submissions/${sub.id}/payment-proof`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const fileData = await fileRes.json().catch(() => null);
        if (!fileRes.ok || !fileData?.success) throw new Error(fileData?.error || 'Failed to upload proof.');
        // The proof is stored now. Clearing it stops a re-confirm from uploading
        // the same image a second time and orphaning the first R2 object.
        setFile(null);
      }

      // fee_amount/fee_tier is the server-quoted price from the selection-time
      // fetch above, which the author explicitly confirmed. The backend still
      // re-checks it against the admin fee matrix and falls back to its own
      // resolution if it no longer matches, so a hand-rolled request still
      // cannot claim a cheaper early-bird price.
      const regRes = await fetch(`${API_URL}/api/user/submissions/${sub.id}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_type: type,
          author_type: authorType,
          utr_transaction_id: utr.trim(),
          fee_amount: liveFee.amount,
          fee_tier: liveFee.tier,
        }),
      });
      const regData = await regRes.json().catch(() => null);

      // Last-resort guard for the narrow window where the admin repriced between
      // the selection-time fetch and this submit. Nothing is written on this
      // path; re-fetch the live price and let the author confirm the new one.
      if (regRes.status === 409 && regData?.code === 'FEE_CHANGED') {
        setError('The fee changed a moment ago. The form has been refreshed with the current amount — please review it and confirm again.');
        setLiveFee(prev => prev ? { ...prev, amount: regData.current_amount, tier: regData.current_tier } : { amount: regData.current_amount, tier: regData.current_tier, otherAmount: '', cutoff: '' });
        setConfirmedPaid(false);
        return;
      }

      if (!regRes.ok || !regData?.success) throw new Error(regData?.error || 'Failed to save registration details.');

      setEditingSubmitted(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitRegistration();
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
            {registrationTypeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
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
              {authorTypeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}

        {/* Step 3: Fee Details & Bank Info & Upload (Shown after completing author type) */}
        {type && authorType && (
          <div className="space-y-6 animate-fadeIn pt-2 border-t border-stone-200">
            {/* Fee details. Every figure and the deadline date come from the live
                server response for the selected pair -- never from the mount-time
                config -- so what the author reads is what gets recorded. Nothing
                is rendered until that arrives, which is why there is no
                placeholder amount to briefly contradict it. */}
            {liveFee && (() => {
              const isEarlyTier = liveFee.tier === 'EARLY';
              // Both the deadline and the fee that replaces it are the admin's
              // own values, returned by the same call as the amount.
              const liveCutoff = formatCutoffDate(liveFee.cutoff);

              return (
                <div className="bg-amber-50/90 border-2 border-amber-300/80 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-amber-200 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2.5 py-0.5 rounded-full">
                        Applicable Fee
                      </span>
                      <span className="text-sm font-bold text-black">{authorType} • {type}</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-base font-bold text-black flex items-center gap-2 flex-wrap">
                        <span>{isEarlyTier ? 'Early registration' : 'Standard / late fee'}</span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${
                            isEarlyTier
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          {isEarlyTier ? 'Early Bird' : 'Standard Fee'}
                        </span>
                      </div>
                      <div className="text-xs text-black/70 mt-1 leading-relaxed">
                        {isEarlyTier ? (
                          <>
                            Late fee of{' '}
                            <span className="font-bold text-black">{liveFee.otherAmount}</span> will be
                            applicable after{' '}
                            <span className="font-bold text-black">{liveCutoff}</span>.
                          </>
                        ) : (
                          <>
                            Early bird fee of{' '}
                            <span className="font-bold text-black">{liveFee.otherAmount}</span> ended on{' '}
                            <span className="font-bold text-black">{liveCutoff}</span>.
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-3xl font-bold font-mono text-brand-text">
                      {liveFee.amount}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Bank details */}
            {hasBankDetails && (
              <div className="space-y-4">
                <div className="font-bold text-xs uppercase tracking-wider text-black/60 font-sans px-2">
                  Bank Transfer Details
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleBanks.map(bank => (
                    <div key={bank.id} className="bg-stone-50 border border-stone-300 p-4 rounded-xl text-sm text-black/90 font-mono leading-relaxed shadow-inner space-y-1">
                      {bank.account_number && (
                        <p><span className="font-semibold text-black">Account number:</span> {bank.account_number}</p>
                      )}
                      {bank.ifsc && (
                        <p>
                          <span className="font-semibold text-black">IFSC Code:</span> {bank.ifsc}
                          {bank.branch ? ` [${bank.branch}]` : ''}
                        </p>
                      )}
                      {bank.beneficiary && (
                        <p><span className="font-semibold text-black">Beneficiary Name:</span> {bank.beneficiary}</p>
                      )}
                      {bank.bank_name && (
                        <p><span className="font-semibold text-black">Bank Name:</span> {bank.bank_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              {file && file.size > MAX_PAYMENT_PROOF_SIZE && (
                <p className="text-xs text-red-600 font-medium mt-1">
                  That file is {Math.round((file.size / 1024 / 1024) * 10) / 10}MB. The limit is 4MB — please use a
                  screenshot of the receipt rather than a camera photo.
                </p>
              )}
              {sub.payment_proof_url && !file && (
                <p className="text-xs text-green-700 font-medium mt-1">✓ A payment proof file has already been uploaded.</p>
              )}
              <p className="text-xs text-black/50 mt-1">
                JPG, PNG, WebP or PDF, up to 4MB. The text in your screenshot is read automatically so we can confirm the
                transfer.
              </p>
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

            {/* The amount the author is affirming, fetched from the server when
                they picked this registration type. Sits directly under the UTR
                field so the last thing they read before submitting is the number
                they are agreeing to have recorded. */}
            {feeError && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" /> {feeError}
              </div>
            )}

            {liveFee && (
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors ${
                  confirmedPaid
                    ? 'bg-green-50 border-green-400'
                    : 'bg-yellow-50 border-yellow-400 cursor-pointer hover:bg-yellow-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={confirmedPaid}
                  onChange={(e) => setConfirmedPaid(e.target.checked)}
                  disabled={loading}
                  className="mt-0.5 w-5 h-5 shrink-0 accent-green-600 cursor-pointer"
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-bold text-black">
                    I confirm I have paid {liveFee.amount}
                  </span>
                  <span className="text-black/80">
                    {' '}
                    for this registration
                    {liveFee.tier === 'EARLY' ? ' (early-bird rate)' : ' (standard rate)'} and that the
                    details above are correct.
                  </span>
                </span>
              </label>
            )}

            {notice && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-sm font-medium">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" /> {notice}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || compressing || !liveFee || !confirmedPaid}
              className="w-full py-3 bg-brand-text text-white rounded-xl font-bold text-base hover:bg-brand-accent transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading || compressing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {compressing && !loading ? 'Preparing screenshot...' : 'Submitting...'}
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
  config,
}: {
  sub: MySubmission;
  payable: MySubmission[];
  totalPapers: number;
  getToken: () => Promise<string | null>;
  onSaved: () => void;
  config: RegistrationConfig;
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
        config={config}
      />
    </div>
  );
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Payment proofs are capped tighter than manuscripts. They are bank-app
// screenshots, so anything near 10 MB is a camera photo rather than a receipt
// screenshot; 4 MB is comfortably above a real screenshot and keeps each proof
// cheap to store and to read back with OCR. Must match PAYMENT_PROOF_MAX_BYTES
// in backend/src/index.ts, which enforces the same ceiling server-side.
const MAX_PAYMENT_PROOF_SIZE = 4 * 1024 * 1024; // 4 MB

// ------------------------------------------------------------------
// Payment-proof compression.
//
// OCR.space's free plan refuses anything over 1 MB, and the text it reads out
// of the screenshot is the only thing that can catch an author reusing someone
// else's receipt with a made-up UTR. So any image above that ceiling is
// re-encoded in the browser before it is sent: a 1600px receipt screenshot is
// still comfortably legible to a human reading it and to OCR reading it, but it
// fits the free key.
//
// Must stay at or below OCR_MAX_BYTES in backend/src/paymentOcr.ts. Kept at
// 1 MB rather than matching the 1.5 MB the free key technically allows, so the
// file lands clear of the boundary and a receipt stays small enough to read
// crisply. If a PRO key (5 MB) is configured there, raise this to 5 MB to stop
// shrinking files unnecessarily.
// ------------------------------------------------------------------
const OCR_PROOF_TARGET_BYTES = 1 * 1024 * 1024; // 1 MB
const OCR_PROOF_MAX_EDGE_PX = 1600;

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Rename to .jpg so the stored extension matches the bytes we are sending. */
function asJpgName(name: string) {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  return `${(base || 'payment-proof').replace(/[^\w.-]+/g, '_')}.jpg`;
}

/**
 * Shrink an oversized screenshot to fit the OCR free tier, or return it
 * unchanged when that is not possible or not worthwhile.
 *
 * Always returns a usable File: a PDF cannot be re-encoded in the browser, and
 * an image too small to shrink without destroying the digits is better sent as
 *-is so the admin can still read it (the Duplicate Payments tab then reports
 * the scan as too large rather than silently skipping the proof).
 */
async function compressProofForOcr(file: File): Promise<File> {
  if (file.size <= OCR_PROOF_TARGET_BYTES) return file;
  if (file.type === 'application/pdf') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    const longestEdge = Math.max(bitmap.width, bitmap.height);
    let scale = Math.min(1, OCR_PROOF_MAX_EDGE_PX / longestEdge);
    let quality = 0.82;

    // Lower quality first, then shrink the image. Dropping quality alone turns
    // small digits into smudges, so scale is what actually saves a very large
    // screenshot -- and the cap stops the loop ending in a useless 200px blob.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (scale < 0.25) break;
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      // Fill white first: a PNG screenshot with transparency flattens to black
      // on a JPEG background, which would destroy dark text on a dark page.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      const blob = await canvasToJpeg(canvas, quality);
      if (blob && blob.size <= OCR_PROOF_TARGET_BYTES) {
        return new File([blob], asJpgName(file.name), {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }

      if (quality > 0.65) quality -= 0.09;
      else {
        scale *= 0.8;
        quality = 0.78;
      }
    }

    return file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
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

export function MySubmissions({
  getToken,
  onBack,
  onStart,
  maintenanceMode = false,
  maintenanceUntil = null,
  registrationOpen = false,
  registration = null,
  fileEditsEnabled = true,
}: MySubmissionsProps) {
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MySubmission | null>(null);
  const [popup, setPopup] = useState<PopupInfo | null>(null);
  const [expandedPaymentIds, setExpandedPaymentIds] = useState<Record<string, boolean>>({});

  // Admin-editable fees, cutoff and bank details, fetched once by App from
  // GET /api/settings. Drives the dropdown options and the bank block; the
  // price itself comes from the per-selection fetch in RegistrationFormBody, so
  // nothing displayed to an author about to pay money is read from this.
  const config = useRegistrationConfig(registration);

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
                      {!maintenanceMode && fileEditsEnabled && (
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

                  {!maintenanceMode && !fileEditsEnabled && (
                    <div className="mt-3 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-2.5">
                      File updates are closed for now. If you need to correct your paper, please contact the
                      conference team.
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
                            config={config}
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

      {/* Guarded as well as the button: the endpoint is the real gate (it
          returns 403), this just avoids opening a form that cannot submit. */}
      {editing && fileEditsEnabled && (
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