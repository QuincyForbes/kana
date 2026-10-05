"use strict";
/* Kana Trainer — start-up: switches between the Study, Quiz and Progress
   views, keeps the URL hash in step, and wires the pieces together.

   The app is plain scripts loaded in order by trainer.html, sharing globals:
     store.js          keys + safe storage + audio prefs
     srs.js            scheduler and record helpers (pure)
     kana-data.js, trainer-data.js, legacy-ids.js   data tables
     trainer-romaji.js   answer checking (pure)
     trainer-cards.js    CARDS, decks, custom CSV decks
     trainer-session.js  Srs + QuizSession — the quiz engine, no DOM
     trainer-ui.js       DOM helpers, speech, player
     trainer-study.js / trainer-quiz.js / trainer-progress.js   the views
     trainer.js          this file                                            */

/* ------------------------------- Tabs ------------------------------------ */
let currentMode = "study";
function syncHash() {
  const sec = StudyView.current();
  const h = currentMode === "study" ? "study" + (sec !== "all" ? "/" + sec : "") : currentMode;
  history.replaceState(null, "", "#" + h);
}
function updateDueBadge(){
  const now = Date.now();
  let due = 0;
  CARDS.forEach((c) => { const p = Srs.record(c.id); if (p && p.d <= now) due++; });
  document.querySelectorAll('.tab[data-mode="quiz"]').forEach((tab) => {
    let b = tab.querySelector('.badge');
    if (!b) { b = document.createElement('i'); b.className = 'badge'; tab.appendChild(b); }
    b.textContent = due > 99 ? '99+' : due;
    b.hidden = !due;
  });
}

let modeInitialized = false;
function setMode(mode) {
  currentMode = mode;
  document.body.className = document.body.className.replace(/mode-\w+/g, "").trim();
  document.body.classList.add("mode-" + mode);
  /* view switches, not ARIA tabs: aria-current marks the one showing */
  document.querySelectorAll(".tab").forEach((t) =>
    t.dataset.mode === mode ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"));
  Player.stop();
  if (mode !== "quiz") Quiz.leave();
  if (mode === "quiz") Quiz.start();
  if (mode === "progress") Progress.render();
  syncHash();
  if (modeInitialized) window.scrollTo({ top: 0, behavior: "instant" });
  /* move keyboard/screen-reader focus into the newly shown panel */
  if (modeInitialized) {
    const panel = $(mode);
    panel.tabIndex = -1;
    panel.focus({ preventScroll: true });
  }
  modeInitialized = true;
}

/* ------------------------------- Init ------------------------------------ */
/* #quiz, #quiz/<deck>, #progress, #study/s5 — read before wiring, which
   rewrites the hash                                                         */
const MODES = ["study", "quiz", "progress"];
const readHash = () => location.hash.slice(1).split("/").map(safeDecode);
const [hashMode, hashArg] = readHash();
const hashSec = hashMode === "study" ? hashArg : null;
if (hashMode === "quiz" && hashArg) Quiz.setDeck(hashArg);
StudyView.render();
StudyView.wire();
Quiz.wire();
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => setMode(t.dataset.mode)));
if (hashSec) StudyView.go(hashSec);
setMode(MODES.includes(hashMode) ? hashMode : "study");
updateDueBadge();
window.addEventListener("hashchange", () => {
  const [m, arg] = readHash();
  if (!MODES.includes(m)) return;
  if (m === "quiz" && arg) Quiz.setDeck(arg);
  if (m !== currentMode || (m === "quiz" && arg)) setMode(m);
  if (m === "study" && arg && arg !== StudyView.current()) StudyView.go(arg);
});

/* A second trainer tab writes the same record. Take its version instead
   of overwriting it with this tab's stale copy on the next grade.          */
window.addEventListener("storage", (e) => {
  if (e.key !== KEYS.progress) return;
  Srs.reload();
  updateDueBadge();
  Quiz.refresh();
  if (currentMode === "progress") Progress.render();
});

/* the study bar wraps to two rows on narrow screens — section headings
   stick directly beneath it, whatever its height                          */
if (window.ResizeObserver)
  new ResizeObserver(() =>
    document.documentElement.style.setProperty("--bar-h", $("bar").offsetHeight + "px")).observe($("bar"));

/* first-visit pointer */
if (!store.get(KEYS.hello) && !Object.keys(Srs.all()).length) {
  const hello = $("hello");
  if (hello) {
    hello.hidden = false;
    $("hello-x").onclick = () => { store.set(KEYS.hello, 1); hello.hidden = true; };
  }
}

if (!store.ok) {
  const warn = document.createElement("p");
  warn.className = "qwarn";
  warn.innerHTML =
    "<b>This browser is blocking storage</b>, so quiz progress lasts only until you close the tab — use Export progress (under Backup &amp; reset) to keep it.";
  $("qarea").before(warn);
}
