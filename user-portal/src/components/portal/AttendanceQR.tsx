import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Loader2, QrCode, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'error'; message: string }
  | { kind: 'qr'; image: string }
  | { kind: 'marked'; markedAt: string; presented: number };

// Conference-day attendance for offline papers (and paper 1271).
// One QR per paper, generated and stored by the backend; any author of the
// paper who signs in sees the same QR. Once the scanner marks attendance the
// QR is replaced by the thank-you note. Renders nothing for online papers.
export function AttendanceQR({
  submissionId,
  getToken,
}: {
  submissionId: string;
  getToken: () => Promise<string | null>;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      let token = await getToken();
      for (let i = 0; i < 3 && !token; i++) {
        await new Promise((r) => setTimeout(r, 400));
        token = await getToken();
      }
      if (!token) return setState({ kind: 'hidden' });
      const res = await fetch(`${API_URL}/api/submissions/${submissionId}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      // Backend without the attendance feature yet: show nothing.
      if (res.status === 404 && !data) return setState({ kind: 'hidden' });
      if (!res.ok || !data?.success) {
        return setState({ kind: 'error', message: data?.error || 'Could not load your attendance QR.' });
      }
      if (!data.eligible) return setState({ kind: 'hidden' });
      if (data.marked) return setState({ kind: 'marked', markedAt: data.marked_at, presented: data.presented_count });
      const image = await QRCode.toDataURL(data.qr, { errorCorrectionLevel: 'M', margin: 2, width: 560 });
      setState({ kind: 'qr', image });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Please try again.' });
    }
  }, [submissionId, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  // While the QR is on screen, check every 15 s so it switches to the
  // thank-you note as soon as the scanner marks attendance.
  useEffect(() => {
    if (state.kind !== 'qr') return;
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, [state.kind, load]);

  if (state.kind === 'hidden') return null;

  if (state.kind === 'loading') {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-black text-black flex items-center gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your attendance QR…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="bg-white rounded-2xl p-5 shadow-lg border-2 border-red-300 text-red-700 text-sm flex items-center justify-between gap-3">
        <span>{state.message}</span>
        <button onClick={load} className="inline-flex items-center gap-1.5 font-bold underline">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (state.kind === 'marked') {
    return (
      <div className="rounded-2xl p-6 sm:p-8 shadow-lg border-2 border-green-600 bg-green-50 text-black">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <CheckCircle2 className="w-12 h-12 text-green-700 shrink-0" />
          <div className="space-y-2">
            <h4 className="font-serif text-xl sm:text-2xl font-bold leading-snug text-green-900">
              Thank you for attending ICAIDIET'26
            </h4>
            <p className="text-base font-semibold text-green-900">Your attendance has been marked successfully.</p>
            <p className="text-sm sm:text-base text-black/80 leading-relaxed">
              Please collect your conference kit and proceed to the session hall allocated to you.
            </p>
            <p className="text-sm sm:text-base text-black/80 leading-relaxed">
              Certificates will be issued once you complete your presentation.
            </p>
            <p className="text-sm sm:text-base font-semibold text-black/80">Thank you!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-black text-black">
      <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
        <QrCode className="w-5 h-5" />
        <h4 className="text-lg sm:text-xl font-bold font-serif">Show this QR to mark your attendance</h4>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
        <img
          src={state.image}
          alt="Attendance QR for this paper"
          className="w-64 h-64 sm:w-56 sm:h-56 rounded-xl border-2 border-black/10 bg-white"
        />
        <div className="text-sm text-black/75 space-y-2 max-w-md">
          <p>Show this QR at the ICAIDIET'26 registration desk. It is one QR for your paper, so any one author can show it.</p>
          <p>The desk will mark each author present or absent. Once marked, this QR is replaced by a confirmation.</p>
          <p className="font-semibold text-black">Increase your screen brightness for faster scanning. Please do not share this QR.</p>
        </div>
      </div>
    </div>
  );
}
