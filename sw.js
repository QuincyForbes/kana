/* Service worker — makes the site installable and usable offline.

   What is cached, and how:
     pages   network first, so a deploy shows up on the next load; the cached
             copy is the fallback when offline (or when the network stalls)
     assets  cache first. Every js/css URL carries ?v=N, so a new version is
             a new URL and can't be confused with the old one
     audio   cache first, kept across versions (the clips never change).
             Clips are cached as they are played; the trainer's "Offline"
             panel can fetch a whole voice up front
     fonts   Google Fonts, stale-while-revalidate

   VERSION is bumped by tools/bump.js together with the ?v= in the pages.   */
const VERSION = 24;
const SHELL = `kana-shell-v${VERSION}`, AUDIO = 'kana-audio-v1', FONTS = 'kana-fonts-v1';
const PAGES = ['./', 'index.html', 'guide.html', 'trainer.html', 'mnemonics.html', '404.html'];
const EXTRAS = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

/* Cache each page and everything it loads. The asset list is read out of
   the pages themselves, so adding a script to a page needs no change here. */
async function precache() {
  const cache = await caches.open(SHELL);
  const assets = new Set(EXTRAS);
  await Promise.all(PAGES.map(async (page) => {
    const res = await fetch(page, { cache: 'no-cache' });
    if (!res.ok) return;
    await cache.put(page, res.clone());
    for (const m of (await res.text()).matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)) assets.add(m[1]);
  }));
  await Promise.all([...assets].map((url) => cache.add(url).catch(() => {})));
}

self.addEventListener('install', (e) => e.waitUntil(precache().then(() => self.skipWaiting())));

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const key of await caches.keys())
    if (key.startsWith('kana-shell-') && key !== SHELL) await caches.delete(key);
  await self.clients.claim();
})()));

/* network first; fall back to the cache when offline or after 4s of nothing */
async function page(req) {
  const cache = await caches.open(SHELL);
  const key = req.url.replace(/[?#].*$/, ''); /* one entry per page, whatever its query */
  const cached = async () => (await cache.match(key)) || (await cache.match('index.html')) || Response.error();
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error('slow network')), 4000)),
    ]);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch { return cached(); }
}

async function asset(req) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    /* offline and this exact version isn't cached: an older copy beats nothing */
    return (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}

/* Media elements ask for byte ranges, and Safari insists on a 206 back. The
   cache only stores whole files, so fetch and keep the whole clip (they are
   10–30 KB) and cut the requested range out of it here.                    */
async function audio(req) {
  const cache = await caches.open(AUDIO);
  let res = await cache.match(req.url);
  if (!res) {
    res = await fetch(req.url);
    if (res.ok && res.status === 200) cache.put(req.url, res.clone());
    else return res;
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!range || (!range[1] && !range[2])) return res;
  const buf = await res.arrayBuffer();
  const last = buf.byteLength - 1;
  /* "bytes=A-B", "bytes=A-" (to the end) or "bytes=-N" (the last N) */
  const start = range[1] ? +range[1] : Math.max(0, buf.byteLength - +range[2]);
  const end = range[1] && range[2] ? Math.min(+range[2], last) : last;
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${buf.byteLength}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function font(req) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') e.respondWith(page(req));
    else if (url.pathname.includes('/audio/')) e.respondWith(audio(req));
    else e.respondWith(asset(req));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(font(req));
});
