"""Definitions for the two image task groups used by the assessment."""

from __future__ import annotations

EMOTION_LABELS = {"happy": "开心", "sad": "悲伤", "fear": "恐惧"}

SINGLE_SPECS = [
    ("开心", "下面哪张图片是开心的？", ["happy1.jpg", "sad1.jpg"]),
    ("悲伤", "下面哪张图片更能体现悲伤情绪？", ["happy2.jpg", "sad2.jpg"]),
    ("恐惧", "下面哪张图片更能体现恐惧情绪？", ["fear1.jpg", "happy3.jpg"]),
    ("开心", "下面哪张图片更能体现开心情绪？", ["sad3.jpg", "happy4.jpg"]),
    ("恐惧", "哪一张图片表现出恐惧情绪？", ["happy5.jpg", "fear2.jpg"]),
    ("悲伤", "哪一张图片表现出悲伤情绪？", ["happy6.jpg", "sad4.jpg"]),
]

MULTI_SPECS = [
    ("恐惧", "在这 3 张图片中，哪一张表达了恐惧？", ["happy7.jpg", "sad5.jpg", "fear3.jpg"]),
    ("悲伤", "在这 3 张图片中，哪一张表达了悲伤？", ["happy8.jpg", "sad6.jpg", "happy9.jpg"]),
    ("开心", "从 3 张图片中找出自然微笑的表情。", ["happy10.jpg", "sad7.jpg", "sad8.jpg"]),
    ("悲伤", "在这 3 张图片中，哪一张表达了悲伤？", ["happy11.jpg", "sad9.jpg", "happy12.jpg"]),
    ("开心", "从 3 张图片中找出自然微笑的表情。", ["happy13.jpg", "sad10.jpg", "sad11.jpg"]),
    ("悲伤", "在这 3 张图片中，哪一张表达了悲伤？", ["happy14.jpg", "sad12.jpg", "happy15.jpg"]),
]


def _emotion_from_file(filename: str) -> str:
    for key, label in EMOTION_LABELS.items():
        if filename.startswith(key) and filename[len(key):].split(".", 1)[0].isdigit():
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
        correct_index = filenames.index(target_file)
        options = _options(filenames)
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


IMAGE_TASKS = _build_tasks(SINGLE_SPECS, "single", 3)
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
