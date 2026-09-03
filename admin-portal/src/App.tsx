import React, { useState, useEffect } from 'react';

interface Submission {
  id: string;
  submission_code: string;
  title: string;
  track: string;
  author: string;
  status: string;
  created_at: string;
}

export default function App() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/api/admin/submissions`);
        if (!res.ok) throw new Error('Failed to fetch submissions');
        const data = await res.json();
        setSubmissions(data.submissions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, []);

  return (
    <div className="min-h-screen bg-stone-100 font-sans text-stone-900">
      <header className="bg-white border-b border-stone-200 sticky top-0">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="font-serif font-bold text-2xl tracking-tight">ICAIDIET'26 Admin</h1>
          <div className="text-sm font-medium">Admin User</div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold font-serif">Submissions</h2>
          <span className="bg-stone-900 text-white px-3 py-1 rounded-full text-sm font-medium">Total: {submissions.length}</span>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200">
            Error loading submissions: {error}
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
              ) : submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                  <td className="py-4 px-6 font-medium text-stone-900">
                    {sub.title}
                    <div className="text-xs text-stone-500 font-normal mt-0.5">{sub.submission_code}</div>
                  </td>
                  <td className="py-4 px-6 text-sm text-stone-600">{sub.track}</td>
                  <td className="py-4 px-6 text-sm text-stone-600">{sub.author || 'N/A'}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      sub.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {sub.status || 'SUBMITTED'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="text-stone-900 font-medium text-sm hover:underline">View PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
