import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Inbox, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface MySubmission {
  id: string;
  submission_code: string;
  paper_id: string;
  title: string;
  abstract: string;
  track: string;
  status: string;
  created_at: string;
  author_count: number;
}

interface MySubmissionsProps {
  getToken: () => Promise<string | null>;
  onBack: () => void;
  onStart: () => void;
}

function statusBadge(status: string) {
  const cls =
    status === 'ACCEPTED'
      ? 'bg-green-100 text-green-800'
      : status === 'REJECTED'
        ? 'bg-red-100 text-red-800'
        : status === 'UNDER_REVIEW'
          ? 'bg-blue-100 text-blue-800'
          : status === 'REVISION_REQUIRED'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-amber-100 text-amber-800';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {(status || 'SUBMITTED').replace(/_/g, ' ')}
    </span>
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function MySubmissions({ getToken, onBack, onStart }: MySubmissionsProps) {
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (!cancelled) setError('Please sign in to view your submissions.');
          return;
        }
        const res = await fetch(`${API_URL}/api/submissions/mine`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setError('Could not load your submissions. Please try again.');
          return;
        }
        const data = await res.json().catch(() => null);
        if (!cancelled) setSubs(data?.submissions || []);
      } catch {
        if (!cancelled) setError('Could not reach the server. Please try again.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

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
        <div className="space-y-5">
          {subs.map((sub) => (
            <div
              key={sub.id}
              className="bg-brand-card rounded-2xl p-6 shadow-xl border border-brand-text/5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0 mt-1">
                    <FileText className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-bold leading-snug">{sub.title}</h3>
                    <div className="text-sm text-brand-text/60 mt-1">
                      {sub.submission_code}
                      {sub.paper_id ? ` · CMT ID: ${sub.paper_id}` : ''}
                      {sub.author_count ? ` · Authors: ${sub.author_count}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-brand-text/50">{formatDate(sub.created_at)}</span>
                  {statusBadge(sub.status)}
                </div>
              </div>

              {sub.abstract && (
                <p className="text-sm text-brand-text/70 mt-4 leading-relaxed line-clamp-3">{sub.abstract}</p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-brand-text/10 pt-4">
                <span className="text-sm text-brand-text/60 capitalize">{sub.track?.replace(/-/g, ' ')}</span>
                <span className="text-xs text-brand-text/50">{sub.author_count} {sub.author_count === 1 ? 'author' : 'authors'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}