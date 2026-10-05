"use strict";
/* Kana Trainer — the cards: every character, phrase and kanji from the data
   tables (js/kana-data.js, js/trainer-data.js), the personalised intro rows,
   and the learner's own CSV decks. No DOM; storage through js/store.js.     */

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
const YOU = store.get(KEYS.you) || {};
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
const Custom = {
  decks: cleanDecks(store.get(KEYS.custom), RESERVED_DECKS),
  commit() { store.set(KEYS.custom, this.decks); location.reload(); },
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

/* ------------------------- Custom deck helpers -------------------------- */
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
