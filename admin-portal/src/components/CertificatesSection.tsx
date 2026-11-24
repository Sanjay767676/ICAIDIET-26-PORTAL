import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Clock, Download, ExternalLink, Eye, Loader2, X, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type AuthorCert = {
  author_id: string;
  is_primary: boolean;
  name: string;
  college: string;
  cert_id: string | null;
  status: 'READY' | 'GENERATING' | 'NOT_GENERATED';
};

type PaperCerts = {
  payment_approved: boolean;
  authors_edited: boolean;
  eligible: boolean;
  authors: AuthorCert[];
};

// Certificates block inside the admin "View Info" modal. Lists every author of the
// paper with the certificate state and shows a generated certificate right here
// (web view) — the PDF is fetched with the admin token and shown from a blob URL.
export default function CertificatesSection({ submissionId, token }: { submissionId: string; token: string }) {
  const [data, setData] = useState<PaperCerts | null>(null);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<{ certId: string; name: string; url: string } | null>(null);
  const [opening, setOpening] = useState('');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    fetch(`${API_URL}/api/admin/submissions/${submissionId}/certificates`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!alive) return;
        if (!ok || !j?.success) setError(j?.error || 'Could not load certificates.');
        else setData(j);
      })
      .catch(() => alive && setError('Could not load certificates.'));
    return () => {
      alive = false;
    };
  }, [submissionId, token]);

  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url); }, [viewer]);

  const open = async (a: AuthorCert) => {
    if (!a.cert_id) return;
    setOpening(a.cert_id);
    try {
      const res = await fetch(`${API_URL}/api/admin/certificates/${a.cert_id}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      setViewer({ certId: a.cert_id, name: a.name, url: URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })) });
    } catch {
      alert('Could not open the certificate.');
    } finally {
      setOpening('');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-brand-text/50 uppercase tracking-wide font-medium mb-2">
        <Award className="w-3.5 h-3.5" /> Certificates
      </div>

      {error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : !data ? (
        <p className="text-sm text-brand-text/60 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-3">
          {!data.eligible && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm space-y-1">
              <div className="font-semibold text-amber-900">Not eligible for certificates yet</div>
              <div className={`flex items-center gap-1.5 ${data.payment_approved ? 'text-green-800' : 'text-red-700'}`}>
                {data.payment_approved ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} Payment approved
              </div>
              <div className={`flex items-center gap-1.5 ${data.authors_edited ? 'text-green-800' : 'text-red-700'}`}>
                {data.authors_edited ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} Edit Authors completed and approved
              </div>
            </div>
          )}

          <div className="rounded-xl border border-brand-accent/40 divide-y divide-brand-accent/20">
            {data.authors.map((a) => (
              <div key={a.author_id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-semibold break-words">{a.name}</div>
                  <div className="text-sm text-brand-text/70 break-words">{a.college}</div>
                  {a.cert_id && <div className="text-xs text-brand-text/60 mt-0.5">ID <span className="font-mono font-semibold">{a.cert_id}</span></div>}
                </div>
                {a.status === 'READY' ? (
                  <button
                    type="button"
                    onClick={() => open(a)}
                    disabled={!!opening}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-text text-white hover:opacity-85 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {opening === a.cert_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} View Certificate
                  </button>
                ) : a.status === 'GENERATING' ? (
                  <span className="text-sm text-brand-text/60 inline-flex items-center gap-1"><Clock className="w-4 h-4" /> Generating</span>
                ) : (
                  <span className="text-sm text-brand-text/50">Not generated</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-6">
          <div className="absolute inset-0 bg-black/70" onClick={() => setViewer(null)} />
          <div className="relative w-full max-w-5xl h-[90vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 bg-brand-text text-white">
              <div className="font-semibold truncate flex-1">
                {viewer.name} · <span className="font-mono">{viewer.certId}</span>
              </div>
              <a href={viewer.url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-white/10 rounded-lg" title="Open in new tab">
                <ExternalLink className="w-5 h-5" />
              </a>
              <a href={viewer.url} download={`ICAIDIET26_Certificate_${viewer.certId}.pdf`} className="p-1.5 hover:bg-white/10 rounded-lg" title="Download">
                <Download className="w-5 h-5" />
              </a>
              <button onClick={() => setViewer(null)} className="p-1.5 hover:bg-white/10 rounded-lg" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe title="Certificate" src={`${viewer.url}#view=FitH`} className="flex-1 w-full bg-neutral-200" />
          </div>
        </div>
      )}
    </div>
  );
}
