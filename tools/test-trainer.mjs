// Tests for the trainer's number converter and SRS scheduling step.
//   node tools/test-trainer.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'js/trainer.js'), 'utf8');

const slice = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error(`markers not found: ${from}`);
  return src.slice(a, b);
};
const config = slice('const CONFIG = {', '/* ------------------------------ Utils');
const helpers = slice('const numDigits =', '/* ---------------------------- Study view');
const { CONFIG, numToRomaji, numNorm, nextRecord } = new Function(
  config + helpers + '; return { CONFIG, numToRomaji, numNorm, nextRecord };')();

let failed = 0;
const is = (actual, expected, label) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) { failed++; console.error(`✗ ${label}: got ${a}, wanted ${e}`); }
  else console.log(`✓ ${label}`);
};

/* number readings, including the irregulars */
is(numToRomaji(1), 'ichi', '1');
is(numToRomaji(10), 'juu', '10 is bare juu');
is(numToRomaji(11), 'juuichi', '11');
is(numToRomaji(100), 'hyaku', '100 is bare hyaku');
is(numToRomaji(300), 'sanbyaku', '300 irregular');
is(numToRomaji(600), 'roppyaku', '600 irregular');
is(numToRomaji(800), 'happyaku', '800 irregular');
is(numToRomaji(1000), 'sen', '1000 is bare sen');
is(numToRomaji(3000), 'sanzen', '3000 irregular');
is(numToRomaji(8000), 'hassen', '8000 irregular');
is(numToRomaji(10000), 'ichiman', '10000 keeps ichi');
is(numToRomaji(8766), 'hassennanahyakurokujuuroku', '8766 compound');
is(numToRomaji(30000), 'sanman', '30000');
is(numNorm('juu ichi'), numNorm('juuichi'), 'spacing ignored');
is(numNorm('kyuu'), numNorm('kyu'), 'long vowel lenient');

/* SRS stepping */
const T = 1_000_000;
const fresh = nextRecord(null, true, T);
is(fresh.b, 1, 'first hit promotes to box 1');
is(fresh.d, T + CONFIG.intervals[1], 'due after box-1 interval');
is(fresh.s, 1, 'seen count increments');

const top = nextRecord({ b: CONFIG.intervals.length - 1, d: 0, s: 9, l: 0 }, true, T);
is(top.b, CONFIG.intervals.length - 1, 'top box caps');

const missed = nextRecord({ b: 4, d: 0, s: 5, l: 1 }, false, T);
is(missed.b, 0, 'a miss resets to box 0');
is(missed.l, 2, 'lapse count increments');
is(missed.d, T + CONFIG.againDelay, 'missed card comes back after againDelay');

const input = { b: 2, d: 5, s: 3, l: 0 };
nextRecord(input, true, T);
is(input.b, 2, 'nextRecord does not mutate its input');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall tests passed');
