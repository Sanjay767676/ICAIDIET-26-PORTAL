// One-shot generator (no web server): generates every pending certificate and exits.
//   API_URL=https://<worker> CERTIFICATE_SECRET=... node run.js
// Works the same on your laptop, a Render Shell, or a Render cron job.
import { config, runAll } from './generator.js';

const state = await runAll(config());
process.exit(state.failed || state.errors.length ? 1 : 0);
