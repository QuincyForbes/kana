"use strict";
/* Kana Trainer — what every view leans on: small DOM helpers, speech (clip
   first, browser voice as fallback) and the play-a-list player.            */

/* ----------------------------- DOM helpers ------------------------------ */
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
const download = (name, text, type) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
/* quiet confirmations, from js/site.js */
const toast = (msg) => window.kanaToast?.(msg);
toast.afterReload = (msg) => window.kanaToast?.afterReload(msg);
/* a hand-edited hash can hold a bare % — never let that take the page down */
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/* ------------------------------ Speech ---------------------------------- */
/* Local neural-TTS clips first — audio/ja/ is Nanami (female), audio/ja-m/
   is Keita (male); the preferred dir is tried first, then the other, then
   the browser's own Japanese voice. The voice and slow-audio preferences
   are shared with the guide (Prefs, js/store.js).                          */
/* play the clip for `text` from the first voice dir that has it; resolves
   to the playing Audio, or null when neither file plays                    */
function playClip(text) {
  const from = (dir) => {
    const a = new Audio(dir + encodeURIComponent(text) + ".mp3");
    a.playbackRate = Prefs.slow() ? 0.75 : 1;
    return a.play().then(() => a);
  };
  const [pref, alt] = Prefs.voiceDirs();
  return from(pref).catch(() => from(alt)).catch(() => null);
}
const Speech = (() => {
  const supported = "speechSynthesis" in window;
  let voice = null;
  const pick = () => {
    const ja = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("ja"));
    voice = ja.find((v) => /Nanami|Kyoko|Google 日本語|Otoya/i.test(v.name)) || ja[0] || null;
  };
  if (supported) { pick(); speechSynthesis.onvoiceschanged = pick; }
  let playing = null, turn = 0;
  const tts = (text) => new Promise((res) => {
    if (!supported) return res();
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      if (voice) u.voice = voice;
      u.rate = Prefs.slow() ? 0.6 : 0.85;
      u.onend = u.onerror = res;
      speechSynthesis.speak(u);
    } catch { res(); }
  });
  function stop() {
    turn++;
    try { playing?.pause(); } catch {}
    playing = null;
    try { if (supported) speechSynthesis.cancel(); } catch {}
  }
  /* speak one text, cutting off whatever was playing. clip: false goes
     straight to browser TTS (text no recorded clip exists for). The promise
     settles when it finishes or is cut off — a paused clip never fires
     "ended", so "pause" resolves it too.                                   */
  function say(text, clip = true) {
    if (!text) return Promise.resolve();
    stop();
    const mine = turn;
    return (clip ? playClip(text) : Promise.resolve(null)).then((a) => {
      if (mine !== turn) { try { a?.pause(); } catch {} return; }
      if (!a) return tts(text);
      playing = a;
      return new Promise((res) => { a.onended = a.onpause = a.onerror = res; });
    });
  }
  return { say, stop };
})();

/* ------------------------- sequential player ----------------------------- */
/* Plays a list through Speech, one text after another. `run` is bumped by
   every stop, so a loop that was mid-flight sees it changed and bows out.  */
const Player = {
  btn: null, run: 0,
  stop() {
    this.run++;
    Speech.stop();
    if (this.btn) { this.btn.classList.remove("on"); this.btn.textContent = "▶"; }
    this.btn = null;
  },
  /* items: [text, hasClip] pairs */
  async toggle(items, btn) {
    const same = this.btn === btn;
    this.stop();
    if (same) return;
    const run = this.run;
    this.btn = btn;
    btn.classList.add("on");
    btn.textContent = "■";
    for (const [text, clip] of items) {
      await Speech.say(text, clip);
      if (run !== this.run) return;
      await new Promise((r) => setTimeout(r, 500));
      if (run !== this.run) return;
    }
    this.stop();
  },
};
