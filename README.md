# かな — Japanese Kana

Two self-contained, offline-friendly HTML apps for learning hiragana and katakana. No build step, no dependencies — open [index.html](index.html) in a browser.

## Pages

- **[index.html](index.html)** — landing page linking the apps; returning learners see what's due, what's known and their streak.
- **[guide.html](guide.html)** — the learning guide: interactive gojūon chart with per-character mnemonics, stroke order and tracing, look-alike pairs (シ/ツ, ン/ソ, …), the four modifier rules (dakuten, handakuten, small ゃゅょ, small っ / ー), starter grammar, a pronunciation section (mora timing, vowel devoicing, pitch accent) with a minimal-pair listening drill, and audio throughout. Practice itself lives in the trainer; the chart shades each square from your quiz record.
- **[trainer.html](trainer.html)** — the practice app: survival phrases split one kana per box, 30 survival kanji, single-script and combined kana charts, and a spaced-repetition quiz with separate decks for hiragana, katakana, combos, phrases, kanji and your own CSV decks. Modes: flip, type the romaji, listen & type, match ひらがな ↔ カタカナ, plus a 60-second sprint. Progress saves to `localStorage`; export/import as JSON under **Backup & reset** on the Quiz tab.
- **[mnemonics.html](mnemonics.html)** — printable sheet: all 92 characters with both scripts' memory hooks, print-formatted.

Every page shares one header (page links and a light/dark toggle). The theme follows the system setting until you pick one; the choice is remembered per browser. The site is installable and works offline — see [Offline](#offline).

## Structure

```
index.html / guide.html / trainer.html / mnemonics.html   markup only
manifest.webmanifest, sw.js, icons/                       install + offline
css/site.css        shared chrome: site header, theme toggle, toasts
css/guide.css, css/trainer.css                            page styles + palettes
js/theme.js         applies the light/dark theme (loaded in <head>, before CSS)
js/site.js          shared header, toasts, service-worker registration, install prompt
js/store.js         the one place that touches localStorage: keys, safe wrapper, audio prefs
js/srs.js           FSRS scheduler + record helpers (validation, id migration) — pure
js/kana-data.js     shared syllabary tables + per-sound guide content
js/legacy-ids.js    frozen map of pre-v22 positional card ids (migration only)

js/guide-data.js    K chart + ROM2KANA (derived from kana-data)
js/guide-words.js   example words per sound + minimal pairs
js/guide-shapes.js  mnemonic sketches, drawn over the strokes
js/strokes.js       stroke-order paths (KanjiVG, CC BY-SA)
js/guide.js         guide logic (chart, detail, audio, listening drill)

js/trainer-data.js      DATA (phrases), KANJI, MNEM
js/trainer-romaji.js    answer checking, number readings — pure
js/trainer-cards.js     CARDS, decks, custom CSV decks
js/trainer-session.js   Srs + QuizSession: the quiz engine, no DOM
js/trainer-ui.js        DOM helpers, speech, play-all
js/trainer-study.js / trainer-quiz.js / trainer-progress.js   the three views
js/trainer.js           view switching + start-up

audio/ja/           492 Nanami (female) clips, filename = spoken text
audio/ja-m/         492 Keita (male) clips — toggle in either app
tools/              audio + icon generation, tests, bump.js
```

No build step and no modules — plain scripts loaded in order, sharing globals. Edit and reload.

## Scheduling

The trainer schedules with **FSRS-4.5** (default parameters). Each card carries a *stability* — the number of days until recall is expected to fall to 90% — and a *difficulty* from 1 to 10; every review updates both, and the next review is timed for 90% retention, capped at a year. The two grades map to FSRS's Again and Good.

- A card you know on sight comes back after 4, 15, 49, 146 days; one that started with a miss after 1, 2, 6, 16, 39.
- A miss comes back within minutes in the same session; what follows is set by the (now smaller) stability.
- A card counts as **known** once its next review is three weeks or more away. The six dots on a card show the same thing as a level.
- **New cards are limited per day** (default 10), counted when a card is first graded — reloading or switching tabs never spends the allowance. "Learn 5 more" on the done screen goes past it on request.
- **The 60s sprint and "drill these now" are practice**, not review: a hit can't promote a card ahead of its due date and unseen cards stay unseen; a miss on a card you've met still counts.

Records written by the older fixed-interval scheduler convert on their next review; nothing in storage needs rewriting.

## Card ids

Ids are built from content, never position: `hg-あ` / `kt-ア` / `kx-ファ` for characters, `p:<kana>` for phrases, `k:<kanji>` for kanji, `c:<deck>:<front>` for custom decks. Adding, removing or reordering rows in the data files therefore can't move anyone's progress onto a different card. Records written before v22 (`s3r0`, `k5`, `u:Deck:7`) are renamed on load and on import through `migrateIds` and the frozen table in `js/legacy-ids.js` — don't edit or regenerate that file.

Changing the *text* of an existing phrase gives it a new id (its old record is orphaned), which is the honest outcome: it's a different card.

## Audio

`audio/ja/` (Nanami, female) and `audio/ja-m/` (Keita, male) hold a clip for every kana syllable, phrase, kanji reading, example word and minimal pair, generated with Microsoft neural voices via `edge-tts` at rate −10%. Both apps try the preferred voice, then the other, then browser TTS. Custom decks and the personalised intro phrases have no clips and go straight to browser TTS. Slow-audio (0.75×) and voice toggles live in both apps.

To regenerate: `node tools/gen_texts.js` then `python tools/gen_audio.py` (add `--voice ja-JP-KeitaNeural --out audio/ja-m` for the male set).

## Offline

`sw.js` caches the pages and their scripts on first visit, so the site loads without a connection afterwards and can be installed as an app (`manifest.webmanifest`, icons from `node tools/gen_icons.js`). Pages are fetched network-first, so a deploy shows up on the next load; versioned assets and audio are cache-first. Audio clips are kept as they are played — the trainer's **Offline & install** panel fetches a whole voice (about 6 MB) up front.

The worker is not registered on `localhost`, so edits show up without a version bump; append `?sw` to a URL to exercise it locally.

## Tests

```
node tools/test-romaji.mjs     answer checking: romaji aliases, long vowels, kana/IME input
node tools/test-trainer.mjs    numbers, the FSRS scheduler, record validation, id migration, custom decks
node tools/test-session.mjs    the quiz engine: queue, allowance, grading, undo, drills, sprint, decks
node tools/smoke.mjs           the real pages in Chromium: every flow above, plus import/export and offline
```

The first three load the app's DOM-free scripts through `tools/load-app.mjs` and need nothing but node. The smoke test needs Playwright, which is deliberately not a repo dependency — CI installs it for that job only (see the header of `tools/smoke.mjs` to run it locally). CI also checks that every page and `sw.js` carry the same version.

## localStorage keys

| Key | Holds |
|---|---|
| `kanaTrainerProgress.v1` | SRS record per card id: `{b: level, d: due-ms, s: seen, l: lapses, st: stability, df: difficulty, lr: last-review-ms, iv: interval-days}` |
| `kanaTrainerSettings.v1` | quiz settings (deck, direction, mode, new cards/day, speak) |
| `kanaTrainerDays.v1` | reviews per day `{"YYYY-MM-DD": n}` — streak and heatmap |
| `kanaTrainerNewDay.v1` | new cards introduced today `{day, n}` |
| `kanaTrainerCustom.v1` | custom CSV decks `[{name, cards: [{f, r, m}]}]` |
| `kanaTrainerYou.v1` | name / country / job for the personalised intro phrases |
| `kanaTrainerSprint.v1` | best 60s sprint score per deck |
| `kanaTrainerStudySec.v1`, `kanaTrainerSeenSec.v1` | last study section; sections already visited |
| `kanaTrainerHello.v1` | first-visit pointer dismissed |
| `kanaOfflineAudio.v1` | which voices were saved for offline use |
| `kanaGuidePanel.v1` | last guide panel |
| `kanaVoice.v1`, `kanaGuideAudio.v1` | voice (f/m) and slow-audio preference, shared by both apps |
| `kanaTheme.v1` | `light` / `dark`; absent = follow the system |

All of these are read and written through `js/store.js` (`KEYS`), which falls back to memory when storage is blocked. Bump the `.v1` suffix and migrate in code if a schema ever changes shape. Asset URLs carry a `?v=N` query — run `node tools/bump.js` when shipping JS/CSS changes; it moves the service worker's version too, which is what retires the old offline cache.

## License

Code is MIT; written content (mnemonics, decks, notes) is CC BY 4.0; audio was synthesised with Microsoft Edge neural voices via edge-tts. See [LICENSE](LICENSE).

## Notes

- Web fonts load from Google Fonts when online; pages fall back to system Japanese fonts offline.
- Quiz progress lives in the browser profile that opened the page — use **Export progress** in the trainer before clearing browser data or switching machines.

## Provenance

Consolidated from `~/Downloads`: `kana-guide_1.html` (superset of `kana-guide.html`, kept as `guide.html`) and `kana-trainer.html` (kept as `trainer.html`).
