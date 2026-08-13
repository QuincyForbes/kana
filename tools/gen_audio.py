"""Generate mp3 clips for every text in tools/texts.json with Edge neural TTS.

Usage (after: node tools/gen_texts.js):
  pip install edge-tts
  python tools/gen_audio.py                                # female voice -> audio/ja/
  python tools/gen_audio.py --voice ja-JP-KeitaNeural --out audio/ja-m
Existing non-empty files are skipped, so reruns only fill gaps.
"""
import argparse, asyncio, json, sys
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument("--voice", default="ja-JP-NanamiNeural")
ap.add_argument("--rate", default="-10%")
ap.add_argument("--out", default="audio/ja")
args = ap.parse_args()

OUT = ROOT / args.out
TEXTS = json.loads((Path(__file__).parent / "texts.json").read_text(encoding="utf8"))

async def gen(text, sem):
    dest = OUT / f"{text}.mp3"
    if dest.exists() and dest.stat().st_size > 0:
        return "skip"
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, args.voice, rate=args.rate).save(str(dest))
                return "ok"
            except Exception as e:
                if attempt == 2:
                    print(f"FAIL {text}: {e}", file=sys.stderr)
                    return "fail"
                await asyncio.sleep(2 * (attempt + 1))

async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(4)
    r = await asyncio.gather(*(gen(t, sem) for t in TEXTS))
    print(f"{args.voice} -> {OUT}: ok={r.count('ok')} skipped={r.count('skip')} failed={r.count('fail')} of {len(TEXTS)}")

asyncio.run(main())
