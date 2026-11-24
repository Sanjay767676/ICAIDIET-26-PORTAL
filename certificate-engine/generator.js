// Batch generator: asks the Worker for the next authors, renders each certificate
// and uploads the PDF back to the Worker (which stores it in R2 and marks it READY).
// Safe to stop and restart at any point: unfinished certificates keep their ID and
// are handed out again by the next claim.

import { generateCertificate } from './engine.js';

export function config() {
  const apiUrl = (process.env.API_URL || '').replace(/\/+$/, '');
  const secret = process.env.CERTIFICATE_SECRET || '';
  if (!apiUrl) throw new Error('API_URL is not set (the Cloudflare Worker URL).');
  if (secret.length < 16) throw new Error('CERTIFICATE_SECRET is not set (min 16 chars, same value as the Worker secret).');
  return {
    apiUrl,
    secret,
    style: process.env.CERT_STYLE || 'A_classic',
    batchSize: Math.min(Math.max(parseInt(process.env.BATCH_SIZE || '20', 10) || 20, 1), 50),
  };
}

async function call(cfg, path, init = {}) {
  const res = await fetch(cfg.apiUrl + path, {
    ...init,
    headers: { 'X-Certificate-Secret': cfg.secret, ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${data?.error || ''}`.trim());
  }
  return data;
}

export const fetchStats = (cfg) => call(cfg, '/api/internal/certificates/stats');

/**
 * Runs until every eligible author has a READY certificate.
 * state: object updated in place so /status can report progress.
 */
export async function runAll(cfg, state = {}, log = console.log) {
  Object.assign(state, { running: true, done: 0, failed: 0, errors: [], startedAt: new Date().toISOString(), finishedAt: null });
  const failedIds = new Set();
  try {
    for (;;) {
      if (state.stopRequested) { log('Stop requested.'); break; }
      const claim = await call(cfg, '/api/internal/certificates/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: cfg.batchSize }),
      });
      Object.assign(state, { eligible: claim.eligible_authors, ready: claim.ready, remaining: claim.remaining });
      // Skip certificates that already failed in this run so one bad row cannot loop forever.
      const items = claim.items.filter((it) => !failedIds.has(it.cert_id));
      if (!items.length) break;

      for (const it of items) {
        try {
          // Print exactly what the Worker sent (title + first + last name, college as entered).
          const r = await generateCertificate({ name: it.name, college: it.college, certId: it.cert_id }, cfg.style);
          const form = new FormData();
          form.append('file', new Blob([r.pdf], { type: 'application/pdf' }), `${it.cert_id}.pdf`);
          form.append('printed_name', r.name);
          form.append('printed_college', r.college);
          form.append('warnings', [...r.warnings, ...(it.notes || [])].join(','));
          await call(cfg, `/api/internal/certificates/${it.cert_id}/file`, { method: 'POST', body: form });
          state.done++;
          const flags = [...r.warnings, ...(it.notes || [])];
          // Never log names or colleges: Render logs and /status are visible to
          // anyone who knows the service URL. The certificate ID is enough.
          log(`OK   ${it.cert_id}${flags.length ? '  [' + flags.join(',') + ']' : ''}`);
        } catch (e) {
          failedIds.add(it.cert_id);
          state.failed++;
          state.errors.push(`${it.cert_id}: ${e.message}`);
          log(`FAIL ${it.cert_id}  ${e.message}`);
        }
      }
    }
    const s = await fetchStats(cfg);
    Object.assign(state, { eligible: s.eligible_authors, ready: s.ready, remaining: s.remaining });
    log(`Finished. generated=${state.done} failed=${state.failed} ready=${s.ready}/${s.eligible_authors}`);
  } catch (e) {
    state.errors.push(e.message);
    log(`STOPPED: ${e.message}`);
  } finally {
    state.running = false;
    state.stopRequested = false;
    state.finishedAt = new Date().toISOString();
  }
  return state;
}
