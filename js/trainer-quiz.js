"use strict";
/* Kana Trainer — Quiz view. Draws whatever state QuizSession
   (js/trainer-session.js) is in and wires the controls around it: the card,
   shortcuts, the sprint clock, backup/import and custom decks.             */
const Quiz = (() => {
  const S = QuizSession, session = S.state, settings = S.settings;
  const { counterpart, listening, matching, typedApplies } = S;

  /* memory hook for the 46 base characters, from the guide. Looked up by
     glyph (BASE_LINK), not romaji — を and お share "o", ウォ and を "wo". */
  const mnemOf = (c) => {
    const m = c.type === "char" ? MNEM[BASE_LINK[c.char]] : null;
    return m ? m[K2H[c.char] !== undefined ? 1 : 0] : "";
  };
  const speak = (c) => Speech.say(speechText(c), hasClip(c));
  /* screen readers hear the prompt and the verdict, not every re-render */
  const announce = (text) => { const live = $("qlive"); if (live) live.textContent = text; };

  /* draw the card the session just dealt, warming the clip after it */
  function show() {
    const up = session.queue[0];
    if (up && hasClip(up)) {
      const pre = new Audio();
      pre.preload = "auto";
      pre.src = Prefs.voiceDirs()[0] + encodeURIComponent(speechText(up)) + ".mp3";
    }
    render();
  }
  /* rebuild the queue from what's due and deal from it */
  const deal = () => { S.buildQueue(); S.next(); show(); };
  function reveal(verdict) { S.reveal(verdict); render(); }

  /* ---- 60s sprint: the session picks and grades, the clock lives here ---- */
  let clock = null, left = 0;
  /* completed: the minute ran out. redeal: false when something else takes
     over next (tab change, reset, drill)                                   */
  function stopSprint(completed, redeal = true) {
    clearInterval(clock);
    clock = null;
    const r = S.endSprint(completed);
    document.body.classList.remove("sprinting");
    $("qsprint").textContent = "60s sprint";
    $("sprint-box").hidden = true;
    $("qsession").hidden = false;
    if (completed) {
      stats();
      $("qarea").innerHTML = `<div class="qcard"><div class="qdone">
        <p><b>Sprint over — ${r.count} correct in 60 seconds.</b>${r.isBest && r.count > 0 ? " New best for this deck!" : ` Best: ${r.best}.`}</p>
        <div class="qbtns"><button class="qb" id="qsprint-again">Again</button><button class="qb ghost" id="qsprint-done">Back to reviews</button></div>
      </div></div>`;
      announce(`Sprint over — ${r.count} correct.`);
      $("qsprint-again").onclick = startSprint;
      $("qsprint-done").onclick = deal;
    } else if (redeal) deal();
  }
  function startSprint() {
    if (S.sprinting()) return stopSprint(false);
    if (!S.startSprint()) {
      $("qarea").innerHTML = `<div class="qcard"><div class="qdone">
        <p><b>Nothing to sprint through here.</b> This deck only has flip-and-grade cards — pick a deck with kana readings.</p>
        <div class="qbtns"><button class="qb ghost" id="qrefill">Back to reviews</button></div></div></div>`;
      $("qrefill").onclick = deal;
      return;
    }
    left = 60;
    clock = setInterval(() => {
      if (--left <= 0) return stopSprint(true);
      $("sprint-left").textContent = left;
    }, 1000);
    document.body.classList.add("sprinting");
    $("qsprint").textContent = "Stop sprint";
    $("sprint-box").hidden = false;
    $("qsession").hidden = true;
    $("sprint-left").textContent = "60";
    $("sprint-count").textContent = "0";
    render();
  }

  function grade(good) {
    if (!session.current) return;
    S.grade(good);
    if (S.sprinting()) { $("sprint-count").textContent = S.sprintCount(); render(); }
    else show();
    updateDueBadge();
  }

  function undo() {
    if (!S.undo()) return;
    render();
    updateDueBadge();
  }

  /* ---- rendering ---- */
  function stats() {
    const s = S.stats();
    $("stNew").textContent = s.unseen;
    $("stLearn").textContent = s.learning;
    $("stKnown").textContent = s.known;
    $("stDue").textContent = s.due;
    $("stLeft").textContent = s.left;
    $("stToday").textContent = s.reviewed;
    $("stAcc").textContent = s.reviewed ? ` · ${Math.round(100 * s.correct / s.reviewed)}% right` : "";
    $("qundo").disabled = !s.canUndo;
  }

  /* One face descriptor per card type: prompt shown up front, answer parts
     revealed together. Keeps all six type×face combinations in one shape.  */
  const kanaBlock = (t, big, hide) =>
    `<div class="qkana${big ? " big" : ""}${hide ? " qhide" : ""}" lang="ja">${t}</div>`;
  const meanBlock = (t, hide) => `<p class="qmean${hide ? " qhide" : ""}">${t}</p>`;
  const romBlock = (t, hide) => `<p class="qrom${hide ? " qhide" : ""}">${t}</p>`;

  function faceHTML(c, face) {
    /* hideQ hides the Japanese side, hideA the answer side. In listen mode
       everything is hidden until reveal — the audio IS the prompt. */
    const listen = listening();
    const hideQ = listen || face !== "jp";
    const hideA = listen || face === "jp";
    if (c.type === "char")
      return kanaBlock(esc(c.char), true, hideQ) + romBlock(esc(c.rom), hideA);
    if (c.type === "custom")
      return kanaBlock(esc(c.front), c.front.length <= 4, hideQ)
        + (c.reading && c.reading !== c.front ? romBlock(esc(c.reading), hideA) : "")
        + meanBlock(esc(c.mean), hideA);
    if (c.type === "kanji") {
      const ruby = (hideRt) =>
        `<ruby>${esc(c.kanji)}<rt${hideRt ? ' class="qhide"' : ""}>${esc(c.furi)}</rt></ruby>`;
      return kanaBlock(ruby(hideA), false, hideQ)
        + meanBlock(`${esc(c.mean)} <span style="color:var(--muted);font-size:13px">· ${esc(c.where)}</span>`, hideA)
        + romBlock(esc(c.rom), true);
    }
    return kanaBlock(esc(c.kana.join("")), false, hideQ)
      + meanBlock(esc(c.mean), hideA)
      + romBlock(esc(spokenRom(c)), true);
  }

  function controlsHTML() {
    if (!session.revealed) {
      const replay = listening()
        ? `<div class="qbtns"><button class="qb ghost" id="bReplay">🔊 play again</button></div>` : "";
      if (matching()) {
        const right = counterpart(session.current);
        /* distractors: look-alike partners of this glyph first, then random */
        const opts = [right];
        /* answers stay in the counterpart's script; look-alike partners of
           THIS character trap first, random fills the rest */
        const answerScript = K2H[right] !== undefined ? "k" : "h";
        const toAnswerScript = (g) => (answerScript === "k" ? (K2H[g] !== undefined ? g : H2K[g]) : (H2K[g] !== undefined ? g : K2H[g]));
        TRICKY.forEach((p) => {
          if (!p.g.includes(session.current.char) && !p.g.includes(right)) return;
          p.g.forEach((g) => {
            const cand = toAnswerScript(g);
            if (cand && opts.length < 4 && !opts.includes(cand)) opts.push(cand);
          });
        });
        const pool = Object.keys(answerScript === "k" ? K2H : H2K).filter((g) => g.length === right.length);
        while (opts.length < 4) {
          const cand = pool[Math.floor(Math.random() * pool.length)];
          if (!opts.includes(cand)) opts.push(cand);
        }
        return `<div class="qchoices">${shuffle(opts).map((g) =>
          `<button type="button" class="qc" lang="ja" data-match="${esc(g)}">${esc(g)}</button>`).join("")}</div>`;
      }
      /* personalized cards have no fixed romaji — flip-grade them */
      return typedApplies() && !session.current.custom
        ? `${replay}<div class="qbtns"><input id="qtype" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="${listening() ? "type what you hear" : "type the romaji, enter to check"}"></div>
           <div class="qbtns"><button class="qb ghost" id="bShow">Give up — show it</button></div>`
        : `${replay}<div class="qbtns"><button class="qb" id="bShow">Show answer</button></div>`;
    }
    const v = session.verdict;
    const verdict = v
      ? `<p class="verdict ${v.ok ? "ok" : "no"}">${v.ok ? "Correct" : "Not quite"} — <span lang="ja">${esc(matching() ? counterpart(session.current) : "")}</span>${matching() ? "" : esc(answerRom(session.current))}${v.ok ? "" : ` (you answered: ${esc(v.got)})`}</p>`
      : "";
    const m = mnemOf(session.current);
    const mnem = m ? `<p class="qmnem">${m}</p>` : "";
    return `${verdict}${mnem}<div class="qbtns">
      <button class="qb again" id="bAgain">Again <kbd>1</kbd></button>
      <button class="qb" id="bGood">Got it <kbd>2</kbd></button></div>`;
  }

  function render() {
    stats();
    const c = session.current;
    if (!c) return renderDone();
    const p = Srs.record(c.id);
    const levels = CONFIG.levels.length;
    const level = p
      ? `<span class="dots" role="img" aria-label="Level ${p.b + 1} of ${levels}" title="Level ${p.b + 1} of ${levels} — the further off a card's next review, the higher its level">${
          CONFIG.levels.map((_, i) => `<i${i <= p.b ? ' class="on"' : ""}></i>`).join("")}</span>`
      : `<span class="newtag">new</span>`;
    $("qarea").innerHTML = `<div class="qcard">
      <span class="tag">${esc(c.deck)}</span>
      <span class="box">${level}</span>
      ${faceHTML(c, session.face)}${controlsHTML()}
    </div>`;
    session.revealed ? wireRevealed(c) : wirePrompt(c);
    if (!session.revealed)
      announce(listening() ? "Listen, then type what you hear." : session.face === "jp" ? cardJp(c) : cardGloss(c));
    else {
      const v = session.verdict;
      announce((v ? (v.ok ? "Correct. " : "Not quite. ") : "") + `${cardJp(c)} — ${answerRom(c)}` + (c.mean ? `, ${c.mean}` : ""));
    }
  }

  function renderDone() {
    const r = session.reviewed;
    /* session summary: what was missed, with the memory hook re-shown */
    const missed = S.missed();
    const summary = missed.length
      ? `<div class="qsummary"><h3>Missed this session</h3><ul>${missed.map((c) => {
          const m = mnemOf(c);
          return `<li><b lang="ja">${esc(cardJp(c))}</b> ${esc(answerRom(c))}${m ? ` — ${m}` : ""}</li>`;
        }).join("")}</ul></div>`
      : "";
    /* unseen cards left once today's allowance is spent: offer a few more
       rather than sending the learner to the settings to raise a number    */
    const unseen = S.unseenCount();
    const more = Math.min(5, unseen);
    $("qarea").innerHTML = `<div class="qcard"><div class="qdone">
      <p><b>Nothing due.</b> ${r ? `You reviewed ${r} card${r > 1 ? "s" : ""} — nice.` : ""}</p>
      ${summary}
      <p>${more
        ? `Today's new cards are done, with ${unseen} still unseen in this deck. Come back later for reviews, or keep going.`
        : "Come back later for reviews, or pick another deck."}</p>
      <div class="qbtns">${more ? `<button class="qb" id="qmore">Learn ${more} more</button>` : ""}<button class="qb ghost" id="qrefill">Check again</button></div>
    </div></div>`;
    announce("Nothing due.");
    $("qrefill").onclick = deal;
    if (more) $("qmore").onclick = () => { S.learnMore(more); show(); };
  }

  function wireRevealed(c) {
    document.querySelectorAll(".qhide").forEach((e) => e.classList.remove("qhide"));
    $("bAgain").onclick = () => grade(false);
    $("bGood").onclick = () => grade(true);
    /* focus the grade the verdict suggests — Enter then continues */
    const v = session.verdict;
    if (v) (v.ok ? $("bGood") : $("bAgain")).focus();
    if (settings.speak) speak(c);
  }

  function wirePrompt(c) {
    document.querySelectorAll("[data-match]").forEach((b) =>
      b.addEventListener("click", () => {
        const right = counterpart(c);
        reveal({ ok: b.dataset.match === right, got: b.dataset.match });
      }));
    const show = $("bShow");
    if (show) show.onclick = () => reveal(null);
    const rep = $("bReplay");
    if (rep) rep.onclick = () => speak(c);
    if (listening()) speak(c);
    const input = $("qtype");
    if (input) {
      input.focus();
      input.addEventListener("keydown", (e) => {
        /* Enter that confirms an IME conversion is not "submit" */
        if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
        e.stopPropagation();
        reveal({ ok: checkTyped(input.value, c), got: input.value.trim() || "—" });
      });
    }
  }

  /* ---- wiring ---- */
  function wire() {
    const deckSel = $("qdeck");
    const deckGroups = [
      ["Everything", COMPOSITE_DECKS.filter((d) => d !== "Look-alikes")],
      ["Characters", ["Hiragana", "Katakana", "Hiragana combos", "Katakana combos", "Look-alikes"]],
      ["Phrases & words", DATA.map((d) => d[0])],
      ["Kanji", ["Survival kanji"]],
      ...(Custom.decks.length ? [["My decks", Custom.decks.map((d) => d.name)]] : []),
    ];
    deckSel.innerHTML = deckGroups.map(([label, items]) =>
      `<optgroup label="${esc(label)}">${items.map((d) => `<option>${esc(d)}</option>`).join("")}</optgroup>`).join("");
    deckSel.value = settings.deck;
    $("qdir").value = settings.dir;
    $("qmode").value = settings.mode;
    $("qnewn").value = settings.newn;
    $("qspeak").checked = settings.speak;

    on("qopts-btn", "click", () => {
      const open = $("qopts").hidden;
      $("qopts").hidden = !open;
      $("qopts-btn").setAttribute("aria-expanded", String(open));
    });

    /* mid-sprint, a settings change deals a fresh sprint card instead of
       dropping back into the review queue                                  */
    const saveSettings = () => S.saveSettings({
      deck: $("qdeck").value, dir: $("qdir").value, mode: $("qmode").value,
      newn: Math.max(0, +$("qnewn").value || 0), speak: $("qspeak").checked,
    });
    const onChange = {
      qdeck: () => {
        if (!S.sprinting()) return deal();
        if (!S.sprintCards().length) return stopSprint(false);
        S.nextSprintCard();
        render();
      },
      qdir: () => { if (!S.sprinting()) S.repick(); render(); },
      qmode: () => { if (!S.sprinting()) S.repick(); render(); },
      qnewn: () => {
        if (S.sprinting()) return;
        S.buildQueue(session.current);
        if (session.current) stats(); else { S.next(); show(); }
      },
      qspeak: () => {},
    };
    Object.entries(onChange).forEach(([id, fn]) =>
      on(id, "change", () => { saveSettings(); fn(); }));

    /* Space/Enter belong to a control the user tabbed onto; a button that
       only holds focus because it was just clicked doesn't claim them.     */
    const keyboardFocused = (t) => {
      try { return /^(BUTTON|A|SUMMARY)$/.test(t.tagName) && t.matches(":focus-visible"); } catch { return false; }
    };
    document.addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("mode-quiz")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      /* typing anywhere — answer box, deck name, the CSV textarea — is
         never a shortcut                                                   */
      const t = e.target;
      if (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      if (e.key === " " || e.key === "Enter") {
        if (keyboardFocused(t)) return;
        if (!session.revealed && session.current) { e.preventDefault(); reveal(null); }
      } else if (e.key === "1" && session.revealed) grade(false);
      else if (e.key === "2" && session.revealed) grade(true);
      else if (e.key === "s" && session.current) speak(session.current);
      else if (e.key === "u") undo();
    });

    on("qundo", "click", undo);
    on("qsprint", "click", startSprint);

    /* voice + speed prefs are global (shared with the guide), not quiz settings */
    $("qvoice").checked = Prefs.voice() === "m";
    on("qvoice", "change", () => Prefs.setVoice($("qvoice").checked ? "m" : "f"));
    $("qslow").checked = Prefs.slow();
    on("qslow", "change", () => Prefs.setSlow($("qslow").checked));

    on("qexport", "click", () => {
      const payload = { v: 3, when: new Date().toISOString(), prog: Srs.all(), custom: Custom.decks };
      download("kana-trainer-progress.json", JSON.stringify(payload, null, 1), "application/json");
      toast("Backup saved to your downloads");
    });
    on("qimport", "click", () => $("qfile").click());
    on("qfile", "change", (e) => {
      const f = e.target.files[0];
      e.target.value = ""; /* so choosing the same file again still fires */
      if (!f) return;
      f.text().then((t) => {
        /* validate everything first — nothing is touched until the file
           has parsed, checked out, and the learner has agreed to replace   */
        let j = null;
        try { j = JSON.parse(t); } catch {}
        const prog = j && cleanProg(j.prog);
        if (!prog) { alert("That file isn't a Kana Trainer export — nothing was changed."); return; }
        const decks = Array.isArray(j.custom) ? cleanDecks(j.custom, RESERVED_DECKS) : null;
        const n = Object.keys(prog).length;
        const what = `${n} card record${n === 1 ? "" : "s"}`
          + (decks ? ` and ${decks.length} custom deck${decks.length === 1 ? "" : "s"}` : "");
        if ((Object.keys(Srs.all()).length || Custom.decks.length)
            && !confirm(`Replace what's saved in this browser with the file's ${what}?\n\nExport first if you want a backup of what's here now.`)) return;
        if (decks) Custom.decks = decks; /* first: old custom ids migrate through the file's decks */
        Srs.replace(prog);
        if (decks) { toast.afterReload(`Imported ${what}`); return Custom.commit(); } /* decks changed the card list — reloads */
        toast(`Imported ${what}`);
        if (S.sprinting()) stopSprint(false, false);
        S.restart();
        show();
        updateDueBadge();
      });
    });
    /* ---- My decks (CSV) ---- */
    const SAMPLE = "日本, にほん, Japan\n水, みず, water\nはしります, , to run (polite)";
    function renderCustomList() {
      const ul = $("md-list");
      if (!ul) return;
      ul.innerHTML = Custom.decks.length
        ? Custom.decks.map((d, i) => {
            const typed = Custom.cardsOf(d).filter((c) => !c.custom).length;
            return `<li><b>${esc(d.name)}</b> · ${d.cards.length} cards${typed ? ` (${typed} typeable)` : ""}
              <span class="mdacts">
                <button type="button" class="minibtn" data-editdeck="${i}">edit</button>
                <button type="button" class="minibtn" data-dldeck="${i}">download</button>
                <button type="button" class="minibtn" data-deldeck="${i}">remove</button>
              </span></li>`;
          }).join("")
        : '<li class="pempty">No custom decks yet — paste some lines above, or <button type="button" class="minibtn" id="md-sample">insert a sample</button>.</li>';
    }
    renderCustomList();
    const mdCount = () => {
      const n = Custom.parse($("md-csv").value).length;
      $("md-count").textContent = n ? `${n} card${n > 1 ? "s" : ""} ready` : "";
    };
    on("md-csv", "input", mdCount);
    on("md-import", "click", () => {
      const name = $("md-name").value.trim();
      const cards = Custom.parse($("md-csv").value);
      if (!name || !cards.length) { alert("Give the deck a name and at least one line: front, reading, meaning"); return; }
      if (RESERVED_DECKS.includes(name)) { alert(`"${name}" is one of the built-in decks — pick another name.`); return; }
      toast.afterReload(`Saved "${name}" — ${cards.length} card${cards.length === 1 ? "" : "s"}`);
      Custom.upsert(name, cards);
    });
    on("md-load", "click", () => $("md-fileinput").click());
    on("md-fileinput", "change", (e) => {
      const f = e.target.files[0];
      if (f) f.text().then((txt) => {
        $("md-csv").value = txt;
        if (!$("md-name").value) $("md-name").value = f.name.replace(/\.[^.]+$/, "");
        mdCount();
      });
    });
    on("md-list", "click", (e) => {
      const act = (attr) => { const b = e.target.closest(`[data-${attr}]`); return b ? +b.dataset[attr] : null; };
      if (e.target.id === "md-sample") { $("md-csv").value = SAMPLE; $("md-name").value ||= "Sample deck"; mdCount(); return; }
      const del = act("deldeck");
      if (del !== null) {
        const name = Custom.decks[del].name;
        if (confirm(`Remove "${name}" from the trainer? Its cards and their progress go with it.`)) {
          toast.afterReload(`Removed "${name}"`);
          Custom.remove(del);
        }
        return;
      }
      const ed = act("editdeck");
      if (ed !== null) {
        const d = Custom.decks[ed];
        $("md-name").value = d.name;
        $("md-csv").value = Custom.toCSV(d);
        mdCount();
        $("mydecks").open = true;
        $("md-csv").focus();
        return;
      }
      const dl = act("dldeck");
      if (dl !== null) {
        const d = Custom.decks[dl];
        download(d.name + ".csv", Custom.toCSV(d), "text/csv");
      }
    });

    /* ---- offline audio: pull every clip of the current voice through the
       service worker, which keeps what passes through it (sw.js) ---- */
    const offStatus = (t) => { $("off-status").textContent = t; };
    const savedVoices = () => store.get(KEYS.offline) || {};
    const showSaved = () =>
      offStatus(savedVoices()[Prefs.voice()] ? `${Prefs.voice() === "m" ? "male" : "female"} voice saved ✓` : "");
    showSaved();
    on("qvoice", "change", showSaved);
    on("off-save", "click", async () => {
      if (!("caches" in window) || !navigator.serviceWorker?.controller) {
        offStatus("Offline storage isn't ready in this browser — reload the page once and try again.");
        return;
      }
      const btn = $("off-save"), voice = Prefs.voice(), dir = Prefs.voiceDirs()[0];
      btn.disabled = true;
      try {
        /* the list gen_audio.py generated the clips from */
        const texts = await (await fetch("tools/texts.json")).json();
        const todo = [...texts];
        let done = 0, failed = 0;
        const worker = async () => {
          for (let t; (t = todo.pop()) !== undefined;) {
            try { if (!(await fetch(dir + encodeURIComponent(t) + ".mp3")).ok) failed++; } catch { failed++; }
            offStatus(`saving… ${++done} / ${texts.length}`);
          }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        if (failed) offStatus(`${texts.length - failed} of ${texts.length} clips saved — ${failed} failed; try again on a steadier connection`);
        else { store.set(KEYS.offline, { ...savedVoices(), [voice]: Date.now() }); showSaved(); toast("Audio saved for offline use"); }
      } catch { offStatus("Couldn't fetch the clip list — are you online?"); }
      btn.disabled = false;
    });

    on("qreset", "click", () => {
      if (!confirm("Wipe all quiz progress? This can't be undone (export first if unsure).")) return;
      if (S.sprinting()) stopSprint(false, false);
      S.wipe();
      show();
      updateDueBadge();
      toast("Progress reset");
    });
  }

  /* focused drill on an explicit card list (e.g. the lapse list) */
  function drillCards(cards) {
    if (S.sprinting()) stopSprint(false, false);
    S.drill(cards);
  }

  /* ignores names that aren't decks — the hash can ask for anything */
  function setDeck(name) {
    if (S.setDeck(name)) $("qdeck").value = name;
  }

  return {
    wire, drillCards, setDeck,
    /* entering the Quiz tab */
    start() { if (S.resume()) show(); },
    /* leaving the Quiz tab abandons a running sprint */
    leave() { if (S.sprinting()) stopSprint(false, false); },
    /* another tab changed the record: refresh the counts, keep the card */
    refresh() { if (document.body.classList.contains("mode-quiz") && !S.sprinting()) stats(); },
  };
})();
