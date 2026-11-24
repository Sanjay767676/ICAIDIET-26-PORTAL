import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BadgeCheck, Loader2, Search, ShieldX } from 'lucide-react';

const API_URL: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';

type Result =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'verified'; certId: string; name: string; college: string }
  | { kind: 'notfound'; certId: string }
  | { kind: 'error'; message: string };

// Certificate IDs are "2026" followed by 4 digits, e.g. 20264821.
const clean = (v: string) => v.replace(/\D/g, '').slice(0, 12);

export default function App() {
  const [certId, setCertId] = useState(() => clean(new URLSearchParams(window.location.search).get('id') || ''));
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  const verify = async (id: string) => {
    if (id.length < 5) {
      setResult({ kind: 'error', message: 'Enter the full certificate ID printed at the bottom of the certificate.' });
      return;
    }
    setResult({ kind: 'loading' });
    try {
      const res = await fetch(`${API_URL}/api/verify/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setResult({ kind: 'error', message: data?.error || 'Too many lookups. Please wait a minute.' });
      } else if (data?.verified) {
        setResult({ kind: 'verified', certId: data.cert_id, name: data.name, college: data.college });
      } else if (res.status === 404 || data?.success) {
        setResult({ kind: 'notfound', certId: id });
      } else {
        setResult({ kind: 'error', message: 'Could not verify right now. Please try again.' });
      }
      const url = new URL(window.location.href);
      url.searchParams.set('id', id);
      window.history.replaceState(null, '', url);
    } catch {
      setResult({ kind: 'error', message: 'Could not reach the verification service. Check your connection and try again.' });
    }
  };

  // Links like https://verify.icaidiet26.tech/?id=20264821 verify straight away.
  useEffect(() => {
    if (certId) verify(certId);
    else inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    verify(certId);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-black/10 bg-brand-bg/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="font-serif font-bold text-xl tracking-tight">ICAIDIET&apos;26</span>
          <a href="https://www.icaidiet26.tech" className="text-sm font-medium hover:underline">
            icaidiet26.tech
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-3">Certificate Verification</h1>
          <p className="text-black/70 max-w-xl mx-auto leading-relaxed">
            International Conference on AI-Driven Innovation in Engineering and Technology, SNS College of
            Technology, Coimbatore, 20 &amp; 21 November 2026.
          </p>
        </div>

        <form onSubmit={onSubmit} className="bg-brand-card rounded-2xl p-5 sm:p-6 shadow-xl border border-black/5">
          <label htmlFor="cert" className="block text-sm font-semibold mb-2">
            Certificate ID
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="cert"
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 20264821"
              value={certId}
              onChange={(e) => setCertId(clean(e.target.value))}
              className="flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 text-lg font-mono tracking-wider outline-none focus:ring-2 focus:ring-black/40"
            />
            <button
              type="submit"
              disabled={result.kind === 'loading'}
              className="rounded-xl bg-black text-white px-6 py-3 font-semibold inline-flex items-center justify-center gap-2 hover:bg-black/85 disabled:opacity-60"
            >
              {result.kind === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Verify
            </button>
          </div>
          <p className="text-xs text-black/60 mt-2">The ID is printed at the bottom-left corner of the certificate.</p>
        </form>

        <div className="mt-8" aria-live="polite">
          {result.kind === 'verified' && (
            <div className="rise bg-white rounded-2xl shadow-xl border-2 border-green-600 overflow-hidden">
              <div className="bg-green-600 text-white px-6 py-4 flex items-center gap-3">
                <BadgeCheck className="w-8 h-8 shrink-0" />
                <div className="text-lg sm:text-xl font-bold">Verified Participant of ICAIDIET&apos;26</div>
              </div>
              <dl className="px-6 py-5 grid gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-black/50">Name</dt>
                  <dd className="text-xl font-serif font-bold">{result.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-black/50">College</dt>
                  <dd className="text-lg">{result.college}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-black/50">Certificate ID</dt>
                  <dd className="font-mono text-lg">{result.certId}</dd>
                </div>
              </dl>
            </div>
          )}

          {result.kind === 'notfound' && (
            <div className="rise bg-white rounded-2xl shadow-xl border-2 border-red-600 px-6 py-5 flex gap-3">
              <ShieldX className="w-8 h-8 text-red-600 shrink-0" />
              <div>
                <div className="text-lg font-bold text-red-700">No certificate found</div>
                <p className="text-black/70 mt-1">
                  <span className="font-mono">{result.certId}</span> is not a valid ICAIDIET&apos;26 certificate ID.
                  Check the number and try again.
                </p>
              </div>
            </div>
          )}

          {result.kind === 'error' && (
            <div className="rise bg-white rounded-2xl shadow border border-black/10 px-6 py-4 text-black/80">{result.message}</div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-black/60">
        SNS College of Technology, Coimbatore · in association with Yorkville University, Canada
      </footer>
    </div>
  );
}
