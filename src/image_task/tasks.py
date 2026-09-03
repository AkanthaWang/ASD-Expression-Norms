"""16 local image emotion tasks: 8 two-choice (1 point) + 8 three-choice (1.5 points)."""

def option(letter, emotion, filename):
    return {"id": letter, "label": letter, "emotion": emotion, "imageUrl": f"/images/{filename}", "alt": f"{emotion}表情"}

def task(no, mode, target, opts):
    return {"id": f"image-q{no}", "type": mode, "mode": mode, "points": 1 if mode == "two-choice" else 1.5,
            "emotion": target, "prompt": f"下面哪张图片最能表现{target}情绪？",
            "reason": f"请观察眼睛、眉毛、嘴角和整体面部状态，判断{target}情绪。",
            "correctOption": next(o["id"] for o in opts if o["emotion"] == target), "options": opts}

IMAGE_TASKS = [
    task(1,"two-choice","开心",[option("A","开心","q01-a-happy.jpg"),option("B","伤心","q01-b-sad.jpg")]),
    task(2,"two-choice","伤心",[option("A","伤心","q02-a-sad.jpg"),option("B","害怕","q02-b-fear.jpg")]),
    task(3,"two-choice","害怕",[option("A","害怕","q03-a-fear.jpg"),option("B","开心","q03-b-happy.jpg")]),
    task(4,"two-choice","开心",[option("A","开心","q04-a-happy.jpg"),option("B","害怕","q04-b-fear.png")]),
    task(5,"two-choice","伤心",[option("A","伤心","q05-a-sad.jpg"),option("B","开心","q05-b-happy.jpg")]),
    task(6,"two-choice","害怕",[option("A","害怕","q06-a-fear.jpg"),option("B","伤心","q06-b-sad.jpg")]),
    task(7,"two-choice","开心",[option("A","开心","q07-a-happy.jpg"),option("B","害怕","q07-b-fear.jpg")]),
    task(8,"two-choice","伤心",[option("A","伤心","q08-a-sad.png"),option("B","开心","q08-b-happy.jpg")]),
    task(9,"three-choice","开心",[option("A","开心","q09-a-happy.jpg"),option("B","伤心","q09-b-sad.png"),option("C","害怕","q09-c-fear.png")]),
    task(10,"three-choice","伤心",[option("A","伤心","q10-a-sad.png"),option("B","害怕","q10-b-fear.jpg"),option("C","开心","q10-c-happy.jpg")]),
    task(11,"three-choice","害怕",[option("A","害怕","q11-a-fear.jpg"),option("B","开心","q11-b-happy.jpg"),option("C","伤心","q11-c-sad.jpg")]),
    task(12,"three-choice","开心",[option("A","开心","q12-a-happy.jpg"),option("B","伤心","q12-b-sad.jpg"),option("C","害怕","q12-c-fear.jpg")]),
    task(13,"three-choice","伤心",[option("A","伤心","q13-a-sad.jpg"),option("B","害怕","q13-b-fear.jpg"),option("C","开心","q13-c-happy.jpg")]),
    task(14,"three-choice","害怕",[option("A","害怕","q14-a-fear.jpg"),option("B","开心","q14-b-happy.jpg"),option("C","伤心","q14-c-sad.jpg")]),
    task(15,"three-choice","开心",[option("A","开心","q15-a-happy.jpg"),option("B","伤心","q15-b-sad.jpg"),option("C","害怕","q15-c-fear.jpg")]),
    task(16,"three-choice","伤心",[option("A","伤心","q16-a-sad.jpg"),option("B","害怕","q16-b-fear.jpg"),option("C","开心","q16-c-happy.jpg")]),
]
IMAGE_TASK = IMAGE_TASKS[0]

def validate_answer(option_id: str, task_id: str = "image-q1") -> dict:
    current = next((item for item in IMAGE_TASKS if item["id"] == task_id), None)
    if current is None:
        raise ValueError("unknown image task")
    valid = {item["id"] for item in current["options"]}
    if option_id not in valid:
        raise ValueError(f"optionId must be one of {sorted(valid)}")
    correct = option_id == current["correctOption"]
    return {"taskId": current["id"], "optionId": option_id, "isCorrect": correct,
            "score": current["points"] if correct else 0, "points": current["points"],
            "feedback": "答对啦！这张图片符合目标情绪。" if correct else "再观察一下眼睛、眉毛和嘴角的变化吧。"}