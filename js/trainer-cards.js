"use strict";
/* Kana Trainer — the cards: every character, phrase and kanji from the data
   tables (js/kana-data.js, js/trainer-data.js), the personalised intro rows,
   and the learner's own decks (js/decks.js). No DOM; storage through
   js/store.js.                                                             */

/* ------------------------------ Cards ----------------------------------- */
/* Card shapes:
     char   {id, deck, char, rom, say, alt?}      alt: other accepted spellings
     phrase {id, deck, kana[], rom[], mean, slot?} rom: "*x" = particle, "~" = modifier
     kanji  {id, deck, kanji, furi, rom, mean, where}
     custom {id, deck, front, reading, mean, rom, custom}
   Ids are built from content, never position — hg-あ, p:こんにちは, k:出口 —
   so adding or reordering rows in the data files can't move anyone's
   progress onto a different card. (Positional ids from before v22 are
   carried across by migrateIds + js/legacy-ids.js.)

   The ORDER of this list is the order new cards are introduced in, so it
   follows the guide's advice: all of hiragana before any katakana, then
   phrases, then kanji.                                                      */
const CARDS = [];

(function buildCharCards() {
  /* を is "o" when spoken but "wo" on most charts and every keyboard; ん is
     typed "nn" in an IME — accept both rather than mark a right answer wrong */
  const ALT = { "を": ["wo"], "ん": ["nn"] };
  const cells = [GOJU, DAKU, YOON].flatMap((rows) => rows.flatMap(([, row]) => row.filter(Boolean)));
  for (const [h, , r] of cells)
    CARDS.push({ id: "hg-" + h, deck: h.length > 1 ? "Hiragana combos" : "Hiragana", char: h, rom: r, say: h, alt: ALT[h], type: "char" });
  for (const [h, k, r] of cells)
    /* speak the hiragana twin — TTS reads a lone ヲ/ヅ badly */
    CARDS.push({ id: "kt-" + k, deck: k.length > 1 ? "Katakana combos" : "Katakana", char: k, rom: r, say: h, alt: ALT[h], type: "char" });
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
  "Hiragana", "Hiragana combos", "Katakana", "Katakana combos",
  ...DATA.map((d) => d[0]), "Survival kanji",
];
/* virtual decks the quiz builds from the others */
const COMPOSITE_DECKS = ["All decks", "All characters", "All phrases", "Look-alikes"];
/* names a personal deck can't take */
const RESERVED_DECKS = [...COMPOSITE_DECKS, ...DECK_ORDER];

/* ---- personal decks (js/decks.js) as the trainer sees them ---------------
   Own cards become trainer cards here (ids from customIds: deck name +
   front text, so editing a deck keeps the record of every line whose front
   is unchanged). Collected cards — refs — are looked up by deckMembers.    */
Decks.replace(cleanDecks(Decks.list, RESERVED_DECKS)); /* a name the guide allowed may clash here */
const Custom = {
  get decks() { return Decks.list; },
  set decks(next) { Decks.replace(next); },
  /* CSV edits and removals change the card list itself — save and start over */
  commit() { store.set(KEYS.custom, Decks.list); location.reload(); },
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
  /* replace a deck's own cards (the CSV editor); what it has collected stays */
  upsert(name, cards) {
    const old = Decks.get(name);
    if (old) old.cards = cards; else Decks.list.push({ name, cards, refs: [] });
    this.commit();
  },
  remove(i) { Decks.list.splice(i, 1); this.commit(); },
};
Custom.decks.forEach((d) => { CARDS.push(...Custom.cardsOf(d)); DECK_ORDER.push(d.name); });
/* a deck started from the "add to a deck" menu appears without a reload */
Decks.onChange(() => Decks.list.forEach((d) => { if (!DECK_ORDER.includes(d.name)) DECK_ORDER.push(d.name); }));

/* the cards of a deck: its own, plus any existing cards collected into it */
function deckMembers(name) {
  const own = CARDS.filter((c) => c.deck === name);
  const refs = Decks.get(name)?.refs;
  if (!refs || !refs.length) return own;
  const want = new Set(refs);
  return own.concat(CARDS.filter((c) => want.has(c.id) && c.deck !== name));
}
