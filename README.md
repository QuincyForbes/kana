# かな — Japanese Kana

Two self-contained, offline-friendly HTML apps for learning hiragana and katakana. No build step, no dependencies — open [index.html](index.html) in a browser.

## Pages

- **[index.html](index.html)** — landing page linking the apps.
- **[guide.html](guide.html)** — the learning guide: interactive gojūon chart with per-character mnemonics, look-alike pairs (シ/ツ, ン/ソ, …), the four modifier rules (dakuten, handakuten, small ゃゅょ, small っ / ー), a pronunciation section (mora timing, vowel devoicing, pitch accent), audio playback, and a romaji typing drill (score persists per browser).
- **[trainer.html](trainer.html)** — the practice app: survival phrases split one kana per box, 30 survival kanji, single-script and combined kana charts, and a spaced-repetition quiz (Leitner boxes) with separate decks for hiragana, katakana, combos, phrases, and kanji. Progress saves to `localStorage`; export/import as JSON from the Quiz tab.
- **[mnemonics.html](mnemonics.html)** — printable sheet: all 92 characters with both scripts' memory hooks, print-formatted.

## Structure

```
index.html / guide.html / trainer.html / mnemonics.html   markup only
css/guide.css, css/trainer.css                            styles
js/guide-data.js    kana table (K), look-alikes (TRICKY), ROM2KANA audio map
js/guide.js         guide logic (chart, detail, drill, audio)
js/trainer-data.js  DATA (phrases), KANJI, GOJU/DAKU/YOON/EXTRA charts, MNEM
js/trainer.js       trainer engine (study, SRS, quiz, progress)
audio/ja/           467 Nanami (female) clips, filename = spoken text
audio/ja-m/         380 Keita (male) clips — toggle in either app
tools/              audio generation (gen_texts.js, gen_audio.py) + tests
```

No build step — plain files, edit and reload.

## Audio

`audio/ja/` (Nanami, female) and `audio/ja-m/` (Keita, male) hold a clip for every kana syllable, phrase, kanji reading, and example word, generated with Microsoft neural voices via `edge-tts` at rate −10%. Both apps try the preferred voice, then the other, then browser TTS. A slow-audio toggle (0.75×) lives in the guide.

To regenerate: `node tools/gen_texts.js` then `python tools/gen_audio.py` (add `--voice ja-JP-KeitaNeural --out audio/ja-m` for the male set). Tests: `node tools/test-romaji.mjs`.

## localStorage keys

| Key | Holds |
|---|---|
| `kanaTrainerProgress.v1` | SRS record per card id: `{b: box, d: due-ms, s: seen, l: lapses}` |
| `kanaTrainerSettings.v1` | quiz settings (deck, direction, mode, new/session, speak) |
| `kanaTrainerStudySec.v1` | last selected study section |
| `kanaGuideDrill.v1` | guide drill score + scope/direction |

Bump the `.v1` suffix and migrate in code if a schema ever changes shape. Asset URLs carry a `?v=N` query — bump it in the HTML files when shipping breaking JS/CSS changes so cached pages don't mix versions.

## License

Code is MIT; written content (mnemonics, decks, notes) is CC BY 4.0; audio was synthesised with Microsoft Edge neural voices via edge-tts. See [LICENSE](LICENSE).

## Notes

- Web fonts load from Google Fonts when online; both pages fall back to system Japanese fonts offline.
- Quiz progress lives in the browser profile that opened the file — use **Export progress** in the trainer before clearing browser data or switching machines.

## Provenance

Consolidated from `~/Downloads`: `kana-guide_1.html` (superset of `kana-guide.html`, kept as `guide.html`) and `kana-trainer.html` (kept as `trainer.html`).
