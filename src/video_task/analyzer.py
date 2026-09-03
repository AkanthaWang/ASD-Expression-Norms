from __future__ import annotations

from video_emotion_model import CameraEmotionAnalyzer


def analyze_video(
    file_name: str | None = None,
    target_emotion: str | None = None,
    duration_seconds: float = 6.0,
    display: bool = True,
) -> dict:
    """Analyze the live webcam while the task video is being shown.

    ``file_name`` is retained for API compatibility and is not opened or analyzed.
    """
    result = CameraEmotionAnalyzer().analyze_camera(
        target_emotion=target_emotion,
        duration_seconds=duration_seconds,
        display=display,
    )
    payload = result.as_dict()
    payload["durationSeconds"] = duration_seconds
    payload["fileName"] = file_name
    payload["explanation"] = (
        f"实时摄像头表情聚合结果为“{result.emotion}”。"
        if result.is_match is None
        else f"实时摄像头表情为“{result.emotion}”，与目标“{result.target_emotion}”"
        f"{'一致' if result.is_match else '不一致'}。"
    )
    return payload
