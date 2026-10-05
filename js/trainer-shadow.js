"use strict";
/* Kana Trainer — Speak view: shadowing. Hear a native clip, say it along
   with the voice, record yourself and play the two back to back. Nothing
   here is graded or scheduled and the recording never leaves the device —
   it lives in memory until the next phrase.

   It draws from phrases made only of characters the learner has already
   learned (readableCard), so what they say is what they can read; until
   there are any, the shortest phrases.                                      */
const Shadow = (() => {
  const canRecord = !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const MAX_MS = 8000;
  let cur = null, mine = null, recorder = null, stream = null, stopTimer = 0, done = 0, lastId = "";
  let blocked = false, showRom = false;

  /* the Study view owns the pitch switch; this view reads it off the page */
  const pitchOn = () => document.body.classList.contains("pitch");
  const pitched = (c) => {
    const pat = pitchPattern(PITCH[c.id][0], c.kana.length);
    return c.kana.map((k, i) => `<span class="pk${pat[i].hi ? " hi" : ""}${pat[i].drop ? " drop" : ""}">${esc(k)}</span>`).join("");
  };

  function pool() {
    /* with pitch on, only phrases that have an accent to show */
    const every = CARDS.filter((c) => c.type === "phrase" && !c.custom && hasClip(c));
    const all = pitchOn() && every.some((c) => PITCH[c.id]) ? every.filter((c) => PITCH[c.id]) : every;
    const ready = all.filter(readableCard);
    return ready.length ? { list: ready, early: false }
      : { list: all.slice().sort((a, b) => a.kana.length - b.kana.length).slice(0, 12), early: true };
  }
  function pick() {
    const { list, early } = pool();
    const from = list.filter((c) => c.id !== lastId);
    cur = (from.length ? from : list)[Math.floor(Math.random() * (from.length || list.length))];
    lastId = cur.id;
    releaseMine();
    showRom = false;
    return early;
  }
  function releaseMine() {
    if (mine) URL.revokeObjectURL(mine);
    mine = null;
  }
  const listen = () => Speech.say(speechText(cur), hasClip(cur));
  const playMine = () => new Promise((res) => {
    if (!mine) return res();
    const a = new Audio(mine);
    a.onended = a.onerror = res;
    a.play().catch(res);
  });

  function stopRecording() {
    clearTimeout(stopTimer);
    if (recorder && recorder.state !== "inactive") recorder.stop(); /* onstop finishes the job */
  }
  async function toggleRecord() {
    if (recorder && recorder.state === "recording") return stopRecording();
    Speech.stop();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { blocked = true; return render(); }
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop()); /* release the microphone */
      stream = null;
      if (chunks.length) { releaseMine(); mine = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType })); done++; }
      recorder = null;
      render();
    };
    recorder.start();
    stopTimer = setTimeout(stopRecording, MAX_MS);
    render();
  }

  function render() {
    const c = cur;
    if (!c) return;
    const recording = recorder?.state === "recording";
    $("shadow-card").innerHTML = `<span class="tag">${esc(c.deck)}</span>
      <div class="qkana" lang="ja">${pitchOn() && PITCH[c.id] ? pitched(c) : esc(c.kana.join(""))}</div>
      ${pitchOn() && PITCH[c.id] ? `<p class="qrom pt">pitch: ${pitchLabel(PITCH[c.id][0])}</p>` : ""}
      <p class="qmean">${esc(c.mean)}</p>
      ${showRom ? `<p class="qrom">${esc(spokenRom(c))}</p>` : ""}
      <div class="qbtns">
        <button type="button" class="qb" id="sh-play">▶ Listen <kbd>s</kbd></button>
        ${canRecord && !blocked ? `<button type="button" class="qb ghost${recording ? " rec" : ""}" id="sh-rec">${recording ? "■ Stop" : "● Record"} <kbd>r</kbd></button>` : ""}
        <button type="button" class="qb ghost" id="sh-mine"${mine ? "" : " disabled"}>▶ You <kbd>m</kbd></button>
        <button type="button" class="qb ghost" id="sh-both"${mine ? "" : " disabled"}>Voice, then you</button>
      </div>
      <div class="qbtns">
        <button type="button" class="qb ghost" id="sh-rom">${showRom ? "Hide" : "Show"} reading</button>
        <button type="button" class="qb ghost" id="sh-next">Next phrase → <kbd>n</kbd></button>
      </div>`;
    $("sh-play").onclick = listen;
    if ($("sh-rec")) $("sh-rec").onclick = toggleRecord;
    $("sh-mine").onclick = playMine;
    $("sh-both").onclick = async () => { await listen(); await new Promise((r) => setTimeout(r, 250)); await playMine(); };
    $("sh-rom").onclick = () => { showRom = !showRom; render(); };
    $("sh-next").onclick = next;
    $("shadow-note").textContent = !canRecord ? "This browser can't record — listen, then say it out loud along with the voice."
      : blocked ? "The microphone is blocked — you can still listen and say it out loud; allow it in the site settings to record."
      : "";
    $("shadow-count").textContent = done ? `${done} recording${done === 1 ? "" : "s"} this visit` : "";
  }
  function next() {
    stopRecording();
    Speech.stop();
    const early = pick();
    $("shadow-early").hidden = !early;
    render();
    listen();
  }

  document.addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("mode-shadow") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(e.target.tagName) && e.key === " ") return;
    const act = { s: listen, r: canRecord && !blocked ? toggleRecord : null, m: playMine, n: next }[e.key];
    if (act) { e.preventDefault(); act(); }
  });

  return {
    wire() {
      $("sh-slow").checked = Prefs.slow();
      $("sh-male").checked = Prefs.voice() === "m";
      on("sh-slow", "change", () => Prefs.setSlow($("sh-slow").checked));
      on("sh-male", "change", () => Prefs.setVoice($("sh-male").checked ? "m" : "f"));
      on("sh-pitch", "change", () => { $("tP").click(); if (pitchOn() && cur && !PITCH[cur.id]) next(); else render(); });
    },
    /* entering the view: a fresh phrase, said once so the ear has it */
    start() { $("sh-slow").checked = Prefs.slow(); $("sh-male").checked = Prefs.voice() === "m"; $("sh-pitch").checked = pitchOn(); next(); },
    /* leaving: let go of the microphone and any audio */
    stop() {
      stopRecording();
      Speech.stop();
      releaseMine();
      cur = null;
    },
  };
})();
