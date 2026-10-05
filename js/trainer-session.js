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
     learnedToday: a first grade that follows an introduction — see nextRecord.
     @returns true if the card should resurface this session */
  function grade(card, good, { practice = false, learnedToday = false, now = Date.now() } = {}) {
    const before = prog[card.id];
    const after = practice ? practiceRecord(before, good, now) : nextRecord(before, good, now, learnedToday);
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

/* A character counts as learned once it has been answered right at least
   once (its next review is a day or more away). Glyphs that are not cards —
   small っ, ー, a fill-in box — never hold anything back.                   */
const learnedChar = (g) => {
  const id = CHAR_ID[g];
  if (!id) return true;
  const p = Srs.record(id);
  return !!p && p.b >= 1;
};
/* a phrase or kanji card the learner can already read, kana by kana */
const readableCard = (c) => (c.type === "phrase" ? c.kana : c.type === "kanji" ? [...c.furi] : []).every(learnedChar);

/* ---------------------------- Remembered mix-ups -------------------------- */
/* Every wrong pick in a choice question is kept as "you answered X for Y".
   They feed the distractors (so the options trap you where you actually
   slip), the "Your mix-ups" deck and the Progress list.                    */
const Confuse = (() => {
  let data = cleanConfuse(store.get(KEYS.confuse));
  const save = () => store.set(KEYS.confuse, data);
  const count = (a, b) => (data[a]?.[b] || 0) + (data[b]?.[a] || 0);
  return {
    note(right, wrong) {
      if (!right || !wrong || right === wrong) return;
      (data[right] ||= {})[wrong] = Math.min(999, (data[right][wrong] || 0) + 1);
      save();
    },
    /* glyphs mixed up with g, most often first */
    related(g) {
      const seen = new Set();
      Object.keys(data[g] || {}).forEach((w) => seen.add(w));
      Object.entries(data).forEach(([r, ws]) => { if (g in ws) seen.add(r); });
      return [...seen].sort((a, b) => count(g, b) - count(g, a));
    },
    /* unordered pairs [{a, b, n}], most mixed up first */
    pairs() {
      const out = new Map();
      Object.entries(data).forEach(([r, ws]) => Object.keys(ws).forEach((w) => {
        const [a, b] = [r, w].sort(), k = a + "|" + b;
        if (!out.has(k)) out.set(k, { a, b, n: count(a, b) });
      }));
      return [...out.values()].sort((x, y) => y.n - x.n);
    },
    glyphs() { return new Set(Object.entries(data).flatMap(([r, ws]) => [r, ...Object.keys(ws)])); },
    all: () => data,
    replace(next) { data = cleanConfuse(next); save(); },
    reset() { data = {}; save(); },
  };
})();

/* ----------------------------- Quiz session ------------------------------ */
/* The state machine behind the Quiz tab: which deck, what's queued, the
   card in play, grading, undo, the daily new-card allowance and the sprint.
   The view (js/trainer-quiz.js) calls in, then draws whatever state it finds. */
const QuizSession = (() => {
  const DEFAULTS = { deck: "All decks", dir: "jp", mode: "flip", newn: 10, speak: true, learn: true };
  /* modes: flip · type · listen · match · hear (hear a sound, pick its kana) · mixed */
  const settings = Object.assign({}, DEFAULTS, store.get(KEYS.settings) || {});
  /* intro: the card in play is being shown, not asked (learn-then-test).
     practice: the queue is an extra-reps drill, graded via practiceRecord.
     bonusNew: new cards asked for on top of today's allowance.
     pending: a drill is loaded and waits for the Quiz tab to open.
     mode: how the card in play is asked — the chosen mode, or for "mixed"
       whichever format suits it. force: a drill's own format.
     choices: the options of a pick-one question, fixed for the card.       */
  const session = { queue: [], current: null, face: "jp", revealed: false, verdict: null, intro: false,
                    reviewed: 0, correct: 0, missed: [], pending: false,
                    practice: false, bonusNew: 0, mode: "flip", force: null, choices: [] };
  const introduced = new Set(); /* ids shown as an introduction this session */
  const undoStack = []; /* up to 20 grades deep */
  let sprint = null;    /* {count} while a 60s sprint runs — the view owns the clock */

  const TRICKY_CHARS = new Set(TRICKY.flatMap((p) => p.g.flatMap((g) => [g, H2K[g] || "", K2H[g] || ""])));
  const COMPOSITE = {
    "All decks": () => CARDS,
    "All characters": () => CARDS.filter((c) => c.type === "char"),
    "All phrases": () => CARDS.filter((c) => c.type === "phrase"),
    "Look-alikes": () => CARDS.filter((c) => c.type === "char" && TRICKY_CHARS.has(c.char)),
    /* the characters you have actually confused, and their other script */
    "Your mix-ups": () => {
      const g = Confuse.glyphs();
      return CARDS.filter((c) => c.type === "char" && (g.has(c.char) || g.has(counterpart(c))));
    },
  };
  /* own-property checks: a deck name can arrive from the URL hash, and
     "constructor" must not resolve to Object.prototype's                    */
  const isDeck = (name) => Object.hasOwn(COMPOSITE, name) || DECK_ORDER.includes(name);
  const deckCards = () =>
    (Object.hasOwn(COMPOSITE, settings.deck) ? COMPOSITE[settings.deck]() : deckMembers(settings.deck));
  if (!isDeck(settings.deck)) settings.deck = DEFAULTS.deck; /* a stored deck that no longer exists */

  /* The new-card allowance is per day, counted when a card is first graded
     — so reloading, switching tabs or peeking at a card never spends it.   */
  const newToday = () => { const r = store.get(KEYS.newDay); return r && r.day === ymd() ? r.n : 0; };
  const addNewToday = (by) => store.set(KEYS.newDay, { day: ymd(), n: Math.max(0, newToday() + by) });
  const newBudget = () => Math.max(0, settings.newn + session.bonusNew - newToday());

  const counterpart = (c) => H2K[c.char] || K2H[c.char] || "";
  const pickFace = () =>
    settings.mode === "listen" || settings.mode === "hear" ? "jp"
    : settings.dir === "mix" ? (Math.random() < 0.5 ? "jp" : "en") : settings.dir;
  const listening = () => session.mode === "listen" && session.face === "jp";
  const hearing = () => session.mode === "hear" && session.current?.type === "char" && session.face === "jp";
  const matching = () => session.mode === "match" && session.current?.type === "char" && counterpart(session.current);
  const typedApplies = () => (session.mode === "type" || session.mode === "listen") && session.face === "jp";

  /* Mixed: harder ways of recalling a card as it settles in. Recognising
     among options comes first, typing it from memory last — the retrieval
     that is hardest at the time is the one that lasts.                     */
  const ladder = (c) => c.type === "char" ? [counterpart(c) && "match", "hear", "type", "listen"].filter(Boolean)
    : c.custom ? ["flip"] : ["flip", "type", "listen"];
  function modeFor(c, face, racing = false) {
    const m = session.force || settings.mode;
    if (m === "hear" && c.type !== "char") return "listen"; /* nothing to pick between */
    if (m !== "mixed") return m;
    if (face !== "jp") return "flip";
    if (racing) return c.type === "char" && counterpart(c) ? "match" : "type";
    const rungs = ladder(c), level = Srs.record(c.id)?.b || 0;
    const pool = rungs.slice(0, Math.min(rungs.length, 1 + level));
    const fresh = pool.filter((x) => x !== session.mode); /* not the same question twice running */
    const from = fresh.length ? fresh : pool;
    return from[Math.floor(Math.random() * from.length)];
  }

  /* options for a pick-one question: the right glyph, then the ones you have
     actually confused it with, then its look-alikes, then random fill       */
  const KATA = /^[ァ-ヶー]+$/;
  function makeChoices(c) {
    const right = hearing() ? c.char : counterpart(c);
    const kata = KATA.test(right), opts = [right];
    const add = (g) => { if (g && opts.length < 4 && !opts.includes(g)) opts.push(g); };
    const inScript = (g) => (kata ? (K2H[g] !== undefined ? g : H2K[g]) : (H2K[g] !== undefined ? g : K2H[g]));
    Confuse.related(right).forEach(add);
    TRICKY.forEach((p) => {
      if (p.g.includes(c.char) || p.g.includes(right)) p.g.forEach((g) => add(inScript(g)));
    });
    const pool = CARDS.filter((x) => x.type === "char" && x.char.length === right.length && KATA.test(x.char) === kata)
      .map((x) => x.char);
    for (let i = 0; opts.length < 4 && i < 200; i++) add(pool[Math.floor(Math.random() * pool.length)]);
    return shuffle(opts);
  }
  /* settle how the card in play is asked; call whenever it or its face changes */
  function arrange() {
    const c = session.current;
    session.mode = c ? modeFor(c, session.face, !!sprint) : settings.mode;
    session.choices = c && (matching() || hearing()) ? makeChoices(c) : [];
  }
  /* the learner picked an option: right, or one more mix-up to remember */
  function choose(glyph) {
    const c = session.current;
    if (!c || session.revealed || !session.choices.includes(glyph)) return;
    const right = hearing() ? c.char : counterpart(c), ok = glyph === right;
    if (!ok) Confuse.note(right, glyph);
    reveal({ ok, got: glyph });
  }

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
    session.force = null;
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
    arrange();
    session.revealed = false;
    session.verdict = null;
    /* Learn, then test: a card never seen before is shown in full first and
       asked a few cards later, instead of being a question you can only
       fail. Practice drills only hold cards that already have a record.   */
    const c = session.current;
    session.intro = !!c && settings.learn !== false && !session.practice
      && !Srs.record(c.id) && !introduced.has(c.id);
    return c;
  }

  /* the learner has taken the new card in: bring it back as a question */
  function learned() {
    const c = session.current;
    if (!c || !session.intro) return;
    introduced.add(c.id);
    session.queue.splice(Math.min(CONFIG.requeueGap, session.queue.length), 0, c);
    next();
  }
  /* "I already know this": skip the introduction and grade it as known */
  function knowIt() {
    if (!session.intro) return;
    session.intro = false;
    grade(true);
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
    arrange();
    session.revealed = false;
    session.verdict = null;
    session.intro = false;
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
    if (!c || session.intro) return;
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
    if (Srs.grade(c, good, { practice: session.practice, learnedToday: introduced.has(c.id) }))
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
    arrange();
    session.revealed = false;
    session.verdict = null;
    session.intro = false;
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
  function drill(cards, { mode = null } = {}) {
    sprint = null;
    session.queue = [...cards];
    session.practice = true;
    session.force = mode;
    session.pending = true;
  }

  /* ignores names that aren't decks — the hash can ask for anything.
     @returns true when the deck changed hands */
  function setDeck(name) {
    if (!isDeck(name)) return false;
    saveSettings({ deck: name });
    session.current = null; /* the card on screen belongs to the old deck */
    session.force = null;
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
    introduced.clear();
    session.missed = [];
    session.bonusNew = 0;
    buildQueue();
    next();
  }
  /* forget everything learned */
  function wipe() {
    Srs.reset();
    Confuse.reset();
    store.set(KEYS.newDay, null);
    restart();
  }

  return {
    settings, state: session,
    isDeck, deckCards, counterpart, listening, hearing, matching, typedApplies, choose,
    saveSettings, buildQueue, next, reveal, learned, knowIt,
    repick() { session.face = pickFace(); arrange(); },
    sprinting: () => !!sprint, sprintCount: () => (sprint ? sprint.count : 0),
    sprintCards, nextSprintCard, startSprint, endSprint,
    grade, undo, stats, missed, unseenCount, newToday, learnMore,
    drill, setDeck, resume, restart, wipe,
  };
})();
