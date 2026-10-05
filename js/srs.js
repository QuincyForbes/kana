/* Shared spaced-repetition core — loaded by the trainer, the guide and the
   landing page so every view reads one record of what you actually know.
   Pure functions: nothing here touches storage or the DOM.                 */

const DAY = 864e5;

const CONFIG = {
  /* FSRS-4.5 default parameters (open-spaced-repetition). The scheduler
     models each card's memory as a stability (days until recall drops to
     90%) and a difficulty (1–10), and spaces reviews to hit `retention`.   */
  w: [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474,
      0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755],
  retention: 0.9,           /* chance of recall each review is timed for    */
  maxIntervalDays: 365,     /* no card goes longer than a year unseen       */
  againDelay: 2 * 60e3,     /* a missed card is due again in 2 minutes      */
  requeueGap: 3,            /* …and resurfaces this many cards later        */
  /* Display levels 0–5, by days until the next review. They drive the dots
     on a card and "known"; scheduling itself only uses stability.          */
  levels: [0, 1, 3, 7, 21, 45],
  knownBox: 4,              /* "known": next review three weeks or more out */
  interleaveEvery: 3,       /* new cards are spliced in every N due cards   */
};

const ymd = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/* consecutive review days ending today (or yesterday, so an unfinished
   today doesn't read as zero). days: {"YYYY-MM-DD": reviews}               */
function streakOf(days, today = new Date()) {
  const key = (back) => { const d = new Date(today); d.setDate(d.getDate() - back); return ymd(d); };
  let n = 0, i = days[key(0)] ? 0 : 1;
  while (days[key(i)]) { n++; i++; }
  return n;
}

/* ------------------------------- FSRS ------------------------------------ */
/* The FSRS-4.5 formulas, as published. The trainer grades two ways — Again
   (1) and Got it (3) — so the Hard and Easy multipliers (w15, w16) and the
   Hard/Easy starting points (w1, w3) are never reached.                    */
const FSRS = (() => {
  const DECAY = -0.5, FACTOR = 19 / 81;
  const w = CONFIG.w;
  const clampD = (d) => Math.min(10, Math.max(1, d));
  const d0 = (g) => clampD(w[4] - (g - 3) * w[5]);
  return {
    /* chance of recall t days after a review, at stability s */
    retrievability: (t, s) => Math.pow(1 + FACTOR * t / s, DECAY),
    /* days until recall falls to r */
    interval: (s, r = CONFIG.retention) => s / FACTOR * (Math.pow(r, 1 / DECAY) - 1),
    /* a card's first grade */
    initial: (g) => ({ st: w[g - 1], df: d0(g) }),
    /* difficulty drifts with each grade and reverts toward the default */
    difficulty: (d, g) => clampD(w[7] * d0(3) + (1 - w[7]) * (d - w[6] * (g - 3))),
    /* stability after a successful recall at retrievability r */
    recall: (d, s, r) =>
      s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1)),
    /* stability after forgetting — never more than it was */
    forget: (d, s, r) =>
      Math.min(s, w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r))),
  };
})();

/* display level for an interval in days: the highest threshold it reaches */
function levelOf(iv) {
  let b = 0;
  CONFIG.levels.forEach((days, i) => { if (iv >= days) b = i; });
  return b;
}

/* Records written before FSRS carry a Leitner box instead of a memory
   state. Read one as: stability ≈ the interval the card had earned (the
   old boxes were exactly CONFIG.levels days apart), difficulty nudged up
   per lapse, last reviewed one interval before it fell due.                */
function memoryOf(p) {
  if (p.st > 0 && p.df > 0 && p.lr > 0) return p;
  const iv = p.iv > 0 ? p.iv : CONFIG.levels[Math.min(Math.max(p.b || 0, 0), CONFIG.levels.length - 1)];
  return {
    st: Math.max(iv, CONFIG.w[0]),
    df: Math.min(10, Math.max(1, CONFIG.w[4] + (p.l || 0) * CONFIG.w[6])),
    lr: p.d - (iv > 0 ? iv * DAY : CONFIG.againDelay),
  };
}

/* One grade step: returns the card's next record without touching storage.
   Records carry {b: level, d: due-ms, s: seen, l: lapses, st: stability,
   df: difficulty, lr: last-review-ms, iv: interval-days}.
   learnedToday: this first grade follows an introduction earlier in the
   session — the card was learned today, not known on sight — so a hit
   brings it back tomorrow rather than at FSRS's four-day opening gap.      */
function nextRecord(p, good, now, learnedToday = false) {
  const g = good ? 3 : 1;
  const n = { b: 0, d: 0, s: 0, l: 0, ...(p || {}) };
  delete n.e; /* the pre-FSRS ease factor */
  n.s++;
  if (!p) Object.assign(n, FSRS.initial(g));
  else {
    const m = memoryOf(p);
    const r = FSRS.retrievability(Math.max(0, (now - m.lr) / DAY), m.st);
    n.st = good ? FSRS.recall(m.df, m.st, r) : FSRS.forget(m.df, m.st, r);
    n.df = FSRS.difficulty(m.df, g);
  }
  n.st = +Math.max(0.1, n.st).toFixed(4);
  n.df = +n.df.toFixed(4);
  n.lr = now;
  if (good) {
    n.iv = !p && learnedToday ? 1
      : Math.min(CONFIG.maxIntervalDays, Math.max(1, Math.round(FSRS.interval(n.st))));
    n.d = now + n.iv * DAY;
  } else {
    /* relearn it this session; the shrunken stability sets what follows */
    n.l++;
    n.iv = 0;
    n.d = now + CONFIG.againDelay;
  }
  n.b = levelOf(n.iv);
  return n;
}

/* Practice grades (the 60s sprint, "drill these now") are extra reps, not
   scheduled reviews: a hit can't promote a card ahead of its due date and
   an unseen card stays unseen. A miss on a card you've met still counts.
   Returns the record to keep — the same object when nothing changes.       */
function practiceRecord(p, good, now) {
  if (!p || (good && p.d > now)) return p;
  return nextRecord(p, good, now);
}

/* Keep only well-formed records from untrusted input (an imported file, or
   storage another version wrote). Returns null when it isn't a record map. */
function cleanProg(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const num = Number.isFinite;
  const out = {};
  for (const [id, r] of Object.entries(raw)) {
    if (!r || typeof r !== "object" || !num(r.b) || !num(r.d)) continue;
    const rec = { b: Math.max(0, Math.min(CONFIG.levels.length - 1, Math.round(r.b))), d: r.d,
                  s: num(r.s) ? r.s : 1, l: num(r.l) ? r.l : 0 };
    if (num(r.iv)) rec.iv = Math.max(0, r.iv);
    if (num(r.st) && r.st > 0 && num(r.df) && num(r.lr)) {
      rec.st = r.st;
      rec.df = Math.min(10, Math.max(1, r.df));
      rec.lr = r.lr;
    }
    out[id] = rec;
  }
  return out;
}

/* Mix-ups the learner has made: {right glyph: {wrong glyph: count}}. Same
   rules as cleanProg — keep only what is well-formed.                      */
function cleanConfuse(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [right, wrongs] of Object.entries(raw)) {
    if (right.length > 4 || !wrongs || typeof wrongs !== "object" || Array.isArray(wrongs)) continue;
    for (const [wrong, n] of Object.entries(wrongs)) {
      if (wrong.length > 4 || wrong === right || !Number.isFinite(n) || n < 1) continue;
      (out[right] ||= {})[wrong] = Math.min(999, Math.round(n));
    }
  }
  return out;
}

/* Rename ids through a legacy → current map (js/legacy-ids.js plus the
   per-deck custom ids). Unmapped ids pass through; a record already stored
   under the current id wins. Returns [records, changed].                   */
function migrateIds(prog, map) {
  const out = {};
  let changed = false;
  for (const [id, rec] of Object.entries(prog)) {
    const to = Object.hasOwn(map, id) ? map[id] : id;
    if (to !== id) changed = true;
    if (to === id || !Object.hasOwn(prog, to)) out[to] = rec;
  }
  return [out, changed];
}
