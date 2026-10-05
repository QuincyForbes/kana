/* Shared spaced-repetition core — loaded by the trainer, the guide and the
   landing page so every view reads one record of what you actually know.   */

const CONFIG = {
  /* Leitner boxes 0–5 for the learning phase. A hit promotes one box; a
     miss resets to box 0. Once a card clears the top box, growth switches
     to a per-card ease factor (SM-2 style): interval ×= ease, ease drifts
     up slowly on hits and drops on misses.                                 */
  intervals: [10 * 60e3, 864e5, 3 * 864e5, 7 * 864e5, 21 * 864e5, 45 * 864e5],
  againDelay: 2 * 60e3,     /* a missed card is due again in 2 minutes      */
  requeueGap: 3,            /* …and resurfaces this many cards later        */
  knownBox: 4,              /* "learned": passed the review after the 7-day gap */
  maxIntervalDays: 365,     /* eased intervals stop stretching here         */
  interleaveEvery: 3,       /* new cards are spliced in every N due cards   */
  easeStart: 2.5, easeMin: 1.3, easeMax: 2.8,
  easeGain: 0.03, easeLoss: 0.2,
  progressKey: "kanaTrainerProgress.v1",
  settingsKey: "kanaTrainerSettings.v1",
  daysKey: "kanaTrainerDays.v1",
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

/* one grade step: returns the card's next record without touching storage.
   Records carry {b: box, d: due-ms, s: seen, l: lapses} and, once past the
   fixed boxes, {e: ease, iv: interval-days}.                               */
function nextRecord(p, good, now) {
  const n = { e: CONFIG.easeStart, iv: 0, ...(p || { b: 0, d: 0, s: 0, l: 0 }) };
  n.s++;
  const top = CONFIG.intervals.length - 1;
  if (good) {
    if (n.b < top) {
      n.b++;
      n.d = now + CONFIG.intervals[n.b];
      n.iv = CONFIG.intervals[n.b] / 864e5;
    } else {
      n.iv = Math.min(CONFIG.maxIntervalDays,
        Math.round(Math.max(n.iv || CONFIG.intervals[top] / 864e5, 1) * n.e));
      n.e = Math.min(CONFIG.easeMax, n.e + CONFIG.easeGain);
      n.d = now + n.iv * 864e5;
    }
  } else {
    n.l++;
    n.b = 0;
    n.e = Math.max(CONFIG.easeMin, n.e - CONFIG.easeLoss);
    n.iv = 0;
    n.d = now + CONFIG.againDelay;
  }
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
  const out = {};
  for (const [id, r] of Object.entries(raw)) {
    if (!r || typeof r !== "object" || !Number.isFinite(r.b) || !Number.isFinite(r.d)) continue;
    const rec = { b: Math.max(0, Math.min(CONFIG.intervals.length - 1, Math.round(r.b))), d: r.d,
                  s: Number.isFinite(r.s) ? r.s : 1, l: Number.isFinite(r.l) ? r.l : 0 };
    if (Number.isFinite(r.e)) rec.e = Math.max(CONFIG.easeMin, Math.min(CONFIG.easeMax, r.e));
    if (Number.isFinite(r.iv)) rec.iv = Math.max(0, r.iv);
    out[id] = rec;
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
