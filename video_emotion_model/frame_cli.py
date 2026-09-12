"""Analyze browser-captured camera frames received through standard input."""

from __future__ import annotations

import json
import sys

from src.video_task.analyzer import analyze_captured_frames


def main() -> None:
    payload = json.load(sys.stdin)
    result = analyze_captured_frames(payload.get("frames", []), payload.get("targetEmotion"))
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
