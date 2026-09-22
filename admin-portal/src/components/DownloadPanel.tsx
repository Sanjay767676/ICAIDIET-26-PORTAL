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
}

const FILTER_GROUPS: { group: string; filters: ExportFilter[] }[] = [
  {
    group: 'Submission Status',
    filters: [
      { id: 'ALL', label: 'All Entries (not deleted)' },
      { id: 'SUBMITTED', label: 'Submitted' },
      { id: 'UNDER_REVIEW', label: 'Under Review' },
      { id: 'READY_FOR_REGISTRATION', label: 'Ready for Registration' },
      { id: 'READY_FOR_CAMERA_READY', label: 'Ready for Camera Ready' },
    ],
  },
  {
    group: 'Review Decision',
    filters: [
      { id: 'ACCEPTED', label: 'Accepted' },
      { id: 'ACCEPTED_WITH_MINOR_CHANGES', label: 'Accepted with Minor Changes' },
      { id: 'ACCEPTED_WITH_MAJOR_CHANGES', label: 'Accepted with Major Changes' },
      { id: 'NOT_ACCEPTED', label: 'Not Accepted' },
    ],
  },
];

export default function DownloadPanel({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }) {
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
                Export submissions as an Excel (.xlsx) file. Pick a filter (status / review decision), then choose the columns to include.
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
              <div className="grid sm:grid-cols-2 gap-4">
                {FILTER_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="text-xs font-bold uppercase tracking-wide text-brand-text/50 mb-2">{g.group}</div>
                    <div className="space-y-2">
                      {g.filters.map((f) => (
                        <label
                          key={f.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${filter === f.id ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-text/10 hover:border-brand-text/25'}`}
                        >
                          <input
                            type="radio"
                            name="export-filter"
                            checked={filter === f.id}
                            onChange={() => setFilter(f.id)}
                            className="w-4 h-4 accent-brand-accent"
                          />
                          <span className="text-sm font-medium text-brand-text">{f.label}</span>
                        </label>
                      ))}
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
                <div className="text-sm text-brand-text/70">
                  Filter: <span className="font-semibold text-brand-text">{selectedFilterLabel}</span>
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
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all ${selected.includes(c.id) ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-text/10 hover:border-brand-text/25'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggleColumn(c.id)}
                          className="w-4 h-4 rounded accent-brand-accent"
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