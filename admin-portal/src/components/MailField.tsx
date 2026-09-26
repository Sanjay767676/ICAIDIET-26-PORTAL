import React, { useCallback, useRef } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';

// Kept in step with MAIL_PLACEHOLDERS in backend/src/index.ts, which does the
// actual substitution when a queued mail is rendered.
export const MAIL_PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{name}', label: 'Author name' },
  { token: '{paper_title}', label: 'Paper title' },
  { token: '{paper_id}', label: 'CMT Paper ID' },
  { token: '{submission_code}', label: 'Submission code' },
  { token: '{track}', label: 'Track' },
  { token: '{review_decision}', label: 'Review decision' },
  { token: '{review_feedback}', label: 'Reviewer comments' },
];

type Tag = 'b' | 'i' | 'u';
type FieldEl = HTMLInputElement | HTMLTextAreaElement;

// Wrap the current selection in <tag>, or unwrap it when the selection is
// already exactly a wrapped run so repeated presses cannot nest tags.
function applyTag(el: FieldEl, value: string, tag: Tag): { next: string; caret: number } {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const selected = value.slice(start, end);
  const open = `<${tag}>`;
  const close = `</${tag}>`;

  if (selected.startsWith(open) && selected.endsWith(close) && selected.length >= open.length + close.length) {
    const inner = selected.slice(open.length, selected.length - close.length);
    return {
      next: value.slice(0, start) + inner + value.slice(end),
      caret: start + inner.length,
    };
  }
  if (selected) {
    return {
      next: value.slice(0, start) + open + selected + close + value.slice(end),
      caret: start + open.length + selected.length + close.length,
    };
  }
  return {
    next: value.slice(0, start) + open + close + value.slice(end),
    caret: start + open.length,
  };
}

export default function MailField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  help,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  help?: string;
}) {
  const fieldRef = useRef<FieldEl | null>(null);
  const multiline = typeof rows === 'number';

  // Commit an edit then put the caret back where the user expects it, so
  // typing is never interrupted by the controlled re-render.
  const commit = useCallback(
    (next: string, caret: number) => {
      onChange(next);
      requestAnimationFrame(() => {
        const el = fieldRef.current;
        if (!el) return;
        el.focus();
        try {
          el.setSelectionRange(caret, caret);
        } catch {
          /* input types that disallow selection - focus is enough */
        }
      });
    },
    [onChange]
  );

  const insertToken = useCallback(
    (token: string) => {
      const el = fieldRef.current;
      if (!el) {
        onChange(value + token);
        return;
      }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      commit(value.slice(0, start) + token + value.slice(end), start + token.length);
    },
    [commit, onChange, value]
  );

  const tag = useCallback(
    (which: Tag) => {
      const el = fieldRef.current;
      if (!el) return;
      const { next, caret } = applyTag(el, value, which);
      commit(next, caret);
    },
    [commit, value]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<FieldEl>) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'b' || key === 'i' || key === 'u') {
        e.preventDefault();
        tag(key);
      }
    },
    [tag]
  );

  const shared =
    'w-full px-3 py-2 rounded-lg border border-stone-300 bg-white text-sm shadow-sm focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all';
  const activeTagBtn =
    'px-2 py-1 rounded border border-brand-text/15 bg-white text-brand-text hover:border-brand-accent hover:text-brand-accent transition-colors text-xs font-semibold';

  return (
    <div>
      <label className="block text-sm font-medium text-brand-text/80 mb-1">{label}</label>

      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className="text-xs text-brand-text/40">Insert:</span>
        {MAIL_PLACEHOLDERS.map((p) => (
          <button
            key={p.token}
            type="button"
            title={p.label}
            onClick={() => insertToken(p.token)}
            className="text-xs px-1.5 py-0.5 rounded bg-white border border-brand-text/15 text-brand-text/70 hover:border-brand-accent hover:text-brand-accent transition-colors"
          >
            {p.token}
          </button>
        ))}
      </div>

      {multiline && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs text-brand-text/40">Format:</span>
          <button type="button" title="Bold (Ctrl+B)" onClick={() => tag('b')} className={activeTagBtn}>
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Italic (Ctrl+I)" onClick={() => tag('i')} className={activeTagBtn}>
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" title="Underline (Ctrl+U)" onClick={() => tag('u')} className={activeTagBtn}>
            <Underline className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-brand-text/40 ml-1">
            Select text, then press Ctrl+B / Ctrl+I / Ctrl+U
          </span>
        </div>
      )}

      {multiline ? (
        <textarea
          ref={fieldRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          className={shared + ' resize-y font-mono'}
        />
      ) : (
        <input
          ref={fieldRef as React.RefObject<HTMLInputElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={shared}
        />
      )}

      {help && <p className="text-[11px] text-brand-text/45 mt-1">{help}</p>}
    </div>
  );
}
