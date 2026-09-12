from __future__ import annotations


def risk_band(score: float) -> dict:
    if score <= 17:
        return {"label": "高关注 / ASD 一致表现区",
                "explanation": "面部情绪加工或情境归因存在较明显困难。建议进行完整发育、语言和 ASD 专业评估，本结果不可直接诊断。"}
    if score <= 22:
        return {"label": "潜在风险区",
                "explanation": "表现处于边界范围。应结合年龄、语言水平、分项差异、施测状态和家庭/园所观察，必要时在 6–12 个月后使用平行题复测。"}
    return {"label": "低风险 / 典型表现区",
            "explanation": "在本任务中的表现较好，但不能排除 ASD，也不能证明儿童在真实社交情境中没有困难。"}


def build_report(session_id: str, image_answers: list[dict], video_answers: list[dict]) -> dict:
    image_score = sum(answer["points"] for answer in image_answers if answer["isCorrect"])
    video_score = sum(answer["points"] for answer in video_answers if answer["isCorrect"])
    overall = image_score + video_score
    band = risk_band(overall)
    image_details = [{"taskId": answer["taskId"], "taskType": answer["type"], "selectedOption": answer["optionId"],
                      "isCorrect": answer["isCorrect"], "score": answer["points"] if answer["isCorrect"] else 0,
                      "maxScore": answer["points"]} for answer in image_answers]
    video_details = [{"taskId": answer["taskId"], "target": answer.get("target"), "capturedEmotion": answer["emotion"],
                      "isMatch": answer["isCorrect"], "score": answer["points"] if answer["isCorrect"] else 0,
                      "maxScore": 4} for answer in video_answers]
    return {"sessionId": session_id, "scores": {"image": image_score, "video": video_score, "total": overall},
            "overall": overall, "total": 30, "risk": band, "conclusion": band["label"],
            "insights": [{"title": "图片情绪识别", "detail": f"{image_score} / 18 分"},
                         {"title": "视频表情任务", "detail": f"{video_score} / 12 分"}],
            "details": {"images": image_details, "videos": video_details}}
