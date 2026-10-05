"use strict";
/* =========================================================================
   Kana Trainer — application engine
   Sections: Utils · Storage · Speech · Cards · Romaji · Study view ·
             SRS scheduler · Quiz view · Progress view · Tabs · Init
   Data tables (DATA, KANJI, GOJU, DAKU, YOON, EXTRA) are defined above.
   ========================================================================= */

/* Config (CONFIG), ymd and the record helpers (nextRecord, practiceRecord,
   cleanProg, migrateIds) live in js/srs.js, shared with the guide and the
   landing page so every view reads one progress record.                     */

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
/* Local neural-TTS clips first — audio/ja/ is Nanami (female), audio/ja-m/
   is Keita (male); the preferred dir is tried first, then the other, then
   the browser's own Japanese voice. Voice pref is shared with the guide.  */
const VOICE_KEY = "kanaVoice.v1", AUDIO_PREF_KEY = "kanaGuideAudio.v1";
const slowPref = () => { try { return !!(JSON.parse(localStorage.getItem(AUDIO_PREF_KEY)) || {}).slow; } catch { return false; } };
const voiceDirs = () => {
  let m = false;
  try { m = localStorage.getItem(VOICE_KEY) === "m"; } catch {}
  return m ? ["audio/ja-m/", "audio/ja/"] : ["audio/ja/", "audio/ja-m/"];
};
/* play the clip for `text` from the first voice dir that has it; resolves
   to the playing Audio, or null when neither file plays                    */
function playClip(text) {
  const from = (dir) => {
    const a = new Audio(dir + encodeURIComponent(text) + ".mp3");
    a.playbackRate = slowPref() ? 0.75 : 1;
    return a.play().then(() => a);
  };
  const [pref, alt] = voiceDirs();
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
      u.rate = slowPref() ? 0.6 : 0.85;
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

/* ------------------------------ Cards ----------------------------------- */
/* Card shapes:
     char   {id, deck, char, rom, say, alt?}      alt: other accepted spellings
     phrase {id, deck, kana[], rom[], mean, slot?} rom: "*x" = particle, "~" = modifier
     kanji  {id, deck, kanji, furi, rom, mean, where}
   Ids are built from content, never position — hg-あ, p:こんにちは, k:出口 —
   so adding or reordering rows in the data files can't move anyone's
   progress onto a different card. (Positional ids from before v22 are
   carried across by migrateIds + js/legacy-ids.js.)                        */
const CARDS = [];

(function buildCharCards() {
  /* を is "o" when spoken but "wo" on most charts and every keyboard; ん is
     typed "nn" in an IME — accept both rather than mark a right answer wrong */
  const ALT = { "を": ["wo"], "ん": ["nn"] };
  const push = (h, k, r) => {
    CARDS.push({ id: "hg-" + h, deck: h.length > 1 ? "Hiragana combos" : "Hiragana", char: h, rom: r, say: h, alt: ALT[h], type: "char" });
    /* speak the hiragana twin — TTS reads a lone ヲ/ヅ badly */
    CARDS.push({ id: "kt-" + k, deck: k.length > 1 ? "Katakana combos" : "Katakana", char: k, rom: r, say: h, alt: ALT[h], type: "char" });
  };
  for (const rows of [GOJU, DAKU, YOON])
    for (const [, cells] of rows)
      for (const c of cells) if (c) push(c[0], c[1], c[2]);
  for (const [k, r] of EXTRA)
    CARDS.push({ id: "kx-" + k, deck: "Katakana combos", char: k, rom: r, say: k, type: "char" });
})();

/* a 4th field on a DATA row names a personalization slot (see below) */
DATA.forEach(([deck, , rows]) =>
  rows.forEach(([kana, rom, mean, slot]) =>
    CARDS.push({ id: slot ? "p:you-" + slot : "p:" + kana.join(""), deck, kana, rom, mean, slot, type: "phrase" })));

KANJI.forEach(([kanji, furi, rom, mean, where]) =>
  CARDS.push({ id: "k:" + kanji, deck: "Survival kanji", kanji, furi, rom, mean, where, type: "kanji" }));

/* ---- personalization: the intro deck fills in YOUR details --------------
   Custom boxes can't be romaji-checked, so those cards flip-grade only.   */
const YOU_KEY = "kanaTrainerYou.v1";
const YOU = store.get(YOU_KEY) || {};
(function personalizeIntro() {
  const fill = (slot, pre, post, preR, postR, val, mean) => {
    const c = CARDS.find((x) => x.slot === slot);
    if (!c) return;
    c.kana = [...pre, val || "○○", ...post];
    c.rom = [...preR, "", ...postR];
    c.mean = mean;
    c.custom = true;
  };
  const an = (s) => (/^[aeiou]/i.test(s) ? "an" : "a");
  fill("name", ["わ", "た", "し", "は"], ["で", "す"], ["wa", "ta", "shi", "*wa"], ["de", "su"],
    YOU.name, YOU.name ? `I'm ${YOU.name}` : "I'm ___ — fill in your details in the form above");
  fill("country", [], ["か", "ら", "き", "ま", "し", "た"], [], ["ka", "ra", "ki", "ma", "shi", "ta"],
    YOU.country, YOU.country ? `I'm from ${YOU.country}` : "I'm from ___");
  fill("job", [], ["で", "す"], [], ["de", "su"],
    YOU.job, YOU.job ? `I'm ${an(YOU.job)} ${YOU.job}` : "I'm a ___ (occupation)");
})();

/* base-46 lookup for cross-links into the guide's chart detail */
const BASE_LINK = {};
GOJU.forEach(([, cells]) => cells.forEach((c) => { if (c) { BASE_LINK[c[0]] = c[2]; BASE_LINK[c[1]] = c[2]; } }));
BASE_LINK["を"] = BASE_LINK["ヲ"] = "wo"; /* the guide keys the particle as wo */

const DECK_ORDER = [
  "Hiragana", "Katakana", "Hiragana combos", "Katakana combos",
  ...DATA.map((d) => d[0]), "Survival kanji",
];
/* virtual decks the quiz builds from the others */
const COMPOSITE_DECKS = ["All decks", "All characters", "All phrases", "Look-alikes"];
/* names a custom deck can't take */
const RESERVED_DECKS = [...COMPOSITE_DECKS, ...DECK_ORDER];

/* ---- custom CSV decks (Anki-style, stored in this browser) ---------------
   Card ids are deck name + front text (customIds), so editing a deck or
   re-importing it under the same name keeps the SRS record of every line
   whose front is unchanged.                                                */
const CUSTOM_KEY = "kanaTrainerCustom.v1";
const Custom = {
  decks: cleanDecks(store.get(CUSTOM_KEY), RESERVED_DECKS),
  commit() { store.set(CUSTOM_KEY, this.decks); location.reload(); },
  cardsOf(d) {
    const ids = customIds(d);
    return d.cards.map((c, i) => {
      /* a kana reading (or kana front) yields romaji, enabling typed answers */
      const rom = kanaToRomaji(c.r || c.f);
      return { id: ids[i], deck: d.name, type: "custom",
        front: c.f, reading: c.r || "", mean: c.m, rom: rom || "", custom: !rom };
    });
  },
  parse(text) {
    return String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
      const parts = line.includes("\t") ? line.split("\t") : line.split(",");
      const f = (parts[0] || "").trim();
      if (!f) return null;
      if (parts.length >= 3) return { f, r: (parts[1] || "").trim(), m: parts.slice(2).join(",").trim() };
      return { f, r: "", m: (parts[1] || "").trim() };
    }).filter(Boolean);
  },
  toCSV(d) { return d.cards.map((c) => [c.f, c.r, c.m].join(", ")).join("\n"); },
  upsert(name, cards) {
    const i = this.decks.findIndex((d) => d.name === name);
    if (i >= 0) this.decks[i] = { name, cards }; else this.decks.push({ name, cards });
    this.commit();
  },
  remove(i) { this.decks.splice(i, 1); this.commit(); },
};
Custom.decks.forEach((d) => { CARDS.push(...Custom.cardsOf(d)); DECK_ORDER.push(d.name); });

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
const answerRom = (c) => (c.type === "phrase" ? spokenRom(c) : c.type === "custom" ? (c.rom || c.reading || c.front) : c.rom);
const speechText = (c) => (c.type === "phrase" ? c.kana.join("") : c.type === "kanji" ? c.furi : c.type === "custom" ? (c.reading || c.front) : c.say);
/* recorded clips cover the built-in content only — custom decks and the
   personalized intro rows are spoken by the browser */
const hasClip = (c) => c.type !== "custom" && !c.custom;
/* the Japanese side and the short gloss of any card, whatever its type */
const cardJp = (c) => (c.type === "char" ? c.char : c.type === "kanji" ? c.kanji : c.type === "custom" ? c.front : c.kana.join(""));
const cardGloss = (c) => (c.type === "char" ? c.rom : c.mean);

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
const expectedKana = (c) => (c.type === "phrase" ? c.kana.join("") : c.type === "kanji" ? c.furi : c.type === "custom" ? (c.reading || c.front) : c.char);

function checkTyped(input, card) {
  const raw = String(input).trim();
  if (/[぀-ヿ一-鿿]/.test(raw)) {
    if (card.type === "kanji" && raw.replace(/\s/g, "") === card.kanji) return true;
    return kanaNorm(raw) === kanaNorm(expectedKana(card));
  }
  const inP = pre(raw);
  if (!inP) return false;
  const typed = [collapse(inP), collapse(aliasize(inP))];
  return [answerRom(card), ...(card.alt || [])].some((a) => typed.includes(collapse(pre(a))));
}

/* ------------------------- Numbers & scheduling --------------------------- */
/* Pure helpers, kept at module level so tools/test-trainer.mjs can slice
   and exercise them without a DOM.                                          */
const numDigits = ["", "ichi", "ni", "san", "yon", "go", "roku", "nana", "hachi", "kyuu"];
function numToRomaji(n) {
  let s = "";
  const man = Math.floor(n / 10000);
  if (man) s += numDigits[man] + "man";
  n %= 10000;
  const sen = Math.floor(n / 1000);
  if (sen) s += sen === 1 ? "sen" : sen === 3 ? "sanzen" : sen === 8 ? "hassen" : numDigits[sen] + "sen";
  n %= 1000;
  const hyaku = Math.floor(n / 100);
  if (hyaku) s += hyaku === 1 ? "hyaku" : hyaku === 3 ? "sanbyaku" : hyaku === 6 ? "roppyaku" : hyaku === 8 ? "happyaku" : numDigits[hyaku] + "hyaku";
  n %= 100;
  const juu = Math.floor(n / 10);
  if (juu) s += (juu === 1 ? "" : numDigits[juu]) + "juu";
  if (n % 10) s += numDigits[n % 10];
  return s;
}
const numNorm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, "").replace(/([aeiou])\1+/g, "$1").replace(/ou/g, "o");

/* custom-deck card ids: deck name + front text; a repeated front gets #2, #3… */
function customIds(d) {
  const seen = new Map();
  return d.cards.map((c) => {
    const n = (seen.get(c.f) || 0) + 1;
    seen.set(c.f, n);
    return `c:${d.name}:${c.f}` + (n > 1 ? "#" + n : "");
  });
}

/* Keep only well-formed decks from storage or an imported file. A name that
   collides with a built-in deck (or an earlier deck) gets a numeric suffix
   instead of silently merging into it.                                     */
function cleanDecks(raw, reserved = []) {
  if (!Array.isArray(raw)) return [];
  const taken = new Set(reserved);
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  return raw.flatMap((d) => {
    let name = str(d?.name);
    if (!name || !Array.isArray(d.cards)) return [];
    const cards = d.cards.flatMap((c) => (str(c?.f) ? [{ f: str(c.f), r: str(c.r), m: str(c.m) }] : []));
    if (!cards.length) return [];
    for (let n = 2; taken.has(name); n++) name = `${str(d.name)} (${n})`;
    taken.add(name);
    return [{ name, cards }];
  });
}

/* ---------------------------- Study view --------------------------------- */
const StudyView = (() => {
  const modLabel = (k) => (k === "ー" ? "(long)" : "(stop)");
  const SEC_KEY = "kanaTrainerStudySec.v1";
  const SEEN_KEY = "kanaTrainerSeenSec.v1";
  const sections = []; /* {id, label, group} in reading order */
  let sec = "all";
  const seenSec = store.get(SEEN_KEY) || {};

  const phraseRow = (c) => {
    const cells = c.kana.map((k, i) => {
      let r = c.rom[i] || "", cls = "";
      if (r.startsWith("*")) { cls = " p"; r = r.slice(1); }
      else if (r === "~") { cls = " m"; r = modLabel(k); }
      if (k.length > 1) cls += " wide"; /* personalized fill-in boxes */
      const inner = `<div class="k" lang="ja">${esc(k)}</div><div class="r">${esc(r)}</div>`;
      /* base-46 boxes link to that character's guide entry */
      return BASE_LINK[k]
        ? `<a class="c${cls}" href="guide.html#c=${BASE_LINK[k]}" title="${esc(k)} in the guide">${inner}</a>`
        : `<div class="c${cls}">${inner}</div>`;
    }).join("");
    const key = `${c.kana.join("")} ${spokenRom(c)} ${c.mean}`.toLowerCase();
    return `<div class="row" data-k="${esc(key)}">
      <div class="rmain"><div class="cells">${cells}</div><p class="meaning">${esc(c.mean)}</p></div>
      <button class="spk" data-say="${esc(c.kana.join(""))}"${hasClip(c) ? "" : " data-tts"} title="Listen" aria-label="Listen">🔊</button>
    </div>`;
  };

  const kanjiCard = (c) => {
    const key = `${c.kanji} ${c.furi} ${c.rom} ${c.mean}`.toLowerCase();
    return `<div class="row" data-k="${esc(key)}" style="display:block"><div class="kjcard">
      <ruby lang="ja">${esc(c.kanji)}<rt>${esc(c.furi)}</rt></ruby>
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
        return `<td class="${c[3] ? "odd" : ""}"><div class="pair" lang="ja">${glyphs}</div><div class="rom">${c[2]}</div></td>`;
      }).join("");
      return `<tr><th>${label}</th>${tds}</tr>`;
    }).join("");
    return `<div class="chartwrap"><table class="chart${script === "both" ? "" : " solo"}"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  const section = (id, n, jp, en, body, filterable = false) => {
    const playall = filterable && id !== "kanji"
      ? `<button class="playall" data-playall="${id}" title="Play the whole section" aria-label="Play section">▶</button>` : "";
    return `<section id="${id}"${filterable ? " data-filterable" : ""}>
      <div class="shead"><span class="n">${n}</span><h2 lang="ja">${jp}</h2>${playall}<span class="en">${en}</span></div>${body}
    </section>`;
  };

  function render() {
    let out = "", charts = "", nav = "", n = 0;
    const num = () => String(++n).padStart(2, "0");

    DATA.forEach(([title, jp]) => {
      const rows = CARDS.filter((c) => c.deck === title);
      const nn = num(), id = "s" + n;
      sections.push({ id, label: title, group: "Phrases" });
      nav += `<a href="#${id}">${nn} ${esc(title)}</a>`;
      const youForm = title === "Introducing yourself" ? `
        <div class="youform">
          <p>Make these phrases yours — the ○○ boxes fill in with your details:</p>
          <label>name (katakana) <input id="you-name" value="${esc(YOU.name || "")}" placeholder="サム"></label>
          <label>country <input id="you-country" value="${esc(YOU.country || "")}" placeholder="カナダ"></label>
          <label>occupation <input id="you-job" value="${esc(YOU.job || "")}" placeholder="エンジニア"></label>
          <button id="you-save">Save</button>
        </div>` : "";
      const numDrill = title === "Numbers and time" ? `
        <div class="youform numdrill">
          <p>Random number practice — type the reading in romaji (use yon / nana / kyuu):</p>
          <span class="numq" id="num-q">247</span>
          <label style="flex:1;min-width:150px"><input id="num-in" autocomplete="off" spellcheck="false" placeholder="nihyaku yonjuu nana"></label>
          <button id="num-check">Check</button>
          <span id="num-verdict"></span>
        </div>` : "";
      out += section(id, nn, jp, `${esc(title)} · ${rows.length}`, youForm + rows.map(phraseRow).join("") + numDrill, true);
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
      if (b) { Player.stop(); Speech.say(b.dataset.say, !("tts" in b.dataset)); } /* a tapped row takes over from play-all */
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
      /* search mode: the input takes the row, other controls step aside */
      document.body.classList.toggle("searching", !!t);
      $("q-clear").hidden = !t;

      const nav = $("secnav");
      nav.hidden = !focus;
      if (focus) {
        const i = sections.indexOf(cur), prev = sections[i - 1], next = sections[i + 1];
        const deckBtn = DECK_ORDER.includes(cur.label)
          ? `<button class="sn quizsec" data-quizdeck="${esc(cur.label)}">Quiz this section →</button>` : "";
        nav.innerHTML =
          (prev ? `<button class="sn" data-sec="${prev.id}">← ${esc(prev.label)}</button>` : "<span></span>") +
          `<span class="snmid"><span class="sni">${i + 1} / ${sections.length}</span>${deckBtn}</span>` +
          (next ? `<button class="sn" data-sec="${next.id}">${esc(next.label)} →</button>` : "<span></span>");
      }
    }

    function tickLabels() {
      [...$("qsec").options].forEach((o) => {
        if (o.value !== "all") {
          const s = sections.find((x) => x.id === o.value);
          if (s) o.textContent = (seenSec[o.value] ? "✓ " : "") + s.label;
        }
      });
    }

    function setSec(id) {
      sec = sections.some((s) => s.id === id) ? id : "all";
      store.set(SEC_KEY, sec);
      if (sec !== "all" && !seenSec[sec]) { seenSec[sec] = 1; store.set(SEEN_KEY, seenSec); }
      tickLabels();
      $("qsec").value = sec;
      apply();
      window.scrollTo({ top: 0 });
      syncHash(); /* hoisted from the tabs section */
    }
    api.go = setSec;

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
      const qd = e.target.closest("[data-quizdeck]");
      if (qd) { Quiz.setDeck(qd.dataset.quizdeck); setMode("quiz"); return; }
      const b = e.target.closest("[data-sec]");
      if (b) setSec(b.dataset.sec);
    });

    on("q", "input", apply);
    on("q-clear", "click", () => { $("q").value = ""; apply(); $("q").focus(); });
    on("q", "keydown", (e) => {
      if (e.key === "Escape") { $("q").value = ""; apply(); $("q").blur(); }
    });
    /* press / anywhere in Study to jump into search */
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.body.classList.contains("mode-study")
          && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) {
        e.preventDefault();
        $("q").focus();
      }
    });

    /* number sprint: random number → typed reading */
    let numCur = 247;
    function numNext() {
      /* weighted small: plenty of 2-3 digit numbers, occasional big ones */
      const r = Math.random();
      numCur = r < 0.4 ? 1 + Math.floor(Math.random() * 99)
        : r < 0.75 ? 100 + Math.floor(Math.random() * 900)
        : r < 0.92 ? 1000 + Math.floor(Math.random() * 9000)
        : 10000 + Math.floor(Math.random() * 89999);
      $("num-q").textContent = numCur.toLocaleString();
      $("num-in").value = "";
    }
    if ($("num-check")) {
      let pending = 0; /* a second Enter while the verdict shows must not skip a number */
      const check = () => {
        if (pending) return;
        const want = numToRomaji(numCur);
        const ok = numNorm($("num-in").value) === numNorm(want);
        $("num-verdict").innerHTML = ok
          ? `<b style="color:var(--rule)">正解</b>`
          : `<b style="color:var(--shu)">${esc(want)}</b>`;
        pending = setTimeout(() => { pending = 0; numNext(); }, ok ? 600 : 2400);
      };
      on("num-check", "click", check);
      on("num-in", "keydown", (e) => { if (e.key === "Enter") check(); });
      numNext();
    }

    /* personalization form */
    const save = $("you-save");
    if (save) save.onclick = () => {
      store.set(YOU_KEY, {
        name: $("you-name").value.trim(),
        country: $("you-country").value.trim(),
        job: $("you-job").value.trim(),
      });
      toast.afterReload("Saved — your phrases are updated");
      location.reload(); /* cards and rows rebuild from the new values */
    };

    /* play a whole section in sequence */
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-playall]");
      if (!b) return;
      const items = [...document.querySelectorAll(`#${b.dataset.playall} .row:not([hidden]) .spk`)]
        .map((s) => [s.dataset.say, !("tts" in s.dataset)]);
      Player.toggle(items, b);
    });

    setSec(store.get(SEC_KEY) || "all"); /* returning users land where they left off */
  }

  const api = { render, wire, current: () => sec };
  return api;
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

/* --------------------------- SRS scheduler ------------------------------- */
const Srs = (() => {
  const load = () => cleanProg(store.get(CONFIG.progressKey)) || {};
  let prog = load(); /* id -> {b,d,s,l,e?,iv?} */

  const record = (id) => prog[id];
  const isKnown = (p) => !!p && p.b >= CONFIG.knownBox;
  const save = () => store.set(CONFIG.progressKey, prog);

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
     @returns true if the card should resurface this session */
  function grade(card, good, { practice = false, now = Date.now() } = {}) {
    const before = prog[card.id];
    const after = practice ? practiceRecord(before, good, now) : nextRecord(before, good, now);
    if (after !== before) { prog[card.id] = after; save(); }
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
    replace(next) { prog = adopt(next || {})[0]; save(); },
    reset() { prog = {}; save(); },
    reload() { prog = load(); }, /* another tab wrote the record */
  };
})();

/* ----------------------------- Quiz view --------------------------------- */
const Quiz = (() => {
  const DEFAULTS = { deck: "All decks", dir: "jp", mode: "flip", newn: 10, speak: true };
  const settings = Object.assign({}, DEFAULTS, store.get(CONFIG.settingsKey) || {});
  /* practice: the queue is an extra-reps drill, graded via practiceRecord.
     bonusNew: new cards asked for on top of today's allowance.             */
  const session = { queue: [], current: null, face: "jp", revealed: false, verdict: null,
                    reviewed: 0, correct: 0, missed: [], customPending: false,
                    practice: false, bonusNew: 0 };
  const undoStack = []; /* up to 20 grades deep */

  const TRICKY_CHARS = new Set(TRICKY.flatMap((p) => p.g.flatMap((g) => [g, H2K[g] || "", K2H[g] || ""])));
  const COMPOSITE = {
    "All decks": () => CARDS,
    "All characters": () => CARDS.filter((c) => c.type === "char"),
    "All phrases": () => CARDS.filter((c) => c.type === "phrase"),
    "Look-alikes": () => CARDS.filter((c) => c.type === "char" && TRICKY_CHARS.has(c.char)),
  };
  /* own-property checks: a deck name can arrive from the URL hash, and
     "constructor" must not resolve to Object.prototype's                    */
  const isDeck = (name) => Object.hasOwn(COMPOSITE, name) || DECK_ORDER.includes(name);
  const deckCards = () =>
    (Object.hasOwn(COMPOSITE, settings.deck) ? COMPOSITE[settings.deck]() : CARDS.filter((c) => c.deck === settings.deck));

  /* The new-card allowance is per day, counted when a card is first graded
     — so reloading, switching tabs or peeking at a card never spends it.   */
  const NEW_KEY = "kanaTrainerNewDay.v1";
  const newToday = () => { const r = store.get(NEW_KEY); return r && r.day === ymd() ? r.n : 0; };
  const addNewToday = (by) => store.set(NEW_KEY, { day: ymd(), n: Math.max(0, newToday() + by) });
  const newBudget = () => Math.max(0, settings.newn + session.bonusNew - newToday());
  const counterpart = (c) => H2K[c.char] || K2H[c.char] || "";
  const pickFace = () =>
    settings.mode === "listen" ? "jp"
    : settings.dir === "mix" ? (Math.random() < 0.5 ? "jp" : "en") : settings.dir;
  const listening = () => settings.mode === "listen" && session.face === "jp";
  const matching = () => settings.mode === "match" && session.current?.type === "char" && counterpart(session.current);
  const typedApplies = () => (settings.mode === "type" || settings.mode === "listen") && session.face === "jp";
  /* memory hook for the 46 base characters, from the guide. Looked up by
     glyph (BASE_LINK), not romaji — を and お share "o", ウォ and を "wo". */
  const mnemOf = (c) => {
    const m = c.type === "char" ? MNEM[BASE_LINK[c.char]] : null;
    return m ? m[K2H[c.char] !== undefined ? 1 : 0] : "";
  };
  const speak = (c) => Speech.say(speechText(c), hasClip(c));
  /* screen readers hear the prompt and the verdict, not every re-render */
  const announce = (text) => { const live = $("qlive"); if (live) live.textContent = text; };

  function saveSettings() {
    settings.deck = $("qdeck").value;
    settings.dir = $("qdir").value;
    settings.mode = $("qmode").value;
    settings.newn = Math.max(0, +$("qnewn").value || 0);
    settings.speak = $("qspeak").checked;
    store.set(CONFIG.settingsKey, settings);
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
    session.queue = [...due];
    fresh.forEach((c, i) =>
      session.queue.splice(Math.min(session.queue.length, (i + 1) * CONFIG.interleaveEvery), 0, c));
  }

  function next() {
    session.current = session.queue.shift() || null;
    /* a finished drill flows straight back into the scheduled queue */
    if (!session.current && session.practice) { buildQueue(); session.current = session.queue.shift() || null; }
    session.face = pickFace();
    session.revealed = false;
    session.verdict = null;
    if (session.queue[0] && hasClip(session.queue[0])) {
      const pre = new Audio();
      pre.preload = "auto";
      pre.src = voiceDirs()[0] + encodeURIComponent(speechText(session.queue[0])) + ".mp3";
    }
    render();
  }

  function reveal(verdict) {
    session.revealed = true;
    session.verdict = verdict;
    render();
  }

  /* ---- 60s sprint: random cards against the clock. Speed practice, not
     review — grades go through practiceRecord, so a streak of hits can't
     push cards weeks ahead of schedule.                                    */
  let sprint = null;
  const sprintCards = () => deckCards().filter((c) => !c.custom);
  function nextSprintCard() {
    const cards = sprintCards();
    /* avoid showing the same card twice running when there's a choice */
    let c;
    do { c = cards[Math.floor(Math.random() * cards.length)]; }
    while (cards.length > 1 && c === session.current);
    session.current = c;
    session.face = "jp";
    session.revealed = false;
    session.verdict = null;
    render();
  }
  /* deal: false when something else takes over next (tab change, reset, drill) */
  function endSprint(aborted, deal = true) {
    clearInterval(sprint.timer);
    const n = sprint.count;
    sprint = null;
    session.current = null;
    document.body.classList.remove("sprinting");
    $("qsprint").textContent = "60s sprint";
    $("sprint-box").hidden = true;
    $("qsession").hidden = false;
    const bests = store.get("kanaTrainerSprint.v1") || {};
    const key = settings.deck;
    if (!aborted) {
      const isBest = n > (bests[key] || 0);
      if (isBest) { bests[key] = n; store.set("kanaTrainerSprint.v1", bests); }
      $("qarea").innerHTML = `<div class="qcard"><div class="qdone">
        <p><b>Sprint over — ${n} correct in 60 seconds.</b>${isBest && n > 0 ? " New best for this deck!" : ` Best: ${bests[key] || 0}.`}</p>
        <div class="qbtns"><button class="qb" id="qsprint-again">Again</button><button class="qb ghost" id="qsprint-done">Back to reviews</button></div>
      </div></div>`;
      announce(`Sprint over — ${n} correct.`);
      $("qsprint-again").onclick = startSprint;
      $("qsprint-done").onclick = () => { buildQueue(); next(); };
    } else if (deal) { buildQueue(); next(); }
  }
  function startSprint() {
    if (sprint) return endSprint(true);
    if (!sprintCards().length) {
      $("qarea").innerHTML = `<div class="qcard"><div class="qdone">
        <p><b>Nothing to sprint through here.</b> This deck only has flip-and-grade cards — pick a deck with kana readings.</p>
        <div class="qbtns"><button class="qb ghost" id="qrefill">Back to reviews</button></div></div></div>`;
      $("qrefill").onclick = () => { buildQueue(); next(); };
      return;
    }
    sprint = { left: 60, count: 0, timer: setInterval(() => {
      if (--sprint.left <= 0) return endSprint(false);
      $("sprint-left").textContent = sprint.left;
    }, 1000) };
    document.body.classList.add("sprinting");
    $("qsprint").textContent = "Stop sprint";
    $("sprint-box").hidden = false;
    $("qsession").hidden = true;
    $("sprint-left").textContent = "60";
    $("sprint-count").textContent = "0";
    nextSprintCard();
  }

  function grade(good) {
    const c = session.current;
    if (!c) return;
    if (sprint) {
      if (good) sprint.count++;
      $("sprint-count").textContent = sprint.count;
      Srs.grade(c, good, { practice: true });
      session.reviewed++;
      if (good) session.correct++;
      updateDueBadge();
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
    if (Srs.grade(c, good, { practice: session.practice }))
      session.queue.splice(Math.min(CONFIG.requeueGap, session.queue.length), 0, c);
    if (!prev && Srs.record(c.id)) { step.wasNew = true; addNewToday(1); }
    session.reviewed++;
    next();
    updateDueBadge();
  }

  function undo() {
    if (sprint) return;
    const u = undoStack.pop();
    if (!u) return;
    Srs.restore(u.card.id, u.prevProg);
    if (u.wasNew) addNewToday(-1);
    session.queue = u.queue;
    session.current = u.card;
    session.face = pickFace();
    session.revealed = false;
    session.verdict = null;
    session.reviewed = u.reviewed;
    session.correct = u.correct;
    if (session.missed[session.missed.length - 1]?.id === u.card.id) session.missed.pop();
    render();
    updateDueBadge();
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
    $("stLeft").textContent = session.queue.length + (session.current ? 1 : 0);
    $("stToday").textContent = session.reviewed;
    $("stAcc").textContent = session.reviewed
      ? ` · ${Math.round(100 * session.correct / session.reviewed)}% right` : "";
    $("qundo").disabled = !undoStack.length || !!sprint;
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
    const boxes = CONFIG.intervals.length;
    const level = p
      ? `<span class="dots" role="img" aria-label="Box ${p.b + 1} of ${boxes}" title="Box ${p.b + 1} of ${boxes} — each hit moves a card up a box, and higher boxes come back less often">${
          CONFIG.intervals.map((_, i) => `<i${i <= p.b ? ' class="on"' : ""}></i>`).join("")}</span>`
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
    const missed = [...new Map(session.missed.map((c) => [c.id, c])).values()].slice(0, 15);
    const summary = missed.length
      ? `<div class="qsummary"><h3>Missed this session</h3><ul>${missed.map((c) => {
          const m = mnemOf(c);
          return `<li><b lang="ja">${esc(cardJp(c))}</b> ${esc(answerRom(c))}${m ? ` — ${m}` : ""}</li>`;
        }).join("")}</ul></div>`
      : "";
    /* unseen cards left once today's allowance is spent: offer a few more
       rather than sending the learner to the settings to raise a number    */
    const unseen = deckCards().filter((c) => !Srs.record(c.id)).length;
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
    $("qrefill").onclick = () => { buildQueue(); next(); };
    /* sized so exactly `more` fit, whatever the allowance is set to now */
    if (more) $("qmore").onclick = () => { session.bonusNew = more + newToday() - settings.newn; buildQueue(); next(); };
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
    if (!isDeck(settings.deck)) settings.deck = "All decks";
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
    const onChange = {
      qdeck: () => { if (sprint) return sprintCards().length ? nextSprintCard() : endSprint(true); buildQueue(); next(); },
      qdir: () => { if (!sprint) session.face = pickFace(); render(); },
      qmode: () => { if (!sprint) session.face = pickFace(); render(); },
      qnewn: () => { if (sprint) return; buildQueue(session.current); if (!session.current) next(); else stats(); },
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
    try { $("qvoice").checked = localStorage.getItem(VOICE_KEY) === "m"; } catch {}
    on("qvoice", "change", () => {
      try { localStorage.setItem(VOICE_KEY, $("qvoice").checked ? "m" : "f"); } catch {}
    });
    $("qslow").checked = slowPref();
    on("qslow", "change", () => {
      try { localStorage.setItem(AUDIO_PREF_KEY, JSON.stringify({ slow: $("qslow").checked })); } catch {}
    });

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
        undoStack.length = 0;
        session.missed = [];
        buildQueue();
        next();
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

    on("qreset", "click", () => {
      if (!confirm("Wipe all quiz progress? This can't be undone (export first if unsure).")) return;
      if (sprint) endSprint(true, false);
      Srs.reset();
      store.set(NEW_KEY, null);
      undoStack.length = 0;
      session.missed = [];
      session.bonusNew = 0;
      buildQueue();
      next();
      updateDueBadge();
      toast("Progress reset");
    });
  }

  /* focused drill on an explicit card list (e.g. the lapse list) */
  function drillCards(cards) {
    if (sprint) endSprint(true, false);
    session.queue = [...cards];
    session.practice = true;
    session.customPending = true;
  }

  /* ignores names that aren't decks — the hash can ask for anything */
  function setDeck(name) {
    if (!isDeck(name)) return;
    settings.deck = name;
    store.set(CONFIG.settingsKey, settings);
    $("qdeck").value = name;
    session.current = null; /* the card on screen belongs to the old deck */
    session.customPending = false;
  }

  return {
    wire, drillCards, setDeck,
    /* entering the Quiz tab: pick up newly due cards, but keep the card
       you were on rather than dealing a new one every visit                */
    start() {
      if (sprint) return;
      if (session.customPending) { session.customPending = false; next(); }
      else if (session.current) { if (!session.practice) buildQueue(session.current); render(); }
      else { buildQueue(); next(); }
    },
    /* leaving the Quiz tab abandons a running sprint */
    leave() { if (sprint) endSprint(true, false); },
    /* another tab changed the record: refresh the counts, keep the card */
    refresh() { if (document.body.classList.contains("mode-quiz") && !sprint) stats(); },
  };
})();

/* --------------------------- Progress view ------------------------------- */
const Progress = (() => {
  const li = (c, extra = "") =>
    `<li><span class="jp2" lang="ja">${esc(cardJp(c))}</span><span class="mn">${esc(cardGloss(c))}${extra}</span></li>`;

  function stats() {
    const days = Srs.days();
    const streak = streakOf(days);
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
    let known = 0, learning = 0;
    CARDS.forEach((c) => { const p = Srs.record(c.id); if (p) Srs.isKnown(p) ? known++ : learning++; });
    $("pfirst").hidden = known + learning > 0;
    $("pstats").innerHTML = `
      <div class="ptotals">
        <div class="kn"><b>${known}</b><span>known</span></div>
        <div class="ln"><b>${learning}</b><span>learning</span></div>
        <div class="nw"><b>${CARDS.length - known - learning}</b><span>unseen</span></div>
        <div class="st"><b>${streak}</b><span>day streak</span></div>
      </div>
      <p class="pdue"><b class="now">${dueNow}</b> due now · <b>${dueTom}</b> more by tomorrow · <b>${dueWeek}</b> later this week${
        dueNow ? ' <button type="button" class="minibtn" id="pgo">review now →</button>' : ""}</p>
      <h2 class="phead">Last 12 weeks</h2>
      <div class="heat" role="img" aria-label="Reviews per day over the last 12 weeks">${heat}</div>`;
    if (dueNow) $("pgo").onclick = () => setMode("quiz");
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
      const split = `${known} known · ${learning} learning · ${unseen} unseen`;
      return `<div class="pdeck">
        <h3><button type="button" class="pname" data-quizdeck="${esc(deck)}" title="Quiz this deck">${esc(deck)}<i>quiz →</i></button>
          <span class="pcount">${known || learning ? `${known} known${learning ? ` · ${learning} learning` : ""} / ` : "0 / "}${cards.length}</span></h3>
        <div class="pbar" role="img" aria-label="${split}" title="${split}"><i class="kn" style="width:${w(known)}"></i><i class="ln" style="width:${w(learning)}"></i><i class="nw" style="width:${w(unseen)}"></i></div>
      </div>`;
    }).join("");

    const known = CARDS.filter((c) => Srs.isKnown(Srs.record(c.id)));
    const lapsed = CARDS
      .filter((c) => { const p = Srs.record(c.id); return p && p.l >= 3 && !Srs.isKnown(p); })
      .sort((a, b) => Srs.record(b.id).l - Srs.record(a.id).l);

    $("pknown").innerHTML = known.length
      ? known.map((c) => li(c)).join("")
      : `<li class="pempty">Nothing yet — a card counts as learned once you pass the review that follows its 7-day gap.</li>`;
    $("plapse").innerHTML = lapsed.length
      ? lapsed.map((c) => li(c, ` · missed ×${Srs.record(c.id).l}`)).join("")
      : `<li class="pempty">No repeat offenders. Cards land here after three misses.</li>`;

    const btn = $("plapseDrill");
    btn.hidden = !lapsed.length;
    btn.onclick = () => { Quiz.drillCards(lapsed); setMode("quiz"); };
  }

  on("pstart", "click", () => setMode("quiz"));
  on("pbars", "click", (e) => {
    const b = e.target.closest("[data-quizdeck]");
    if (b) { Quiz.setDeck(b.dataset.quizdeck); setMode("quiz"); }
  });

  return { render };
})();

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
  if (e.key !== CONFIG.progressKey) return;
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
if (!store.get("kanaTrainerHello.v1") && !Object.keys(Srs.all()).length) {
  const hello = $("hello");
  if (hello) {
    hello.hidden = false;
    $("hello-x").onclick = () => { store.set("kanaTrainerHello.v1", 1); hello.hidden = true; };
  }
}

if (!store.ok) {
  const warn = document.createElement("p");
  warn.className = "qwarn";
  warn.innerHTML =
    "<b>This browser is blocking storage</b>, so quiz progress lasts only until you close the tab — use Export progress (under Backup &amp; reset) to keep it.";
  $("qarea").before(warn);
}
