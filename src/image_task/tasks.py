IMAGE_TASK = {
    "id": "image-q1",
    "type": "single-choice",
    "emotion": "开心",
    "prompt": "下面哪张图片是开心的？",
    "correctOption": "A",
    "options": [
        {"id": "A", "label": "A", "imageUrl": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=700&q=85", "alt": "选项A人物表情"},
        {"id": "B", "label": "B", "imageUrl": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=85", "alt": "选项B人物表情"},
    ],
}


def validate_answer(option_id: str) -> dict:
    if option_id not in {"A", "B"}:
        raise ValueError("optionId must be A or B")
    correct = option_id == IMAGE_TASK["correctOption"]
    return {"taskId": IMAGE_TASK["id"], "optionId": option_id, "isCorrect": correct, "score": 100 if correct else 0,
            "feedback": "答对啦！这张图片里的表情更开心。" if correct else "再观察一下嘴角和眼睛的变化吧。"}
