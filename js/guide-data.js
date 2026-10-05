/* Guide data — derived from js/kana-data.js (load that first). */

/* K: the guide's chart rows, built from GOJU + KANA_INFO */
const K = GOJU.map(([label, cells]) => ({
  r: label,
  c: cells.map(c => {
    if (!c) return null;
    const r = c[0] === 'を' ? 'wo' : c[2];
    const info = KANA_INFO[r] || {};
    /* d: the label shown. を is read "o" but written and typed "wo" */
    return { h: c[0], k: c[1], r, d: r === 'wo' ? '(w)o' : r, s: info.s || '', mh: info.mh, mk: info.mk };
  }),
}));

/* romaji -> hiragana for every syllable with an audio clip */
const ROM2KANA = (() => {
  const m = {};
  for (const rows of [GOJU, DAKU, YOON])
    for (const [, cells] of rows)
      for (const c of cells) if (c && !(c[2] in m)) m[c[2]] = c[0];
  m.wo = 'を';
  return m;
})();

/* TRICKY (look-alike pairs) lives in js/kana-data.js */
