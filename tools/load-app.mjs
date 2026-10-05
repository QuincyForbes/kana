// Loads the trainer's DOM-free scripts the way trainer.html does — in order,
// sharing one scope — and hands back their globals, so tests exercise the
// real files rather than slices of them. Each call is a fresh, isolated app
// with its own storage.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = ['store.js', 'srs.js', 'kana-data.js', 'pitch-data.js', 'trainer-data.js', 'legacy-ids.js', 'decks.js',
  'trainer-romaji.js', 'trainer-cards.js', 'trainer-session.js'];
const EXPORTS = ['KEYS', 'store', 'Prefs', 'CONFIG', 'ymd', 'streakOf', 'nextRecord', 'practiceRecord',
  'FSRS', 'levelOf', 'cleanProg', 'migrateIds', 'LEGACY_IDS', 'kanaToRomaji', 'DATA', 'KANJI', 'CARDS', 'DECK_ORDER', 'Custom',
  'cleanConfuse', 'CHAR_ID', 'customIds', 'cleanDecks', 'Decks', 'deckMembers', 'checkTyped', 'spokenRom', 'answerRom', 'cardJp', 'cardGloss',
  'numToRomaji', 'numNorm', 'PITCH', 'pitchPattern', 'pitchLabel', 'Srs', 'Confuse', 'learnedChar', 'readableCard', 'QuizSession'];

/* a Map-backed stand-in for localStorage; seed it to start from stored state */
export function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    json: (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
  };
}

export function loadApp({ storage = fakeStorage() } = {}) {
  const src = FILES.map((f) => readFileSync(join(root, 'js', f), 'utf8')).join('\n;\n');
  return new Function('localStorage', 'location', `${src}\n;return { ${EXPORTS.join(', ')} };`)(
    storage, { reload() {} });
}

/* tiny assertion helper shared by the test files */
export function checker() {
  let failed = 0;
  const is = (actual, expected, label) => {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) { failed++; console.error(`✗ ${label}: got ${a}, wanted ${e}`); }
    else console.log(`✓ ${label}`);
  };
  const done = () => {
    if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
    console.log('\nall tests passed');
  };
  return { is, done };
}
