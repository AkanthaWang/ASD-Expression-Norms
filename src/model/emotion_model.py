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
        return EmotionPrediction(
            emotion="开心",
            confidence=0.87,
            features=["嘴角上扬，形成自然笑容", "眉部舒展，眼睛轻微眯起", "表情保持稳定，持续约 6 秒"],
            explanation="嘴角上扬、眉部舒展，整体面部动作符合开心表达。",
        )
