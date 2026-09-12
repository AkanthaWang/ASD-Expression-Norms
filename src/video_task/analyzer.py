from __future__ import annotations

import base64

from video_emotion_model import CameraEmotionAnalyzer


def analyze_captured_frames(frame_data: list[str], target_emotion: str | None = None) -> dict:
    """Analyze JPEG frames captured by the browser camera without persisting them."""
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise RuntimeError("视频模型需要安装 opencv-python 和 deepface") from exc

    frames = []
    for encoded in frame_data:
        raw = base64.b64decode(encoded, validate=True)
        frame = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
        if frame is not None:
            frames.append(frame)
    if not frames:
        raise RuntimeError("未收到可分析的摄像头画面")
    result = CameraEmotionAnalyzer().aggregate_frames(frames, target_emotion=target_emotion)
    payload = result.as_dict()
    payload["explanation"] = (
        f"摄像头采集的 {result.frames_analyzed} 帧面部画面中，主导表情为“{result.emotion}”，"
        f"与目标“{result.target_emotion}”{'一致' if result.is_match else '不一致'}。"
    )
    return payload


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
