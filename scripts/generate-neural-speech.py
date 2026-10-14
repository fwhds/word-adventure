"""Cache Edge online neural speech; no API key or paid provider fallback.

Install into the ignored project runtime (requires working pip/network permissions):
  python -m pip install --target .tool-runtime edge-tts==7.3.1 mutagen
Try twelve words first:
  python scripts/generate-neural-speech.py --accent uk --limit 12
Generate/reuse the complete bilingual-accent cache:
  python scripts/generate-neural-speech.py --accent both

This community client depends on an online Microsoft Edge service, without SLA.
It sends only the vocabulary text, never child recordings or API credentials.
"""
from __future__ import annotations

import argparse
import asyncio
import importlib.metadata
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".tool-runtime"))
OUT = ROOT / "dist" / "assets" / "audio" / "neural"
WORDS = json.loads((ROOT / "scripts" / "speech-words.json").read_text(encoding="utf-8-sig"))
VOICES = {"uk": "en-GB-SoniaNeural", "us": "en-US-JennyNeural"}
RATES = {"normal": "+0%", "slow": "-25%"}


def usable(path: Path) -> bool:
    if not path.is_file() or path.stat().st_size < 1000:
        return False
    with path.open("rb") as stream:
        prefix = stream.read(3)
    if not (prefix == b"ID3" or (prefix[0] == 0xFF and prefix[1] & 0xE0 == 0xE0)):
        return False
    try:
        from mutagen.mp3 import MP3
        info = MP3(path).info
        return 0.1 < info.length < 30 and info.sample_rate > 0
    except Exception:
        return False


def location(word_id: str, accent: str, version: str) -> Path:
    if not re.fullmatch(r"[a-z0-9_-]+", word_id):
        raise ValueError(f"Unsafe vocabulary id: {word_id}")
    return OUT / accent / f"{word_id}-{version}.mp3"


def write_manifest() -> dict:
    manifest = {}
    coverage = {key: {"normal": 0, "slow": 0} for key in VOICES}
    for word in WORDS:
        item = {}
        for accent, voice in VOICES.items():
            normal = location(word["id"], accent, "normal")
            slow = location(word["id"], accent, "slow")
            has_normal, has_slow = usable(normal), usable(slow)
            coverage[accent]["normal"] += int(has_normal)
            coverage[accent]["slow"] += int(has_slow)
            if has_normal:
                item[accent] = {
                    "src": normal.relative_to(ROOT / "dist").as_posix(),
                    "slowSrc": slow.relative_to(ROOT / "dist").as_posix() if has_slow else None,
                    "voice": voice,
                    "kind": "neural",
                    "accent": accent,
                    "slowRate": 0.75,
                }
        if item:
            manifest[word["id"]] = item
    metadata = {
        "wordCount": len(WORDS), "coverage": coverage,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "Microsoft Edge online TTS via rany2/edge-tts",
        "serviceVerified": bool(manifest),
    }
    (ROOT / "dist" / "neural-audio.js").write_text(
        "// Generated from verified local MP3 files; empty means unavailable.\n"
        "const WORD_NEURAL_AUDIO = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n"
        "const WORD_NEURAL_AUDIO_META = " + json.dumps(metadata, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print(json.dumps(metadata, ensure_ascii=False), flush=True)
    return metadata


async def generate(args):
    try:
        import edge_tts
        from mutagen.mp3 import MP3  # required for actual MP3 frame/duration checks
    except ImportError:
        write_manifest()
        print("Dependencies unavailable. Install edge-tts==7.3.1 and mutagen into .tool-runtime. No service call made.", file=sys.stderr)
        return 2
    print("edge-tts version: " + importlib.metadata.version("edge-tts"), flush=True)
    accents = list(VOICES) if args.accent == "both" else [args.accent]
    selected = WORDS[:args.limit] if args.limit else WORDS
    failures = 0
    consecutive_failures = 0
    write_manifest()
    for accent in accents:
        for word in selected:
            for version, rate in RATES.items():
                target = location(word["id"], accent, version)
                if usable(target):
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                temporary = target.with_suffix(".mp3.part")
                succeeded = False
                for attempt in range(1, 3):
                    try:
                        communicator = edge_tts.Communicate(word["en"], VOICES[accent], rate=rate)
                        await asyncio.wait_for(communicator.save(str(temporary)), timeout=20)
                        if not usable(temporary):
                            raise ValueError("Received file is not a valid non-empty MP3")
                        temporary.replace(target)
                        print(f"OK {accent} {word['id']} {version}", flush=True)
                        succeeded = True
                        break
                    except Exception as error:
                        # Error type only; response URLs/headers may contain temporary service tokens.
                        print(f"FAIL {accent} {word['id']} {version} attempt={attempt} {type(error).__name__}", flush=True)
                        temporary.unlink(missing_ok=True)
                        if attempt < 2:
                            await asyncio.sleep(1)
                consecutive_failures = 0 if succeeded else consecutive_failures + 1
                failures += int(not succeeded)
                write_manifest()
                if consecutive_failures >= 2:
                    print("Stopped after two consecutive failed clips. Cache and manifest retained; no endless retry.", file=sys.stderr)
                    return 1
                await asyncio.sleep(0.3)
    write_manifest()
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--accent", choices=["uk", "us", "both"], default="both")
    parser.add_argument("--limit", type=int, default=0, help="0 means all words")
    parser.add_argument("--verify-only", action="store_true", help="Rebuild manifest from local files without network")
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("--limit must be non-negative")
    if args.verify_only:
        write_manifest()
        return 0
    return asyncio.run(generate(args))


if __name__ == "__main__":
    raise SystemExit(main())
