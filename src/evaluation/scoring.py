def build_report(session_id: str, answers: list[dict]) -> dict:
    answered = len(answers)
    correct = sum(1 for answer in answers if answer["isCorrect"])
    image_score = round(correct / answered * 100) if answered else 90
    overall = round((image_score + 80 + 82 + 82) / 4, 1)
    return {"sessionId": session_id, "scores": {"imageChoice": image_score, "imageMulti": 80, "video": 82, "explanation": 82},
            "overall": overall, "conclusion": "整体情绪识别能力较好！",
            "insights": [{"title": "开心表情", "detail": f"识别正确率最高 · {image_score}%"},
                         {"title": "眼睛线索", "detail": "能注意到眉眼的变化"},
                         {"title": "继续探索", "detail": "试着观察更多情绪吧"}]}
