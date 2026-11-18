export const API_URL: string = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8787';

// Same pattern the Worker enforces. Anything else is rejected on the phone
// without a network round-trip.
export const QR_PATTERN = /^ICD26\.[a-f0-9]{24}\.[A-Za-z0-9_-]{22}$/;

export type Author = { id: string; name: string; college: string; is_primary: boolean };
export type Paper = {
  submission_id: string;
  paper_id: string;
  title: string;
  track: string;
  head_count: number | null;
  colleges: string[];
  authors: Author[];
  attendance: null | {
    marked_at: string;
    presented_count: number;
    authors: { id: string; name: string; college: string; status: 'PRESENT' | 'ABSENT' }[];
  };
};
export type VenueConfig = {
  venue_name: string;
  venue_lat: number;
  venue_lng: number;
  radius_m: number;
  max_accuracy_m: number;
  scanning_enabled: boolean;
};

export async function api<T = any>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_URL}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

// Open the connection to the API early so the first scan is fast.
export function preconnect() {
  try {
    const l = document.createElement('link');
    l.rel = 'preconnect';
    l.href = new URL(API_URL).origin;
    l.crossOrigin = 'anonymous';
    document.head.appendChild(l);
  } catch {
    /* ignore */
  }
}

export function fmtTime(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
  } catch {
    return iso;
  }
}
