// Browser smoke test — drives the real pages in Chromium and fails on any
// console error, uncaught exception or broken same-origin request. It covers
// the stateful flows the node tests can't reach: introductions, grading and
// undo, typed answers, view switching, collecting cards into decks, export →
// import, the sprint, the theme toggle, the guide's modal, and loading
// offline through the worker.
//
//   npm install --no-save --no-package-lock playwright@1 && npx playwright install chromium
//   node tools/smoke.mjs
//
// Playwright is deliberately not a repo dependency (the site has none); CI
// installs it for this job only. Set SMOKE_CHANNEL=chrome or msedge to use
// a browser that is already installed instead of downloading Chromium.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import('playwright');

/* ---- a static server for the repo ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

/* ---- browser + bookkeeping ---- */
/* a fake microphone, already allowed, so the Speak view can record */
const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL || undefined,
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const context = await browser.newContext({ acceptDownloads: true, permissions: ['microphone'] });
const page = await context.newPage();
const problems = [], dialogs = [];
let failed = 0;
const check = (ok, label) => { if (ok) console.log(`✓ ${label}`); else { failed++; console.error(`✗ ${label}`); } };
page.on('pageerror', (e) => problems.push(`exception on ${page.url()}: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && (m.location().url || base).startsWith(base)) problems.push(`console error on ${page.url()}: ${m.text()}`);
});
page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) problems.push(`${r.status()} ${r.url()}`); });
page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
const open = async (path) => { await page.goto(base + path); await page.waitForLoadState('load'); };
const card = () => page.evaluate(() => QuizSession.state.current && QuizSession.state.current.id);
/* the stored record as a string that doesn't depend on key order */
const records = () => page.evaluate(() => JSON.stringify(
  Object.entries(Srs.all()).sort().map(([id, r]) => [id, Object.entries(r).sort()])));
const tmp = await mkdtemp(join(tmpdir(), 'kana-smoke-'));

try {
  /* ---- every page loads, with the shared header ---- */
  for (const p of ['index.html', 'guide.html', 'trainer.html', 'mnemonics.html']) {
    await open(p);
    check(await page.locator('#sitebar .brand').count() === 1 && await page.locator('#themebtn').count() === 1, `${p} loads with the site header`);
  }
  await open('404.html');
  check((await page.title()).includes('404'), '404.html loads');

  /* ---- one look: the same background and an identical header everywhere ---- */
  const looks = [];
  for (const p of ['index.html', 'guide.html', 'trainer.html', 'mnemonics.html']) {
    await open(p);
    await page.evaluate(() => document.fonts.ready);
    looks.push(await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round).join(','); };
      return JSON.stringify([body.backgroundColor, body.backgroundImage, body.backgroundSize,
        box('#sitebar'), box('#sitebar .brand'), box('#sitebar nav'), box('#themebtn')]);
    }));
  }
  check(new Set(looks).size === 1, 'every page has the same background and a pixel-identical header');
  for (const url of ['trainer.html#quiz', 'trainer.html#study', 'trainer.html#progress', 'guide.html#pron']) {
    await open(url);
    await page.waitForTimeout(150);
    check(await page.evaluate(() => scrollY === 0 && document.getElementById('sitebar').getBoundingClientRect().top === 0),
      `${url} opens at the top with the header in view`);
  }

  /* ---- theme toggle flips and is remembered ---- */
  await open('index.html');
  const before = await page.getAttribute('html', 'data-theme');
  await page.click('#themebtn');
  const after = await page.getAttribute('html', 'data-theme');
  await page.reload();
  check(after !== before && await page.getAttribute('html', 'data-theme') === after, 'theme toggle flips and survives a reload');

  /* ---- guide: panels, chart → modal → next ---- */
  await open('guide.html');
  for (const id of ['tricky', 'rules', 'grammar', 'pron', 'drill-sec', 'plan', 'chart']) await page.click(`.jumpnav a[href="#${id}"]`);
  check(await page.locator('#chart').isVisible(), 'guide panels switch');
  await page.locator('#grid .k-cell').first().click();
  const romaji = () => page.locator('#detail .romaji-big').textContent();
  const first = await romaji();
  await page.keyboard.press('ArrowRight');
  check(await page.locator('#detail-modal[open]').count() === 1 && await romaji() !== first, 'chart cell opens the detail modal; arrow keys walk it');
  check(await page.locator('#grid .k-cell', { hasText: 'を' }).locator('.gr').textContent() === '(w)o', 'を is labelled (w)o in the chart');
  await page.locator('#detail .wordadd').first().click();
  await page.fill('.deckmenu .dm-new input', 'Words');
  await page.click('.deckmenu .dm-new button');
  await page.keyboard.press('Escape');
  check(await page.locator('.deckmenu').count() === 0 && await page.locator('#detail-modal[open]').count() === 1
    && await page.evaluate(() => Decks.get('Words').cards.length) === 1, 'an example word goes into a new deck; Escape closes the menu, not the modal');
  await page.click('#detail-close');

  /* ---- trainer: grade, undo, typed answers, view switches ---- */
  await open('trainer.html#quiz');
  await page.selectOption('#qdeck', 'Hiragana');
  const c1 = await card();
  check(await page.locator('.qcard.intro').count() === 1, 'a card never seen before is introduced, not asked');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Space');
  check(await card() === c1 && await page.locator('.qcard.intro').count() === 0, '…and comes back as a question a few cards later');
  await page.keyboard.press('Space');
  await page.locator('#bGood').waitFor();
  await page.keyboard.press('2');
  const c2 = await card();
  check(c1 && c2 && c1 !== c2 && (await records()).includes(c1), 'reveal + "got it" grades the card and deals the next');
  await page.keyboard.press('u');
  check(await card() === c1 && !(await records()).includes(c1), 'undo brings the card back and removes its record');

  for (let i = 0; i < 4; i++) { await page.click('#tab-progress'); await page.click('#tab-quiz'); }
  check(await card() === c1, 'switching views keeps the card on screen');

  await page.selectOption('#qmode', 'type');
  await page.fill('#qtype', await page.evaluate(() => answerRom(QuizSession.state.current)));
  await page.keyboard.press('Enter');
  check(await page.locator('.verdict.ok').count() === 1, 'typed answer is checked and accepted');
  await page.keyboard.press('2');
  await page.selectOption('#qmode', 'match');
  check(await page.locator('.qchoices .qc').count() === 4, 'match mode offers four choices');
  /* listen, then pick the kana: options, a remembered mix-up, number keys */
  await page.selectOption('#qmode', 'hear');
  check(await page.locator('.qchoices .qc').count() === 4 && await page.locator('#bReplay').count() === 1, 'listen-and-pick offers four kana and a replay');
  const heard = await page.evaluate(() => QuizSession.state.current.char);
  await page.locator('.qchoices .qc', { hasNotText: heard }).first().click();
  check(await page.locator('.verdict.no').count() === 1 && await page.evaluate(() => Object.keys(Confuse.all()).length) === 1,
    'a wrong pick is marked and remembered as a mix-up');
  await page.keyboard.press('1');
  await page.selectOption('#qmode', 'mixed');
  await page.keyboard.press('1');
  check(await page.evaluate(() => !QuizSession.state.current || ['flip', 'type', 'listen', 'match', 'hear'].includes(QuizSession.state.mode)), 'mixed mode settles on a concrete format for each card');
  await page.selectOption('#qmode', 'flip');

  /* Study: romaji fades under characters you have learned; Readable now filters */
  await page.evaluate(() => { for (const id of ['hg-こ', 'hg-ん']) Srs.grade(CARDS.find((c) => c.id === id), true, {}); });
  await page.click('#tab-study');
  await page.waitForTimeout(350); /* the fade is a short transition */
  const faded = await page.evaluate(() => {
    const el = document.querySelector('.c[data-cid="hg-こ"].kn .r');
    return !!el && getComputedStyle(el).opacity === '0';
  });
  check(faded, 'romaji under a learned character fades out in Study');
  await page.click('#tP');
  check(await page.evaluate(() => document.body.classList.contains('pitch') && document.querySelectorAll('.row[data-pitch] .c.hi').length > 20), 'Pitch: words carry a high/low contour');
  await page.click('#tP');
  await page.click('#tD');
  const total = await page.locator('#out .row').count();
  const some = await page.locator('#out .row:not([hidden])').count();
  await page.evaluate(() => CARDS.filter((c) => c.id.startsWith('hg-') && c.char.length === 1).forEach((c) => Srs.grade(c, true, {})));
  await page.click('#tab-quiz'); await page.click('#tab-study');
  const most = await page.locator('#out .row:not([hidden])').count();
  check(some < total && most > some, 'Readable now: phrases appear as their characters are learned');
  await page.click('#tD');

  /* Speak: shadowing with a recording */
  await page.click('#tab-shadow');
  check(await page.locator('#shadow-card .qkana').isVisible(), 'the Speak view offers a phrase to say');
  await page.click('#sh-rec');
  await page.waitForTimeout(900);
  await page.click('#sh-rec');
  await page.waitForSelector('#sh-mine:not([disabled])');
  await page.click('#sh-mine');
  check(await page.locator('#sh-both').isEnabled(), 'a recording can be played back against the voice');
  await page.check('#sh-pitch');
  check(await page.locator('#shadow-card .pk.hi').count() > 0 && await page.locator('#shadow-card .pk.drop').count() <= 1, 'Speak can show the pitch contour of the phrase');
  await page.uncheck('#sh-pitch');
  await page.click('#sh-next');
  check(await page.locator('#sh-mine').isDisabled(), 'the next phrase starts clean — the recording is dropped');

  await page.click('#tab-study');
  check(await page.locator('#out .row').count() > 200, 'study view lists the phrases');
  await page.locator('#out .addbtn').first().click();
  await page.fill('.deckmenu .dm-new input', 'Picked');
  await page.click('.deckmenu .dm-new button');
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => deckMembers('Picked').length) === 1
    && await page.locator('#qdeck option', { hasText: 'Picked' }).count() === 1, 'a phrase is collected into a new deck from Study, and the quiz can pick it');
  await page.click('#tab-progress');
  check(await page.locator('#pstats .ptotals').isVisible() && await page.locator('#pbars .pdeck').count() > 20, 'progress view renders totals and decks');

  /* ---- sprint starts and stops ---- */
  await page.click('#tab-quiz');
  await page.click('#qsprint');
  const sprinting = await page.locator('#sprint-box').isVisible();
  await page.click('#qsprint');
  check(sprinting && await page.locator('#sprint-box').isHidden(), 'sprint starts and stops');

  /* ---- export → change something → import restores it ---- */
  await page.evaluate(() => { document.getElementById('qdata').open = true; });
  const saved = await records();
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#qexport')]);
  const backup = join(tmp, 'backup.json');
  await download.saveAs(backup);
  await page.evaluate(() => Srs.grade(CARDS.find((c) => c.id === 'kt-ア'), true, {}));
  check(await records() !== saved, '(state changed after the export)');
  await Promise.all([page.waitForEvent('load'), page.setInputFiles('#qfile', backup)]);
  check(await records() === saved && !dialogs.some((d) => d.includes("isn't a Kana Trainer export")), 'importing the backup restores the exported record');

  /* ---- custom deck: add it, miss a card, finish — summary and progress still render ---- */
  await page.evaluate(() => { document.getElementById('mydecks').open = true; });
  await page.fill('#md-name', 'Smoke deck');
  await page.fill('#md-csv', '日本, にほん, Japan\n水, , water');
  check(await page.inputValue('#md-csv') === '日本, にほん, Japan\n水, , water', 'the CSV box accepts spaces and new lines');
  await Promise.all([page.waitForEvent('load'), page.click('#md-import')]);
  await page.evaluate(() => { document.getElementById('qopts').hidden = false; });
  await page.uncheck('#qlearn');
  await page.evaluate(() => document.activeElement.blur()); /* or Space would re-tick the box */
  await page.selectOption('#qdeck', 'Smoke deck');
  check(await page.locator('.qcard.intro').count() === 0, 'introductions can be switched off');
  await page.keyboard.press('Space'); await page.keyboard.press('1');
  for (let i = 0; i < 8 && await page.locator('#bShow').count(); i++) { await page.keyboard.press('Space'); await page.keyboard.press('2'); }
  check(await page.locator('.qsummary').count() === 1 && (await page.locator('.qsummary').textContent()).includes('日本'), 'session summary lists the missed custom card');
  await page.click('#tab-progress');
  check((await page.locator('#pbars').textContent()).includes('Smoke deck'), 'progress view includes the custom deck');

  /* ---- offline: install the worker, cut the network, load another page ---- */
  await open('index.html?sw=1');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.goto(base + 'trainer.html#quiz');
  check(await page.evaluate(() => typeof CARDS !== 'undefined' && CARDS.length > 400), 'trainer loads offline through the service worker');
  await context.setOffline(false);

  check(problems.length === 0, 'no console errors, exceptions or failed requests');
  problems.forEach((p) => console.error('   ' + p));
} catch (e) {
  failed++;
  console.error(`✗ smoke test aborted: ${e.message}`);
  problems.forEach((p) => console.error('   ' + p));
} finally {
  await browser.close();
  server.close();
  await rm(tmp, { recursive: true, force: true });
}
if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nsmoke test passed');
