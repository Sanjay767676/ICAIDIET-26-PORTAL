import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Submission {
  id: string;
  submission_code: string;
  title: string;
  track: string;
  author_name: string;
  author_email: string;
  status: string;
  created_at: string;
}

interface FileView {
  open: boolean;
  url?: string;
  filename?: string;
  error?: string;
}

// ------------------------------------------------------------------
// Login screen (hardcoded admin auth against backend)
// ------------------------------------------------------------------
function LoginScreen({ onLogin }: { onLogin: (token: string, email: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.token) {
        setError(data?.error || 'Invalid credentials. Please try again.');
        setLoading(false);
        return;
      }
      onLogin(data.token, data.user?.email || username.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the server.');
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-20">
      <div className="bg-brand-card w-full max-w-md rounded-2xl p-8 shadow-xl border border-brand-text/5">
        <div className="text-center mb-8">
          <h2 className="font-serif text-3xl font-bold mb-2">Admin Sign In</h2>
          <p className="text-brand-text/70 text-sm">Restricted access. Authorized personnel only.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
              placeholder="snsct"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all mt-6 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// PDF viewer modal (fetches the file with the auth token)
// ------------------------------------------------------------------
function PdfViewer({ file, token, onClose }: { file: FileView; token: string; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const loadPdf = useCallback(async () => {
    if (!file.url) return;
    setError(null);
    const res = await fetch(file.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      setError('Could not load this manuscript. It may have been removed.');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (frameRef.current) frameRef.current.src = url;
  }, [file.url, token]);

  useEffect(() => {
    loadPdf();
  }, [loadPdf]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between px-5 py-3 bg-stone-900 text-white">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 shrink-0" />
            <span className="font-medium truncate">{file.filename || 'Manuscript'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setError(null);
                loadPdf();
              }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Reload"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" aria-label="Close">
              &times;
            </button>
          </div>
        </div>
        <div className="flex-1 bg-stone-100 relative">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-red-600 bg-red-50 border border-red-200 px-5 py-3 rounded-lg text-sm">
                {error}
              </div>
            </div>
          ) : (
            <iframe ref={frameRef} title="Manuscript" className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main app
// ------------------------------------------------------------------
export default function App() {
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('icaidiet_admin_token') || '');
  const [adminEmail, setAdminEmail] = useState<string>(() => sessionStorage.getItem('icaidiet_admin_user') || '');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState({ total: 0, accepted: 0, rejected: 0, submitted: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfView, setPdfView] = useState<FileView>({ open: false });

  const handleLogin = (newToken: string, email: string) => {
    setToken(newToken);
    setAdminEmail(email);
    sessionStorage.setItem('icaidiet_admin_token', newToken);
    sessionStorage.setItem('icaidiet_admin_user', email);
    setError(null);
  };

  const handleLogout = () => {
    setToken('');
    setAdminEmail('');
    setSubmissions([]);
    setPdfView({ open: false });
    sessionStorage.removeItem('icaidiet_admin_token');
    sessionStorage.removeItem('icaidiet_admin_user');
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load submissions.');
      }
      const list: Submission[] = data.submissions || [];
      setSubmissions(list);
      setStats({
        total: list.length,
        accepted: list.filter((s) => s.status === 'ACCEPTED').length,
        rejected: list.filter((s) => s.status === 'REJECTED').length,
        submitted: list.filter((s) => s.status === 'SUBMITTED').length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (token) {
      fetchSubmissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openPdf = async (id: string, filename: string) => {
    setPdfView({ open: true, url: `${API_URL}/api/admin/submissions/${id}/file`, filename });
  };

  const closePdf = () => {
    setPdfView({ open: false, url: undefined, filename: undefined, error: undefined });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
        <div className="flex-1 flex flex-col">
          <header className="border-b border-brand-text/10 bg-white">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
              <h1 className="font-serif font-bold text-2xl tracking-tight">ICAIDIET'26 Admin</h1>
            </div>
          </header>
          <LoginScreen onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-text bg-stone-100">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-serif font-bold text-2xl tracking-tight">ICAIDIET'26 Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500">{adminEmail}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold font-serif">Submissions</h2>
          <button
            onClick={fetchSubmissions}
            disabled={loading}
            className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
            <div className="text-3xl font-bold font-serif">{stats.total}</div>
            <div className="text-sm text-stone-500 mt-1">Total</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
            <div className="text-3xl font-bold font-serif text-amber-600">{stats.submitted}</div>
            <div className="text-sm text-stone-500 mt-1">Submitted</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
            <div className="text-3xl font-bold font-serif text-green-600">{stats.accepted}</div>
            <div className="text-sm text-stone-500 mt-1">Accepted</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4">
            <div className="text-3xl font-bold font-serif text-red-600">{stats.rejected}</div>
            <div className="text-sm text-stone-500 mt-1">Rejected</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200 text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Error loading submissions: {error}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="py-4 px-6 font-medium text-sm text-stone-500 uppercase tracking-wider">Paper Title</th>
                <th className="py-4 px-6 font-medium text-sm text-stone-500 uppercase tracking-wider">Track</th>
                <th className="py-4 px-6 font-medium text-sm text-stone-500 uppercase tracking-wider">Primary Author</th>
                <th className="py-4 px-6 font-medium text-sm text-stone-500 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 font-medium text-sm text-stone-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-500">Loading submissions...</td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-500">No submissions found.</td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-stone-900">
                      {sub.title}
                      <div className="text-xs text-stone-500 font-normal mt-0.5">{sub.submission_code}</div>
                    </td>
                    <td className="py-4 px-6 text-sm text-stone-600">{sub.track || '—'}</td>
                    <td className="py-4 px-6 text-sm text-stone-600">
                      {sub.author_name || 'N/A'}
                      {sub.author_email && (
                        <div className="text-xs text-stone-400 font-normal">{sub.author_email}</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          sub.status === 'ACCEPTED'
                            ? 'bg-green-100 text-green-800'
                            : sub.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : sub.status === 'UNDER_REVIEW'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sub.status || 'SUBMITTED'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => openPdf(sub.id, sub.title)}
                        className="inline-flex items-center gap-1.5 text-stone-900 font-medium text-sm hover:underline"
                      >
                        <Eye className="w-4 h-4" /> View PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {pdfView.open && pdfView.url && <PdfViewer file={pdfView} token={token} onClose={closePdf} />}
    </div>
  );
}