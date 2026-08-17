/* Shared spaced-repetition core — loaded by both the trainer and the guide
   so every drill feeds one record of what you actually know.               */

const CONFIG = {
  /* Leitner boxes 0–5 for the learning phase. A hit promotes one box; a
     miss resets to box 0. Once a card clears the top box, growth switches
     to a per-card ease factor (SM-2 style): interval ×= ease, ease drifts
     up slowly on hits and drops on misses.                                 */
  intervals: [10 * 60e3, 864e5, 3 * 864e5, 7 * 864e5, 21 * 864e5, 45 * 864e5],
  againDelay: 2 * 60e3,     /* a missed card is due again in 2 minutes      */
  requeueGap: 3,            /* …and resurfaces this many cards later        */
  knownBox: 4,              /* box that counts as "learned" (survived 21 d) */
  interleaveEvery: 3,       /* new cards are spliced in every N due cards   */
  easeStart: 2.5, easeMin: 1.3, easeMax: 2.8,
  easeGain: 0.03, easeLoss: 0.2,
  progressKey: "kanaTrainerProgress.v1",
  settingsKey: "kanaTrainerSettings.v1",
  daysKey: "kanaTrainerDays.v1",
};

const ymd = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

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
      n.iv = Math.round(Math.max(n.iv || CONFIG.intervals[top] / 864e5, 1) * n.e);
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

/* Bridge for pages without the trainer's Srs module (the guide's drill):
   grade a card id directly against the shared localStorage record.         */
const SrsBridge = {
  grade(id, good, now = Date.now()) {
    try {
      const prog = JSON.parse(localStorage.getItem(CONFIG.progressKey)) || {};
      prog[id] = nextRecord(prog[id], good, now);
      localStorage.setItem(CONFIG.progressKey, JSON.stringify(prog));
      const days = JSON.parse(localStorage.getItem(CONFIG.daysKey)) || {};
      days[ymd()] = (days[ymd()] || 0) + 1;
      localStorage.setItem(CONFIG.daysKey, JSON.stringify(days));
    } catch {}
  },
};
