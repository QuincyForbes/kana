// Bump the ?v=N cache-bust version across all HTML files, and the service
// worker's VERSION with it (that is what retires the old offline cache).
//   node tools/bump.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['index.html', 'guide.html', 'trainer.html', 'mnemonics.html', '404.html'];

const current = fs.readFileSync(path.join(root, 'guide.html'), 'utf8').match(/\?v=(\d+)/);
if (!current) { console.error('no ?v=N found in guide.html'); process.exit(1); }
const next = +current[1] + 1;

for (const f of files) {
  const p = path.join(root, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\?v=\d+/g, `?v=${next}`));
}
const sw = path.join(root, 'sw.js');
const swSrc = fs.readFileSync(sw, 'utf8');
if (!/const VERSION = \d+;/.test(swSrc)) { console.error('no VERSION in sw.js'); process.exit(1); }
fs.writeFileSync(sw, swSrc.replace(/const VERSION = \d+;/, `const VERSION = ${next};`));
console.log(`v=${current[1]} -> v=${next} in ${files.join(', ')}, sw.js`);
