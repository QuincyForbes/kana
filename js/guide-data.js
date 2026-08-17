/* Guide data — derived from js/kana-data.js (load that first). */

/* K: the guide's chart rows, built from GOJU + KANA_INFO */
const K = GOJU.map(([label, cells]) => ({
  r: label,
  c: cells.map(c => {
    if (!c) return null;
    const r = c[0] === 'を' ? 'wo' : c[2];
    const info = KANA_INFO[r] || {};
    return { h: c[0], k: c[1], r, s: info.s || '', mh: info.mh, mk: info.mk };
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

const TRICKY = [{"g":["シ","ツ"],"l":["shi","tsu"],"p":"The whole difference is stroke direction. シ is written from the <b>left, sweeping up</b> — its marks stack down the left side. ツ comes from the <b>top, sweeping down</b> — its marks sit along the top edge."},{"g":["ン","ソ"],"l":["n","so"],"p":"Same rule as above, one mark fewer. ン sweeps <b>up from the lower left</b>. ソ comes <b>down from the upper right</b>."},{"g":["ぬ","め"],"l":["nu","me"],"p":"ぬ has the extra loop trailing off — the escaping noodle. め stops clean."},{"g":["る","ろ"],"l":["ru","ro"],"p":"る loops at the bottom, ろ doesn't. The route comes back; the road is a dead end."},{"g":["れ","わ","ね"],"l":["re","wa","ne"],"p":"Same body, different tail: れ flicks <b>out</b>, わ curls <b>in</b>, ね loops all the way round (the cat's tail)."},{"g":["は","ほ"],"l":["ha","ho"],"p":"ほ has one extra crossbar — the antenna on the house."},{"g":["さ","き"],"l":["sa","ki"],"p":"き has two crossbars, さ has one. Two teeth on the key."},{"g":["ク","ワ","ケ"],"l":["ku","wa","ke"],"p":"ク comes to a sharp point at the bottom, ワ is wide and blunt, ケ has a stroke through the top."},{"g":["ロ","コ"],"l":["ro","ko"],"p":"ロ is a closed box, コ is open on the left."},{"g":["ア","マ"],"l":["a","ma"],"p":"ア's stroke hangs down from the <b>right</b> side; マ's hangs from the <b>middle</b>."},{"g":["ネ","ホ"],"l":["ne","ho"],"p":"ネ has a slanted stroke on top; ホ starts with a clean vertical cross."},{"g":["チ","テ"],"l":["chi","te"],"p":"チ has a hook at the bottom of the vertical; テ's vertical runs straight down."},{"g":["ウ","ワ"],"l":["u","wa"],"p":"ウ has the chimney tick on top; ワ is bare."}];
