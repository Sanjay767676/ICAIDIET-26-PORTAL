import { useCallback, useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Check, Flashlight, Loader2, LocateFixed, MapPinOff, RotateCcw, X } from 'lucide-react';
import { api, fmtTime, QR_PATTERN, type Paper, type VenueConfig } from './api';
import { distanceMeters, useGeolocation, type Fix } from './geo';
import { cue, unlockAudio } from './feedback';

type Sheet =
  | { kind: 'loading' }
  | { kind: 'mark'; paper: Paper; ticket: string }
  | { kind: 'already'; paper: Paper }
  | { kind: 'done'; paper: Paper; presented: number };

type Toast = { title: string; detail: string };

const SAME_CODE_COOLDOWN_MS = 3000;

function geoGate(cfg: VenueConfig | null, fix: Fix | null) {
  if (!cfg || !fix) return null;
  const d = distanceMeters(fix.lat, fix.lng, cfg.venue_lat, cfg.venue_lng);
  if (fix.accuracy > cfg.max_accuracy_m) return { ok: false as const, reason: 'weak' as const, d, acc: fix.accuracy };
  if (d > cfg.radius_m + Math.min(fix.accuracy, 75)) return { ok: false as const, reason: 'outside' as const, d, acc: fix.accuracy };
  return { ok: true as const, d, acc: fix.accuracy };
}

function reload() {
  window.location.reload();
}

function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const recent = useRef(new Map<string, number>());
  const busyRef = useRef(false);

  const { state: geo, latest: fixRef } = useGeolocation(true);
  const [cfg, setCfg] = useState<VenueConfig | null>(null);
  const [cfgError, setCfgError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [saving, setSaving] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ has: boolean; on: boolean }>({ has: false, on: false });
  // One tap before the camera starts: browsers only allow vibration and sound
  // after the user has touched the page.
  const [started, setStarted] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // ---- venue config --------------------------------------------------------
  const loadCfg = useCallback(async () => {
    try {
      const { data } = await api('/api/attendance/config');
      if (data?.success) {
        setCfg(data);
        setCfgError(null);
      } else setCfgError('Could not load the scanner settings.');
    } catch {
      setCfgError("Can't reach the ICAIDIET server. Check the internet connection and try again. If this continues, the backend has not been updated for the scanner yet.");
    }
  }, []);
  useEffect(() => {
    loadCfg();
  }, [loadCfg]);

  const fix = geo.status === 'ok' ? geo.fix : null;
  const gate = geoGate(cfg, fix);
  const onCampus = !!cfg && cfg.scanning_enabled && !!gate?.ok;
  const canScan = onCampus && started;

  // Keep the screen awake while the scanner is open.
  useEffect(() => {
    let lock: any = null;
    const take = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* ignore */
      }
    };
    take();
    const onVis = () => document.visibilityState === 'visible' && take();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      try {
        lock?.release();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const flash = (t: Toast) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  const here = useCallback(() => {
    const f = fixRef.current;
    return f ? { lat: f.lat, lng: f.lng, accuracy: f.accuracy } : { lat: null, lng: null, accuracy: null };
  }, [fixRef]);

  // ---- scan ----------------------------------------------------------------
  const onDecode = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      const now = Date.now();
      const last = recent.current.get(text);
      recent.current.set(text, now);
      if (busyRef.current) return;
      if (last && now - last < SAME_CODE_COOLDOWN_MS) return;

      if (!QR_PATTERN.test(text)) {
        cue.error();
        flash({ title: 'Not an ICAIDIET QR', detail: "Ask the author to open My Submissions in the ICAIDIET'26 portal." });
        return;
      }

      busyRef.current = true;
      setSheet({ kind: 'loading' });
      try {
        const { status, data } = await api('/api/attendance/scan', { qr: text, ...here() });
        if (status === 200 && data?.success) {
          if (data.already_marked) {
            cue.duplicate();
            setSheet({ kind: 'already', paper: data.paper });
          } else {
            cue.ok();
            setPresent(new Set());
            setSheet({ kind: 'mark', paper: data.paper, ticket: data.ticket });
          }
          return;
        }
        cue.error();
        setSheet(null);
        busyRef.current = false;
        flash({
          title: data?.code === 'OUTSIDE_VENUE' ? 'This geolocation is not accessible' : 'QR not accepted',
          detail: data?.error || 'Try again.',
        });
      } catch {
        cue.error();
        setSheet(null);
        busyRef.current = false;
        flash({ title: 'No connection', detail: 'Check the internet and scan again.' });
      }
    },
    [here]
  );

  const onDecodeRef = useRef(onDecode);
  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  const closeSheet = useCallback(() => {
    setSheet(null);
    setPresent(new Set());
    busyRef.current = false;
    recent.current.clear();
  }, []);

  const mark = async () => {
    if (sheet?.kind !== 'mark' || present.size === 0) return;
    setSaving(true);
    try {
      const { status, data } = await api('/api/attendance/mark', {
        ticket: sheet.ticket,
        present_author_ids: Array.from(present),
        ...here(),
      });
      if (status === 200 && data?.success) {
        cue.ok();
        setSheet({ kind: 'done', paper: sheet.paper, presented: data.presented_count });
        window.setTimeout(closeSheet, 2200);
      } else if (status === 409 && data?.paper) {
        cue.duplicate();
        setSheet({ kind: 'already', paper: data.paper });
      } else {
        cue.error();
        flash({
          title: data?.code === 'OUTSIDE_VENUE' ? 'This geolocation is not accessible' : 'Not saved',
          detail: data?.error || 'Try again.',
        });
        if (data?.code === 'TICKET') closeSheet();
      }
    } catch {
      cue.error();
      flash({ title: 'No connection', detail: 'Nothing was saved. Tap Mark attendance again.' });
    } finally {
      setSaving(false);
    }
  };

  // ---- camera (starts only when the phone is on campus) -------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!canScan || !video) return;
    const scanner = new QrScanner(video, (r) => onDecodeRef.current(r.data), {
      preferredCamera: 'environment',
      maxScansPerSecond: 15,
      returnDetailedScanResult: true,
      highlightScanRegion: false,
      highlightCodeOutline: false,
      // Decode a centred square, downscaled: much faster than the full frame.
      calculateScanRegion: (v) => {
        const size = Math.round(Math.min(v.videoWidth, v.videoHeight) * 0.78);
        return {
          x: Math.round((v.videoWidth - size) / 2),
          y: Math.round((v.videoHeight - size) / 2),
          width: size,
          height: size,
          downScaledWidth: 480,
          downScaledHeight: 480,
        };
      },
      onDecodeError: () => {},
    });
    scannerRef.current = scanner;
    scanner
      .start()
      .then(async () => {
        setCamError(null);
        try {
          setTorch({ has: await scanner.hasFlash(), on: false });
        } catch {
          /* ignore */
        }
      })
      .catch((e) =>
        setCamError(
          /NotAllowed|permission/i.test(String(e))
            ? 'Camera access is blocked. Allow the camera for this site in the browser settings, then reload.'
            : 'The camera could not start. Close other apps using it and reload.'
        )
      );
    const onVis = () => (document.visibilityState === 'visible' ? scanner.start().catch(() => undefined) : scanner.stop());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [canScan]);

  const toggleTorch = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.toggleFlash();
      setTorch({ has: true, on: s.isFlashOn() });
    } catch {
      /* ignore */
    }
  };

  // ---- what blocks scanning right now -------------------------------------
  let blocker: { title: string; body: string; icon: 'pin' | 'locate'; retry?: () => void } | null = null;
  if (cfgError) blocker = { title: 'Server not reachable', body: cfgError, icon: 'pin', retry: loadCfg };
  else if (geo.status === 'denied' || geo.status === 'unavailable')
    blocker = { title: 'This geolocation is not accessible', body: geo.message, icon: 'pin', retry: reload };
  else if (!cfg || geo.status === 'waiting') blocker = { title: 'Finding your location', body: 'Hold on while GPS gets a fix.', icon: 'locate' };
  else if (!cfg.scanning_enabled) blocker = { title: 'Scanning is paused', body: 'The organisers have paused attendance scanning.', icon: 'pin' };
  else if (gate && !gate.ok && gate.reason === 'outside')
    blocker = {
      title: 'This geolocation is not accessible',
      body: `The scanner works only at ${cfg.venue_name}. This phone is about ${formatDistance(gate.d)} away.`,
      icon: 'pin',
    };
  else if (gate && !gate.ok && gate.reason === 'weak')
    blocker = { title: 'Weak GPS signal', body: `Accuracy is ±${Math.round(gate.acc)} m. Step near a window or outdoors for a moment.`, icon: 'locate' };

  return (
    <div className="h-full flex flex-col bg-black text-white" onPointerDown={unlockAudio}>
      <header className="flex items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black">
        <img src="/favicon.png" alt="ICAIDIET'26" className="h-10 w-auto rounded-lg bg-white p-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[16px] leading-tight font-bold truncate">ICAIDIET Attendance Scanner</h1>
          <p className="text-xs text-white/60 truncate">{cfg?.venue_name || 'SNS College of Technology, Coimbatore'}</p>
        </div>
        {gate?.ok && (
          <span title="On campus" className="flex items-center justify-center rounded-full bg-brand-accent text-black w-9 h-9 shrink-0">
            <LocateFixed className="w-4 h-4" />
            <span className="sr-only">On campus</span>
          </span>
        )}
      </header>

      <main className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${canScan ? '' : 'hidden'}`} muted playsInline />

        {canScan && !camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="finder relative w-[70vmin] h-[70vmin] max-w-[400px] max-h-[400px]">
              <i />
              {!sheet && <div className="sweep absolute left-[6%] right-[6%] h-[3px] rounded bg-brand-accent shadow-[0_0_16px_#ffbf00]" />}
            </div>
            <p className="mt-6 text-sm font-semibold text-white/90 bg-black/55 rounded-full px-4 py-2">
              Point at the QR on the author's My Submissions page
            </p>
          </div>
        )}

        {canScan && torch.has && (
          <button
            onClick={toggleTorch}
            aria-label="Torch"
            className={`absolute top-3 right-3 rounded-full p-3 ${torch.on ? 'bg-brand-accent text-black' : 'bg-black/60 text-white'}`}
          >
            <Flashlight className="w-5 h-5" />
          </button>
        )}

        {onCampus && !started && !blocker && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-brand-bg text-black">
            <img src="/favicon.png" alt="" className="h-28 w-auto" />
            <h2 className="font-serif text-2xl font-bold mt-4">You are on campus</h2>
            <p className="mt-2 text-[15px] text-black/75 max-w-xs">Allow the camera when asked. The phone vibrates when a QR is verified.</p>
            <button
              onClick={() => {
                unlockAudio();
                try { navigator.vibrate?.(30); } catch { /* ignore */ }
                setStarted(true);
              }}
              className="mt-7 w-full max-w-xs rounded-2xl bg-black text-brand-accent py-4 text-lg font-extrabold"
            >
              Start scanning
            </button>
          </div>
        )}

        {camError && canScan && <Gate title="Camera unavailable" body={camError} icon="pin" retry={reload} />}
        {blocker && <Gate {...blocker} />}

        {toast && (
          <div role="alert" className="pop absolute left-3 right-3 top-3 z-20 rounded-2xl p-4 shadow-2xl bg-red-700 text-white">
            <div className="font-bold text-base">{toast.title}</div>
            <div className="text-sm opacity-90">{toast.detail}</div>
          </div>
        )}

        {sheet && (
          <AttendanceSlip sheet={sheet} present={present} setPresent={setPresent} saving={saving} onMark={mark} onClose={closeSheet} />
        )}
      </main>
    </div>
  );
}

function Gate({ title, body, icon, retry }: { title: string; body: string; icon: 'pin' | 'locate'; retry?: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 bg-brand-bg text-black">
      <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mb-5">
        {icon === 'pin' ? <MapPinOff className="w-9 h-9 text-brand-accent" /> : <Loader2 className="w-9 h-9 text-brand-accent animate-spin" />}
      </div>
      <h2 className="font-serif text-2xl font-bold leading-snug max-w-xs">{title}</h2>
      <p className="mt-3 text-[15px] text-black/75 max-w-xs leading-relaxed">{body}</p>
      {retry && (
        <button onClick={retry} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black text-white px-5 py-3 font-bold">
          <RotateCcw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attendance slip: the verified paper, a Present / Absent switch per author,
// read-only camera-ready facts, and one action.
// ---------------------------------------------------------------------------
function AttendanceSlip({
  sheet,
  present,
  setPresent,
  saving,
  onMark,
  onClose,
}: {
  sheet: Sheet;
  present: Set<string>;
  setPresent: (s: Set<string>) => void;
  saving: boolean;
  onMark: () => void;
  onClose: () => void;
}) {
  if (sheet.kind === 'loading') {
    return (
      <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center">
        <div className="bg-brand-bg text-black rounded-2xl px-6 py-5 flex items-center gap-3 font-bold">
          <Loader2 className="w-5 h-5 animate-spin" /> Verifying QR…
        </div>
      </div>
    );
  }

  if (sheet.kind === 'done') {
    return (
      <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
        <div className="pop w-full max-w-sm rounded-3xl bg-green-700 text-white p-7 text-center">
          <div className="mx-auto w-20 h-20 rounded-full bg-white text-green-700 flex items-center justify-center">
            <Check className="w-12 h-12" strokeWidth={3} />
          </div>
          <h2 className="font-serif text-2xl font-bold mt-4">Attendance marked</h2>
          <p className="mt-1 text-white/90">
            Paper {sheet.paper.paper_id}: {sheet.presented} of {sheet.paper.authors.length} present
          </p>
        </div>
      </div>
    );
  }

  const { paper } = sheet;
  const readOnly = sheet.kind === 'already';
  const statusOf = (id: string): 'PRESENT' | 'ABSENT' =>
    readOnly ? paper.attendance?.authors.find((a) => a.id === id)?.status || 'ABSENT' : present.has(id) ? 'PRESENT' : 'ABSENT';
  const presentedCount = readOnly ? paper.attendance?.presented_count ?? 0 : present.size;
  const rosterNames = readOnly && paper.attendance ? paper.attendance.authors : paper.authors;

  const set = (id: string, on: boolean) => {
    const next = new Set(present);
    if (on) next.add(id);
    else next.delete(id);
    setPresent(next);
  };

  return (
    <div className="absolute inset-0 z-10 bg-black/55 flex items-end sm:items-center justify-center">
      <section
        aria-label="Attendance details"
        className="slip-in w-full sm:max-w-md max-h-[94%] flex flex-col bg-brand-bg text-black rounded-t-[28px] sm:rounded-[28px] shadow-2xl"
      >
        <div className="perforation" aria-hidden />
        <div className="overflow-y-auto px-5 pt-3 pb-3">
          <div className="flex items-center gap-2">
            {readOnly ? (
              <span className="inline-flex items-center rounded-full bg-brand-accent px-3 py-1 text-xs font-bold">
                Already marked on {fmtTime(paper.attendance?.marked_at)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-700 text-white px-3 py-1 text-xs font-bold">
                <Check className="w-3.5 h-3.5" strokeWidth={3} /> QR verified
              </span>
            )}
            <button onClick={onClose} aria-label="Close" className="ml-auto rounded-full p-2 hover:bg-black/5">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="mt-3 text-sm font-bold text-black/60">Paper {paper.paper_id}</p>
          <h2 className="font-serif text-[21px] leading-snug font-bold mt-0.5">{paper.title}</h2>

          <div className="mt-5 flex items-baseline justify-between">
            <h3 className="text-base font-extrabold">Authors</h3>
            {!readOnly && (
              <button onClick={() => setPresent(new Set(paper.authors.map((a) => a.id)))} className="text-sm font-bold underline underline-offset-4">
                Mark all present
              </button>
            )}
          </div>
          <ul className="mt-2 space-y-2">
            {rosterNames.map((a) => {
              const st = statusOf(a.id);
              return (
                <li key={a.id} className="rounded-2xl bg-white border-2 border-black/10 p-3">
                  <div className="font-bold leading-snug">{a.name}</div>
                  {a.college && <div className="text-xs text-black/60 mt-0.5">{a.college}</div>}
                  <div className="mt-2.5 grid grid-cols-2 gap-2" role="group" aria-label={`Attendance for ${a.name}`}>
                    <button
                      disabled={readOnly}
                      aria-pressed={st === 'PRESENT'}
                      onClick={() => set(a.id, true)}
                      className={`rounded-xl py-2.5 text-sm font-bold border-2 transition-colors disabled:cursor-default ${
                        st === 'PRESENT' ? 'bg-green-700 border-green-700 text-white' : 'bg-white border-black/15 text-black/70'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      disabled={readOnly}
                      aria-pressed={st === 'ABSENT'}
                      onClick={() => set(a.id, false)}
                      className={`rounded-xl py-2.5 text-sm font-bold border-2 transition-colors disabled:cursor-default ${
                        st === 'ABSENT' ? 'bg-black border-black text-white' : 'bg-white border-black/15 text-black/70'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="mt-5 rounded-2xl border-2 border-black bg-white">
            <Fact label="College / Industry" value={paper.colleges.length ? paper.colleges.join(', ') : 'Not provided'} />
            <Fact label="Head count (camera-ready)" value={paper.head_count != null ? String(paper.head_count) : 'Not provided'} />
            <Fact label="Presented count" value={`${presentedCount} of ${rosterNames.length}`} strong last />
          </dl>
        </div>

        <div className="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t-2 border-black/10">
          {readOnly ? (
            <button onClick={onClose} className="w-full rounded-2xl bg-black text-white py-4 text-base font-bold">
              Scan next QR
            </button>
          ) : (
            <button
              onClick={onMark}
              disabled={saving || present.size === 0}
              className="w-full rounded-2xl bg-black text-brand-accent py-4 text-base font-extrabold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-5 h-5 animate-spin" />}
              {present.size === 0 ? 'Select who is present' : `Mark attendance (${present.size} present)`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function Fact({ label, value, strong, last }: { label: string; value: string; strong?: boolean; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-4 py-3 ${last ? '' : 'border-b-2 border-black/10'}`}>
      <dt className="text-sm text-black/65">{label}</dt>
      <dd className={`text-right ${strong ? 'text-lg font-extrabold' : 'text-sm font-bold'}`}>{value}</dd>
    </div>
  );
}
