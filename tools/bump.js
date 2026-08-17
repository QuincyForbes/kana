// Bump the ?v=N cache-bust version across all HTML files.
//   node tools/bump.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['guide.html', 'trainer.html', 'mnemonics.html'];

const current = fs.readFileSync(path.join(root, 'guide.html'), 'utf8').match(/\?v=(\d+)/);
if (!current) { console.error('no ?v=N found in guide.html'); process.exit(1); }
const next = +current[1] + 1;

for (const f of files) {
  const p = path.join(root, f);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\?v=\d+/g, `?v=${next}`));
}
console.log(`v=${current[1]} -> v=${next} in ${files.join(', ')}`);
