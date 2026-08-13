"use strict";
/* =========================================================================
   Kana Trainer — application engine
   Sections: Utils · Storage · Speech · Cards · Romaji · Study view ·
             SRS scheduler · Quiz view · Progress view · Tabs · Init
   Data tables (DATA, KANJI, GOJU, DAKU, YOON, EXTRA) are defined above.
   ========================================================================= */

/* ------------------------------ Config ---------------------------------- */
const CONFIG = {
  /* Leitner boxes 0–5. A hit promotes one box; a miss resets to box 0.     */
  intervals: [10 * 60e3, 864e5, 3 * 864e5, 7 * 864e5, 21 * 864e5, 45 * 864e5],
  againDelay: 2 * 60e3,     /* a missed card is due again in 2 minutes      */
  requeueGap: 3,            /* …and resurfaces this many cards later        */
  knownBox: 4,              /* box that counts as "learned" (survived 21 d) */
  interleaveEvery: 3,       /* new cards are spliced in every N due cards   */
  progressKey: "kanaTrainerProgress.v1",
  settingsKey: "kanaTrainerSettings.v1",
  daysKey: "kanaTrainerDays.v1",
};
const ymd = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/* ------------------------------ Utils ----------------------------------- */
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const on = (id, ev, fn) => $(id).addEventListener(ev, fn);

/* ------------------------------ Storage --------------------------------- */
/* localStorage when available, silent in-memory fallback otherwise.        */
const store = (() => {
  const mem = {};
  let ok = false;
  try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); ok = true; } catch {}
  return {
    ok,
    get(k) {
      try { if (ok) { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } } catch {}
      return mem[k] ?? null;
    },
    set(k, v) {
      mem[k] = v;
      try { if (ok) localStorage.setItem(k, JSON.stringify(v)); } catch {}
    },
  };
})();

/* ------------------------------ Speech ---------------------------------- */
/* Local neural-TTS clips first (audio/ja/<text>.mp3, ja-JP-NanamiNeural,
   generated for every card) — falls back to the browser's Japanese voice
   for anything without a file.                                             */
const Speech = (() => {
  const supported = "speechSynthesis" in window;
  let voice = null;
  const pick = () => {
    const ja = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("ja"));
    voice = ja.find((v) => /Nanami|Kyoko|Google 日本語|Otoya/i.test(v.name)) || ja[0] || null;
  };
  if (supported) { pick(); speechSynthesis.onvoiceschanged = pick; }
  let playing = null;
  const tts = (text) => {
    if (!supported) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP";
      if (voice) u.voice = voice;
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch {}
  };
  return {
    say(text) {
      if (!text) return;
      try { playing?.pause(); } catch {}
      const a = new Audio("audio/ja/" + encodeURIComponent(text) + ".mp3");
      playing = a;
      a.play().catch(() => tts(text));
    },
  };
})();

/* ------------------------------ Cards ----------------------------------- */
/* Card shapes:
     char   {id, deck, char, rom, say}
     phrase {id, deck, kana[], rom[], mean}       rom: "*x" = particle, "~" = modifier
     kanji  {id, deck, kanji, furi, rom, mean, where}                        */
const CARDS = [];

(function buildCharCards() {
  const push = (h, k, r) => {
    CARDS.push({ id: "hg-" + h, deck: h.length > 1 ? "Hiragana combos" : "Hiragana", char: h, rom: r, say: h, type: "char" });
    /* speak the hiragana twin — TTS reads a lone ヲ/ヅ badly */
    CARDS.push({ id: "kt-" + k, deck: k.length > 1 ? "Katakana combos" : "Katakana", char: k, rom: r, say: h, type: "char" });
  };
  for (const rows of [GOJU, DAKU, YOON])
    for (const [, cells] of rows)
      for (const c of cells) if (c) push(c[0], c[1], c[2]);
  for (const [k, r] of EXTRA)
    CARDS.push({ id: "kx-" + k, deck: "Katakana combos", char: k, rom: r, say: k, type: "char" });
})();

DATA.forEach(([deck, , rows], si) =>
  rows.forEach(([kana, rom, mean], ri) =>
    CARDS.push({ id: `s${si}r${ri}`, deck, kana, rom, mean, type: "phrase" })));

KANJI.forEach(([kanji, furi, rom, mean, where], i) =>
  CARDS.push({ id: "k" + i, deck: "Survival kanji", kanji, furi, rom, mean, where, type: "kanji" }));

const DECK_ORDER = [
  "Hiragana", "Katakana", "Hiragana combos", "Katakana combos",
  ...DATA.map((d) => d[0]), "Survival kanji",
];

/* ------------------------------ Romaji ---------------------------------- */
/* spokenRom: what a phrase sounds like — particles resolved (*wa → wa),
   small tsu doubles the next consonant, ー stretches the previous vowel.   */
function spokenRom(c) {
  const out = [];
  c.rom.forEach((r, i) => {
    if (r !== "~") return out.push(r.replace("*", ""));
    if (c.kana[i] === "ー") {
      const v = (out[out.length - 1] || "").match(/[aeiou]$/);
      out.push(v ? v[0] : "");
    } else {
      const next = (c.rom[i + 1] || "").replace("*", "");
      out.push(next && !/^[aeiou]/.test(next) ? next[0] : "");
    }
  });
  return out.join("");
}
const answerRom = (c) => (c.type === "phrase" ? spokenRom(c) : c.rom);
const speechText = (c) => (c.type === "phrase" ? c.kana.join("") : c.type === "kanji" ? c.furi : c.say);

/* Typed-answer checking.
   Kunrei→Hepburn aliases apply to the INPUT only, in a single left-to-right
   pass (sequential replacement cascades: syu→shu, then hu→fu eats the new
   shu). Guard entries keep Hepburn digraphs intact. The stored answer is
   authoritative, so ティ (ti) never accepts "chi" while チ still accepts
   Kunrei "ti". Long vowels are lenient: kekkoudesu ≡ kekkodesu.            */
const ALIAS = [
  ["si", "shi"], ["ti", "chi"], ["tu", "tsu"], ["hu", "fu"],
  ["zi", "ji"], ["di", "ji"], ["du", "zu"],
  ["sya", "sha"], ["syu", "shu"], ["syo", "sho"],
  ["tya", "cha"], ["tyu", "chu"], ["tyo", "cho"],
  ["zya", "ja"], ["zyu", "ju"], ["zyo", "jo"],
  ["jya", "ja"], ["jyu", "ju"], ["jyo", "jo"],
  ["cya", "cha"], ["cyu", "chu"], ["cyo", "cho"],
];
const ALIAS_MAP = Object.fromEntries(ALIAS);
["shi", "sha", "shu", "sho", "chi", "cha", "chu", "cho", "tsu"].forEach((g) => (ALIAS_MAP[g] = g));
const ALIAS_RX = new RegExp(Object.keys(ALIAS_MAP).sort((a, b) => b.length - a.length).join("|"), "g");

const MACRON = { "ā": "a", "ī": "i", "ū": "u", "ē": "e", "ō": "o", "â": "a", "î": "i", "û": "u", "ê": "e", "ô": "o" };
const pre = (s) => String(s).toLowerCase()
  .replace(/[āīūēōâîûêô]/g, (m) => MACRON[m]).replace(/[^a-z]/g, "");
const collapse = (s) => s.replace(/([aeiou])\1+/g, "$1").replace(/ou/g, "o");
const aliasize = (s) => s.replace(ALIAS_RX, (m) => ALIAS_MAP[m]);

/* Kana input (IME) is also accepted: katakana folds to hiragana on both
   sides, so typing こんにちは or コンニチハ both match. Kanji cards accept
   the kanji itself or its furigana. */
const kataToHira = (s) => s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
const kanaNorm = (s) => kataToHira(String(s).replace(/[\s・、。・]/g, ""));
const expectedKana = (c) => (c.type === "phrase" ? c.kana.join("") : c.type === "kanji" ? c.furi : c.char);

function checkTyped(input, card) {
  const raw = String(input).trim();
  if (/[぀-ヿ一-鿿]/.test(raw)) {
    if (card.type === "kanji" && raw.replace(/\s/g, "") === card.kanji) return true;
    return kanaNorm(raw) === kanaNorm(expectedKana(card));
  }
  const inP = pre(raw);
  if (!inP) return false;
  const ans = collapse(pre(answerRom(card)));
  return collapse(inP) === ans || collapse(aliasize(inP)) === ans;
}

/* ---------------------------- Study view --------------------------------- */
const StudyView = (() => {
  const modLabel = (k) => (k === "ー" ? "(long)" : "(stop)");
  const SEC_KEY = "kanaTrainerStudySec.v1";
  const sections = []; /* {id, label, group} in reading order */
  let sec = "all";

  const phraseRow = (c) => {
    const cells = c.kana.map((k, i) => {
      let r = c.rom[i] || "", cls = "";
      if (r.startsWith("*")) { cls = " p"; r = r.slice(1); }
      else if (r === "~") { cls = " m"; r = modLabel(k); }
      return `<div class="c${cls}"><div class="k">${esc(k)}</div><div class="r">${esc(r)}</div></div>`;
    }).join("");
    const key = `${c.kana.join("")} ${spokenRom(c)} ${c.mean}`.toLowerCase();
    return `<div class="row" data-k="${esc(key)}">
      <div class="rmain"><div class="cells">${cells}</div><p class="meaning">${esc(c.mean)}</p></div>
      <button class="spk" data-say="${esc(c.kana.join(""))}" title="Listen" aria-label="Listen">🔊</button>
    </div>`;
  };

  const kanjiCard = (c) => {
    const key = `${c.kanji} ${c.furi} ${c.rom} ${c.mean}`.toLowerCase();
    return `<div class="row" data-k="${esc(key)}" style="display:block"><div class="kjcard">
      <ruby>${esc(c.kanji)}<rt>${esc(c.furi)}</rt></ruby>
      <span class="en">${esc(c.mean)}</span><span class="whr">${esc(c.where)}</span>
    </div></div>`;
  };

  /* script: "both" = hiragana·katakana pairs, "h"/"k" = one script, larger glyphs */
  const chartTable = (rows, heads, script = "both") => {
    const head = heads.map((h) => `<th>${h}</th>`).join("");
    const body = rows.map(([label, cells]) => {
      const tds = cells.map((c) => {
        if (!c) return `<td class="nil"></td>`;
        const glyphs = script === "both" ? `${c[0]} ${c[1]}` : script === "h" ? c[0] : c[1];
        return `<td class="${c[3] ? "odd" : ""}"><div class="pair">${glyphs}</div><div class="rom">${c[2]}</div></td>`;
      }).join("");
      return `<tr><th>${label}</th>${tds}</tr>`;
    }).join("");
    return `<div class="chartwrap"><table class="chart${script === "both" ? "" : " solo"}"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const section = (id, n, jp, en, body, filterable = false) =>
    `<section id="${id}"${filterable ? " data-filterable" : ""}>
      <div class="shead"><span class="n">${n}</span><h2>${jp}</h2><span class="en">${en}</span></div>${body}
    </section>`;

  function render() {
    let out = "", charts = "", nav = "", n = 0;
    const num = () => String(++n).padStart(2, "0");

    DATA.forEach(([title, jp]) => {
      const rows = CARDS.filter((c) => c.deck === title);
      const nn = num(), id = "s" + n;
      sections.push({ id, label: title, group: "Phrases" });
      nav += `<a href="#${id}">${nn} ${esc(title)}</a>`;
      out += section(id, nn, jp, `${esc(title)} · ${rows.length}`, rows.map(phraseRow).join(""), true);
    });

    {
      const nn = num();
      sections.push({ id: "kanji", label: "Survival kanji", group: "Kanji" });
      nav += `<a href="#kanji">${nn} Survival kanji</a>`;
      const cards = CARDS.filter((c) => c.type === "kanji");
      out += section("kanji", nn, "漢字",
        `Survival kanji — signs you'll actually meet · ${cards.length}`,
        `<div class="kj">${cards.map(kanjiCard).join("")}</div>
         <p class="legend">The red furigana above each kanji is its reading — hide it with the <b>Romaji</b>
         toggle. These thirty cover most doors, tills, platforms and warning signs; phrases stay kana-only
         on purpose.</p>`, true);
    }

    const V = ["a", "i", "u", "e", "o"], Y = ["ya", "yu", "yo"];
    const sub = (t) => `<h3 class="subhead">${t}</h3>`;
    const extraTable =
      `<div class="chartwrap"><table class="chart solo"><tbody><tr>${EXTRA.map(([k, r], i) =>
        `<td><div class="pair">${k}</div><div class="rom">${r}</div></td>` + ((i + 1) % 8 === 0 ? "</tr><tr>" : "")
      ).join("")}</tr></tbody></table></div>`;
    [
      ["hira", "Kana", "ひらがな", "Hiragana — the full syllabary",
        sub("Base — 46 characters") + chartTable(GOJU, V, "h")
        + sub("Voiced — add ゛or ゜") + chartTable(DAKU, V, "h")
        + sub("Combos — kana + small ゃゅょ") + chartTable(YOON, Y, "h"),
        "Hiragana only — native words and all the grammar. Red romaji breaks the row pattern — say it as written."],
      ["kata", "Kana", "カタカナ", "Katakana — the full syllabary",
        sub("Base — 46 characters") + chartTable(GOJU, V, "k")
        + sub("Voiced — add ゛or ゜") + chartTable(DAKU, V, "k")
        + sub("Combos — kana + small ャュョ") + chartTable(YOON, Y, "k")
        + sub("Foreign sounds — katakana only") + extraTable,
        "Katakana only — loanwords, menus, brand names. The foreign-sound rows exist only in this script."],
      ["c1", "Kana charts — both scripts", "ごじゅうおん", "Base chart — hiragana / katakana", chartTable(GOJU, V),
        "Each cell reads <b>hiragana · katakana · romaji</b>. Red values break the row pattern — say them as written."],
      ["c2", "Kana charts — both scripts", "だくおん", "Voiced — add ゛or ゜", chartTable(DAKU, V),
        "Two ticks turn か into が. A small circle turns は into ぱ. Same shape, new sound."],
      ["c3", "Kana charts — both scripts", "ようおん", "Combos — kana + small ゃゅょ", chartTable(YOON, Y),
        "The small kana rides on the <b>i</b>-row character before it. き + ゃ is one beat, not two."],
      ["c4", "Kana charts — both scripts", "がいらいおん", "Katakana-only — foreign sounds", extraTable,
        "Built for sounds Japanese didn't originally have. Constant in menus, brand names and tech."],
    ].forEach(([id, group, jp, en, table, legend]) => {
      const nn = num();
      sections.push({ id, label: en.split(" — ")[0], group });
      nav += `<a href="#${id}">${nn} ${en.split(" — ")[0]}</a>`;
      charts += section(id, nn, jp, en, `${table}<p class="legend">${legend}</p>`);
    });

    $("out").innerHTML = out;
    $("charts").innerHTML = charts;
    $("idx").innerHTML = nav;
  }

  function wire() {
    const total = document.querySelectorAll("#out .row, #kanji .row").length;
    $("count").textContent = total + " items";

    document.addEventListener("click", (e) => {
      const b = e.target.closest(".spk");
      if (b) Speech.say(b.dataset.say);
    });

    const toggle = (id, cls) => on(id, "click", () => {
      const btn = $(id), off = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", String(!off));
      document.body.classList.toggle(cls, off);
    });
    toggle("tR", "no-r");
    toggle("tM", "no-m");

    /* ---- section picker ----
       One section at a time with prev/next, "all" restores the full scroll.
       A non-empty search always searches everything — a filter that silently
       ignored other sections would read as "no results". */
    function apply() {
      const t = $("q").value.trim().toLowerCase();
      const focus = !t && sec !== "all";
      document.querySelectorAll(".mast, .rules, .howto").forEach((el) => (el.hidden = focus));
      let shown = 0;
      document.querySelectorAll("section[data-filterable]").forEach((s) => {
        let any = 0;
        s.querySelectorAll(".row").forEach((r) => {
          const hit = !t || r.dataset.k.includes(t);
          r.hidden = !hit;
          if (hit) any++;
        });
        s.hidden = t ? !any : (focus && s.id !== sec);
        if (!s.hidden) shown += any;
      });
      document.querySelectorAll("#charts section").forEach((s) => {
        s.classList.toggle("dim", !!t);
        s.hidden = focus && s.id !== sec;
      });
      const cur = sections.find((x) => x.id === sec);
      $("count").textContent = t ? `${shown} of ${total}` : focus ? cur.label : `${total} items`;
      $("empty").hidden = !t || shown > 0;
      $("qsec").disabled = !!t;

      const nav = $("secnav");
      nav.hidden = !focus;
      if (focus) {
        const i = sections.indexOf(cur), prev = sections[i - 1], next = sections[i + 1];
        nav.innerHTML =
          (prev ? `<button class="sn" data-sec="${prev.id}">← ${esc(prev.label)}</button>` : "<span></span>") +
          `<span class="sni">${i + 1} / ${sections.length}</span>` +
          (next ? `<button class="sn" data-sec="${next.id}">${esc(next.label)} →</button>` : "<span></span>");
      }
    }

    function setSec(id) {
      sec = sections.some((s) => s.id === id) ? id : "all";
      store.set(SEC_KEY, sec);
      $("qsec").value = sec;
      apply();
      window.scrollTo({ top: 0 });
    }

    /* build the dropdown: All, then optgroups in reading order */
    const groups = [...new Set(sections.map((s) => s.group))];
    $("qsec").innerHTML =
      `<option value="all">All sections</option>` +
      groups.map((g) =>
        `<optgroup label="${g}">` +
        sections.filter((s) => s.group === g)
          .map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("") +
        `</optgroup>`).join("");
    on("qsec", "change", () => setSec($("qsec").value));

    /* header index links focus a section instead of anchor-scrolling */
    on("idx", "click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      setSec(a.getAttribute("href").slice(1));
    });

    on("secnav", "click", (e) => {
      const b = e.target.closest(".sn");
      if (b) setSec(b.dataset.sec);
    });

    on("q", "input", apply);

    setSec(store.get(SEC_KEY) || "all"); /* returning users land where they left off */
  }

  return { render, wire };
})();

/* --------------------------- SRS scheduler ------------------------------- */
const Srs = (() => {
  let prog = store.get(CONFIG.progressKey) || {}; /* id -> {b,d,s,l} */

  const record = (id) => prog[id];
  const isKnown = (p) => !!p && p.b >= CONFIG.knownBox;
  const save = () => store.set(CONFIG.progressKey, prog);

  /* @returns true if the card should resurface this session */
  function grade(card, good, now = Date.now()) {
    const p = prog[card.id] || { b: 0, d: 0, s: 0, l: 0 };
    p.s++;
    if (good) {
      p.b = Math.min(p.b + 1, CONFIG.intervals.length - 1);
      p.d = now + CONFIG.intervals[p.b];
    } else {
      p.l++;
      p.b = 0;
      p.d = now + CONFIG.againDelay;
    }
    prog[card.id] = p;
    save();
    const days = store.get(CONFIG.daysKey) || {};
    days[ymd()] = (days[ymd()] || 0) + 1;
    store.set(CONFIG.daysKey, days);
    return !good;
  }

  /* undo support: put a card's record back exactly as it was (null = unseen) */
  function restore(id, rec) {
    if (rec) prog[id] = rec; else delete prog[id];
    save();
  }

  return {
    record, isKnown, grade, restore,
    days: () => store.get(CONFIG.daysKey) || {},
    all: () => prog,
    replace(next) { prog = next || {}; save(); },
    reset() { prog = {}; save(); },
  };
})();

/* ----------------------------- Quiz view --------------------------------- */
const Quiz = (() => {
  const DEFAULTS = { deck: "All decks", dir: "jp", mode: "flip", newn: 10, speak: true };
  const settings = Object.assign({}, DEFAULTS, store.get(CONFIG.settingsKey) || {});
  const session = { queue: [], current: null, face: "jp", revealed: false, verdict: null,
                    reviewed: 0, newIntroduced: 0, missed: [], customPending: false };
  let undoState = null;

  const deckCards = () =>
    settings.deck === "All decks" ? CARDS : CARDS.filter((c) => c.deck === settings.deck);
  const pickFace = () =>
    settings.mode === "listen" ? "jp"
    : settings.dir === "mix" ? (Math.random() < 0.5 ? "jp" : "en") : settings.dir;
  const listening = () => settings.mode === "listen" && session.face === "jp";
  const typedApplies = () => (settings.mode === "type" || settings.mode === "listen") && session.face === "jp";

  function saveSettings() {
    settings.deck = $("qdeck").value;
    settings.dir = $("qdir").value;
    settings.mode = $("qmode").value;
    settings.newn = Math.max(0, +$("qnewn").value || 0);
    settings.speak = $("qspeak").checked;
    store.set(CONFIG.settingsKey, settings);
  }

  function buildQueue() {
    const now = Date.now(), cards = deckCards();
    const due = shuffle(cards.filter((c) => Srs.record(c.id)?.d <= now));
    const budget = Math.max(0, settings.newn - session.newIntroduced);
    /* new cards arrive in pedagogical order (chart/deck order), not shuffled */
    const fresh = cards.filter((c) => !Srs.record(c.id)).slice(0, budget);
    session.queue = [...due];
    fresh.forEach((c, i) =>
      session.queue.splice(Math.min(session.queue.length, (i + 1) * CONFIG.interleaveEvery), 0, c));
  }

  function next() {
    session.current = session.queue.shift() || null;
    session.face = pickFace();
    session.revealed = false;
    session.verdict = null;
    if (session.current && !Srs.record(session.current.id)) session.newIntroduced++;
    render();
  }

  function reveal(verdict) {
    session.revealed = true;
    session.verdict = verdict;
    render();
  }

  function grade(good) {
    const c = session.current;
    undoState = {
      card: c,
      prevProg: Srs.record(c.id) ? JSON.parse(JSON.stringify(Srs.record(c.id))) : null,
      queue: [...session.queue],
      reviewed: session.reviewed,
      newIntroduced: session.newIntroduced,
    };
    if (!good) session.missed.push(c);
    if (Srs.grade(c, good))
      session.queue.splice(Math.min(CONFIG.requeueGap, session.queue.length), 0, c);
    session.reviewed++;
    next();
  }

  function undo() {
    if (!undoState) return;
    Srs.restore(undoState.card.id, undoState.prevProg);
    session.queue = undoState.queue;
    session.current = undoState.card;
    session.face = pickFace();
    session.revealed = false;
    session.verdict = null;
    session.reviewed = undoState.reviewed;
    session.newIntroduced = undoState.newIntroduced;
    if (session.missed[session.missed.length - 1]?.id === undoState.card.id) session.missed.pop();
    undoState = null;
    render();
  }

  /* ---- rendering ---- */
  function stats() {
    const now = Date.now();
    let nw = 0, learn = 0, known = 0, due = 0;
    deckCards().forEach((c) => {
      const p = Srs.record(c.id);
      if (!p) return nw++;
      Srs.isKnown(p) ? known++ : learn++;
      if (p.d <= now) due++;
    });
    $("stNew").textContent = nw;
    $("stLearn").textContent = learn;
    $("stKnown").textContent = known;
    $("stDue").textContent = due;
    $("stToday").textContent = session.reviewed;
  }

  /* One face descriptor per card type: prompt shown up front, answer parts
     revealed together. Keeps all six type×face combinations in one shape.  */
  const kanaBlock = (t, big, hide) =>
    `<div class="qkana${big ? " big" : ""}${hide ? " qhide" : ""}">${t}</div>`;
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
      return typedApplies()
        ? `${replay}<div class="qbtns"><input id="qtype" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="${listening() ? "type what you hear" : "type the romaji, enter to check"}"></div>
           <div class="qbtns"><button class="qb ghost" id="bShow">Give up — show it</button></div>`
        : `${replay}<div class="qbtns"><button class="qb" id="bShow">Show answer</button></div>`;
    }
    const v = session.verdict;
    const verdict = v
      ? `<p class="verdict ${v.ok ? "ok" : "no"}">${v.ok ? "Correct" : "Not quite"} — ${esc(answerRom(session.current))}${v.ok ? "" : ` (you typed: ${esc(v.got)})`}</p>`
      : "";
    /* memory hook for the 46 base characters, from the guide */
    const c = session.current;
    const m = c.type === "char" ? MNEM[c.rom] : null;
    const mnem = m ? `<p class="qmnem">${c.deck.startsWith("Kata") ? m[1] : m[0]}</p>` : "";
    return `${verdict}${mnem}<div class="qbtns">
      <button class="qb again" id="bAgain">Again</button>
      <button class="qb" id="bGood">Got it</button></div>`;
  }

  function render() {
    stats();
    const c = session.current;
    if (!c) return renderDone();
    const p = Srs.record(c.id);
    $("qarea").innerHTML = `<div class="qcard">
      <span class="tag">${esc(c.deck)}${p ? "" : " · new"}</span>
      <span class="box">box ${(p ? p.b : 0) + 1}/${CONFIG.intervals.length}</span>
      ${faceHTML(c, session.face)}${controlsHTML()}
    </div>`;
    session.revealed ? wireRevealed(c) : wirePrompt(c);
  }

  function renderDone() {
    const r = session.reviewed;
    /* session summary: what was missed, with the memory hook re-shown */
    const missed = [...new Map(session.missed.map((c) => [c.id, c])).values()].slice(0, 15);
    const summary = missed.length
      ? `<div class="qsummary"><h3>Missed this session</h3><ul>${missed.map((c) => {
          const jp = c.type === "char" ? c.char : c.type === "kanji" ? c.kanji : c.kana.join("");
          const m = c.type === "char" && MNEM[c.rom] ? ` — ${c.deck.startsWith("Kata") ? MNEM[c.rom][1] : MNEM[c.rom][0]}` : "";
          return `<li><b>${esc(jp)}</b> ${esc(answerRom(c))}${m}</li>`;
        }).join("")}</ul></div>`
      : "";
    $("qarea").innerHTML = `<div class="qcard"><div class="qdone">
      <p><b>Nothing due.</b> ${r ? `You reviewed ${r} card${r > 1 ? "s" : ""} — nice.` : ""}</p>
      ${summary}
      <p>Come back later, pick another deck, or raise <i>new/session</i> to keep going.</p>
      <div class="qbtns"><button class="qb ghost" id="qrefill">Check again</button></div>
    </div></div>`;
    $("qrefill").onclick = () => { buildQueue(); next(); };
  }

  function wireRevealed(c) {
    document.querySelectorAll(".qhide").forEach((e) => e.classList.remove("qhide"));
    $("bAgain").onclick = () => grade(false);
    $("bGood").onclick = () => grade(true);
    /* focus the grade the verdict suggests — Enter then continues */
    const v = session.verdict;
    if (v) (v.ok ? $("bGood") : $("bAgain")).focus();
    if (settings.speak) Speech.say(speechText(c));
  }

  function wirePrompt(c) {
    const show = $("bShow");
    if (show) show.onclick = () => reveal(null);
    const rep = $("bReplay");
    if (rep) rep.onclick = () => Speech.say(speechText(c));
    if (listening()) Speech.say(speechText(c));
    const input = $("qtype");
    if (input) {
      input.focus();
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.stopPropagation();
        reveal({ ok: checkTyped(input.value, c), got: input.value.trim() || "—" });
      });
    }
  }

  /* ---- wiring ---- */
  function wire() {
    const deckSel = $("qdeck");
    ["All decks", ...DECK_ORDER].forEach((d) => deckSel.append(new Option(d)));
    deckSel.value = settings.deck;
    $("qdir").value = settings.dir;
    $("qmode").value = settings.mode;
    $("qnewn").value = settings.newn;
    $("qspeak").checked = settings.speak;

    const onChange = {
      qdeck: () => { buildQueue(); next(); },
      qdir: () => { session.face = pickFace(); render(); },
      qmode: () => render(),
      qnewn: () => { buildQueue(); if (!session.current) next(); },
      qspeak: () => {},
    };
    Object.entries(onChange).forEach(([id, fn]) =>
      on(id, "change", () => { saveSettings(); fn(); }));

    document.addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("mode-quiz")) return;
      if (e.target.id === "qtype" || /^(INPUT|SELECT)$/.test(e.target.tagName)) return;
      if ((e.key === " " || e.key === "Enter") && !session.revealed && session.current) {
        e.preventDefault();
        reveal(null);
      } else if (e.key === "1" && session.revealed) grade(false);
      else if (e.key === "2" && session.revealed) grade(true);
      else if (e.key === "s" && session.current) Speech.say(speechText(session.current));
      else if (e.key === "u") undo();
    });

    on("qundo", "click", undo);

    on("qexport", "click", () => {
      const payload = { v: 1, when: new Date().toISOString(), prog: Srs.all() };
      const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kana-trainer-progress.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    on("qimport", "click", () => $("qfile").click());
    on("qfile", "change", (e) => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then((t) => {
        try {
          const j = JSON.parse(t);
          if (!j || typeof j.prog !== "object") throw new Error("shape");
          Srs.replace(j.prog);
          buildQueue();
          next();
        } catch { alert("That file didn't parse as progress JSON."); }
      });
    });
    on("qreset", "click", () => {
      if (!confirm("Wipe all quiz progress? This can't be undone (export first if unsure).")) return;
      Srs.reset();
      session.newIntroduced = 0;
      buildQueue();
      next();
    });
  }

  /* focused drill on an explicit card list (e.g. the lapse list) */
  function drillCards(cards) {
    session.queue = [...cards];
    session.customPending = true;
  }

  return {
    wire, drillCards,
    start() {
      if (session.customPending) { session.customPending = false; next(); }
      else { buildQueue(); next(); }
    },
  };
})();

/* --------------------------- Progress view ------------------------------- */
const Progress = (() => {
  const label = (c) =>
    c.type === "char" ? { jp: c.char, mn: c.rom }
    : c.type === "kanji" ? { jp: c.kanji, mn: c.mean }
    : { jp: c.kana.join(""), mn: c.mean };

  const li = (c, extra = "") => {
    const L = label(c);
    return `<li><span class="jp2">${esc(L.jp)}</span><span class="mn">${esc(L.mn)}${extra}</span></li>`;
  };

  function stats() {
    const days = Srs.days();
    const dayKey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return ymd(d); };
    /* streak: consecutive review days ending today (or yesterday, so an
       unfinished today doesn't read as zero) */
    let streak = 0, i = days[dayKey(0)] ? 0 : 1;
    while (days[dayKey(i)]) { streak++; i++; }
    /* due forecast */
    const now = Date.now(), eod = new Date(); eod.setHours(23, 59, 59, 999);
    let dueNow = 0, dueTom = 0, dueWeek = 0;
    CARDS.forEach((c) => {
      const p = Srs.record(c.id);
      if (!p) return;
      if (p.d <= now) dueNow++;
      else if (p.d <= eod.getTime() + 864e5) dueTom++;
      else if (p.d <= eod.getTime() + 7 * 864e5) dueWeek++;
    });
    /* heatmap: last 12 weeks, one column per week */
    const start = new Date(); start.setDate(start.getDate() - 83);
    let heat = "";
    for (let w = 0; w < 12; w++) {
      heat += '<div class="hw">';
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
        if (dt > new Date()) { heat += "<i></i>"; continue; }
        const n = days[ymd(dt)] || 0;
        heat += `<i class="l${n ? Math.min(4, Math.ceil(n / 10)) : 0}" title="${ymd(dt)}: ${n} reviews"></i>`;
      }
      heat += "</div>";
    }
    $("pstats").innerHTML = `
      <div class="pnums">
        <span><b>${streak}</b>day streak</span>
        <span><b>${dueNow}</b>due now</span>
        <span><b>${dueTom}</b>due by tomorrow</span>
        <span><b>${dueWeek}</b>rest of the week</span>
      </div>
      <div class="heat">${heat}</div>`;
  }

  function render() {
    stats();
    $("pbars").innerHTML = DECK_ORDER.map((deck) => {
      const cards = CARDS.filter((c) => c.deck === deck);
      let known = 0, learning = 0, unseen = 0;
      cards.forEach((c) => {
        const p = Srs.record(c.id);
        if (!p) unseen++; else if (Srs.isKnown(p)) known++; else learning++;
      });
      const w = (x) => (100 * x / cards.length).toFixed(1) + "%";
      return `<div class="pdeck">
        <h3>${esc(deck)}<span>${known} known · ${learning} learning · ${unseen} unseen of ${cards.length}</span></h3>
        <div class="pbar"><i class="kn" style="width:${w(known)}"></i><i class="ln" style="width:${w(learning)}"></i><i class="nw" style="width:${w(unseen)}"></i></div>
      </div>`;
    }).join("");

    const known = CARDS.filter((c) => Srs.isKnown(Srs.record(c.id)));
    const lapsed = CARDS
      .filter((c) => { const p = Srs.record(c.id); return p && p.l >= 3 && !Srs.isKnown(p); })
      .sort((a, b) => Srs.record(b.id).l - Srs.record(a.id).l);

    $("pknown").innerHTML = known.length
      ? known.map((c) => li(c)).join("")
      : `<li class="pempty">Nothing yet — a card counts as learned once it survives the 7-day gap.</li>`;
    $("plapse").innerHTML = lapsed.length
      ? lapsed.map((c) => li(c, ` · missed ×${Srs.record(c.id).l}`)).join("")
      : `<li class="pempty">No repeat offenders. Cards land here after three misses.</li>`;

    const btn = $("plapseDrill");
    btn.hidden = !lapsed.length;
    btn.onclick = () => { Quiz.drillCards(lapsed); setMode("quiz"); };
  }

  return { render };
})();

/* ------------------------------- Tabs ------------------------------------ */
function setMode(mode) {
  document.body.className = document.body.className.replace(/mode-\w+/g, "").trim();
  document.body.classList.add("mode-" + mode);
  document.querySelectorAll(".tab").forEach((t) =>
    t.setAttribute("aria-selected", String(t.dataset.mode === mode)));
  if (mode === "quiz") Quiz.start();
  if (mode === "progress") Progress.render();
}

/* ------------------------------- Init ------------------------------------ */
StudyView.render();
StudyView.wire();
Quiz.wire();
document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => setMode(t.dataset.mode)));
setMode("study");

if (!store.ok) {
  const warn = document.createElement("p");
  warn.className = "legend";
  warn.style.margin = "8px 0 0";
  warn.innerHTML =
    "⚠ This browser is blocking storage, so quiz progress lasts only until you close the tab — use <b>Export progress</b> to keep it.";
  document.querySelector(".qman").after(warn);
}
