/* Everything the apps keep in this browser goes through here: one registry
   of keys, one safe wrapper (localStorage when it's available, a silent
   in-memory fallback when it's blocked), and the audio preferences the guide
   and the trainer share. Loaded by every page that reads or writes state.
   js/theme.js is the one exception — it has to run before anything else
   loads, so it reads its key directly.                                     */

const KEYS = {
  progress: "kanaTrainerProgress.v1",   /* SRS record per card id (js/srs.js)        */
  settings: "kanaTrainerSettings.v1",   /* quiz deck, direction, mode, new/day, speak */
  days: "kanaTrainerDays.v1",           /* reviews per day — streak and heatmap      */
  newDay: "kanaTrainerNewDay.v1",       /* new cards introduced today {day, n}       */
  custom: "kanaTrainerCustom.v1",       /* custom CSV decks                          */
  you: "kanaTrainerYou.v1",             /* name / country / job for the intro deck   */
  confuse: "kanaTrainerConfuse.v1",     /* glyphs the learner mixes up {right: {wrong: n}} */
  study: "kanaTrainerStudy.v1",         /* Study view: {fade, readable}              */
  sprint: "kanaTrainerSprint.v1",       /* best 60s sprint per deck                  */
  studySec: "kanaTrainerStudySec.v1",   /* last study section                        */
  seenSec: "kanaTrainerSeenSec.v1",     /* study sections already visited            */
  hello: "kanaTrainerHello.v1",         /* first-visit pointer dismissed             */
  offline: "kanaOfflineAudio.v1",       /* voices whose clips were saved for offline */
  guidePanel: "kanaGuidePanel.v1",      /* last guide panel (plain string)           */
  voice: "kanaVoice.v1",                /* "f" | "m" (plain string)                  */
  audio: "kanaGuideAudio.v1",           /* {slow}                                    */
  theme: "kanaTheme.v1",                /* "light" | "dark" — owned by js/theme.js   */
};

const store = (() => {
  const mem = {};
  let ok = false;
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); ok = true; } catch {}
  const getRaw = (k) => {
    try { if (ok) return localStorage.getItem(k); } catch {}
    return k in mem ? mem[k] : null;
  };
  const setRaw = (k, v) => {
    mem[k] = v;
    try { if (ok) localStorage.setItem(k, v); } catch {}
  };
  return {
    ok,                       /* false: nothing survives the tab */
    getRaw, setRaw,           /* plain strings */
    /* JSON values; anything unreadable comes back as null */
    get(k) {
      const v = getRaw(k);
      if (v == null || v === "") return null;
      try { return JSON.parse(v); } catch { return null; }
    },
    set(k, v) { setRaw(k, JSON.stringify(v)); },
  };
})();

/* audio preferences, shared by the guide and the trainer */
const Prefs = {
  voice: () => (store.getRaw(KEYS.voice) === "m" ? "m" : "f"),
  setVoice(v) { store.setRaw(KEYS.voice, v === "m" ? "m" : "f"); },
  slow: () => !!(store.get(KEYS.audio) || {}).slow,
  setSlow(on) { store.set(KEYS.audio, { slow: !!on }); },
  /* clip folders, the preferred voice first */
  voiceDirs: () => (Prefs.voice() === "m" ? ["audio/ja-m/", "audio/ja/"] : ["audio/ja/", "audio/ja-m/"]),
};
