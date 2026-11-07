"""Turn scripts/portfolio/narration.json into one WAV per scene and language with Microsoft's
neural voices through edge-tts (pip install edge-tts), and write durations.txt for record.mjs.

Usage: python scripts/portfolio/tts_edge.py <workDir>
Needs ffmpeg on PATH, or its full path in the FFMPEG environment variable.
"""
import asyncio
import json
import os
import pathlib
import shutil
import subprocess
import sys

import edge_tts

VOICES = {
    "vi": os.environ.get("VI_VOICE", "vi-VN-HoaiMyNeural"),
    "en": os.environ.get("EN_VOICE", "en-US-AvaMultilingualNeural"),
}
RATE = os.environ.get("RATE", "-5%")
FFMPEG = os.environ.get("FFMPEG") or shutil.which("ffmpeg")


def spoken(lang: str, text: str) -> str:
    # Read the abbreviation letter by letter in both languages.
    return text.replace("IRR", "I. R. R." if lang == "en" else "I-R-R")


async def main(work: pathlib.Path) -> None:
    if not FFMPEG:
        sys.exit("ffmpeg not found: put it on PATH or set FFMPEG")
    work.mkdir(parents=True, exist_ok=True)
    items = json.loads((pathlib.Path(__file__).parent / "narration.json").read_text(encoding="utf-8"))
    durations = []
    for lang in ("vi", "en"):
        for it in items:
            mp3 = work / f"{lang}-{it['id']}.mp3"
            wav = work / f"{lang}-{it['id']}.wav"
            if wav.exists():  # resume after an interrupted run
                durations.append(f"{wav.name} {(wav.stat().st_size - 44) / 48000:.3f}")
                continue
            for attempt in range(10):
                try:
                    await edge_tts.Communicate(spoken(lang, it[lang]), VOICES[lang], rate=RATE).save(str(mp3))
                    break
                except edge_tts.exceptions.NoAudioReceived:
                    # The free service often drops requests; wait longer each time and try again.
                    if attempt == 9:
                        raise
                    await asyncio.sleep(3 + 4 * attempt)
            subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(mp3), "-ar", "24000", "-ac", "1", str(wav)], check=True)
            seconds = (wav.stat().st_size - 44) / 48000  # 16-bit mono at 24 kHz
            durations.append(f"{wav.name} {seconds:.3f}")
    (work / "durations.txt").write_text("\n".join(durations) + "\n", encoding="utf-8")
    print(f"wrote {len(durations)} clips with {VOICES['vi']} and {VOICES['en']}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    asyncio.run(main(pathlib.Path(sys.argv[1])))
