// Tests for the quiz engine (js/trainer-session.js): queue building, the
// daily new-card allowance, grading and undo, practice drills, the sprint,
// deck switching, and the migration of stored progress on load.
//   node tools/test-session.mjs
import { loadApp, fakeStorage, checker } from './load-app.mjs';

const { is, done } = checker();
const { KEYS } = loadApp();
const far = Date.now() + 9e9, past = Date.now() - 1000;
const app = (settings = {}, seed = {}) => loadApp({ storage: fakeStorage({
  [KEYS.settings]: { deck: 'Hiragana', dir: 'jp', mode: 'flip', newn: 3, speak: false, learn: false, ...settings }, ...seed }) });
const cur = (S) => S.state.current && S.state.current.id;

/* ---- queue + allowance ---- */
{
  const { QuizSession: S, Srs } = app();
  S.resume();
  is(cur(S), 'hg-あ', 'new cards arrive in chart order');
  is(S.stats().left, 3, 'the queue holds exactly the day\'s allowance');
  for (let i = 0; i < 6; i++) S.resume();
  is([cur(S), S.stats().left, S.newToday()], ['hg-あ', 3, 0], 're-entering the quiz keeps the card and spends nothing');

  S.grade(true);
  is([cur(S), S.newToday(), Srs.record('hg-あ').iv], ['hg-い', 1, 4], 'a first grade introduces the card and counts it');
  is(S.undo(), true, 'undo reports success');
  is([cur(S), S.newToday(), Srs.record('hg-あ')], ['hg-あ', 0, undefined], 'undo restores the card, the count and the record');
  is(S.undo(), false, 'nothing left to undo');

  S.grade(true); S.grade(true); S.grade(true);
  is([cur(S), S.unseenCount()], [null, 68], 'queue runs dry once the allowance is spent');
  S.buildQueue(); S.next();
  is(cur(S), null, 'rebuilding the queue does not conjure more new cards');
  S.learnMore(5);
  is(S.stats().left, 5, '"learn more" goes past the allowance by exactly what was asked');
  S.saveSettings({ newn: 0 });
  S.learnMore(2);
  is(S.stats().left, 2, '…whatever the allowance has been changed to');
}

/* ---- learn, then test ---- */
{
  const { QuizSession: S, Srs } = app({ learn: true, newn: 6 });
  S.resume();
  is([cur(S), S.state.intro], ['hg-あ', true], 'a card never seen before is introduced, not asked');
  S.grade(true);
  is([cur(S), Srs.record('hg-あ')], ['hg-あ', undefined], 'an introduction cannot be graded');
  const order = [];
  for (let i = 0; i < 8; i++) {
    order.push((S.state.intro ? 'show ' : 'ask ') + cur(S).slice(3));
    if (S.state.intro) S.learned(); else S.grade(true);
  }
  is(order, ['show あ', 'show い', 'show う', 'show え', 'ask あ', 'ask い', 'ask う', 'ask え'],
     'new cards are shown in a small batch, then asked in the same order');
  is([Srs.record('hg-あ').iv, S.newToday()], [1, 4], 'a card learned today returns tomorrow and counts toward the allowance');
  is(S.state.intro, true, 'the next new card is introduced in turn');
  S.knowIt();
  is([Srs.record('hg-お').iv, cur(S)], [4, 'hg-か'], '"I already know this" grades it as known on sight');
  S.resume(); S.resume();
  is([cur(S), S.state.intro], ['hg-か', true], 're-entering the quiz keeps an introduction on screen');
}
{
  const seed = { [KEYS.progress]: { 'hg-あ': { b: 1, d: past, s: 1, l: 0 } } };
  const { QuizSession: S } = app({ learn: true }, seed);
  S.resume();
  const sawIntroOfSeen = [];
  for (let i = 0; i < 6 && S.state.current; i++) {
    if (S.state.intro && cur(S) === 'hg-あ') sawIntroOfSeen.push(1);
    if (S.state.intro) S.learned(); else S.grade(true);
  }
  is(sawIntroOfSeen, [], 'a card with a record is never re-introduced');
}

/* ---- personal decks: own cards plus cards collected from the built-ins ---- */
{
  const decks = [{ name: 'Mine', cards: [{ f: '水', r: 'みず', m: 'water' }], refs: ['p:こんにちは', 'k:出口', 'gone'] }];
  const { QuizSession: S, Srs, Decks, deckMembers, DECK_ORDER } = app({ deck: 'Mine', newn: 10 }, { [KEYS.custom]: decks });
  is(deckMembers('Mine').map((c) => c.id), ['c:Mine:水', 'p:こんにちは', 'k:出口'], 'a deck is its own cards plus what it collected; dead refs are ignored');
  S.resume();
  is(S.stats().left, 3, 'the quiz deals from the whole deck');
  while (cur(S) !== 'p:こんにちは') S.grade(true);
  S.grade(true);
  is(!!Srs.record('p:こんにちは'), true, 'a collected card keeps its one record');
  S.setDeck('Greetings');
  is(S.stats().unseen, 15, '…so its home deck sees it as started too');

  Decks.toggleRef('Mine', 'hg-あ');
  is(deckMembers('Mine').length, 4, 'collecting a card adds it');
  Decks.toggleRef('Mine', 'hg-あ');
  is(deckMembers('Mine').length, 3, '…and collecting it again takes it back out');
  is(Decks.create('Greetings', ['Greetings']), null, 'a new deck cannot take a built-in name');
  is([!!Decks.create('Travel'), DECK_ORDER.includes('Travel'), S.setDeck('Travel')], [true, true, true],
     'a deck created on the fly is usable at once');
  Decks.toggleCard('Travel', { f: 'えき', r: 'えき', m: 'station' });
  is([Decks.hasCard('Travel', 'えき'), Decks.list.find((d) => d.name === 'Travel').cards.length], [true, 1], 'a new card of its own can be added to it');
}

/* ---- misses come back; the summary lists each once ---- */
{
  const { QuizSession: S, Srs, CONFIG } = app({ newn: 6 });
  S.resume();
  const first = S.state.current;
  S.grade(false);
  is(S.state.queue[CONFIG.requeueGap - 1] === first || S.state.queue.indexOf(first) === CONFIG.requeueGap, true,
     'a missed card is re-queued a few cards later');
  is(Srs.record(first.id).l, 1, 'the miss is recorded as a lapse');
  while (S.state.current !== first) S.grade(true);
  S.grade(false);
  is(S.missed().map((c) => c.id), [first.id], 'missed twice, listed once');
}

/* ---- a drill is practice: no early promotion, then back to the schedule ---- */
{
  const seed = { [KEYS.progress]: { 'hg-か': { b: 2, d: far, s: 3, l: 3 }, 'hg-き': { b: 1, d: past, s: 2, l: 0 } } };
  const { QuizSession: S, Srs, CARDS } = app({}, seed);
  S.drill([CARDS.find((c) => c.id === 'hg-か')]);
  S.resume();
  is([cur(S), S.state.practice], ['hg-か', true], 'the drill queue waits for the quiz to open');
  S.grade(true);
  is(Srs.record('hg-か'), { b: 2, d: far, s: 3, l: 3 }, 'a drill hit on a card that is not due leaves its record alone');
  is([S.state.practice, cur(S)], [false, 'hg-き'], 'a finished drill flows into the scheduled queue');
  S.grade(true);
  is(Srs.record('hg-き').d > Date.now() + 864e5, true, 'scheduled reviews still push the card out');
}

/* ---- sprint ---- */
{
  const { QuizSession: S, Srs } = app({ deck: 'Days of the week' });
  is(S.startSprint(), true, 'sprint starts on a deck with typeable cards');
  let repeats = 0, last = null;
  for (let i = 0; i < 40; i++) { if (S.state.current === last) repeats++; last = S.state.current; S.grade(true); }
  is([S.sprintCount(), Object.keys(Srs.all()).length, repeats], [40, 0, 0],
     '40 sprint hits: counted, nothing introduced, never the same card twice running');
  is(S.undo(), false, 'no undo mid-sprint');
  is(S.endSprint(true), { count: 40, best: 40, isBest: true }, 'a completed sprint sets the best');
  S.startSprint(); S.grade(true);
  is(S.endSprint(false), { count: 1, best: 40, isBest: false }, 'an abandoned sprint never does');
  is(S.sprinting(), false, 'sprint is over');
}
{
  const decks = [{ name: 'Kanji only', cards: [{ f: '水', r: '', m: 'water' }] }];
  const { QuizSession: S } = app({ deck: 'Kanji only' }, { [KEYS.custom]: decks });
  is(S.settings.deck, 'Kanji only', 'a custom deck can be the stored deck');
  is(S.startSprint(), false, 'no sprint on a deck with nothing typeable');
}

/* ---- decks ---- */
{
  const { QuizSession: S } = app();
  S.resume();
  is(S.setDeck('constructor'), false, 'a prototype name is not a deck');
  is(S.setDeck('No such deck'), false, 'an unknown name is not a deck');
  is(cur(S), 'hg-あ', '…and the card on screen is untouched');
  is([S.setDeck('Katakana'), S.settings.deck, cur(S)], [true, 'Katakana', null], 'switching decks clears the old card');
  S.resume();
  is(cur(S), 'kt-ア', 'the new deck deals its own cards');
  is(app({ deck: 'Deleted deck' }).QuizSession.settings.deck, 'All decks', 'a stored deck that no longer exists falls back');
}

/* ---- stored progress from before content ids migrates on load ---- */
{
  const storage = fakeStorage({
    [KEYS.custom]: [{ name: 'Mine', cards: [{ f: '日本', r: 'にほん', m: 'Japan' }, { f: '水', r: '', m: 'water' }] }],
    [KEYS.progress]: { 'hg-あ': { b: 1, d: past, s: 1, l: 0 }, s0r2: { b: 2, d: far, s: 2, l: 0 },
                       k0: { b: 5, d: far, s: 6, l: 0 }, 'u:Mine:1': { b: 0, d: far, s: 4, l: 3 }, junk: 5 },
  });
  const { Srs, CARDS } = loadApp({ storage });
  const ids = Object.keys(Srs.all()).sort();
  is(ids, ['c:Mine:水', 'hg-あ', 'k:出口', 'p:こんにちは'], 'positional ids become content ids; junk is dropped');
  is(ids.every((id) => CARDS.some((c) => c.id === id)), true, 'every migrated record belongs to a real card');
  is(Object.keys(storage.json(KEYS.progress)).sort(), ids, 'the migrated record is written back');
}

/* ---- every card id is unique, and the personalised rows have stable ones ---- */
{
  const { CARDS } = loadApp();
  is(new Set(CARDS.map((c) => c.id)).size, CARDS.length, 'no two cards share an id');
  const firstKata = CARDS.findIndex((c) => c.id.startsWith('kt-'));
  is(CARDS.slice(0, firstKata).every((c) => c.id.startsWith('hg-')) && firstKata === 104, true,
     'new cards run through all of hiragana before any katakana');
  is(CARDS.filter((c) => c.slot).map((c) => c.id), ['p:you-name', 'p:you-country', 'p:you-job'], 'intro slots keep fixed ids');
}

done();
