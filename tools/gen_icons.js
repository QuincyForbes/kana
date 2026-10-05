// Draw the app icons (home screen / install) from the same KanjiVG stroke
// data the guide animates — a brush-weight か on the paper colour.
// No dependencies: strokes are rasterised here and written as PNG by hand.
//   node tools/gen_icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const STROKES = new Function(fs.readFileSync(path.join(root, 'js/strokes.js'), 'utf8') + '; return STROKES;')();

const GLYPH = 'か';
const PAPER = [0xF2, 0xF3, 0xEE], GREEN = [0x2E, 0x7D, 0x4F];
/* the glyph fills this share of the icon — inside the 80% "safe zone", so
   the same image also works as a maskable icon */
const FILL = 0.56, WEIGHT = 8.5; /* stroke width in KanjiVG units (109 box) */

/* "M x,y c dx1,dy1,dx2,dy2,dx,dy …" → a polyline (the set only uses M and c) */
function flatten(d) {
  const n = d.match(/-?\d*\.?\d+/g).map(Number);
  let x = n[0], y = n[1];
  const pts = [[x, y]];
  for (let i = 2; i + 5 < n.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = [x + n[i], y + n[i + 1], x + n[i + 2], y + n[i + 3], x + n[i + 4], y + n[i + 5]];
    for (let s = 1; s <= 20; s++) {
      const t = s / 20, u = 1 - t;
      pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
                u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
    x = x3; y = y3;
  }
  return pts;
}

function render(size) {
  const lines = STROKES[GLYPH].map(flatten);
  const all = lines.flat();
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const k = size * FILL / Math.max(maxX - minX, maxY - minY);
  const ox = size / 2 - k * (minX + maxX) / 2, oy = size / 2 - k * (minY + maxY) / 2;
  const segs = [];
  for (const pts of lines)
    for (let i = 1; i < pts.length; i++)
      segs.push([ox + k * pts[i - 1][0], oy + k * pts[i - 1][1], ox + k * pts[i][0], oy + k * pts[i][1]]);
  const half = k * WEIGHT / 2;

  const px = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      /* distance from the pixel centre to the nearest stroke segment */
      let best = Infinity;
      const cx = x + 0.5, cy = y + 0.5;
      for (const [ax, ay, bx, by] of segs) {
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1)));
        const ex = cx - ax - t * dx, ey = cy - ay - t * dy;
        const d2 = ex * ex + ey * ey;
        if (d2 < best) best = d2;
      }
      const cover = Math.max(0, Math.min(1, half - Math.sqrt(best) + 0.5)); /* 1px soft edge */
      const o = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) px[o + c] = Math.round(PAPER[c] + (GREEN[c] - PAPER[c]) * cover);
    }
  }
  return px;
}

/* minimal PNG writer: 8-bit RGB, no interlace */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();
function chunk(type, data) {
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(body));
  return Buffer.concat([head, body, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; /* 8 bits per channel, truecolour */
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = path.join(root, 'icons');
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const file = png(size, render(size));
  fs.writeFileSync(path.join(out, name), file);
  console.log(`${name}  ${size}×${size}  ${(file.length / 1024).toFixed(1)} KB`);
}
