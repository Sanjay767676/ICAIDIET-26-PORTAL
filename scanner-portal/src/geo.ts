import { useEffect, useRef, useState } from 'react';

export type Fix = { lat: number; lng: number; accuracy: number; at: number };
export type GeoState =
  | { status: 'waiting' }
  | { status: 'denied'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'ok'; fix: Fix };

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Continuous high-accuracy watch. The latest fix is also kept in a ref so the
// scan handler can read it synchronously without re-rendering.
export function useGeolocation(enabled = true) {
  const [state, setState] = useState<GeoState>({ status: 'waiting' });
  const latest = useRef<Fix | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable', message: 'This browser cannot read location.' });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
        latest.current = fix;
        setState({ status: 'ok', fix });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: 'denied', message: 'Location permission is blocked. Allow location for this site in browser settings.' });
        } else if (!latest.current) {
          setState({ status: 'unavailable', message: 'Could not get a GPS fix. Turn on Location / GPS.' });
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { state, latest };
}

export function getOneFix(timeout = 15000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser cannot read location.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Location permission is blocked. Allow location for this site and try again.'
              : 'Could not get your location. Turn on GPS and try again.'
          )
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout }
    );
  });
}
