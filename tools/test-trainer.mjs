// Tests for the trainer's number converter, the SRS scheduling step, and the
// storage helpers (record validation, id migration, custom-deck ids).
//   node tools/test-trainer.mjs
import { loadApp, checker } from './load-app.mjs';

const { CONFIG, numToRomaji, numNorm, nextRecord, practiceRecord, cleanProg, migrateIds, streakOf, ymd,
        customIds, cleanDecks, kanaToRomaji, LEGACY_IDS } = loadApp();
const { is, done } = checker();

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

/* ease-based growth beyond the top box */
const topBox = CONFIG.intervals.length - 1;
const top = nextRecord({ b: topBox, d: 0, s: 9, l: 0 }, true, T);
is(top.b, topBox, 'top box caps');
is(top.iv, Math.round(45 * CONFIG.easeStart), 'first post-top interval grows by ease (45d × 2.5)');
is(top.d, T + top.iv * 864e5, 'due matches the eased interval');
const top2 = nextRecord(top, true, T);
is(top2.iv > top.iv, true, 'intervals keep stretching on subsequent hits');
is(top2.e > top.e, true, 'ease drifts up on hits');
const eased = nextRecord({ b: topBox, d: 0, s: 9, l: 0, e: 2.0, iv: 100 }, false, T);
is(eased.e, 1.8, 'a miss reduces ease');
is(eased.b, 0, 'a miss still resets the box');
const floor = nextRecord({ b: 0, d: 0, s: 1, l: 0, e: CONFIG.easeMin, iv: 0 }, false, T);
is(floor.e, CONFIG.easeMin, 'ease never drops below the floor');

const missed = nextRecord({ b: 4, d: 0, s: 5, l: 1 }, false, T);
is(missed.b, 0, 'a miss resets to box 0');
is(missed.l, 2, 'lapse count increments');
is(missed.d, T + CONFIG.againDelay, 'missed card comes back after againDelay');

const input = { b: 2, d: 5, s: 3, l: 0 };
nextRecord(input, true, T);
is(input.b, 2, 'nextRecord does not mutate its input');

/* eased intervals are capped */
const capped = nextRecord({ b: topBox, d: 0, s: 20, l: 0, e: 2.5, iv: 300 }, true, T);
is(capped.iv, CONFIG.maxIntervalDays, 'interval growth stops at the cap');

/* practice grades (sprint, lapse drill) never run ahead of the schedule */
is(practiceRecord(undefined, true, T), undefined, 'practice hit leaves an unseen card unseen');
is(practiceRecord(undefined, false, T), undefined, 'practice miss leaves an unseen card unseen');
const notDue = { b: 2, d: T + 5000, s: 3, l: 0 };
is(practiceRecord(notDue, true, T) === notDue, true, 'practice hit on a not-yet-due card changes nothing');
is(practiceRecord({ b: 2, d: T - 1, s: 3, l: 0 }, true, T).b, 3, 'practice hit on a due card is a real review');
const pMiss = practiceRecord(notDue, false, T);
is([pMiss.b, pMiss.l], [0, 1], 'practice miss on a seen card still lapses it');
let rec;
for (let i = 0; i < 40; i++) rec = practiceRecord(rec, true, T);
is(rec, undefined, '40 sprint hits on an unseen card introduce nothing');

/* streak */
const day = (back) => { const d = new Date(2026, 4, 20); d.setDate(d.getDate() - back); return ymd(d); };
const today = new Date(2026, 4, 20);
is(streakOf({}, today), 0, 'no history, no streak');
is(streakOf({ [day(0)]: 3, [day(1)]: 1, [day(2)]: 9 }, today), 3, 'streak counts back from today');
is(streakOf({ [day(1)]: 1, [day(2)]: 9 }, today), 2, 'an unfinished today does not break the streak');
is(streakOf({ [day(2)]: 9 }, today), 0, 'a skipped day breaks it');

/* record validation (imports, storage) */
is(cleanProg(null), null, 'null is not a record map');
is(cleanProg([1, 2]), null, 'an array is not a record map');
is(cleanProg('x'), null, 'a string is not a record map');
is(cleanProg({ a: { b: 2, d: 5, s: 3, l: 1 }, bad: 7, worse: { b: 'x', d: 1 }, none: null }),
   { a: { b: 2, d: 5, s: 3, l: 1 } }, 'malformed records are dropped, good ones kept');
is(cleanProg({ a: { b: 99, d: 5 } }).a, { b: topBox, d: 5, s: 1, l: 0 }, 'box clamps, missing counters default');

/* id migration */
const [moved, changed] = migrateIds({ s0r2: { b: 1 }, 'hg-あ': { b: 2 }, k0: { b: 3 } }, LEGACY_IDS);
is(changed, true, 'legacy ids are detected');
is(Object.keys(moved).sort(), ['hg-あ', 'k:出口', 'p:こんにちは'], 'positional ids become content ids');
is(migrateIds({ 'p:こんにちは': { b: 5 }, s0r2: { b: 1 } }, LEGACY_IDS)[0], { 'p:こんにちは': { b: 5 } },
   'a record already under the new id wins');
is(migrateIds({ 'hg-あ': { b: 2 } }, LEGACY_IDS)[1], false, 'nothing to migrate, nothing changed');
is(migrateIds({ constructor: { b: 1 } }, LEGACY_IDS)[0], { constructor: { b: 1 } }, 'prototype names pass through');
const targets = Object.values(LEGACY_IDS);
is([targets.length, new Set(targets).size], [273, 273], 'legacy table: 273 ids, no two share a target');

/* custom decks */
is(customIds({ name: 'D', cards: [{ f: '水' }, { f: '日' }, { f: '水' }, { f: 'constructor' }] }),
   ['c:D:水', 'c:D:日', 'c:D:水#2', 'c:D:constructor'], 'ids follow the front text; repeats are numbered');
is(cleanDecks('nope'), [], 'non-array storage yields no decks');
is(cleanDecks([{ name: ' A ', cards: [{ f: ' x ', m: 'y' }, { r: 'no front' }, null] }, { name: '', cards: [] }, { cards: 3 }, null]),
   [{ name: 'A', cards: [{ f: 'x', r: '', m: 'y' }] }], 'malformed decks and cards are dropped, fields trimmed');
is(cleanDecks([{ name: 'Hiragana', cards: [{ f: 'x' }] }, { name: 'Mine', cards: [{ f: 'y' }] }, { name: 'Mine', cards: [{ f: 'z' }] }], ['Hiragana'])
     .map((d) => d.name), ['Hiragana (2)', 'Mine', 'Mine (2)'], 'a taken name is suffixed, never merged');

/* kana -> romaji converter (drives typed answers for custom decks) */
is(kanaToRomaji('はしる'), 'hashiru', 'plain kana');
is(kanaToRomaji('きゃく'), 'kyaku', 'yoon combo');
is(kanaToRomaji('がっこう'), 'gakkou', 'small tsu doubles');
is(kanaToRomaji('ざっし'), 'zasshi', 'small tsu before digraph');
is(kanaToRomaji('コーヒー'), 'koohii', 'long-vowel bar');
is(kanaToRomaji('ニュース'), 'nyuusu', 'katakana combo + bar');
is(kanaToRomaji('走る'), null, 'kanji returns null (flip-grade fallback)');

done();
