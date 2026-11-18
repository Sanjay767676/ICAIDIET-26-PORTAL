// Instant audio + haptic cues. Tones are synthesised (no files to download),
// and the AudioContext is unlocked on the first tap.
let ctx: AudioContext | null = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.25) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function vibrate(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* ignore */
  }
}

export const cue = {
  ok() {
    tone(1320, 0, 0.09);
    tone(1760, 0.1, 0.12);
    vibrate(80);
  },
  duplicate() {
    tone(660, 0, 0.14, 'triangle');
    tone(660, 0.18, 0.14, 'triangle');
    vibrate([60, 60, 60]);
  },
  error() {
    tone(180, 0, 0.32, 'square', 0.18);
    vibrate([200, 80, 200]);
  },
  queued() {
    tone(880, 0, 0.1, 'triangle');
    vibrate(40);
  },
};
