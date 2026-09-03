from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EmotionPrediction:
    emotion: str
    confidence: float
    features: list[str]
    explanation: str


class DemoEmotionModel:
    """Stable placeholder for a real frame/video emotion model."""

    def predict_video(self, file_name: str | None = None) -> EmotionPrediction:
        emotion = "开心"
        if file_name and "sad" in file_name:
            emotion = "难过"
        elif file_name and "fear" in file_name:
            emotion = "恐惧"
        return EmotionPrediction(
            emotion=emotion,
            confidence=0.87,
            features=["嘴角、眉眼等动作变化与目标情绪相符", "面部动作保持稳定", "系统在后台完成本题分析"],
            explanation=f"面部动作模式与“{emotion}”情绪表达相符。",
        )
