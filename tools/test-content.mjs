// Content checks — the Japanese itself can't be unit-tested, but everything
// mechanical about it can: every reading agrees with its kana, particles and
// modifiers are marked where they should be, and every character has its
// audio, strokes, mnemonic, sketch and example words.
//   node tools/test-content.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadApp, checker } from './load-app.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const { DATA, KANJI, CARDS, kanaToRomaji, spokenRom, PITCH } = loadApp();
const { GOJU, DAKU, YOON, EXTRA, KANA_INFO, TRICKY } =
  new Function(read('js/kana-data.js') + '; return { GOJU, DAKU, YOON, EXTRA, KANA_INFO, TRICKY };')();
const { WORDS, PAIRS } = new Function(read('js/guide-words.js') + '; return { WORDS, PAIRS };')();
const STROKES = new Function(read('js/strokes.js') + '; return STROKES;')();
const SHAPES = new Function(read('js/guide-shapes.js') + '; return SHAPES;')();
const { is, done } = checker();
const none = (list, label) => is(list, [], label);

const cells = [GOJU, DAKU, YOON].flatMap((rows) => rows.flatMap(([, row]) => row.filter(Boolean)));
const K2R = Object.fromEntries([...cells.flatMap(([h, k, r]) => [[h, r], [k, r]]), ...EXTRA]);
const base = GOJU.flatMap(([, row]) => row.filter(Boolean));
const keyOf = ([h, , r]) => (h === 'を' ? 'wo' : r); /* the guide keys the particle as wo */
/* compare romaji ignoring how a long vowel is spelt (ō / ou / oo) */
const loose = (s) => s.toLowerCase().replace(/[āâ]/g, 'a').replace(/[īî]/g, 'i').replace(/[ūû]/g, 'u')
  .replace(/[ēê]/g, 'e').replace(/[ōô]/g, 'o').replace(/ou/g, 'o').replace(/([aeiou])\1+/g, '$1');

/* ---- phrases: one romaji per kana box, and each agrees with the chart ---- */
const phrases = DATA.flatMap(([deck, , rows]) => rows.map(([kana, rom, mean]) => ({ deck, kana, rom, mean, text: kana.join('') })));
none(phrases.filter((p) => p.kana.length !== p.rom.length).map((p) => p.text), 'every phrase has one reading per kana box');
none(phrases.flatMap((p) => p.kana.flatMap((k, i) => {
  const r = p.rom[i];
  if (r === '~') return /^[っッー]$/.test(k) ? [] : [`${p.text}: ~ on ${k}`];
  if (r.startsWith('*')) return ({ は: '*wa', へ: '*e', を: '*o' })[k] === r ? [] : [`${p.text}: ${k} marked ${r}`];
  return K2R[k] === r ? [] : [`${p.text}: ${k} read ${r}, chart says ${K2R[k]}`];
})), 'each box reads as the chart says; particles are は→wa へ→e を→o; ~ only on っ and ー');
none(phrases.filter((p) => p.kana.some((k, i) => k === 'を' && p.rom[i] !== '*o')).map((p) => p.text), 'を is always marked as the particle');
none(phrases.filter((p) => !p.mean || !p.mean.trim()).map((p) => p.text), 'every phrase has a meaning');
is(new Set(phrases.map((p) => p.text)).size, phrases.length, 'no phrase appears twice');
none(phrases.filter((p) => /[^a-z]/.test(spokenRom(p))).map((p) => p.text), 'spoken romaji is plain letters');

/* ---- kanji, example words, minimal pairs: romaji agrees with the kana ---- */
none(KANJI.filter(([, furi, rom]) => loose(rom) !== loose(kanaToRomaji(furi) || '')).map((k) => k[0]), 'kanji romaji matches the furigana');
none(Object.values(WORDS).flat().filter(([w, r]) => loose(r) !== loose(kanaToRomaji(w) || '')).map((w) => w[0]), 'example-word romaji matches the kana');
none(PAIRS.flat().filter(([w, r]) => r !== kanaToRomaji(w)).map((w) => w[0]), 'minimal-pair romaji matches the kana');
none(PAIRS.filter(([a, b]) => loose(a[1]) !== loose(b[1].replace(/([kstp])\1/, '$1'))).map((p) => p[0][0]), 'each minimal pair differs only in length');
none(Object.entries(WORDS).flatMap(([key, list]) => {
  const h = (base.find((c) => keyOf(c) === key) || [])[0];
  return list.filter(([w]) => !w.includes(h)).map(([w]) => `${key}: ${w}`);
}), 'each example word contains the character it illustrates');

/* ---- every base character has its full set of teaching material ---- */
none(base.filter((c) => !KANA_INFO[keyOf(c)]?.mh || !KANA_INFO[keyOf(c)]?.mk).map((c) => c[0]), 'a mnemonic for both scripts');
none(base.filter((c) => !SHAPES[keyOf(c)]?.h || !SHAPES[keyOf(c)]?.k).map((c) => c[0]), 'a sketch for both scripts');
none(base.flatMap(([h, k]) => [h, k]).filter((g) => !STROKES[g]?.length), 'stroke order for both scripts');
none(base.filter((c) => keyOf(c) !== 'wo' && (WORDS[keyOf(c)] || []).length < 2).map((c) => c[0]), 'two example words (を is only ever a particle)');
none(TRICKY.flatMap((t) => t.g).filter((g) => !K2R[g]), 'look-alike pairs are real characters');
none(TRICKY.filter((t) => t.g.some((g, i) => K2R[g] !== t.l[i])).map((t) => t.g.join('')), 'look-alike labels match the chart');

/* ---- audio: a clip in both voices for everything with a recorded reading ---- */
const want = new Set([...cells.map((c) => c[0]), ...EXTRA.map((e) => e[0]), ...phrases.map((p) => p.text),
  ...KANJI.map((k) => k[1]), ...Object.values(WORDS).flat().map((w) => w[0]), ...PAIRS.flat().map((w) => w[0])]);
const listed = new Set(JSON.parse(read('tools/texts.json')));
is([[...want].filter((t) => !listed.has(t)), [...listed].filter((t) => !want.has(t))], [[], []], 'tools/texts.json is exactly what the app speaks');
for (const dir of ['audio/ja', 'audio/ja-m'])
  none([...want].filter((t) => { const f = join(root, dir, t + '.mp3'); return !existsSync(f) || statSync(f).size < 500; }), `${dir} has a clip for every text`);

/* ---- pitch accent: only real cards, and an accent that fits the word ---- */
const morae = (s) => [...s].filter((ch) => !/[ゃゅょャュョぁぃぅぇぉァィゥェォ]/.test(ch)).length;
const byId = new Map(CARDS.map((c) => [c.id, c]));
none(Object.keys(PITCH).filter((id) => !['phrase', 'kanji'].includes(byId.get(id)?.type) || byId.get(id).custom), 'every pitch entry belongs to a built-in phrase or kanji card');
none(Object.entries(PITCH).filter(([id, a]) => {
  const c = byId.get(id), n = c.type === 'phrase' ? c.kana.length : morae(c.furi);
  return !a.length || a.some((x) => !Number.isInteger(x) || x < 0 || x > n);
}).map(([id]) => id), 'every accent falls within its word (0 = flat, else a mora of it)');
none(Object.keys(PITCH).filter((id) => byId.get(id).type === 'phrase' && byId.get(id).kana.length !== morae(byId.get(id).kana.join(''))), 'a phrase with a pitch has one box per mora');
is(Object.keys(PITCH).length > 80, true, 'the accent list covers the common words');
is([PITCH['p:おはよう'], PITCH['p:ありがとう'], PITCH['k:水']], [[0], [2], [0]], 'spot checks against the dictionary: おはよう flat, ありがとう falls after り, 水 flat');

/* ---- cards ---- */
is(CARDS.length, 2 * cells.length + EXTRA.length + phrases.length + KANJI.length, 'one card per character, phrase and kanji');

done();
