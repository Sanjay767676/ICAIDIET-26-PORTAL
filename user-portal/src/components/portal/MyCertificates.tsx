import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Award, CheckCircle2, Clock, Download, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
// Optional: only show a "Verify" link in the portal if a verifier URL is configured.
// The certificate PDF itself carries the ID; you can share the verifier URL separately.
const VERIFY_URL = (import.meta.env.VITE_VERIFY_URL || '').replace(/\/+$/, '');

type AuthorCert = {
  author_id: string;
  is_primary: boolean;
  name: string;
  college: string;
  cert_id: string | null;
  status: 'READY' | 'GENERATING' | 'NOT_GENERATED';
};

type PaperCerts = {
  submission_id: string;
  paper_id: string | null;
  paper_title: string;
  payment_approved: boolean;
  authors_edited: boolean;
  eligible: boolean;
  authors: AuthorCert[];
};

function Condition({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${ok ? 'text-green-800' : 'text-red-700'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {label}
    </span>
  );
}

// "View My Certificates" tab. One card per paper with every author the paper
// lists. Each author has a "Download My Certificate" button that saves the PDF
// straight away. Certificates exist only for papers whose payment was approved
// and whose authors were edited (Edit Authors) and approved by the admin.
export function MyCertificates({
  getToken,
  onBack,
}: {
  getToken: () => Promise<string | null>;
  onBack: () => void;
}) {
  const [papers, setPapers] = useState<PaperCerts[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Please sign in again.');
      const res = await fetch(`${API_URL}/api/certificates/mine`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Could not load your certificates.');
      setPapers(data.papers || []);
    } catch (e: any) {
      setError(e?.message || 'Could not load your certificates.');
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (a: AuthorCert) => {
    if (!a.cert_id) return;
    setBusy(a.cert_id);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/certificates/${a.cert_id}/file?download=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not download the certificate. Please try again.');
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `ICAIDIET26_Certificate_${a.name.replace(/[^\w.-]+/g, '_')}_${a.cert_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: any) {
      alert(e?.message || 'Could not download the certificate.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold mb-2">My Certificates</h1>
          <p className="text-brand-text/70">E-certificates for every author of your ICAIDIET&apos;26 papers.</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> My Submissions
        </button>
      </div>

      {error ? (
        <div className="bg-brand-card rounded-2xl p-8 shadow-xl border border-brand-text/5 text-center">
          <div className="text-lg text-brand-text/70 mb-4">{error}</div>
          <button
            onClick={() => {
              setPapers(null);
              load();
            }}
            className="px-8 py-3 bg-brand-text text-white rounded-xl font-medium hover:bg-brand-accent transition-all shadow inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      ) : papers === null ? (
        <div className="flex items-center justify-center gap-2 py-20 text-brand-text/60">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading your certificates…
        </div>
      ) : papers.length === 0 ? (
        <div className="bg-brand-card rounded-2xl p-10 shadow-xl border border-brand-text/5 text-center">
          <Award className="w-10 h-10 mx-auto mb-4 text-brand-text/60" />
          <h2 className="text-2xl font-serif font-bold mb-3">No papers found</h2>
          <p className="text-brand-text/70">Certificates appear here for the authors of the papers you submitted.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {papers.map((paper) => (
            <section key={paper.submission_id} className="bg-brand-card rounded-2xl p-6 shadow-xl border border-brand-text/5">
              <div className="mb-4">
                {paper.paper_id && paper.paper_id !== 'NA' && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-brand-text/60 mb-1">Paper ID {paper.paper_id}</div>
                )}
                <h2 className="text-lg font-serif font-bold leading-snug">{paper.paper_title}</h2>
              </div>

              {!paper.eligible && (
                <div className="mb-4 rounded-xl bg-white/70 border border-brand-text/10 p-4">
                  <p className="text-sm text-brand-text/80 mb-2">
                    Certificates for this paper are generated once both of these are complete:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-6">
                    <Condition ok={paper.payment_approved} label="Payment approved" />
                    <Condition ok={paper.authors_edited} label="Edit Authors completed and approved" />
                  </div>
                </div>
              )}

              <ul className="divide-y divide-brand-text/10 bg-white/60 rounded-xl">
                {paper.authors.map((a) => (
                  <li key={a.author_id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold break-words">{a.name}</div>
                      <div className="text-sm text-brand-text/70 break-words">{a.college}</div>
                      {a.cert_id && (
                        <div className="text-xs text-brand-text/60 mt-1">
                          Certificate ID <span className="font-mono font-semibold text-brand-text">{a.cert_id}</span>
                          {VERIFY_URL && (
                            <>
                              {' · '}
                              <a
                                href={`${VERIFY_URL}/?id=${a.cert_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="underline hover:no-underline inline-flex items-center gap-0.5"
                              >
                                Verify <ExternalLink className="w-3 h-3" />
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {a.status === 'READY' ? (
                        <button
                          type="button"
                          onClick={() => download(a)}
                          disabled={!!busy}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-brand-text text-white hover:bg-brand-text/85 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          {busy === a.cert_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          Download My Certificate
                        </button>
                      ) : paper.eligible ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-brand-text/70">
                          <Clock className="w-4 h-4" /> Being generated — check back soon
                        </span>
                      ) : (
                        <span className="text-sm text-brand-text/50">Not available yet</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
