"""Definitions for the two image task groups used by the assessment."""

from __future__ import annotations

EMOTION_LABELS = {"happy": "开心", "sad": "悲伤", "fear": "恐惧"}

SINGLE_SPECS = [
    ("开心", "下面哪张图片是开心的？", ["q01-a-happy.jpg", "q01-b-sad.jpg"]),
    ("悲伤", "下面哪张图片更能体现悲伤情绪？", ["q02-a-sad.jpg", "q02-b-fear.jpg"]),
    ("恐惧", "下面哪张图片更能体现恐惧情绪？", ["q03-a-fear.jpg", "q03-b-happy.jpg"]),
    ("开心", "下面哪张图片更能体现开心情绪？", ["q04-a-happy.jpg", "q04-b-fear.png"]),
    ("悲伤", "哪一张图片表现出悲伤情绪？", ["q05-a-sad.jpg", "q05-b-happy.jpg"]),
    ("恐惧", "哪一张图片表现出恐惧情绪？", ["q06-a-fear.jpg", "q06-b-sad.jpg"]),
    ("开心", "哪一张图片中的人物正在微笑？", ["q07-a-happy.jpg", "q07-b-fear.jpg"]),
    ("悲伤", "哪一张图片表现出低落情绪？", ["q08-a-sad.png", "q08-b-happy.jpg"]),
]

MULTI_SPECS = [
    ("开心", "在这 3 张图片中，哪一张表达了快乐？", ["q09-a-happy.jpg", "q09-b-sad.png", "q09-c-fear.png"]),
    ("悲伤", "在这 3 张图片中，哪一张表达了悲伤？", ["q10-a-sad.png", "q10-b-fear.jpg", "q10-c-happy.jpg"]),
    ("恐惧", "在这 3 张图片中，哪一张表达了恐惧？", ["q11-a-fear.jpg", "q11-b-happy.jpg", "q11-c-sad.jpg"]),
    ("开心", "从 3 张图片中找出自然微笑的表情。", ["q12-a-happy.jpg", "q12-b-sad.jpg", "q12-c-fear.jpg"]),
    ("悲伤", "从 3 张图片中找出悲伤的表情。", ["q13-a-sad.jpg", "q13-b-fear.jpg", "q13-c-happy.jpg"]),
    ("恐惧", "从 3 张图片中找出恐惧的表情。", ["q14-a-fear.jpg", "q14-b-happy.jpg", "q14-c-sad.jpg"]),
    ("开心", "从 3 张图片中找出自然微笑的表情。", ["q15-a-happy.jpg", "q15-b-sad.jpg", "q15-c-fear.jpg"]),
    ("悲伤", "从 3 张图片中找出悲伤的表情。", ["q16-a-sad.jpg", "q16-b-fear.jpg", "q16-c-happy.jpg"]),
]


def _emotion_from_file(filename: str) -> str:
    for key, label in EMOTION_LABELS.items():
        if f"-{key}." in filename:
            return label
    raise ValueError(f"unknown image emotion: {filename}")


def _options(filenames: list[str]) -> list[dict]:
    options = []
    for index, filename in enumerate(filenames):
        option_id = chr(65 + index)
        emotion = _emotion_from_file(filename)
        options.append({
            "id": option_id,
            "label": option_id,
            "emotion": emotion,
            "imageUrl": f"/images/{filename}",
            "url": f"/images/{filename}",
            "alt": f"{emotion}表情图片",
        })
    return options


def _build_tasks(specs: list[tuple[str, str, list[str]]], mode: str, points: float) -> list[dict]:
    tasks = []
    for index, (target, prompt, filenames) in enumerate(specs):
        target_file = next(filename for filename in filenames if _emotion_from_file(filename) == target)
        distractors = [filename for filename in filenames if filename != target_file]
        correct_index = index % len(filenames)
        ordered_files = distractors[:correct_index] + [target_file] + distractors[correct_index:]
        options = _options(ordered_files)
        correct = chr(65 + correct_index)
        task_number = index + 1
        tasks.append({
            "id": f"image-{mode}-{task_number}",
            "type": "single-choice" if mode == "single" else "multi-choice",
            "mode": mode,
            "points": points,
            "emotion": target,
            "target": target,
            "prompt": prompt,
            "reason": "重点观察眼睛、眉毛、嘴角和整体面部张力。",
            "correctOption": correct,
            "options": options,
        })
    return tasks


IMAGE_TASKS = _build_tasks(SINGLE_SPECS, "single", 1) + _build_tasks(MULTI_SPECS, "multi", 1.5)
IMAGE_TASK = IMAGE_TASKS[0]


def validate_answer(option_id: str, task_id: str = "image-single-1") -> dict:
    task = next((item for item in IMAGE_TASKS if item["id"] == task_id), None)
    if task is None or option_id not in {item["id"] for item in task["options"]}:
        raise ValueError("invalid image task or option")
    correct = option_id == task["correctOption"]
    return {
        "taskId": task_id,
        "optionId": option_id,
        "isCorrect": correct,
        "score": task["points"] if correct else 0,
        "feedback": "判断正确。" if correct else "再观察一下嘴角、眉眼和整体面部张力。",
    }
