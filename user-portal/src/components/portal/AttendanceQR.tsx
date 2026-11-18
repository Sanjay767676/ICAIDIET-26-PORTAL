import React, { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Loader2, QrCode, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// While the QR is on screen, ask the database for the attendance status this
// often. Short enough to feel instant at the registration desk, long enough
// not to hammer the Worker. Tab focus / visibility change / reconnect also
// trigger an immediate check on top of this timer.
const POLL_MS = 4000;

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'error'; message: string }
  | { kind: 'qr'; image: string }
  | { kind: 'marked'; markedAt: string; presented: number };

// Conference-day attendance for offline papers (and paper 1271).
// One QR per paper, generated and stored by the backend; any author of the
// paper who signs in sees the same QR. The component keeps asking the server
// for the live attendance status and swaps the QR for the thank-you note the
// moment the scanner marks the paper — no page refresh needed.
export function AttendanceQR({
  submissionId,
  getToken,
}: {
  submissionId: string;
  getToken: () => Promise<string | null>;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [checking, setChecking] = useState(false);

  // Refs keep the polling loop alive across re-renders. Rebuilding the timer
  // whenever a callback identity changed was why a marked paper kept showing
  // its QR until the author refreshed the page.
  const inFlight = useRef(false);
  const marked = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<number | undefined>(undefined);

  const check = useCallback(async () => {
    if (!mounted.current || marked.current || inFlight.current) return;
    inFlight.current = true;
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current);
      timer.current = undefined;
    }
    setChecking(true);
    try {
      let token = await getToken();
      for (let i = 0; i < 3 && !token; i++) {
        await new Promise((r) => setTimeout(r, 400));
        token = await getToken();
      }
      if (!token) {
        marked.current = true;
        setState({ kind: 'hidden' });
        return;
      }

      const res = await fetch(`${API_URL}/api/submissions/${submissionId}/attendance`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);

      // Backend without the attendance feature yet: show nothing.
      if (res.status === 404 && !data) {
        marked.current = true;
        setState({ kind: 'hidden' });
        return;
      }
      if (!res.ok || !data?.success) {
        // A blip during polling must not throw away a QR that is already on
        // screen — keep it and let the next check recover.
        setState((prev) =>
          prev.kind === 'qr'
            ? prev
            : { kind: 'error', message: data?.error || 'Could not load your attendance QR.' }
        );
        return;
      }
      if (!data.eligible) {
        marked.current = true;
        setState({ kind: 'hidden' });
        return;
      }

      // The server is the only source of truth: paper_attendance is written by
      // the scanner, so this is the exact moment we switch to the thank-you.
      if (data.marked) {
        marked.current = true;
        setState({ kind: 'marked', markedAt: data.marked_at, presented: data.presented_count });
        return;
      }

      const image = await QRCode.toDataURL(data.qr, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 560,
      });
      setState((prev) => (prev.kind === 'qr' && prev.image === image ? prev : { kind: 'qr', image }));
    } catch {
      setState((prev) =>
        prev.kind === 'qr'
          ? prev
          : { kind: 'error', message: 'Could not reach the server. Please try again.' }
      );
    } finally {
      inFlight.current = false;
      setChecking(false);
      // Schedule the next check from here so there is always exactly one
      // pending timer, regardless of how many triggers fired this check.
      if (mounted.current && !marked.current && timer.current === undefined) {
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          void checkRef.current();
        }, POLL_MS);
      }
    }
  }, [submissionId, getToken]);

  // Latest callback without restarting the loop when getToken changes identity.
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  }, [check]);

  // One mount-time loop: start checking straight away, then re-check the
  // instant the tab becomes visible / regains focus or the network returns.
  useEffect(() => {
    mounted.current = true;
    void checkRef.current();

    const wake = () => {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
      void checkRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake();
    };

    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted.current = false;
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      timer.current = undefined;
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // A different paper means a fresh, unmarked status to watch.
  useEffect(() => {
    marked.current = false;
    setState({ kind: 'loading' });
    void checkRef.current();
  }, [submissionId]);

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
        <button onClick={() => void check()} className="inline-flex items-center gap-1.5 font-bold underline">
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

  // state.kind === 'qr'
  return (
    <div className="bg-white rounded-2xl p-6 sm:p-7 shadow-lg border-2 border-black text-black">
      <div className="flex items-center gap-2 pb-3 border-b border-stone-200">
        <QrCode className="w-5 h-5" />
        <h4 className="text-lg sm:text-xl font-bold font-serif">Show this QR to mark your attendance</h4>
        <span className="ml-auto text-[11px] text-black/50 flex items-center gap-1 whitespace-nowrap">
          {checking ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Checking…
            </>
          ) : (
            'Live status'
          )}
        </span>
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
          <p className="text-xs text-black/60">
            This page checks for the confirmation automatically — keep it open, no refresh needed.
          </p>
          <button
            type="button"
            onClick={() => void check()}
            disabled={checking}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-black underline underline-offset-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} /> Check now
          </button>
        </div>
      </div>
    </div>
  );
}
