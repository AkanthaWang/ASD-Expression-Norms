from src.model.emotion_model import DemoEmotionModel


def analyze_video(file_name: str | None = None) -> dict:
    prediction = DemoEmotionModel().predict_video(file_name)
    return {"emotion": prediction.emotion, "confidence": prediction.confidence, "features": prediction.features,
            "durationSeconds": 6, "explanation": prediction.explanation, "source": "demo-model", "fileName": file_name}
