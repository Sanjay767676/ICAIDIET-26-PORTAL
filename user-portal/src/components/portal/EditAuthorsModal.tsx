import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

const TITLE_OPTIONS = ['Mrs', 'Mr', 'Ms', 'Dr'];
const DESIGNATION_OPTIONS = [
  'Student',
  'HoD',
  'Assistant Professor',
  'Associate Professor',
  'Other',
];
const AUTHOR_COUNTS = [2, 3, 4, 5, 6];
const PHONE_MIN_DIGITS = 5;
const PHONE_MAX_DIGITS = 15;

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, PHONE_MAX_DIGITS);
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthorRecord {
  id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  college?: string;
  title?: string;
  designation?: string;
  is_primary?: number | boolean;
}

interface AuthorDraft {
  name: string;
  phone: string;
  email: string;
  college: string;
  title: string;
  designation: string;
  otherDesignation: string;
}

const emptyDraft = (): AuthorDraft => ({
  name: '',
  phone: '',
  email: '',
  college: '',
  title: '',
  designation: '',
  otherDesignation: '',
});

const inputClass =
  'w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl outline-none focus:border-black focus:ring-2 focus:ring-black/10 text-sm font-medium text-black transition-all disabled:bg-stone-100';
const labelClass = 'block text-xs font-semibold text-black/70 mb-1';

export function EditAuthorsModal({
  sub,
  getToken,
  onClose,
  onSaved,
}: {
  sub: { id: string; title?: string; submission_code?: string; paper_id?: string };
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<AuthorDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'edit' | 'confirm'>('edit');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getToken();
        if (!token) throw new Error('Please sign in before editing author details.');
        const res = await fetch(`${API_URL}/api/submissions/${sub.id}/authors`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Could not load your author details. Please try again.');
        }
        if (cancelled) return;
        const existing: AuthorRecord[] = Array.isArray(data.authors) ? data.authors : [];
        const rows = existing.slice(0, 6).map((a) => ({
          name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
          phone: a.phone || '',
          email: a.email || '',
          college: a.college || '',
          title: a.title || '',
          designation: a.designation || '',
          otherDesignation:
            a.designation && !DESIGNATION_OPTIONS.includes(a.designation) ? a.designation : '',
        }));
        while (rows.length < 2) rows.push(emptyDraft());
        setDrafts(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your author details.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sub.id, getToken]);

  const update = (index: number, patch: Partial<AuthorDraft>) =>
    setDrafts((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const changeCount = (count: number) =>
    setDrafts((rows) => {
      const next = rows.slice(0, count);
      while (next.length < count) next.push(emptyDraft());
      return next;
    });

  const validate = (): string | null => {
    for (let i = 0; i < drafts.length; i++) {
      const a = drafts[i];
      const label = `Author ${i + 1}`;
      if (!a.name.trim()) return `${label}: name is required.`;
      const digits = onlyDigits(a.phone);
      if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
        return `${label}: phone number must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only, no +, - or spaces).`;
      }
      if (!emailRegex.test(a.email.trim())) return `${label}: a valid email address is required.`;
      if (!a.college.trim()) return `${label}: institution / organisation name is required.`;
      if (!TITLE_OPTIONS.includes(a.title)) return `${label}: please select a title.`;
      if (!DESIGNATION_OPTIONS.includes(a.designation)) return `${label}: please select a designation.`;
      if (a.designation === 'Other' && !a.otherDesignation.trim()) {
        return `${label}: please enter your designation.`;
      }
    }
    const emails = drafts.map((a) => a.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) {
      return 'Each author must have a different email address.';
    }
    return null;
  };

  const review = () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStage('confirm');
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      setStage('edit');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in before editing author details.');
      const res = await fetch(`${API_URL}/api/submissions/${sub.id}/authors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          authors: drafts.map((a) => ({
            name: a.name.trim().replace(/\s+/g, ' '),
            phone: onlyDigits(a.phone),
            email: a.email.trim(),
            college: a.college.trim(),
            title: a.title,
            designation: a.designation,
            other_designation: a.designation === 'Other' ? a.otherDesignation.trim() : '',
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Your author details could not be saved. Please try again.');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[106] flex items-center justify-center p-2 sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border-2 border-black overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-4 bg-black text-white">
          <div className="min-w-0">
            <h2 className="font-serif font-bold text-lg sm:text-xl truncate">Edit Authors</h2>
            <p className="text-xs text-white/70 truncate mt-0.5">
              {sub.title || sub.submission_code || sub.paper_id || ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors shrink-0 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-black/60">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading your author details…
            </div>
          ) : error && drafts.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          ) : stage === 'edit' ? (
            <>
              <div className="flex flex-wrap items-center gap-3 mb-5 rounded-xl bg-stone-100 px-4 py-3">
                <label htmlFor="author-count" className="text-sm font-semibold text-black">
                  Number of Authors
                </label>
                <select
                  id="author-count"
                  value={drafts.length}
                  onChange={(e) => changeCount(parseInt(e.target.value, 10))}
                  className="px-3.5 py-2 bg-white border border-stone-300 rounded-lg outline-none focus:border-black focus:ring-2 focus:ring-black/10 text-sm font-semibold text-black"
                >
                  {AUTHOR_COUNTS.map((n) => (
                    <option key={n} value={n}>
                      {n} Author{n > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-black/50">
                  All fields are required. The first author is the corresponding author.
                </span>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              <div className="space-y-5">
                {drafts.map((a, i) => (
                  <div key={i} className="rounded-2xl border border-stone-200 p-4 sm:p-5 bg-brand-bg/20">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <h3 className="font-serif font-bold text-base text-black">
                        Author {i + 1}
                        {i === 0 && (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-black text-white">
                            Corresponding
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Name *</label>
                        <input
                          type="text"
                          value={a.name}
                          onChange={(e) => update(i, { name: e.target.value })}
                          className={inputClass}
                          placeholder="Full name as it should appear on the certificate"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Phone Number *</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={a.phone}
                          onChange={(e) => update(i, { phone: onlyDigits(e.target.value) })}
                          className={inputClass}
                          placeholder="Digits only"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Mail ID *</label>
                        <input
                          type="email"
                          value={a.email}
                          onChange={(e) => update(i, { email: e.target.value })}
                          className={inputClass}
                          placeholder="name@example.com"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Institution / Organization Name *</label>
                        <input
                          type="text"
                          value={a.college}
                          onChange={(e) => update(i, { college: e.target.value })}
                          className={inputClass}
                          placeholder="College / university / organisation"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Title *</label>
                        <select
                          value={a.title}
                          onChange={(e) => update(i, { title: e.target.value })}
                          className={inputClass}
                        >
                          <option value="">-- Select Title --</option>
                          {TITLE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Designation *</label>
                        <select
                          value={a.designation}
                          onChange={(e) =>
                            update(i, {
                              designation: e.target.value,
                              otherDesignation: e.target.value === 'Other' ? a.otherDesignation : '',
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">-- Select Designation --</option>
                          {DESIGNATION_OPTIONS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                      {a.designation === 'Other' && (
                        <div className="sm:col-span-2">
                          <label className={labelClass}>Enter Designation *</label>
                          <input
                            type="text"
                            value={a.otherDesignation}
                            onChange={(e) => update(i, { otherDesignation: e.target.value })}
                            className={inputClass}
                            placeholder="Your designation"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div>
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 shrink-0 text-red-700 mt-0.5" />
                  <div>
                    <h3 className="font-serif font-bold text-lg text-red-900 mb-2">
                      Please check before you confirm
                    </h3>
                    <p className="text-sm font-bold text-red-800 leading-relaxed">
                      These author details will be final. These author names will appear on your
                      certificates, so kindly check them once again and confirm. No changes will be
                      made hereafter.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {drafts.map((a, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-stone-200 px-4 py-3 text-sm text-black"
                  >
                    <span className="font-semibold">{i + 1}.</span>
                    <span className="font-semibold">
                      {a.title} {a.name.trim()}
                    </span>
                    <span className="text-black/50">
                      — {a.designation === 'Other' ? a.otherDesignation.trim() : a.designation}
                    </span>
                    <span className="text-black/50">· {a.college.trim()}</span>
                    <span className="text-black/50">· {a.email.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-t-2 border-stone-200 bg-stone-50">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-black/70 hover:bg-black/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {stage === 'confirm' && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStage('edit');
              }}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-black/70 hover:bg-black/5 transition-colors disabled:opacity-50"
            >
              Back to Edit
            </button>
          )}
          {stage === 'edit' ? (
            <button
              type="button"
              onClick={review}
              disabled={loading || drafts.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-all ml-auto disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> Review Author Details
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-all ml-auto disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Confirm and Submit Author Details
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
