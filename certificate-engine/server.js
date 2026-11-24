// Render web service for the ICAIDIET'26 certificate engine.
//
//   GET  /            health check (Render uses it)
//   GET  /status      progress of the current / last run    (X-Certificate-Secret)
//   POST /run         start generating all pending certificates   (X-Certificate-Secret)
//   POST /stop        stop after the current certificate          (X-Certificate-Secret)
//
// Env: API_URL, CERTIFICATE_SECRET, CERT_STYLE (A_classic), BATCH_SIZE (20), PORT,
//      AUTO_RUN (default "true").
//
// The Worker calls POST /run after every payment / Edit Authors approval and from
// its hourly cron. A sleeping free instance may not answer that first call in time,
// so on every start-up the engine also checks the Worker and starts a run by itself
// when certificates are waiting (AUTO_RUN). While a run is active it pings its own
// public URL (RENDER_EXTERNAL_URL) so Render does not put it to sleep mid-run.

import http from 'node:http';
import { config, fetchStats, runAll } from './generator.js';

const cfg = config();
const state = { running: false, done: 0, failed: 0, errors: [], logs: [] };
const log = (line) => {
  const msg = `${new Date().toISOString()} ${line}`;
  console.log(msg);
  state.logs.push(msg);
  if (state.logs.length > 200) state.logs.shift();
};

function authorised(req) {
  const given = req.headers['x-certificate-secret'] || '';
  return typeof given === 'string' && given.length === cfg.secret.length && given === cfg.secret;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body, null, 1));
}

let keepAlive;
function startRun(reason) {
  if (state.running) return false;
  log(`Run started (${reason}; style ${cfg.style}, batch ${cfg.batchSize})`);
  runAll(cfg, state, log); // background
  startKeepAlive();
  return true;
}

function startKeepAlive() {
  const self = process.env.RENDER_EXTERNAL_URL;
  if (!self || keepAlive) return;
  keepAlive = setInterval(() => {
    if (!state.running) { clearInterval(keepAlive); keepAlive = undefined; return; }
    fetch(self + '/').catch(() => {});
  }, 4 * 60 * 1000);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    // Health check for Render and uptime monitors (UptimeRobot etc.): GET or HEAD on / or /health.
    if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/health')) {
      if (req.method === 'HEAD') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(); }
      return send(res, 200, { ok: true, service: 'icaidiet-certificate-engine', running: state.running });
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      // Progress logs and Worker stats describe real authors, so this endpoint
      // is private. Render only uses GET / as its public health check.
      if (!authorised(req)) return send(res, 401, { error: 'Unauthorized' });
      const { logs, ...rest } = state;
      let worker = null;
      try { worker = await fetchStats(cfg); } catch (e) { worker = { error: e.message }; }
      return send(res, 200, { ...rest, style: cfg.style, worker, recent: logs.slice(-25) });
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      if (!authorised(req)) return send(res, 401, { error: 'Unauthorized' });
      if (!startRun('POST /run')) return send(res, 409, { error: 'Already running', done: state.done });
      return send(res, 202, { started: true, status: '/status' });
    }

    if (req.method === 'POST' && url.pathname === '/stop') {
      if (!authorised(req)) return send(res, 401, { error: 'Unauthorized' });
      state.stopRequested = true;
      return send(res, 200, { stopping: state.running });
    }

    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

const port = parseInt(process.env.PORT || '10000', 10);
server.listen(port, async () => {
  log(`Certificate engine listening on :${port} -> ${cfg.apiUrl}`);
  if ((process.env.AUTO_RUN || 'true').toLowerCase() === 'false') return;
  try {
    const s = await fetchStats(cfg);
    if (s.remaining > 0 || s.pending > 0) startRun(`start-up: ${s.remaining} waiting`);
    else log(`Nothing waiting (${s.ready}/${s.eligible_authors} ready).`);
  } catch (e) {
    log(`Start-up check failed: ${e.message}`);
  }
});
