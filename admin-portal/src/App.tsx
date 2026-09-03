import React from 'react';

export default function App() {
  const mockSubmissions = [
    { id: 1, title: 'AI in Modern Healthcare', track: 'AI in Healthcare', author: 'Dr. Jane Smith', status: 'Under Review' },
    { id: 2, title: 'Deep Learning for Robotics', track: 'Robotics', author: 'Dr. Alan Turing', status: 'Accepted' },
  ];

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
          <span className="bg-stone-900 text-white px-3 py-1 rounded-full text-sm font-medium">Total: 2</span>
        </div>

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
              {mockSubmissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-stone-50 transition-colors">
                  <td className="py-4 px-6 font-medium text-stone-900">{sub.title}</td>
                  <td className="py-4 px-6 text-sm text-stone-600">{sub.track}</td>
                  <td className="py-4 px-6 text-sm text-stone-600">{sub.author}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      sub.status === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {sub.status}
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
