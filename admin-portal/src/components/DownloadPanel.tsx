import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileDown, CheckCircle2, ChevronLeft, ArrowRight, Loader2, Paperclip, Building2, Info } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface ExportColumn {
  id: string;
  label: string;
}

interface ExportFilter {
  id: string;
  label: string;
  description?: string;
}

const FILTER_GROUPS: { group: string; filters: ExportFilter[] }[] = [
  {
    group: 'Review Decision & Acceptance',
    filters: [
      { id: 'ACCEPTED', label: 'Accepted (Awaiting Payment)', description: 'Accepted papers only; payment not approved yet (matches Accepted tab)' },
      { id: 'ACCEPTED_AND_PAYMENT_APPROVED', label: 'Accepted & Payment Approved', description: 'Accepted papers with payment verified & approved' },
      { id: 'ACCEPTED_ALL', label: 'All Accepted (Total)', description: 'All accepted entries, both paid and unpaid' },
      { id: 'ACCEPTED_WITH_MINOR_CHANGES', label: 'Accepted with Minor Changes', description: 'Author must submit revisions' },
      { id: 'ACCEPTED_WITH_MAJOR_CHANGES', label: 'Accepted with Major Changes', description: 'Author must submit major revisions' },
      { id: 'NOT_ACCEPTED', label: 'Not Accepted', description: 'Paper rejected after review' },
    ],
  },
  {
    group: 'Workflow & Submission Status',
    filters: [
      { id: 'ALL', label: 'All Entries (not deleted)', description: 'All active submissions' },
      { id: 'SUBMITTED', label: 'Submitted (Initial)', description: 'Pending first review' },
      { id: 'UNDER_REVIEW', label: 'Under Review', description: 'Currently assigned or in review' },
      { id: 'READY_FOR_REGISTRATION', label: 'Ready for Registration', description: 'Eligible for payment & registration' },
      { id: 'READY_FOR_CAMERA_READY', label: 'Ready for Camera Ready', description: 'Ready for camera ready upload' },
    ],
  },
  {
    group: 'Payment',
    filters: [
      { id: 'PAYMENT_APPROVED', label: 'Payment Made (Approved)', description: 'All submissions with approved payment' },
      { id: 'PAYMENT_PENDING', label: 'Payment Pending Review', description: 'Payment proof uploaded, pending check' },
      { id: 'PAYMENT_REJECTED', label: 'Payment Rejected', description: 'Payment proof was rejected' },
      { id: 'PAYMENT_NONE', label: 'No Payment Submitted', description: 'No payment proof uploaded' },
    ],
  },
];

export default function DownloadPanel({
  token,
  onUnauthorized,
  submissions = [],
}: {
  token: string;
  onUnauthorized: () => void;
  submissions?: any[];
}) {
  const [option, setOption] = useState<'choose' | 'data' | 'papers'>('choose');
  const [step, setStep] = useState<1 | 2>(1);
  const [filter, setFilter] = useState<string>('ALL');
  const [columns, setColumns] = useState<ExportColumn[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchColumns = useCallback(async () => {
    setLoadingColumns(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/export/columns`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load export columns.');
      }
      setColumns(data.columns || []);
      setSelected((data.columns || []).map((c: ExportColumn) => c.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load export columns.');
    } finally {
      setLoadingColumns(false);
    }
  }, [token, onUnauthorized]);

  // Preload the column list whenever the Download Data panel is opened.
  useEffect(() => {
    if (option === 'data') {
      fetchColumns();
    }
  }, [option, fetchColumns]);

  const selectedFilterLabel = useMemo(
    () => FILTER_GROUPS.flatMap((g) => g.filters).find((f) => f.id === filter)?.label || filter,
    [filter]
  );

  const getCount = useCallback(
    (filterId: string) => {
      if (!submissions || submissions.length === 0) return null;
      switch (filterId) {
        case 'ALL':
          return submissions.length;
        case 'SUBMITTED':
          return submissions.filter((s) => s.status === 'SUBMITTED' && s.payment_status !== 'APPROVED').length;
        case 'UNDER_REVIEW':
          return submissions.filter((s) => s.status === 'UNDER_REVIEW').length;
        case 'READY_FOR_REGISTRATION':
          return submissions.filter((s) => s.status === 'READY_FOR_REGISTRATION').length;
        case 'READY_FOR_CAMERA_READY':
          return submissions.filter((s) => s.status === 'READY_FOR_CAMERA_READY').length;
        case 'ACCEPTED':
          return submissions.filter(
            (s) =>
              (s.review_decision === 'ACCEPTED' ||
                s.status === 'READY_FOR_REGISTRATION' ||
                s.status === 'READY_FOR_CAMERA_READY') &&
              s.payment_status !== 'APPROVED'
          ).length;
        case 'ACCEPTED_AND_PAYMENT_APPROVED':
          return submissions.filter(
            (s) =>
              (s.review_decision === 'ACCEPTED' ||
                s.status === 'READY_FOR_REGISTRATION' ||
                s.status === 'READY_FOR_CAMERA_READY') &&
              s.payment_status === 'APPROVED'
          ).length;
        case 'ACCEPTED_ALL':
          return submissions.filter(
            (s) =>
              s.review_decision === 'ACCEPTED' ||
              s.status === 'READY_FOR_REGISTRATION' ||
              s.status === 'READY_FOR_CAMERA_READY'
          ).length;
        case 'ACCEPTED_WITH_MINOR_CHANGES':
          return submissions.filter(
            (s) => s.review_decision === 'ACCEPTED_WITH_MINOR_CHANGES' && s.payment_status !== 'APPROVED'
          ).length;
        case 'ACCEPTED_WITH_MAJOR_CHANGES':
          return submissions.filter(
            (s) => s.review_decision === 'ACCEPTED_WITH_MAJOR_CHANGES' && s.payment_status !== 'APPROVED'
          ).length;
        case 'NOT_ACCEPTED':
          return submissions.filter((s) => s.review_decision === 'NOT_ACCEPTED').length;
        case 'PAYMENT_APPROVED':
          return submissions.filter((s) => s.payment_status === 'APPROVED').length;
        case 'PAYMENT_PENDING':
          return submissions.filter((s) => s.payment_status === 'PENDING').length;
        case 'PAYMENT_REJECTED':
          return submissions.filter((s) => s.payment_status === 'REJECTED').length;
        case 'PAYMENT_NONE':
          return submissions.filter((s) => !s.payment_status).length;
        default:
          return null;
      }
    },
    [submissions]
  );

  const toggleAll = () => {
    if (selected.length === columns.length && columns.length > 0) {
      setSelected([]);
    } else {
      setSelected(columns.map((c) => c.id));
    }
  };

  const toggleColumn = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const downloadXlsx = async () => {
    if (selected.length === 0) return;
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filter, columns: selected }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Export failed.');
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const nameMatch = cd.match(/filename="([^"]+)"/);
      const fileName = nameMatch ? nameMatch[1] : `${new Date().toISOString().slice(0, 10)}_${filter}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Downloaded "${fileName}" (${selected.length} column${selected.length === 1 ? '' : 's'} included).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setOption('choose');
    setStep(1);
    setFilter('ALL');
    setError(null);
    setSuccess(null);
  };

  const cardCls =
    'group border-2 border-brand-text/10 rounded-2xl p-6 sm:p-8 transition-all hover:border-brand-accent hover:shadow-lg cursor-pointer bg-brand-card';
  const iconWrap =
    'w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors';

  return (
    <div className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {option === 'choose' && (
        <>
          <div className="rounded-xl bg-brand-text/5 border border-brand-text/10 p-4 text-sm text-brand-text/70">
            <Info className="w-4 h-4 inline-block mr-1.5 align-[-2px]" />
            Choose what you want to download below. Soft-deleted entries are never included in any export.
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <button onClick={() => setOption('data')} className={cardCls + ' text-left'}>
              <div className={iconWrap + ' bg-brand-accent/10 text-brand-accent group-hover:bg-brand-accent group-hover:text-white'}>
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h4 className="font-serif text-lg font-bold flex items-center gap-2">
                Download Data
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-sm text-brand-text/60 mt-1.5">
                Export submissions as an Excel (.xlsx) file. Pick a filter (status / review decision / payment), then choose the columns to include.
              </p>
            </button>

            <div className={cardCls.replace(' cursor-pointer', '') + ' opacity-60 relative'}>
              <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide bg-brand-text/10 text-brand-text/60 px-2 py-1 rounded-full">
                Coming Soon
              </div>
              <button onClick={() => setOption('papers')} className="text-left w-full">
                <div className={iconWrap + ' bg-brand-text/10 text-brand-text'}>
                  <Paperclip className="w-7 h-7" />
                </div>
                <h4 className="font-serif text-lg font-bold">Download Papers</h4>
                <p className="text-sm text-brand-text/60 mt-1.5">
                  Download the manuscript / plagiarism PDF files in bulk (zip). This option is not available yet.
                </p>
              </button>
            </div>
          </div>
        </>
      )}

      {option === 'papers' && (
        <div className="bg-brand-card rounded-2xl border-2 border-brand-text/10 p-8 text-center">
          <FileDown className="w-12 h-12 mx-auto text-brand-text/30 mb-3" />
          <h4 className="font-serif text-xl font-bold">Download Papers</h4>
          <p className="text-sm text-brand-text/60 mt-2 max-w-md mx-auto">
            Bulk paper download (manuscript / plagiarism reports as a zip) is not implemented yet. The functionality
            will be added soon.
          </p>
          <button
            onClick={reset}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      )}

      {option === 'data' && (
        <div className="bg-brand-card rounded-2xl border border-brand-text/5 shadow-sm overflow-hidden">
          {/* Stepper header */}
          <div className="border-b border-brand-text/10 px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
            <h3 className="font-serif text-lg font-bold">Download Data</h3>
            <button onClick={reset} className="text-xs font-medium text-brand-text/60 hover:text-brand-text transition-colors">
              Cancel
            </button>
          </div>

          <div className="px-5 sm:px-6 py-2 flex items-center gap-2 text-xs font-medium">
            <span className={`px-2.5 py-1 rounded-full ${step === 1 ? 'bg-brand-accent text-white' : 'bg-green-100 text-green-800'}`}>
              {step === 1 ? '1' : <CheckCircle2 className="w-3.5 h-3.5 inline-block align-[-2px]" />} Filter
            </span>
            <span className="w-6 h-px bg-brand-text/20" />
            <span className={`px-2.5 py-1 rounded-full ${step === 2 ? 'bg-brand-accent text-white' : 'bg-brand-text/10 text-brand-text/60'}`}>
              2 Columns
            </span>
          </div>

          {step === 1 && (
            <div className="p-5 sm:p-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {FILTER_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="text-xs font-bold uppercase tracking-wide text-brand-text/50 mb-2">{g.group}</div>
                    <div className="space-y-2">
                      {g.filters.map((f) => {
                        const count = getCount(f.id);
                        const isSelected = filter === f.id;
                        return (
                          <label
                            key={f.id}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all shadow-sm ${
                              isSelected
                                ? 'border-brand-accent bg-amber-50 shadow-md ring-2 ring-brand-accent/20'
                                : 'bg-white border-transparent hover:border-brand-text/25'
                            }`}
                          >
                            <input
                              type="radio"
                              name="export-filter"
                              checked={isSelected}
                              onChange={() => setFilter(f.id)}
                              className="w-4 h-4 mt-0.5 accent-brand-accent shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-semibold ${isSelected ? 'text-brand-text' : 'text-brand-text/90'}`}>
                                  {f.label}
                                </span>
                                {count !== null && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${
                                      isSelected
                                        ? 'bg-brand-accent text-white'
                                        : 'bg-brand-text/10 text-brand-text/70'
                                    }`}
                                  >
                                    {count}
                                  </span>
                                )}
                              </div>
                              {f.description && (
                                <p className="text-xs text-brand-text/60 mt-0.5 leading-snug">
                                  {f.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all shadow"
                >
                  Next: Choose Columns <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="text-sm text-brand-text/70 flex flex-wrap items-center gap-2">
                  <span>Filter:</span>
                  <span className="font-semibold text-brand-text">{selectedFilterLabel}</span>
                  {getCount(filter) !== null && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-accent text-white">
                      {getCount(filter)} records
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {loadingColumns ? (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-text/50" />
                  ) : (
                    <>
                      <button onClick={toggleAll} className="text-xs font-medium text-brand-accent hover:underline">
                        {selected.length === columns.length && columns.length > 0 ? 'Clear All' : 'Select All'}
                      </button>
                      <span className="text-xs text-brand-text/50">
                        {selected.length}/{columns.length} selected
                      </span>
                    </>
                  )}
                </div>
              </div>

              {loadingColumns ? (
                <div className="py-12 text-center text-sm text-brand-text/50">Loading export columns...</div>
              ) : columns.length === 0 ? (
                <div className="py-12 text-center text-sm text-brand-text/50">No columns available to export.</div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                    {columns.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border-2 cursor-pointer transition-all shadow-sm ${selected.includes(c.id) ? 'border-amber-500 bg-amber-400' : 'bg-white border-transparent hover:border-brand-text/25'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggleColumn(c.id)}
                          className="w-4 h-4 rounded accent-brand-text"
                        />
                        <span className="text-sm text-brand-text">{c.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-brand-text/10">
                    <button
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-brand-text/70 hover:text-brand-text transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to Filter
                    </button>
                    <button
                      onClick={downloadXlsx}
                      disabled={selected.length === 0 || exporting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent transition-all shadow disabled:opacity-40 disabled:cursor-not-allowed min-w-40"
                    >
                      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {exporting ? 'Preparing...' : 'Download .xlsx'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}