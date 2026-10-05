// Tests for the trainer's number converter, the FSRS scheduling step, and the
// storage helpers (record validation, id migration, custom-deck ids).
//   node tools/test-trainer.mjs
import { loadApp, checker } from './load-app.mjs';

const { CONFIG, FSRS, levelOf, numToRomaji, numNorm, nextRecord, practiceRecord, cleanProg, migrateIds, streakOf, ymd,
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

/* ---- scheduler: FSRS-4.5 ---- */
const T = 1_700_000_000_000, DAYMS = 864e5;
const topBox = CONFIG.levels.length - 1;
is([FSRS.retrievability(10, 10).toFixed(4), FSRS.interval(10).toFixed(4)], ['0.9000', '10.0000'],
   'stability is the interval at which recall is 90%');
is([0, 0.5, 1, 2, 3, 6, 7, 20, 21, 44, 45, 365].map(levelOf), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], 'display levels by interval');

const fresh = nextRecord(null, true, T);
is([fresh.st, fresh.df], [CONFIG.w[2], CONFIG.w[4]], 'first "got it": the published initial stability and difficulty');
is([fresh.iv, fresh.d, fresh.b], [4, T + 4 * DAYMS, 2], 'known on sight comes back in 4 days');
is([fresh.s, fresh.l, fresh.lr], [1, 0, T], 'seen count, lapses and review time are recorded');

const firstMiss = nextRecord(null, false, T);
is([firstMiss.st, firstMiss.b, firstMiss.l, firstMiss.d], [CONFIG.w[0], 0, 1, T + CONFIG.againDelay],
   'a first miss is relearned within minutes');
const relearned = nextRecord(firstMiss, true, T + 3 * 60e3);
is([relearned.iv, relearned.b], [1, 1], 'learned today, back tomorrow');

/* on-time reviews: the curve from the published parameters */
const path = (from, n) => { const ivs = [from.iv]; let r = from; for (let i = 0; i < n; i++) { r = nextRecord(r, true, r.d); ivs.push(r.iv); } return [ivs, r]; };
const [easy, mature] = path(fresh, 5);
is(easy, [4, 15, 49, 146, 365, 365], 'known on sight: 4, 15, 49, 146 days, then the yearly cap');
is(path(relearned, 6)[0], [1, 2, 6, 16, 39, 89, 194], 'a card that started with a miss climbs more slowly');
is(mature.b, topBox, 'long intervals sit at the top level');

/* timing matters: recalling something late is stronger evidence than on time */
const onTime = nextRecord(fresh, true, fresh.d), late = nextRecord(fresh, true, fresh.d + 10 * DAYMS);
is(late.st > onTime.st, true, 'a late success earns more stability than an on-time one');

/* lapses */
const m3 = path(fresh, 2)[1];
const lapse = nextRecord(m3, false, m3.d);
is([lapse.b, lapse.l, lapse.iv, lapse.d], [0, 1, 0, m3.d + CONFIG.againDelay], 'a miss drops to level 0 and comes back in minutes');
is([lapse.st < m3.st, lapse.df > m3.df], [true, true], 'forgetting shrinks stability and raises difficulty');
const back = nextRecord(lapse, true, lapse.d + 60e3);
is(back.iv >= 1 && back.iv < m3.iv, true, 'after relearning, the next gap is shorter than before the lapse');
let worst = firstMiss;
for (let i = 0; i < 25; i++) worst = nextRecord(worst, false, worst.d);
is([worst.df, worst.st >= 0.1], [10, true], 'difficulty tops out at 10; stability keeps a floor');

/* records written before FSRS (a Leitner box, maybe an ease factor) carry over */
const oldBox = nextRecord({ b: 3, d: T, s: 4, l: 0 }, true, T);
is([oldBox.st > 7, oldBox.iv > 7, oldBox.lr], [true, true, T], 'a box-3 card is read as 7 days of stability and grows from there');
const oldEase = nextRecord({ b: 5, d: T, s: 9, l: 0, e: 2.5, iv: 300 }, true, T);
is([oldEase.iv, 'e' in oldEase], [CONFIG.maxIntervalDays, false], 'an eased record keeps its interval (capped) and drops the ease field');
is(nextRecord({ b: 4, d: T, s: 6, l: 3 }, true, T).df > oldBox.df, true, 'past lapses count toward difficulty');

/* learn-then-test: a first hit after an introduction comes back tomorrow */
const taught = nextRecord(null, true, T, true);
is([taught.iv, taught.b, taught.st], [1, 1, CONFIG.w[2]], 'learned today: one day, same starting stability');
is(path(taught, 4)[0], [1, 7, 25, 79, 224], '…then the curve picks up from there');
is(nextRecord(null, false, T, true).d, T + CONFIG.againDelay, 'a miss after an introduction is relearned as usual');
is(nextRecord(fresh, true, fresh.d, true).iv, onTime.iv, 'the flag only matters for a first grade');

const input = { b: 2, d: 5, s: 3, l: 0 };
nextRecord(input, true, T);
is(input, { b: 2, d: 5, s: 3, l: 0 }, 'nextRecord does not mutate its input');

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
const sorted = (o) => Object.fromEntries(Object.entries(o).sort());
is(sorted(cleanProg({ a: fresh }).a), sorted(fresh), 'an FSRS record survives validation whole');
is(cleanProg({ a: { b: 1, d: 5, st: 3, df: 99, lr: 1, e: 2.5 } }).a, { b: 1, d: 5, s: 1, l: 0, st: 3, df: 10, lr: 1 },
   'difficulty is clamped and the old ease field is dropped');
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
   [{ name: 'A', cards: [{ f: 'x', r: '', m: 'y' }], refs: [] }], 'malformed decks and cards are dropped, fields trimmed');
is(cleanDecks([{ name: 'B', cards: [], refs: ['hg-あ', ' k:出口 ', 'hg-あ', 7, ''] }]),
   [{ name: 'B', cards: [], refs: ['hg-あ', 'k:出口'] }], 'a deck of collected cards is kept; refs are trimmed and de-duplicated');
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
