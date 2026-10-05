# かな — Japanese Kana

Two self-contained, offline-friendly HTML apps for learning hiragana and katakana. No build step, no dependencies — open [index.html](index.html) in a browser.

## Pages

- **[index.html](index.html)** — landing page linking the apps; returning learners see what's due, what's known and their streak.
- **[guide.html](guide.html)** — the learning guide: interactive gojūon chart with per-character mnemonics, stroke order and tracing, look-alike pairs (シ/ツ, ン/ソ, …), the four modifier rules (dakuten, handakuten, small ゃゅょ, small っ / ー), starter grammar, a pronunciation section (mora timing, vowel devoicing, pitch accent) with a minimal-pair listening drill, and audio throughout. Practice itself lives in the trainer; the chart shades each square from your quiz record.
- **[trainer.html](trainer.html)** — the practice app: survival phrases split one kana per box, 30 survival kanji, single-script and combined kana charts, and a spaced-repetition quiz with separate decks for hiragana, katakana, combos, phrases, kanji and your own CSV decks. Modes: flip, type the romaji, listen & type, match ひらがな ↔ カタカナ, plus a 60-second sprint. Progress saves to `localStorage`; export/import as JSON under **Backup & reset** on the Quiz tab.
- **[mnemonics.html](mnemonics.html)** — printable sheet: all 92 characters with both scripts' memory hooks, print-formatted.

Every page shares one header (page links and a light/dark toggle). The theme follows the system setting until you pick one; the choice is remembered per browser.

## Structure

```
index.html / guide.html / trainer.html / mnemonics.html   markup only
css/site.css        shared chrome: site header, theme toggle, toasts
css/guide.css, css/trainer.css                            page styles + palettes
js/theme.js         applies the light/dark theme (loaded in <head>, before CSS)
js/site.js          renders the shared header; toast helper
js/kana-data.js     shared syllabary tables + per-sound guide content
js/srs.js           shared scheduler + record helpers (validation, id migration)
js/legacy-ids.js    frozen map of pre-v22 positional card ids (migration only)
js/strokes.js       stroke-order paths (KanjiVG, CC BY-SA)
js/guide-data.js    K chart + ROM2KANA (derived from kana-data)
js/guide-words.js   example words per sound + minimal pairs
js/guide.js         guide logic (chart, detail, audio, listening drill)
js/trainer-data.js  DATA (phrases), KANJI, MNEM
js/trainer.js       trainer engine (study, SRS, quiz, progress)
audio/ja/           492 Nanami (female) clips, filename = spoken text
audio/ja-m/         492 Keita (male) clips — toggle in either app
tools/              audio generation (gen_texts.js, gen_audio.py), tests, bump.js
```

No build step — plain files, edit and reload.

## Scheduling

Leitner boxes 0–5 (10 min, 1 d, 3 d, 7 d, 21 d, 45 d); past the top box the interval grows by a per-card ease factor, capped at a year. A miss resets the card to box 0. A card counts as **known** once it passes the review that follows its 7-day gap.

- **New cards are limited per day** (default 10), counted when a card is first graded — reloading or switching tabs never spends the allowance. "Learn 5 more" on the done screen goes past it on request.
- **The 60s sprint and "drill these now" are practice**, not review: a hit can't promote a card ahead of its due date and unseen cards stay unseen; a miss on a card you've met still counts.

## Card ids

Ids are built from content, never position: `hg-あ` / `kt-ア` / `kx-ファ` for characters, `p:<kana>` for phrases, `k:<kanji>` for kanji, `c:<deck>:<front>` for custom decks. Adding, removing or reordering rows in the data files therefore can't move anyone's progress onto a different card. Records written before v22 (`s3r0`, `k5`, `u:Deck:7`) are renamed on load and on import through `migrateIds` and the frozen table in `js/legacy-ids.js` — don't edit or regenerate that file.

Changing the *text* of an existing phrase gives it a new id (its old record is orphaned), which is the honest outcome: it's a different card.

## Audio

`audio/ja/` (Nanami, female) and `audio/ja-m/` (Keita, male) hold a clip for every kana syllable, phrase, kanji reading, example word and minimal pair, generated with Microsoft neural voices via `edge-tts` at rate −10%. Both apps try the preferred voice, then the other, then browser TTS. Custom decks and the personalised intro phrases have no clips and go straight to browser TTS. Slow-audio (0.75×) and voice toggles live in both apps.

To regenerate: `node tools/gen_texts.js` then `python tools/gen_audio.py` (add `--voice ja-JP-KeitaNeural --out audio/ja-m` for the male set).

## Tests

```
node tools/test-romaji.mjs     answer checking: romaji aliases, long vowels, kana/IME input
node tools/test-trainer.mjs    numbers, scheduler, practice grading, record validation, id migration, custom decks
```

Both run in CI along with a check that every page carries the same `?v=N`. They exercise the pure helpers; the stateful quiz flow (queueing, undo, import) has no automated coverage yet — see the roadmap.

## localStorage keys

| Key | Holds |
|---|---|
| `kanaTrainerProgress.v1` | SRS record per card id: `{b: box, d: due-ms, s: seen, l: lapses, e?: ease, iv?: interval-days}` |
| `kanaTrainerSettings.v1` | quiz settings (deck, direction, mode, new cards/day, speak) |
| `kanaTrainerDays.v1` | reviews per day `{"YYYY-MM-DD": n}` — streak and heatmap |
| `kanaTrainerNewDay.v1` | new cards introduced today `{day, n}` |
| `kanaTrainerCustom.v1` | custom CSV decks `[{name, cards: [{f, r, m}]}]` |
| `kanaTrainerYou.v1` | name / country / job for the personalised intro phrases |
| `kanaTrainerSprint.v1` | best 60s sprint score per deck |
| `kanaTrainerStudySec.v1`, `kanaTrainerSeenSec.v1` | last study section; sections already visited |
| `kanaTrainerHello.v1` | first-visit pointer dismissed |
| `kanaGuidePanel.v1` | last guide panel |
| `kanaVoice.v1`, `kanaGuideAudio.v1` | voice (f/m) and slow-audio preference, shared by both apps |
| `kanaTheme.v1` | `light` / `dark`; absent = follow the system |

Bump the `.v1` suffix and migrate in code if a schema ever changes shape. Asset URLs carry a `?v=N` query — run `node tools/bump.js` when shipping JS/CSS changes so cached pages don't mix versions.

## License

Code is MIT; written content (mnemonics, decks, notes) is CC BY 4.0; audio was synthesised with Microsoft Edge neural voices via edge-tts. See [LICENSE](LICENSE).

## Notes

- Web fonts load from Google Fonts when online; pages fall back to system Japanese fonts offline.
- Quiz progress lives in the browser profile that opened the page — use **Export progress** in the trainer before clearing browser data or switching machines.

## Provenance

Consolidated from `~/Downloads`: `kana-guide_1.html` (superset of `kana-guide.html`, kept as `guide.html`) and `kana-trainer.html` (kept as `trainer.html`).
