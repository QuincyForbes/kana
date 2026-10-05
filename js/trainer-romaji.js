"use strict";
/* Kana Trainer — what a card says and whether a typed answer matches it.
   Pure functions over card objects: no DOM, no storage, no data tables
   (tools/test-romaji.mjs loads this file whole).                           */

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

/* ------------------------------ Pitch accent ----------------------------- */
/* An accent is the number of the mora after which the pitch falls (0: it
   never does). Tokyo pattern: the first mora is low unless the fall comes
   right after it, then high up to the fall, then low.  pitchPattern gives,
   for a word of n morae, which are high and which one the fall follows.   */
function pitchPattern(accent, n) {
  return Array.from({ length: n }, (_, i) => ({
    hi: accent === 1 ? i === 0 : i > 0 && (accent === 0 || i < accent),
    drop: accent > 0 && i === accent - 1,
  }));
}
const pitchLabel = (a) => (a === 0 ? "flat — no fall" : a === 1 ? "falls after the first mora" : `falls after mora ${a}`);

/* --------------------------- Number readings ---------------------------- */
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
