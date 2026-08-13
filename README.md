# かな — Japanese Kana

Two self-contained, offline-friendly HTML apps for learning hiragana and katakana. No build step, no dependencies — open [index.html](index.html) in a browser.

## Pages

- **[index.html](index.html)** — landing page linking the two apps.
- **[guide.html](guide.html)** — the learning guide: interactive gojūon chart with per-character mnemonics, look-alike pairs (シ/ツ, ン/ソ, …), the four modifier rules (dakuten, handakuten, small ゃゅょ, small っ / ー), a pronunciation section (mora timing, vowel devoicing, pitch accent), audio playback, and a romaji typing drill.
- **[trainer.html](trainer.html)** — the practice app: survival phrases split one kana per box, 30 survival kanji, and a spaced-repetition quiz (Leitner boxes) with separate decks for hiragana, katakana, combos, phrases, and kanji. Progress saves to `localStorage`; export/import as JSON from the Quiz tab.

## Audio

`audio/ja/` holds 293 mp3 clips — every kana syllable (base, dakuten, yōon, katakana-only combos), every phrase, and every kanji reading — generated with Microsoft's neural voice **ja-JP-NanamiNeural** (via `edge-tts`, rate −10%). Both apps play these files first and fall back automatically: the guide to its embedded Kokoro-82M clips then browser TTS, the trainer to browser TTS. Clip filenames are the spoken Japanese text itself (e.g. `こんにちは.mp3`).

To regenerate or add clips: put the texts in a JSON array and run `edge-tts --voice ja-JP-NanamiNeural --rate=-10% --text <text> --write-media audio/ja/<text>.mp3` per entry.

## Notes

- Web fonts load from Google Fonts when online; both pages fall back to system Japanese fonts offline.
- Quiz progress lives in the browser profile that opened the file — use **Export progress** in the trainer before clearing browser data or switching machines.

## Provenance

Consolidated from `~/Downloads`: `kana-guide_1.html` (superset of `kana-guide.html`, kept as `guide.html`) and `kana-trainer.html` (kept as `trainer.html`).
