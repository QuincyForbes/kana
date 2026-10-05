/* Mnemonic shape overlays — red sketch lines drawn over the glyph so the
   resemblance is visible, not just described. Keyed by guide romaji, one
   entry per script (h / k).

   Coordinates are KanjiVG's 109×109 grid — the same space as js/strokes.js,
   which is what the glyph underneath is drawn from, so a sketch lines up
   with the strokes whatever font the page happens to use. Each entry is
   SVG drawn with a red stroke and no fill; text needs its own fill.        */
const SHAPES = (() => {
const T = 'fill="var(--shu)" stroke="none" font-family="var(--body)"'; /* for labels */
const DOT = 'fill="var(--shu)" stroke="none"';                         /* eyes, droplets */
const WATER = '<path d="M6 101 Q30 93 54 101 Q78 108 102 98"/>';
return {
  a: {
    /* あ — an apple: the loop is the fruit, the cross is the stem */
    h: `<circle cx="51" cy="68" r="28"/><path d="M50 20 Q62 6 74 14 Q64 26 50 20Z"/>`,
    /* ア — an axe head with the handle slanting off */
    k: `<path d="M20 20 Q52 8 86 14 L74 46 Q50 36 24 38Z"/>`,
  },
  i: {
    /* い — two icicles hanging off a gutter */
    h: `<path d="M8 20 H102"/><path d="M14 22 L26 78 L34 22"/><path d="M68 22 L88 76 L96 22"/>`,
    /* イ — an easel leg propping up a canvas */
    k: `<rect x="62" y="4" width="34" height="26" rx="2"/><path d="M58 96 L46 106 M58 96 L70 106"/>`,
  },
  u: {
    /* う — a duck in profile, beak tipped up */
    h: `<circle cx="50" cy="32" r="2.6" ${DOT}/><path d="M57 17 L74 9 L63 27"/>${WATER}`,
    /* ウ — a roof with a chimney: you're under it going ooh */
    k: `<path d="M30 62 V100 H74 V66"/><rect x="46" y="78" width="12" height="22"/><path d="M57 10 Q63 5 59 0"/>`,
  },
  e: {
    /* え — a swan: long neck, flat back on the water */
    h: `<circle cx="47" cy="25" r="2.6" ${DOT}/><path d="M40 14 L27 12 L38 22"/>${WATER}`,
    /* エ — an I-beam girder hanging from a crane cable */
    k: `<path d="M56 0 V24"/><path d="M56 24 Q47 27 53 33"/>`,
  },
  o: {
    /* お — a golf ball flying off the tee, flag flicking right */
    h: `<circle cx="48" cy="72" r="26"/><path d="M76 14 V40"/><path d="M76 14 L95 20 L76 26"/>`,
    /* オ — an oar dipping into the water */
    k: `<path d="M30 66 Q13 80 9 98 Q27 92 38 76Z"/><path d="M54 101 Q68 95 82 101 Q92 105 102 99"/>`,
  },
  ka: {
    /* か — a kite with the string whipping off it */
    h: `<path d="M48 10 L73 46 L37 95 L11 49Z"/><path d="M92 58 Q101 74 91 86 Q85 96 97 105"/>`,
    /* カ — a karate chop splitting a board */
    k: `<rect x="14" y="32" width="80" height="14" rx="2"/><path d="M40 18 L46 27 M70 13 L66 25 M28 24 L37 29"/>`,
  },
  ki: {
    /* き — a key with two teeth */
    h: `<ellipse cx="53" cy="87" rx="25" ry="12"/><path d="M69 22 V33 M77 40 V51"/>`,
    /* キ — the same key, teeth filed flat */
    k: `<circle cx="47" cy="9" r="8"/><path d="M82 30 V40 M91 52 V62"/>`,
  },
  ku: {
    /* く — a cuckoo's open beak */
    h: `<circle cx="19" cy="54" r="18"/><circle cx="23" cy="47" r="2.6" ${DOT}/>`,
    /* ク — a croissant curl */
    k: `<path d="M56 13 Q106 18 27 99"/><path d="M68 36 L81 44 M60 54 L73 62 M48 72 L61 80"/>`,
  },
  ke: {
    /* け — a keg with the tap on its side */
    h: `<path d="M51 11 Q43 52 51 96 H93 Q101 52 93 11Z"/><path d="M28 69 H15 V80"/>`,
    /* ケ — a kettle with a handle */
    k: `<path d="M22 60 Q17 99 52 101 Q87 99 82 60"/><path d="M83 68 L101 53"/>`,
  },
  ko: {
    /* こ — two coins stacked flat */
    h: `<ellipse cx="46" cy="30" rx="28" ry="11"/><ellipse cx="55" cy="78" rx="34" ry="13"/>`,
    /* コ — a corner bracket: half a box */
    k: `<path d="M28 34 V78" stroke-dasharray="4 5"/>`,
  },
  sa: {
    /* さ — a sardine on a hook, crossed by the rod */
    h: `<ellipse cx="55" cy="87" rx="24" ry="10"/><path d="M31 87 L18 79 V95Z"/><circle cx="71" cy="85" r="2.2" ${DOT}/>`,
    /* サ — a cactus with two arms, stuck in sand */
    k: `<path d="M6 100 Q30 93 52 100 Q74 106 102 98"/><path d="M36 22 L29 14 M71 16 L78 8 M95 41 L104 36 M17 44 L8 39"/>`,
  },
  shi: {
    /* し — a shoehorn curving up at the heel */
    h: `<path d="M22 60 Q16 100 50 101 H95 Q99 86 85 80"/><path d="M22 60 H47"/>`,
    /* シ — a smiley tipped left: two eyes and a wink */
    k: `<circle cx="56" cy="54" r="48"/>`,
  },
  su: {
    /* す — a swing hanging from a looped rope */
    h: `<path d="M30 100 H64"/><path d="M15 38 L7 105 M94 32 L103 105"/>`,
    /* ス — a ski slope with a jump at the bottom */
    k: `<circle cx="58" cy="35" r="4.5"/><path d="M52 44 L42 58"/><path d="M62 95 H104"/>`,
  },
  se: {
    /* せ — a seesaw on its post, tipping back */
    h: `<circle cx="13" cy="41" r="5.5"/><circle cx="97" cy="32" r="5.5"/><path d="M52 51 L63 70 H41Z"/>`,
    /* セ — a scythe curving to its point */
    k: `<path d="M11 54 Q48 27 81 61 Q48 44 11 54Z"/>`,
  },
  so: {
    /* そ — a zigzag stitch: sewing */
    h: `<path d="M22 4 L64 26"/><circle cx="26" cy="6" r="2.6"/><path d="M20 104 H94" stroke-dasharray="6 5"/>`,
    /* ソ — two loose stitches of the same thread */
    k: `<path d="M35 44 Q54 14 84 21" stroke-dasharray="5 5"/><path d="M38 92 L23 108"/>`,
  },
  ta: {
    /* た — literally a t next to an a */
    h: `<text x="4" y="106" font-size="24" ${T}>t</text><text x="90" y="74" font-size="24" ${T}>a</text>`,
    /* タ — a luggage tag with a slash across it */
    k: `<path d="M47 10 L88 22 L33 102 L12 58Z"/><circle cx="57" cy="22" r="3"/>`,
  },
  chi: {
    /* ち — a cheerleader leaning back, ponytail out */
    h: `<circle cx="50" cy="7" r="7"/><path d="M44 5 Q30 -2 21 11"/><circle cx="72" cy="23" r="7" stroke-dasharray="2 3"/>`,
    /* チ — a cheap price tag: a 7 with a line through it */
    k: `<rect x="8" y="5" width="94" height="100" rx="6"/><circle cx="19" cy="16" r="3.5"/>`,
  },
  tsu: {
    /* つ — a tsunami curling over */
    h: `<path d="M6 100 Q30 92 52 100 Q76 107 104 97"/><circle cx="90" cy="26" r="2.6" ${DOT}/><circle cx="99" cy="41" r="2.6" ${DOT}/>`,
    /* ツ — the same wave with three droplets flying off */
    k: `<circle cx="24" cy="38" r="12"/><circle cx="50" cy="31" r="12"/><path d="M6 101 Q30 93 52 101 Q76 108 104 98"/>`,
  },
  te: {
    /* て — a telephone pole with the wire drooping */
    h: `<path d="M19 10 V106"/><path d="M10 19 H28"/>`,
    /* テ — a TV antenna on a roof */
    k: `<path d="M4 108 L42 90 L102 108"/><path d="M84 7 Q94 15 88 28 M93 2 Q106 15 97 33"/>`,
  },
  to: {
    /* と — a toe with a splinter in it */
    h: `<path d="M88 16 Q14 44 24 73 Q34 104 92 95"/>`,
    /* ト — a totem pole with one peg */
    k: `<rect x="33" y="10" width="24" height="22"/><path d="M40 19 h2 M49 19 h2 M41 26 h9"/><path d="M22 99 H72"/>`,
  },
  na: {
    /* な — a knot tied in a rope */
    h: `<circle cx="63" cy="82" r="16"/><path d="M86 88 Q98 93 107 84"/>`,
    /* ナ — a knife driven through a board */
    k: `<rect x="9" y="34" width="92" height="14" rx="2"/><rect x="46" y="0" width="15" height="16" rx="3"/>`,
  },
  ni: {
    /* に — a needle and two stitches beside it */
    h: `<ellipse cx="25" cy="18" rx="3.5" ry="6"/><path d="M26 12 Q46 -2 64 11 Q77 20 72 34" stroke-dasharray="4 4"/>`,
    /* ニ — two lines, and ni means two */
    k: `<text x="84" y="26" font-size="24" ${T}>2</text>`,
  },
  nu: {
    /* ぬ — noodles twirled on chopsticks, one strand escaping */
    h: `<path d="M6 10 L58 68 M19 4 L67 59"/><circle cx="86" cy="84" r="12"/>`,
    /* ヌ — the same noodles, chopsticks crossed, no loop */
    k: `<path d="M10 92 Q52 116 96 92Z"/>`,
  },
  ne: {
    /* ね — a cat curled up with its tail looping */
    h: `<path d="M56 44 L60 29 L68 42 M75 44 L81 29 L88 47"/><circle cx="86" cy="82" r="12"/>`,
    /* ネ — a nest wedged in a tree fork */
    k: `<path d="M32 18 Q56 48 82 16"/><path d="M30 20 H84" stroke-dasharray="3 4"/>`,
  },
  no: {
    /* の — the swirl of a "no entry" sign */
    h: `<circle cx="55" cy="58" r="48"/>`,
    /* ノ — a single slash: no */
    k: `<circle cx="51" cy="57" r="46"/>`,
  },
  ha: {
    /* は — a capital H with a small a, and a house with a chimney */
    h: `<path d="M6 30 L52 0 L102 27"/>`,
    /* ハ — two legs of someone doubled over laughing */
    k: `<circle cx="52" cy="13" r="10"/><path d="M52 23 V36"/>`,
  },
  hi: {
    /* ひ — a wide grin */
    h: `<circle cx="42" cy="12" r="4.5"/><circle cx="70" cy="12" r="4.5"/>`,
    /* ヒ — the heel of a shoe from the side */
    k: `<path d="M21 11 H47 V37 Q89 39 97 72 V95 H21Z"/>`,
  },
  fu: {
    /* ふ — Mount Fuji with two clouds beside it */
    h: `<path d="M2 104 L48 6 L102 104"/>`,
    /* フ — the bare slope of Fuji in one stroke */
    k: `<path d="M78 27 L105 93" stroke-dasharray="5 5"/><path d="M6 97 H106"/>`,
  },
  he: {
    /* へ — a hill you hike over */
    h: `<circle cx="40" cy="17" r="4.5"/><path d="M40 22 V32 M33 26 H47"/><circle cx="87" cy="24" r="9"/>`,
    /* ヘ — the same hill: the one freebie in the chart */
    k: `<circle cx="40" cy="17" r="4.5"/><path d="M40 22 V32 M33 26 H47"/><circle cx="87" cy="24" r="9"/>`,
  },
  ho: {
    /* ほ — the は house plus an antenna: Santa on the roof */
    h: `<path d="M6 28 L52 -1 L102 24"/><text x="70" y="108" font-size="12" ${T}>ho ho</text>`,
    /* ホ — a totem pole with two arms */
    k: `<rect x="42" y="-1" width="24" height="17"/><path d="M49 7 h2 M57 7 h2"/><path d="M24 97 H82"/>`,
  },
  ma: {
    /* ま — Mama with two arms out and a bun in her hair */
    h: `<circle cx="56" cy="6" r="7.5"/><path d="M27 34 L18 25 M82 28 L91 19"/>`,
    /* マ — an open mouth with the tongue showing */
    k: `<path d="M15 32 Q52 114 87 27"/>`,
  },
  mi: {
    /* み — a mermaid's tail curling under her */
    h: `<circle cx="29" cy="14" r="8.5"/><path d="M57 96 L41 107 M57 96 L67 109"/>`,
    /* ミ — three strokes, and mi means three */
    k: `<text x="84" y="28" font-size="24" ${T}>3</text>`,
  },
  mu: {
    /* む — a cow face: muuu */
    h: `<path d="M27 22 Q12 12 20 1 M48 16 Q61 8 55 -1"/><text x="68" y="106" font-size="12" ${T}>muuu</text>`,
    /* ム — a muzzle, or a scoop tipped forward */
    k: `<path d="M56 22 L69 3"/><path d="M29 79 Q56 98 85 77"/>`,
  },
  me: {
    /* め — an eye with a lash: め means eye */
    h: `<circle cx="58" cy="62" r="7.5" ${DOT}/><path d="M62 18 L64 5 M77 26 L86 15"/>`,
    /* メ — X marks the spot on a treasure map */
    k: `<rect x="7" y="7" width="96" height="96" rx="4"/><path d="M14 30 Q30 46 42 34" stroke-dasharray="4 4"/>`,
  },
  mo: {
    /* も — a fishing hook with two more worms on it */
    h: `<path d="M49 12 V-4"/><circle cx="49" cy="14" r="3"/><path d="M80 58 L71 50"/>`,
    /* モ — the same hook, straightened out */
    k: `<path d="M50 21 V-2"/><circle cx="50" cy="24" r="3"/>`,
  },
  ya: {
    /* や — a yacht with mast and sail */
    h: `${WATER}<path d="M33 22 L6 79 H45"/>`,
    /* ヤ — the same yacht, sail only */
    k: `${WATER}<path d="M42 20 L90 83 H55"/>`,
  },
  yu: {
    /* ゆ — a yo-yo at the end of its string */
    h: `<circle cx="54" cy="52" r="36"/><path d="M58 16 V-4"/>`,
    /* ユ — a U-magnet lying on its side */
    k: `<path d="M22 28 L9 21 M22 36 H7 M22 44 L9 51"/>`,
  },
  yo: {
    /* よ — someone doing yoga, folded over their knees */
    h: `<circle cx="55" cy="6" r="6.5"/><path d="M10 105 H100"/>`,
    /* ヨ — a comb with three teeth */
    k: `<path d="M27 30 Q16 35 5 28 M27 53 Q16 58 5 51 M22 79 Q12 84 3 77"/>`,
  },
  ra: {
    /* ら — a rabbit sitting up, one ear laid back */
    h: `<path d="M34 16 Q21 1 15 14"/><circle cx="50" cy="48" r="2.6" ${DOT}/><circle cx="27" cy="93" r="6.5"/>`,
    /* ラ — a bowl of ramen on a table */
    k: `<path d="M46 14 Q51 8 46 1 M62 13 Q67 7 62 0"/><path d="M6 99 H104"/>`,
  },
  ri: {
    /* り — two banks of a river */
    h: `<path d="M46 38 Q53 33 60 38 M46 54 Q53 49 60 54 M46 70 Q53 65 60 70"/>`,
    /* リ — the same river, straightened */
    k: `<path d="M44 30 Q53 25 62 30 M44 46 Q53 41 62 46 M44 62 Q52 57 60 62"/>`,
  },
  ru: {
    /* る — a route that loops back on itself */
    h: `<circle cx="46" cy="86" r="12"/><path d="M25 14 L34 22 L43 13"/>`,
    /* ル — two legs running that route */
    k: `<circle cx="46" cy="8" r="8.5"/><path d="M0 58 H13 M-2 72 H11"/>`,
  },
  re: {
    /* れ — a ribbon streaming off to the side */
    h: `<path d="M34 13 Q22 -1 18 12 Q24 22 34 13 Q46 -1 50 12 Q44 22 34 13"/>`,
    /* レ — a ramp, or a hockey stick */
    k: `<ellipse cx="72" cy="90" rx="10" ry="4.5"/><path d="M6 99 H104"/>`,
  },
  ro: {
    /* ろ — a road with no loop: dead end */
    h: `<path d="M36 103 H70"/><path d="M39 98 V108 M67 98 V108"/>`,
    /* ロ — a robot's square head */
    k: `<circle cx="44" cy="51" r="4"/><circle cx="62" cy="50" r="4"/><path d="M44 65 H62"/><path d="M53 31 V15"/><circle cx="53" cy="11" r="3.5"/>`,
  },
  wa: {
    /* わ — a whale with a curl of spout */
    h: `<path d="M72 34 Q66 15 53 18 M74 34 Q82 15 95 20"/><circle cx="79" cy="58" r="2.6" ${DOT}/>`,
    /* ワ — an open mouth: wah! */
    k: `<path d="M88 22 L100 12 M92 36 H106 M88 50 L100 60"/>`,
  },
  wo: {
    /* を — an ox with horns, dragging a yoke behind it */
    h: `<path d="M38 22 Q25 8 35 -2 M62 18 Q75 6 67 -3"/>`,
    /* ヲ — essentially never used: recognise it, don't drill it */
    k: `<circle cx="55" cy="56" r="49" stroke-dasharray="3 6"/>`,
  },
  n: {
    /* ん — a lazy cursive n */
    h: `<text x="74" y="38" font-size="30" font-style="italic" ${T}>n</text>`,
    /* ン — a wink: one eye, one lash sweeping up */
    k: `<circle cx="56" cy="56" r="49"/><circle cx="75" cy="30" r="4" ${DOT}/>`,
  },
};
})();
