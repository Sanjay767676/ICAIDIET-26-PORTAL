// Verifies the two functions that decide what an author is charged, straight
// out of backend/src/index.ts, so this tests the real shipped logic rather than
// a copy. Extracts them and their dependencies, strips the TS type annotations,
// and runs a decision table over them.
//
// Security-relevant cases:
//   - tamperedAmount: a hand-rolled request must not claim the cheaper
//     early-bird price.
//   - staleAmountRefusal: an admin reprice must be surfaced to the author
//     rather than silently recorded.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'src', 'index.ts'), 'utf8').replace(/\r\n/g, '\n');

function grab(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('not found: ' + startMarker);
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error('end not found for: ' + startMarker);
  return src.slice(start, end + endMarker.length);
}

// Only the resolver and its two helpers are needed; the test supplies its own
// config literal, so DEFAULT_REGISTRATION_CONFIG is deliberately not extracted.
const raw = [
  grab('function isCalendarDate(', '\n}\n'),
  grab('function cleanDisplayText(', '\n}\n'),
  grab('function resolveFeeSnapshot(', '\n}\n'),
  grab('function staleAmountRefusal(', '\n}\n'),
].join('\n\n');

// Transpile the extracted block with the project's own TypeScript rather than
// hand-rolling regexes to strip annotations, so this tracks the real source.
const ts = require('typescript');
const js = ts.transpileModule(raw, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

const factory = new Function(js + '\nreturn { resolveFeeSnapshot, staleAmountRefusal };');
const mod = factory();
const base = {
  early_bird_until: '2026-10-10',
  fees: {
    'Indian Author': {
      'Conference alone': { early: '₹2,000', standard: '₹2,500' },
      'Conference with Scopus proceedings': { early: '₹10,000', standard: '₹11,000' },
    },
  },
  bank: {},
};
const R = mod.resolveFeeSnapshot;
const refuse = mod.staleAmountRefusal;

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + '\n        got      ' + a + '\n        expected ' + e); }
}

const A = 'Indian Author';
const R1 = 'Conference alone';
const S = 'Conference with Scopus proceedings';

console.log('resolveFeeSnapshot decision table\n');

check(
  'honest early claim is accepted verbatim',
  R(base, A, R1, '₹2,000', 'EARLY'),
  { amount: '₹2,000', tier: 'EARLY' }
);
check(
  'honest standard claim is accepted verbatim',
  R(base, A, R1, '₹2,500', 'STANDARD'),
  { amount: '₹2,500', tier: 'STANDARD' }
);
check(
  'lowercase tier is normalised and accepted',
  R(base, A, R1, '₹2,000', 'early'),
  { amount: '₹2,000', tier: 'EARLY' }
);
check(
  'TAMPERED cheaper amount is rejected, not recorded',
  R(base, A, R1, '₹1', 'EARLY'),
  { amount: '₹2,000', tier: 'EARLY' }
);
check(
  'TAMPERED empty amount is rejected',
  R(base, A, R1, '', 'EARLY'),
  { amount: '₹2,000', tier: 'EARLY' }
);
check(
  'TAMPERED unknown tier is rejected',
  R(base, A, R1, '₹2,000', 'FREE'),
  { amount: '₹2,000', tier: 'EARLY' }
);
check(
  'mismatched pair (amount from the Scopus row) is rejected',
  R(base, A, R1, '₹10,000', 'EARLY'),
  { amount: '₹2,000', tier: 'EARLY' }
);
check(
  'no claim falls back to the cutoff',
  R(base, A, S, undefined, undefined),
  { amount: '₹10,000', tier: 'EARLY' }
);
check(
  'pair absent from the matrix returns null (re-register escape hatch)',
  R(base, 'Renamed Type', R1, '₹2,000', 'EARLY'),
  null
);

console.log('\nstaleAmountRefusal (admin repriced the option while the form was open)\n');

// The scenario that motivated the 409: the author had ₹10,000 on screen, the
// admin then edited the matrix, and the author submitted. The resolver maps the
// stale claim onto the new price; the refusal helper is what turns that into an
// explicit "please confirm" instead of a silent price change.
const REPRICED = {
  ...base,
  fees: {
    'Indian Author': {
      'Conference alone': { early: '₹2,000', standard: '₹2,500' },
      'Conference with Scopus proceedings': { early: '₹11,000', standard: '₹11,000' },
    },
  },
};
const S_OLD = { amount: '₹10,000', tier: 'EARLY' };
const S_NEW = { amount: '₹11,000', tier: 'EARLY' };

// The real handler passes the RESOLVED snapshot, which after a reprice is the
// new price, while the browser still claims the old one.
const RESOLVED_AFTER_REPRICE = R(REPRICED, A, S, S_OLD.amount, S_OLD.tier);
check(
  'repriced option REFUSES and reports both figures',
  refuse(REPRICED, A, S, RESOLVED_AFTER_REPRICE, S_OLD.amount),
  { code: 'FEE_CHANGED', displayed_amount: '₹10,000', current_amount: '₹11,000', current_tier: 'EARLY' }
);
const movedWindow = { ...base, early_bird_until: '2020-01-01' };
check(
  'a displayed amount that is still a live price is NOT refused (early window moved, price did not)',
  refuse(movedWindow, A, R1, { amount: '₹2,000', tier: 'EARLY' }, '₹2,000'),
  null
);
check(
  'matching price is not refused',
  refuse(base, A, S, S_NEW, '₹11,000'),
  null
);
check(
  'an author who claimed nothing is never refused (no agreement to breach)',
  refuse(base, A, S, { amount: '₹10,000', tier: 'EARLY' }, ''),
  null
);
check(
  'whitespace-only claim is treated as no claim',
  refuse(base, A, S, { amount: '₹10,000', tier: 'EARLY' }, '   '),
  null
);
check(
  're-confirmed author is not refused a second time',
  refuse(REPRICED, A, S, S_NEW, '₹11,000'),
  null
);
// The reported figures are attacker-controlled (they came from the request
// body) and are rendered into the banner. React escapes them on render, and
// cleanDisplayText caps the length, so neither can inject markup or bloat the
// settings/response row. Assert the cap, which is this layer's job.
check(
  'an over-long displayed amount is capped before it is reported back',
  (() => {
    const r = refuse(REPRICED, A, S, R(REPRICED, A, S, S_OLD.amount, S_OLD.tier), '9'.repeat(500));
    return r ? r.displayed_amount.length : null;
  })(),
  40
);

// Cutoff in the past -> standard pricing is what gets recorded.
const expired = { ...base, early_bird_until: '2020-01-01' };
check(
  'expired cutoff records the standard amount',
  R(expired, A, R1, undefined, undefined),
  { amount: '₹2,500', tier: 'STANDARD' }
);
check(
  'honest claim still wins over an expired cutoff',
  R(expired, A, R1, '₹2,000', 'EARLY'),
  { amount: '₹2,000', tier: 'EARLY' }
);

// No cutoff configured at all -> standard.
const noCutoff = { ...base, early_bird_until: '' };
check(
  'no cutoff configured records the standard amount',
  R(noCutoff, A, R1, undefined, undefined),
  { amount: '₹2,500', tier: 'STANDARD' }
);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
