# Roadmap — feature upgrades & improvements

A deep review of the app as of 2026-08-13, ordered by how much each item would help a learner. ~~Struck~~ and ✅ items are done — as of 2026-10-05 that is all of them.

## 🔴 Fix soon (correctness / public-facing)

1. ✅ **De-personalize the "Introducing yourself" deck.** The site is public now, but the deck says *"I'm Quincy — your name in katakana"*, *"I'm from Canada"*, *"I'm an engineer"*. Either make it generic (わたしは＿＿です with a fill-in-the-blank UI) or add a tiny settings box where each visitor types their name/country/job and the phrases + katakana name regenerate (name→katakana would need a small converter or manual entry; audio falls back to browser TTS for custom text).
2. ✅ **Mobile overflow.** The single-script chart tables and long phrase rows can overflow narrow screens; wrap charts in `overflow-x: auto` containers and shrink `--cell` further below 400px.
3. ✅ **Cache busting.** GitHub Pages caches aggressively; after a deploy, returning visitors can get stale JS against new HTML. Add a version query (`js/trainer.js?v=N`) bumped on release, or fingerprint filenames.
4. ✅ **404.html** for GitHub Pages so bad links land somewhere useful.

## 🟠 High-impact learning features

5. ✅ **Stroke order.** The study plan tells people to hand-write kana but the app can't show how. KanjiVG has free stroke data for all kana — render numbered stroke diagrams (or animated SVG) in the guide's detail pane and the mnemonic sheet.
6. ✅ **Tracing practice.** A canvas with the kana as a faint template to trace over on touch screens — no recognition needed to be useful, though comparing against stroke data is a stretch goal.
7. ✅ **Listening drill in the trainer.** The guide has "Hear it" mode; the quiz should too: play the clip, type the romaji, no glyph shown. It's a different memory pathway and the audio already exists.
8. ✅ **Targeted look-alike drills.** The tricky pairs (シ/ツ, ン/ソ, ぬ/め…) are documented but never drilled. A dedicated mode showing one of a confusable pair — "which is this?" — driven by the user's own miss history.
9. ✅ **Hiragana ↔ katakana matching mode.** Show し, ask for シ. Directly trains the script mapping that the combined charts only display.
10. ✅ **Example words per character.** Three common words per kana (あ → あさ, あめ, あお) with audio — anchors the sound in real vocabulary. ~150 more TTS clips.
11. ✅ **Number sprint.** Random number → type the reading (さんまん ろくせん…). The number deck exists; a generator would make it infinite.
12. ✅ **Speed round.** Timed recognition sprints (60 seconds, as many kana as possible). Automaticity — reading kana in <1s — is the actual goal of kana study, and untimed SRS doesn't train it.

## 🟡 SRS & quiz improvements

13. ✅ **Smarter scheduler.** Leitner with fixed intervals (10min/1d/3d/7d/21d) treats all cards alike. FSRS or SM-2 with per-card ease would schedule better; at minimum add a 22nd+ day box so "known" keeps stretching. *(done: FSRS-4.5 with default parameters — per-card stability and difficulty, reviews timed for 90% retention, capped at a year; old records convert on their next review)*
14. ✅ **Undo last grade.** One mis-tap on "Got it" currently promotes a card with no recourse.
15. ✅ **Session summary.** After a quiz run, show what was missed with mnemonics — the moment of review is the best moment to re-read the hook.
16. ✅ **Pedagogical new-card order.** New cards are introduced in random shuffle; they should follow chart order (あ row before か row) so the trainer matches the guide's plan.
17. ✅ **Streaks & daily goal.** A "reviewed N days in a row" counter and a small calendar heatmap in Progress. Cheap to build on the existing data.
18. ✅ **Due forecast.** "12 due tomorrow, 40 this week" in Progress — helps people plan.
19. ✅ **Feed "keeps tripping you" into a drill.** The lapse list is passive; add a "drill these now" button that queues exactly those cards.
20. ✅ **Kana input mode.** Advanced option: answer with an IME in actual kana instead of romaji (validates real typing skills).

## 🟢 Audio

21. ✅ **Autoplay / listen-through.** A play-all button per study section (plays each phrase in sequence with a gap) — passive listening while commuting.
22. ✅ **Playback speed toggle** (0.75× / 1×) using `audio.playbackRate`.
23. ✅ **Second voice.** Generate a parallel set with a male voice (ja-JP-KeitaNeural) and alternate or toggle — hearing two voices generalizes the sound.
24. ✅ **Record & compare.** MediaRecorder: record yourself, play back next to the native clip. No scoring needed; ears do the work.

## 🔵 UX / platform

25. ✅ **PWA.** Manifest + service worker caching the ~5MB of assets → installable on phones, fully offline, instant loads. Probably the single biggest quality-of-life upgrade for a hosted static app. *(pages and scripts cached on first visit; audio cached as played, or a whole voice at once from the trainer's Offline panel)*
26. ✅ **Dark mode.** `prefers-color-scheme` variant of the two palettes.
27. ✅ **Hash routing.** `#quiz`, `#study/s5` — tabs and sections become linkable, back button works, refreshing keeps your place (partially covered by the persisted section).
28. ✅ **Cross-links.** Click any kana box in a trainer phrase → jump to that character's guide detail (mnemonic + audio + Forvo link).
29. ✅ **Study progress ticks.** Mark sections you've been through with a ✓ in the section dropdown.
30. ✅ **Landing page stats.** Read localStorage on index.html: "214 cards known · 12 due" turns the landing page into a daily dashboard.
31. ✅ **Onboarding.** First visit: a three-line pointer (Study → Quiz → Progress) so the flow is obvious.
32. ✅ **Accessibility pass.** *(a live region announces each prompt and verdict; Study/Quiz/Progress are a real tablist with arrow keys; shortcuts ignore typing, modifier keys and Tab-focused controls; focus rings on every control; both palettes audited to 4.5:1; touch targets at least ~42px)*
33. ✅ **Social/meta tags.** favicon, `og:title`/`og:image` so shared links unfurl nicely.

## ⚪ Code health

34. ~~**Split the monolith HTML files**~~ — done: markup / css/ / js/ / data split, 518KB embedded audio blob removed (guide.html 562KB → 14KB).
35. ~~**Progress persistence + restore**~~ — trainer always had localStorage + export/import; guide drill score/settings now persist too.
36. ✅ **Single source of truth for kana data.** `js/guide-data.js` (K table) and `js/trainer-data.js` (GOJU/DAKU/YOON) duplicate the syllabary; merge into one shared `js/kana-data.js`.
37. ✅ **Tests for the romaji checker.** `checkTyped`'s alias cascade (syu→shu, hu→fu ordering) is subtle and easy to regress; a small node test file covering Hepburn/Kunrei/macron/long-vowel cases would lock it down.
38. ✅ **Commit the audio generation script** as `tools/gen_audio.py` + text extraction, so clips are reproducible from the repo.
39. ✅ **localStorage schema notes.** Document the three keys (`kanaTrainerProgress.v1`, `kanaTrainerSettings.v1`, `kanaGuideDrill.v1`) and migration policy in the README.
40. ✅ **Unify the two drill systems.** The guide's drill keeps its own score separate from the trainer's SRS. Long-term, guide drill misses should feed the trainer's per-character progress — one shared record of what you actually know.
41. ✅ **Stable card ids.** Phrase, kanji and custom-deck ids are built from content (`p:こんにちは`, `k:出口`, `c:Deck:front`), so editing the data files can't shift progress onto other cards. Old positional ids migrate on load/import via `js/legacy-ids.js`.
42. ✅ **Practice is not review.** The 60s sprint and "drill these now" grade through `practiceRecord`: no early promotion, unseen cards stay unseen.
43. ✅ **Light/dark toggle + one site header** on every page (`js/theme.js`, `css/site.css`, `js/site.js`).
44. ✅ **Browser smoke test in CI.** The node tests only reach pure helpers. One Playwright run — load each page, grade a card, undo, export → import, assert no console errors — would cover the stateful quiz flow where the 2026-10 bugs lived. *(`tools/smoke.mjs`, 23 checks; it found two more bugs on its first run)*
45. ✅ **Split `js/trainer.js`** (cards, romaji, quiz session, views) so the session logic is testable without a DOM and without slicing the file by string markers. *(eight plain scripts — not ES modules, so nothing about how the pages load changed; `tools/test-session.mjs` drives the engine in node)*
46. ✅ **One storage module.** `js/store.js` holds the key registry, a safe wrapper and the shared audio prefs; every page goes through it (only `js/theme.js` reads its key directly, because it runs first).
47. ✅ **Finish the mnemonic shape overlays** — all 46 sounds, both scripts, drawn over the stroke data so they line up in any font. *(a first pass: each reads as its mnemonic, but they are sketches and worth an artist's eye)*
48. ✅ **Learn, then test.** New cards are introduced in full before they are asked, and a first hit after an introduction returns the next day rather than in four.
49. ✅ **Decks you build as you learn.** Collect any phrase, kanji or character into a deck of your own from Study, the quiz or the guide; add the guide's example words as new cards; save "keeps tripping you" as a deck.
50. ✅ **Consistency pass.** New cards run through hiragana before katakana, as the guide advises; を is labelled (w)o everywhere; the plan's advice now matches what the app does (stroke order built in, the Romaji toggle, ten new cards a day). `tools/test-content.mjs` checks every reading against its kana and that every character has its audio, strokes, mnemonic, sketch and words.
51. ✅ **One look across pages.** A single palette and page background in `css/site.css`; the site header is identical on every page; the trainer and guide no longer jump down to a hash target on load (the view panels are `#view-quiz`, not `#quiz`).
