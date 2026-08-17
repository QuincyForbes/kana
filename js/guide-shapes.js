/* Mnemonic shape overlays — red sketch lines drawn over the glyph so the
   resemblance is visible, not just described. Keyed by romaji, one entry
   per script. Coordinates live in a 120×120 viewBox with the glyph at
   font-size 86 centred on (60,63). Rows are added incrementally. */
const SHAPES = {
  a: {
    /* あ — an apple: the loop is the fruit, the cross is the stem */
    h: `<circle cx="60" cy="74" r="27"/>
        <path d="M60 47 V30"/>
        <path d="M60 34 Q74 24 84 32 Q74 40 60 34 Z"/>`,
    /* ア — an axe head with the handle slanting off */
    k: `<path d="M30 30 Q56 18 84 28 L80 50 Q56 42 34 50 Z"/>
        <path d="M60 50 Q52 78 32 102"/>`,
  },
  i: {
    /* い — two icicles hanging off a gutter */
    h: `<path d="M20 26 H100"/>
        <path d="M38 30 Q42 60 40 86 Q34 60 34 30"/>
        <path d="M82 30 Q86 48 84 62 Q78 48 78 30"/>`,
    /* イ — an easel leg propping up a canvas */
    k: `<rect x="50" y="24" width="40" height="32" rx="2"/>
        <path d="M66 56 L92 102"/>`,
  },
  u: {
    /* う — a duck in profile, beak tipped up */
    h: `<circle cx="52" cy="46" r="3" fill="var(--shu)"/>
        <path d="M64 30 L82 22 L70 38"/>
        <path d="M18 96 Q40 90 60 96 Q82 102 102 96"/>`,
    /* ウ — a roof with a chimney: you're under it going ooh */
    k: `<path d="M40 70 V100 H82 V70"/>
        <rect x="55" y="80" width="13" height="20"/>
        <path d="M64 16 Q70 10 66 4 M70 18 Q76 12 72 6"/>`,
  },
  e: {
    /* え — a swan: long neck, flat back on the water */
    h: `<circle cx="42" cy="26" r="3" fill="var(--shu)"/>
        <path d="M34 30 L22 26 L34 22"/>
        <path d="M14 98 Q40 92 60 98 Q84 104 106 98"/>`,
    /* エ — an I-beam girder hanging from a crane cable */
    k: `<path d="M60 2 V24"/>
        <path d="M60 24 Q52 30 58 34"/>
        <path d="M22 106 H44 M50 106 H62"/>`,
  },
  o: {
    /* お — a golf ball flying off the tee, flag flicking right */
    h: `<circle cx="56" cy="76" r="24"/>
        <path d="M88 26 V44"/>
        <path d="M88 26 L106 32 L88 38"/>`,
    /* オ — an oar dipping into the water */
    k: `<path d="M40 72 Q28 92 24 106 Q40 98 48 82 Z"/>
        <path d="M70 96 Q84 90 100 96"/>`,
  },
};
