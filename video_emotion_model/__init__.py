"""Real-time webcam emotion recognition backed by OpenCV and DeepFace."""

from .model import CameraEmotionAnalyzer, EmotionResult, normalize_emotion

__all__ = ["CameraEmotionAnalyzer", "EmotionResult", "normalize_emotion"]
