// Tests for the trainer's answer-checking pipeline (romaji aliases, long
// vowels, particles, modifiers, kana/IME input).
//   node tools/test-romaji.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'js/trainer.js'), 'utf8');

// Slice the pure Romaji section out of the app script (no DOM needed).
const start = src.indexOf('function spokenRom');
const end = src.indexOf('/* ---------------------------- Study view');
if (start < 0 || end < 0) { console.error('markers not found'); process.exit(1); }
const { checkTyped, spokenRom, answerRom } = new Function(
  src.slice(start, end) + '; return { checkTyped, spokenRom, answerRom };')();

const phrase = (kana, rom) => ({ type: 'phrase', kana, rom });
const char = (c, rom) => ({ type: 'char', char: c, rom });
const kanji = (k, furi, rom) => ({ type: 'kanji', kanji: k, furi, rom });

let failed = 0;
const is = (actual, expected, label) => {
  if (actual !== expected) { failed++; console.error(`✗ ${label}: got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`); }
  else console.log(`✓ ${label}`);
};

/* spokenRom: particles, small tsu, long-vowel bar */
is(spokenRom(phrase(['こ','ん','に','ち','は'], ['ko','n','ni','chi','*wa'])), 'konnichiwa', 'particle は → wa');
is(spokenRom(phrase(['け','っ','こ','う'], ['ke','~','ko','u'])), 'kekkou', 'small っ doubles');
is(spokenRom(phrase(['コ','ー','ヒ','ー'], ['ko','~','hi','~'])), 'koohii', 'ー stretches the vowel');

/* romaji: Hepburn, Kunrei, long-vowel leniency, macrons */
const konnichiwa = phrase(['こ','ん','に','ち','は'], ['ko','n','ni','chi','*wa']);
is(checkTyped('konnichiwa', konnichiwa), true, 'Hepburn phrase');
is(checkTyped('konnitiwa', konnichiwa), true, 'Kunrei ti → chi');
const kekkou = phrase(['け','っ','こ','う','で','す'], ['ke','~','ko','u','de','su']);
is(checkTyped('kekkoudesu', kekkou), true, 'long vowel spelled out');
is(checkTyped('kekkodesu', kekkou), true, 'long vowel collapsed');
is(checkTyped('kekkōdesu', kekkou), true, 'macron');
is(checkTyped('kekodesu', kekkou), false, 'missing doubled consonant rejected');

/* char cards: stored answer stays authoritative */
is(checkTyped('si', char('し', 'shi')), true, 'し accepts Kunrei si');
is(checkTyped('shi', char('し', 'shi')), true, 'し accepts shi');
is(checkTyped('ti', char('チ', 'chi')), true, 'チ accepts Kunrei ti');
is(checkTyped('ti', char('ティ', 'ti')), true, 'ティ accepts ti');
is(checkTyped('chi', char('ティ', 'ti')), false, 'ティ rejects chi');
is(checkTyped('hu', char('ふ', 'fu')), true, 'ふ accepts hu');
is(checkTyped('syu', char('しゅ', 'shu')), true, 'Kunrei syu → shu');

/* kana / IME input */
is(checkTyped('こんにちは', konnichiwa), true, 'hiragana IME input');
is(checkTyped('コンニチハ', konnichiwa), true, 'katakana folds to hiragana');
is(checkTyped('こんばんは', konnichiwa), false, 'wrong kana rejected');
is(checkTyped('し', char('し', 'shi')), true, 'single kana answer');
is(checkTyped('シ', char('シ', 'shi')), true, 'katakana char answer');

/* kanji cards */
const deguchi = kanji('出口', 'でぐち', 'deguchi');
is(checkTyped('deguchi', deguchi), true, 'kanji romaji');
is(checkTyped('でぐち', deguchi), true, 'kanji furigana');
is(checkTyped('出口', deguchi), true, 'kanji itself');

/* answerRom passthrough */
is(answerRom(char('し', 'shi')), 'shi', 'answerRom char');
is(answerRom(konnichiwa), 'konnichiwa', 'answerRom phrase');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nall tests passed');
