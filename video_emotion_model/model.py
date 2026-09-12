from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from time import monotonic
from typing import Any


EMOTION_ALIASES = {
    "happy": "开心",
    "sad": "难过",
    "fear": "害怕",
    "angry": "生气",
    "surprise": "惊讶",
    "disgust": "厌恶",
    "neutral": "中性",
    "开心": "开心",
    "快乐": "开心",
    "悲伤": "难过",
    "伤心": "难过",
    "难过": "难过",
    "恐惧": "害怕",
    "害怕": "害怕",
}


def normalize_emotion(value: str) -> str:
    """Map DeepFace English labels and task labels to the same Chinese vocabulary."""
    key = str(value).strip().lower()
    return EMOTION_ALIASES.get(key, str(value).strip())


@dataclass(frozen=True)
class EmotionResult:
    emotion: str
    confidence: float
    frames_analyzed: int
    target_emotion: str | None
    is_match: bool | None
    emotion_counts: dict[str, int]

    def as_dict(self) -> dict[str, Any]:
        return {
            "emotion": self.emotion,
            "confidence": round(self.confidence, 4),
            "framesAnalyzed": self.frames_analyzed,
            "targetEmotion": self.target_emotion,
            "isMatch": self.is_match,
            "emotionCounts": self.emotion_counts,
            "source": "opencv-deepface",
        }


class CameraEmotionAnalyzer:
    """Analyze emotions from webcam frames. Dependencies are loaded only on use."""

    def __init__(self, camera_index: int = 0, sample_interval: float = 0.25) -> None:
        self.camera_index = camera_index
        self.sample_interval = sample_interval
        self._cv2 = None
        self._deepface = None

    def _load_dependencies(self) -> None:
        try:
            import cv2
            from deepface import DeepFace
        except ImportError as exc:
            raise RuntimeError(
                "视频模型需要安装 opencv-python 和 deepface，请执行 "
                "pip install -r video_emotion_model/requirements.txt"
            ) from exc
        self._cv2, self._deepface = cv2, DeepFace

    def analyze_frame(self, frame: Any) -> tuple[str, float]:
        """Return the dominant emotion and its probability for one BGR frame."""
        if self._deepface is None:
            self._load_dependencies()
        result = self._deepface.analyze(
            img_path=frame,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="opencv",
            silent=True,
        )
        item = result[0] if isinstance(result, list) else result
        scores = item.get("emotion", {})
        if not scores:
            return "未识别", 0.0
        label, probability = max(scores.items(), key=lambda pair: pair[1])
        return normalize_emotion(label), float(probability) / 100.0

    def aggregate_frames(self, frames: list[Any], target_emotion: str | None = None) -> EmotionResult:
        """Classify supplied camera frames and compare the dominant result to a target."""
        labels: list[str] = []
        confidences: list[float] = []
        for frame in frames:
            label, confidence = self.analyze_frame(frame)
            if label != "未识别":
                labels.append(label)
                confidences.append(confidence)
        if not labels:
            raise RuntimeError("采集画面中未检测到可用的人脸表情")
        counts = Counter(labels)
        emotion = counts.most_common(1)[0][0]
        target = normalize_emotion(target_emotion) if target_emotion else None
        return EmotionResult(
            emotion=emotion,
            confidence=sum(confidences) / len(confidences),
            frames_analyzed=len(labels),
            target_emotion=target,
            is_match=emotion == target if target else None,
            emotion_counts=dict(counts),
        )

    def analyze_camera(
        self,
        target_emotion: str | None = None,
        duration_seconds: float = 6.0,
        display: bool = True,
    ) -> EmotionResult:
        """Read the webcam for a fixed window and compare the aggregate result."""
        if duration_seconds <= 0:
            raise ValueError("duration_seconds must be greater than zero")
        if self._cv2 is None:
            self._load_dependencies()
        camera = self._cv2.VideoCapture(self.camera_index)
        if not camera.isOpened():
            raise RuntimeError(f"无法打开摄像头 index={self.camera_index}")

        labels: list[str] = []
        confidences: list[float] = []
        started, sampled_at = monotonic(), 0.0
        try:
            while monotonic() - started < duration_seconds:
                ok, frame = camera.read()
                if not ok:
                    raise RuntimeError("摄像头读取失败")
                now = monotonic()
                if now - sampled_at >= self.sample_interval:
                    label, confidence = self.analyze_frame(frame)
                    if label != "未识别":
                        labels.append(label)
                        confidences.append(confidence)
                    sampled_at = now
                if display:
                    self._cv2.imshow("实时表情检测 - 按 q 提前结束", frame)
                    if self._cv2.waitKey(1) & 0xFF == ord("q"):
                        break
        finally:
            camera.release()
            if display:
                self._cv2.destroyAllWindows()

        if not labels:
            raise RuntimeError("窗口内未检测到可用的人脸表情")
        counts = Counter(labels)
        emotion = counts.most_common(1)[0][0]
        target = normalize_emotion(target_emotion) if target_emotion else None
        return EmotionResult(emotion, sum(confidences) / len(confidences), len(labels), target, emotion == target if target else None, dict(counts))
