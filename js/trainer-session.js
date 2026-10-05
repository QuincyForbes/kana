"use strict";
/* Kana Trainer — the quiz engine, with no DOM in it: the stored progress
   record (Srs) and the session state machine (QuizSession) that the Quiz
   view drives. Runs under node as-is — see tools/test-session.mjs.         */

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* --------------------------- SRS scheduler ------------------------------- */
const Srs = (() => {
  const load = () => cleanProg(store.get(KEYS.progress)) || {};
  let prog = load(); /* id -> {b,d,s,l,e?,iv?} */

  const record = (id) => prog[id];
  const isKnown = (p) => !!p && p.b >= CONFIG.knownBox;
  const save = () => store.set(KEYS.progress, prog);

  /* Records written before ids became content-based — in storage or in an
     old export file — are renamed on the way in. Custom decks used
     u:<deck>:<line>; the frozen phrase/kanji table is js/legacy-ids.js.     */
  const adopt = (raw) => {
    const map = { ...LEGACY_IDS };
    Custom.decks.forEach((d) => customIds(d).forEach((id, i) => { map[`u:${d.name}:${i}`] = id; }));
    return migrateIds(raw, map);
  };
  {
    const [moved, changed] = adopt(prog);
    if (changed) { prog = moved; save(); }
  }

  /* practice: an extra rep (sprint, lapse drill) — see practiceRecord.
     @returns true if the card should resurface this session */
  function grade(card, good, { practice = false, now = Date.now() } = {}) {
    const before = prog[card.id];
    const after = practice ? practiceRecord(before, good, now) : nextRecord(before, good, now);
    if (after !== before) { prog[card.id] = after; save(); }
    const days = store.get(KEYS.days) || {};
    days[ymd()] = (days[ymd()] || 0) + 1;
    store.set(KEYS.days, days);
    return !good;
  }

  /* undo support: put a card's record back exactly as it was (null = unseen) */
  function restore(id, rec) {
    if (rec) prog[id] = rec; else delete prog[id];
    save();
  }

  return {
    record, isKnown, grade, restore,
    days: () => store.get(KEYS.days) || {},
    all: () => prog,
    replace(next) { prog = adopt(next || {})[0]; save(); },
    reset() { prog = {}; save(); },
    reload() { prog = load(); }, /* another tab wrote the record */
  };
})();

/* ----------------------------- Quiz session ------------------------------ */
/* The state machine behind the Quiz tab: which deck, what's queued, the
   card in play, grading, undo, the daily new-card allowance and the sprint.
   The view (js/trainer-quiz.js) calls in, then draws whatever state it finds. */
const QuizSession = (() => {
  const DEFAULTS = { deck: "All decks", dir: "jp", mode: "flip", newn: 10, speak: true };
  const settings = Object.assign({}, DEFAULTS, store.get(KEYS.settings) || {});
  /* practice: the queue is an extra-reps drill, graded via practiceRecord.
     bonusNew: new cards asked for on top of today's allowance.
     pending: a drill is loaded and waits for the Quiz tab to open.         */
  const session = { queue: [], current: null, face: "jp", revealed: false, verdict: null,
                    reviewed: 0, correct: 0, missed: [], pending: false,
                    practice: false, bonusNew: 0 };
  const undoStack = []; /* up to 20 grades deep */
  let sprint = null;    /* {count} while a 60s sprint runs — the view owns the clock */

  const TRICKY_CHARS = new Set(TRICKY.flatMap((p) => p.g.flatMap((g) => [g, H2K[g] || "", K2H[g] || ""])));
  const COMPOSITE = {
    "All decks": () => CARDS,
    "All characters": () => CARDS.filter((c) => c.type === "char"),
    "All phrases": () => CARDS.filter((c) => c.type === "phrase"),
    "Look-alikes": () => CARDS.filter((c) => c.type === "char" && TRICKY_CHARS.has(c.char)),
  };
  /* own-property checks: a deck name can arrive from the URL hash, and
     "constructor" must not resolve to Object.prototype's                    */
  const isDeck = (name) => Object.hasOwn(COMPOSITE, name) || DECK_ORDER.includes(name);
  const deckCards = () =>
    (Object.hasOwn(COMPOSITE, settings.deck) ? COMPOSITE[settings.deck]() : CARDS.filter((c) => c.deck === settings.deck));
  if (!isDeck(settings.deck)) settings.deck = DEFAULTS.deck; /* a stored deck that no longer exists */

  /* The new-card allowance is per day, counted when a card is first graded
     — so reloading, switching tabs or peeking at a card never spends it.   */
  const newToday = () => { const r = store.get(KEYS.newDay); return r && r.day === ymd() ? r.n : 0; };
  const addNewToday = (by) => store.set(KEYS.newDay, { day: ymd(), n: Math.max(0, newToday() + by) });
  const newBudget = () => Math.max(0, settings.newn + session.bonusNew - newToday());

  const counterpart = (c) => H2K[c.char] || K2H[c.char] || "";
  const pickFace = () =>
    settings.mode === "listen" ? "jp"
    : settings.dir === "mix" ? (Math.random() < 0.5 ? "jp" : "en") : settings.dir;
  const listening = () => settings.mode === "listen" && session.face === "jp";
  const matching = () => settings.mode === "match" && session.current?.type === "char" && counterpart(session.current);
  const typedApplies = () => (settings.mode === "type" || settings.mode === "listen") && session.face === "jp";

  function saveSettings(patch) {
    Object.assign(settings, patch);
    store.set(KEYS.settings, settings);
  }

  /* keep: the card already on screen — left out of the queue so it doesn't
     come straight back, and counted against the allowance if it's new      */
  function buildQueue(keep = null) {
    const now = Date.now(), cards = deckCards().filter((c) => c !== keep);
    const due = shuffle(cards.filter((c) => Srs.record(c.id)?.d <= now));
    const budget = Math.max(0, newBudget() - (keep && !Srs.record(keep.id) ? 1 : 0));
    /* new cards arrive in pedagogical order (chart/deck order), not shuffled */
    const fresh = cards.filter((c) => !Srs.record(c.id)).slice(0, budget);
    session.practice = false;
    session.queue = [...due];
    fresh.forEach((c, i) =>
      session.queue.splice(Math.min(session.queue.length, (i + 1) * CONFIG.interleaveEvery), 0, c));
  }

  /* deal the next card (null when the queue has run dry) */
  function next() {
    session.current = session.queue.shift() || null;
    /* a finished drill flows straight back into the scheduled queue */
    if (!session.current && session.practice) { buildQueue(); session.current = session.queue.shift() || null; }
    session.face = pickFace();
    session.revealed = false;
    session.verdict = null;
    return session.current;
  }

  function reveal(verdict) {
    session.revealed = true;
    session.verdict = verdict;
  }

  /* ---- 60s sprint: random cards against the clock. Speed practice, not
     review — grades go through practiceRecord, so a streak of hits can't
     push cards weeks ahead of schedule.                                    */
  const sprintCards = () => deckCards().filter((c) => !c.custom);
  function nextSprintCard() {
    const cards = sprintCards();
    /* avoid showing the same card twice running when there's a choice */
    let c;
    do { c = cards[Math.floor(Math.random() * cards.length)]; }
    while (cards.length > 1 && c === session.current);
    session.current = c;
    session.face = "jp";
    session.revealed = false;
    session.verdict = null;
  }
  /* @returns false when the deck has nothing a sprint can use */
  function startSprint() {
    if (!sprintCards().length) return false;
    sprint = { count: 0 };
    nextSprintCard();
    return true;
  }
  /* completed: the minute ran out, so the score can stand as a best.
     @returns {count, best, isBest} */
  function endSprint(completed) {
    const count = sprint ? sprint.count : 0;
    sprint = null;
    session.current = null;
    const bests = store.get(KEYS.sprint) || {};
    const before = bests[settings.deck] || 0;
    const isBest = completed && count > before;
    if (isBest) { bests[settings.deck] = count; store.set(KEYS.sprint, bests); }
    return { count, best: isBest ? count : before, isBest };
  }

  function grade(good) {
    const c = session.current;
    if (!c) return;
    if (sprint) {
      if (good) sprint.count++;
      Srs.grade(c, good, { practice: true });
      session.reviewed++;
      if (good) session.correct++;
      nextSprintCard();
      return;
    }
    const prev = Srs.record(c.id);
    const step = {
      card: c,
      prevProg: prev ? { ...prev } : null,
      queue: [...session.queue],
      reviewed: session.reviewed,
      correct: session.correct,
      wasNew: false,
    };
    undoStack.push(step);
    if (undoStack.length > 20) undoStack.shift();
    if (!good) session.missed.push(c);
    if (good) session.correct++;
    if (Srs.grade(c, good, { practice: session.practice }))
      session.queue.splice(Math.min(CONFIG.requeueGap, session.queue.length), 0, c);
    if (!prev && Srs.record(c.id)) { step.wasNew = true; addNewToday(1); }
    session.reviewed++;
    next();
  }

  /* @returns true when a grade was taken back */
  function undo() {
    if (sprint) return false;
    const u = undoStack.pop();
    if (!u) return false;
    Srs.restore(u.card.id, u.prevProg);
    if (u.wasNew) addNewToday(-1);
    session.queue = u.queue;
    session.current = u.card;
    session.face = pickFace();
    session.revealed = false;
    session.verdict = null;
    session.reviewed = u.reviewed;
    session.correct = u.correct;
    if (session.missed[session.missed.length - 1]?.id === u.card.id) session.missed.pop();
    return true;
  }

  /* counts for the current deck, plus where the session stands */
  function stats() {
    const now = Date.now();
    let unseen = 0, learning = 0, known = 0, due = 0;
    deckCards().forEach((c) => {
      const p = Srs.record(c.id);
      if (!p) return unseen++;
      Srs.isKnown(p) ? known++ : learning++;
      if (p.d <= now) due++;
    });
    return { unseen, learning, known, due,
      left: sprint ? 0 : session.queue.length + (session.current ? 1 : 0),
      reviewed: session.reviewed, correct: session.correct,
      canUndo: undoStack.length > 0 && !sprint };
  }

  /* cards missed this session, each once, for the end-of-queue summary */
  const missed = () => [...new Map(session.missed.map((c) => [c.id, c])).values()].slice(0, 15);
  const unseenCount = () => deckCards().filter((c) => !Srs.record(c.id)).length;

  /* past today's allowance on request — sized so exactly n fit, whatever
     the allowance is set to now                                            */
  function learnMore(n) {
    session.bonusNew = n + newToday() - settings.newn;
    buildQueue();
    next();
  }

  /* focused drill on an explicit card list (e.g. the lapse list) */
  function drill(cards) {
    sprint = null;
    session.queue = [...cards];
    session.practice = true;
    session.pending = true;
  }

  /* ignores names that aren't decks — the hash can ask for anything.
     @returns true when the deck changed hands */
  function setDeck(name) {
    if (!isDeck(name)) return false;
    saveSettings({ deck: name });
    session.current = null; /* the card on screen belongs to the old deck */
    session.pending = false;
    return true;
  }

  /* Entering the quiz: pick up newly due cards, but keep the card that was
     on screen rather than dealing a new one every visit.
     @returns false while a sprint owns the screen */
  function resume() {
    if (sprint) return false;
    if (session.pending) { session.pending = false; next(); }
    else if (session.current) { if (!session.practice) buildQueue(session.current); }
    else { buildQueue(); next(); }
    return true;
  }

  /* start over from the stored record (after an import) */
  function restart() {
    sprint = null;
    undoStack.length = 0;
    session.missed = [];
    session.bonusNew = 0;
    buildQueue();
    next();
  }
  /* forget everything learned */
  function wipe() {
    Srs.reset();
    store.set(KEYS.newDay, null);
    restart();
  }

  return {
    settings, state: session,
    isDeck, deckCards, counterpart, listening, matching, typedApplies,
    saveSettings, buildQueue, next, reveal,
    repick() { session.face = pickFace(); },
    sprinting: () => !!sprint, sprintCount: () => (sprint ? sprint.count : 0),
    sprintCards, nextSprintCard, startSprint, endSprint,
    grade, undo, stats, missed, unseenCount, newToday, learnMore,
    drill, setDeck, resume, restart, wipe,
  };
})();
