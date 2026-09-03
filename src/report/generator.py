from __future__ import annotations

from src.evaluation.scoring import build_report


def generate_report(session_id: str, image_answers: list[dict], video_answers: list[dict]) -> dict:
    return build_report(session_id, image_answers, video_answers)
