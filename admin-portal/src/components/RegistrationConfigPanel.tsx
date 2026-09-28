import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, CalendarClock, Landmark, IndianRupee } from 'lucide-react';

export interface FeeRow {
  authorType: string;
  registrationType: string;
  early: string;
  standard: string;
}

export interface RegistrationConfig {
  early_bird_until: string;
  fees: Record<string, Record<string, { early: string; standard: string }>>;
  bank: Record<string, string>;
}

const BANK_FIELDS: { key: string; label: string; placeholder: string; mono?: boolean }[] = [
  { key: 'account_number', label: 'Account number', placeholder: '5904946502', mono: true },
  { key: 'ifsc', label: 'IFSC code', placeholder: 'CBIN0281361', mono: true },
  { key: 'branch', label: 'Branch', placeholder: 'Crosscut Road, CBE' },
  { key: 'beneficiary', label: 'Beneficiary name', placeholder: 'SNSCT CH4 CS' },
  { key: 'bank_name', label: 'Bank name', placeholder: 'CENTRAL BANK OF INDIA' },
];

// The nested fees object is edited as a flat table of one row per
// author-type / registration-type pair. Two rows sharing an author type are
// the same group in the stored document, so an author type with several
// registration types is just several rows with the same value in that column.
// This keeps the editor honest when the option sets differ per author type,
// which a column-per-author-type grid could not represent.
export function configToRows(config: RegistrationConfig): FeeRow[] {
  const rows: FeeRow[] = [];
  for (const [authorType, tiers] of Object.entries(config.fees || {})) {
    for (const [registrationType, amounts] of Object.entries(tiers || {})) {
      rows.push({
        authorType,
        registrationType,
        early: amounts.early || '',
        standard: amounts.standard || '',
      });
    }
  }
  return rows;
}

// Inverse of configToRows. Later rows win on a duplicated
// author-type/registration-type pair, which is what typing the same label into
// two rows means. The backend validates the result, so an incomplete table is
// reported on save rather than silently dropped.
export function rowsToConfig(
  rows: FeeRow[],
  earlyBirdUntil: string,
  bank: Record<string, string>
): RegistrationConfig {
  const fees: RegistrationConfig['fees'] = {};
  for (const row of rows) {
    const authorType = row.authorType.trim();
    const registrationType = row.registrationType.trim();
    if (!authorType || !registrationType) continue;
    if (!fees[authorType]) fees[authorType] = {};
    fees[authorType][registrationType] = {
      early: row.early.trim(),
      standard: row.standard.trim(),
    };
  }
  return { early_bird_until: earlyBirdUntil.trim(), fees, bank };
}

function formatCutoffForHumans(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const parsed = new Date(`${value}T00:00:00`);
  return isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const inputClass =
  'w-full px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all';

// Editors for the fee matrix, the early-bird cutoff and the bank details block.
// The user portal renders exactly these values, so nothing here is duplicated
// in the frontend: fees, cutoff and bank details all come from the backend.
//
// Every keystroke is published upward immediately, so the dashboard's single
// "Save Portal Settings" button saves the fee table too. The rows are still
// held locally because they are the render source: publishing drops rows whose
// author/registration type is blank, and a row mid-retype has to stay on screen
// while that happens. External changes (the settings refetch after a save) are
// distinguished from the panel's own edits with a ref, so a refetch can never
// discard a half-typed table.
export default function RegistrationConfigPanel({
  config,
  onChange,
}: {
  config: RegistrationConfig;
  onChange: (config: RegistrationConfig) => void;
}) {
  const [rows, setRows] = useState<FeeRow[]>(() => configToRows(config));
  const lastEmitted = useRef<string>(JSON.stringify(config.fees));

  const feesKey = JSON.stringify(config.fees);
  useEffect(() => {
    if (feesKey === lastEmitted.current) return;
    setRows(configToRows(config));
    lastEmitted.current = feesKey;
  }, [feesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (nextRows: FeeRow[]) => {
    setRows(nextRows);
    const next = rowsToConfig(nextRows, config.early_bird_until, config.bank || {});
    lastEmitted.current = JSON.stringify(next.fees);
    onChange(next);
  };

  const updateRow = (index: number, patch: Partial<FeeRow>) => {
    commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    // Seed from the first row so a new registration type is a one-field edit
    // rather than five blank boxes.
    const first = rows[0];
    commit([
      ...rows,
      {
        authorType: first ? first.authorType : '',
        registrationType: '',
        early: '',
        standard: '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    commit(rows.filter((_, i) => i !== index));
  };

  const setBankField = (key: string, value: string) => {
    onChange({ ...config, bank: { ...(config.bank || {}), [key]: value } });
  };

  const setCutoff = (value: string) => {
    onChange({ ...config, early_bird_until: value });
  };

  const authorTypes = Array.from(new Set(rows.map((r) => r.authorType.trim()).filter(Boolean)));

  return (
    <div className="space-y-4">
      {/* Early-bird cutoff */}
      <div className="border border-brand-text/10 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-brand-accent/40 flex items-start gap-3">
          <CalendarClock className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-brand-text">Early-bird deadline</h4>
            <p className="text-sm text-brand-text/60 mt-1">
              The last date on which early-bird pricing applies. Authors see the standard fee from the next day. This
              only changes which fee is shown — use &ldquo;Ready for Registration&rdquo; to close registration
              entirely.
            </p>
          </div>
        </div>
        <div className="px-5 py-3.5 bg-brand-bg/20 flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-brand-text/80">Early bird until</label>
          <input
            type="date"
            value={config.early_bird_until || ''}
            onChange={(e) => setCutoff(e.target.value)}
            className={`${inputClass} w-auto`}
          />
          {formatCutoffForHumans(config.early_bird_until) && (
            <span className="text-xs text-brand-text/60">
              Authors see early-bird fees through {formatCutoffForHumans(config.early_bird_until)}, then standard fees.
            </span>
          )}
        </div>
      </div>

      {/* Fee matrix */}
      <div className="border border-brand-text/10 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-brand-accent/40 flex items-start gap-3">
          <IndianRupee className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-brand-text">Registration fees</h4>
            <p className="text-sm text-brand-text/60 mt-1">
              One row per author type and registration type. These rows are also the options authors can choose
              from, so adding a row here adds an option in the user portal. Amounts are shown to authors exactly as
              typed.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-stone-50 text-left text-xs uppercase tracking-wider text-black/60">
                <th className="px-3 py-2.5 font-semibold">Author type</th>
                <th className="px-3 py-2.5 font-semibold">Registration type</th>
                <th className="px-3 py-2.5 font-semibold">Early-bird fee</th>
                <th className="px-3 py-2.5 font-semibold">Standard fee</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-stone-200 align-top">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.authorType}
                      onChange={(e) => updateRow(index, { authorType: e.target.value })}
                      placeholder="Indian Author"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.registrationType}
                      onChange={(e) => updateRow(index, { registrationType: e.target.value })}
                      placeholder="Conference alone"
                      className={inputClass}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.early}
                      onChange={(e) => updateRow(index, { early: e.target.value })}
                      placeholder="₹2,000"
                      className={`${inputClass} font-mono`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.standard}
                      onChange={(e) => updateRow(index, { standard: e.target.value })}
                      placeholder="₹2,500"
                      className={`${inputClass} font-mono`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      title="Remove this fee row"
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-black/50">
                    No fee rows. Add one, otherwise saving will be rejected.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 bg-brand-bg/20 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-text/20 bg-white text-sm font-semibold text-brand-text hover:border-brand-accent transition-colors"
          >
            <Plus className="w-4 h-4" /> Add fee row
          </button>
          {authorTypes.length > 0 && (
            <span className="text-xs text-brand-text/50">
              {authorTypes.length} author type{authorTypes.length === 1 ? '' : 's'} ·{' '}
              {new Set(rows.map((r) => r.registrationType.trim()).filter(Boolean)).size} registration type
              {new Set(rows.map((r) => r.registrationType.trim()).filter(Boolean)).size === 1 ? '' : 's'} — saved
              with the portal settings below
            </span>
          )}
        </div>
      </div>

      {/* Bank details */}
      <div className="border border-brand-text/10 rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b-2 border-brand-accent/40 flex items-start gap-3">
          <Landmark className="w-5 h-5 text-brand-accent shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-brand-text">Bank transfer details</h4>
            <p className="text-sm text-brand-text/60 mt-1">
              Shown to authors in the payment form. Leave a field blank to hide that line.
            </p>
          </div>
        </div>
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {BANK_FIELDS.map((field) => (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-sm font-medium text-brand-text/80">{field.label}</span>
              <input
                type="text"
                value={config.bank?.[field.key] || ''}
                onChange={(e) => setBankField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`${inputClass} ${field.mono ? 'font-mono' : ''}`}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
