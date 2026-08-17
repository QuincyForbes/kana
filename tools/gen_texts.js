// Collect every spoken text in the app (syllables, phrases, kanji readings,
// example words) into texts.json for gen_audio.py.
//   node tools/gen_texts.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const kanaData = fs.readFileSync(path.join(root, 'js/kana-data.js'), 'utf8');
const trainerData = fs.readFileSync(path.join(root, 'js/trainer-data.js'), 'utf8');
const { DATA, KANJI, GOJU, DAKU, YOON, EXTRA } =
  new Function(kanaData + trainerData + '; return {DATA, KANJI, GOJU, DAKU, YOON, EXTRA};')();
const WORDS = new Function(
  fs.readFileSync(path.join(root, 'js/guide-words.js'), 'utf8') + '; return WORDS;')();

const texts = new Set();
for (const rows of [GOJU, DAKU, YOON])
  for (const [, cells] of rows)
    for (const c of cells) if (c) texts.add(c[0]);           // hiragana twin
for (const [k] of EXTRA) texts.add(k);                       // katakana-only combos
for (const [, , rows] of DATA)
  for (const [kana] of rows) texts.add(kana.join(''));       // phrases
for (const [, furi] of KANJI) texts.add(furi);               // kanji readings
for (const list of Object.values(WORDS))
  for (const [w] of list) texts.add(w);                      // example words

fs.writeFileSync(path.join(__dirname, 'texts.json'), JSON.stringify([...texts], null, 1));
console.log(texts.size, 'texts -> tools/texts.json');
