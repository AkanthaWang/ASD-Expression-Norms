from __future__ import annotations

import json
import mimetypes
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from src.evaluation.scoring import build_report
from src.image_task.tasks import IMAGE_TASKS
from src.report.generator import generate_report
from src.video_task.analyzer import analyze_video

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = ROOT / "frontend"
IMAGE_ROOT = ROOT / "data" / "images"
PORT = int(os.getenv("PORT", "5173"))
IMAGE_TASK_COUNT = 16
VIDEO_TASK_COUNT = 5
VIDEO_TASKS = {
    "video-q1": {"fileName": "happy-1.mp4", "target": "开心"},
    "video-q2": {"fileName": "sad-1.mp4", "target": "难过"},
    "video-q3": {"fileName": "fear-1.mp4", "target": "恐惧"},
    "video-q4": {"fileName": "happy-2.mp4", "target": "开心"},
    "video-q5": {"fileName": "sad-2.mp4", "target": "难过"},
}
VIDEO_FILES = {
    "happy-1.mp4": ROOT / "data" / "videos" / "happy" / "happy_1.mp4",
    "sad-1.mp4": ROOT / "data" / "videos" / "sad" / "sad_1.mp4",
    "fear-1.mp4": ROOT / "data" / "videos" / "fear" / "fear_1.mp4",
    "happy-2.mp4": ROOT / "data" / "videos" / "happy" / "happy_2.mp4",
    "sad-2.mp4": ROOT / "data" / "videos" / "sad" / "sad_2.mp4",
}
SESSION = {"id": "demo-session-001", "childName": "乐乐小朋友", "status": "进行中", "completed": 0, "total": IMAGE_TASK_COUNT + VIDEO_TASK_COUNT}
IMAGE_ANSWERS: list[dict] = []
VIDEO_ANSWERS: list[dict] = []


def upsert_answer(collection: list[dict], answer: dict) -> None:
    for index, existing in enumerate(collection):
        if existing["taskId"] == answer["taskId"]:
            collection[index] = answer
            return
    collection.append(answer)


def update_session_progress() -> None:
    SESSION["completed"] = len(IMAGE_ANSWERS) + len(VIDEO_ANSWERS)
    SESSION["status"] = "已完成" if SESSION["completed"] == SESSION["total"] else "进行中"


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def json_response(self, status: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > 1_000_000:
            raise ValueError("payload too large")
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/api/health": return self.json_response(200, {"ok": True, "service": "expression-norms-api", "version": "1.0.0"})
        if route == "/api/session": return self.json_response(200, SESSION)
        if route == "/api/tasks/image": return self.json_response(200, {"version": "demo-2.1", "total": len(IMAGE_TASKS), "tasks": IMAGE_TASKS})
        if route == "/api/video/sample": return self.json_response(200, analyze_video("happy-1.mp4", "开心"))
        if route == "/api/report":
            if SESSION["completed"] < SESSION["total"]:
                return self.json_response(409, {"error": "请完成全部图片和视频测试后再生成最终报告"})
            return self.json_response(200, generate_report(SESSION["id"], IMAGE_ANSWERS, VIDEO_ANSWERS))
        if route.startswith("/media/videos/"):
            return self.serve_video(route)
        self.serve_static(route)

    def do_POST(self):
        route = urlparse(self.path).path
        try:
            body = self.read_body()
            if route == "/api/answers/image":
                task_id = body.get("taskId", "")
                match = re.fullmatch(r"image-(single|multi)-[1-8]", task_id)
                option_id = body.get("optionId")
                if not match or option_id not in {"A", "B", "C"}:
                    raise ValueError("invalid image task or option")
                task_type = match.group(1)
                points = 1 if task_type == "single" else 1.5
                task = next((item for item in IMAGE_TASKS if item["id"] == task_id), None)
                if task is None or option_id not in {item["id"] for item in task["options"]}:
                    raise ValueError("invalid image task or option")
                is_correct = option_id == task["correctOption"]
                answer = {"taskId": task_id, "type": task_type, "optionId": option_id, "isCorrect": is_correct, "points": points,
                          "score": points if is_correct else 0, "answeredAt": "server-time"}
                upsert_answer(IMAGE_ANSWERS, answer)
                update_session_progress()
                return self.json_response(200, answer)
            if route == "/api/video/analyze":
                task = VIDEO_TASKS.get(body.get("taskId"))
                if not task:
                    raise ValueError("invalid video task")
                analysis = analyze_video(task["fileName"], task["target"])
                correct = analysis["emotion"] == task["target"]
                answer = {"taskId": body["taskId"], "isCorrect": correct, "points": 2, "emotion": analysis["emotion"], "answeredAt": "server-time"}
                upsert_answer(VIDEO_ANSWERS, answer)
                update_session_progress()
                return self.json_response(200, {**analysis, "isCorrect": correct, "score": 2 if correct else 0, "fileName": task["fileName"]})
            if route == "/api/session/reset":
                IMAGE_ANSWERS.clear()
                VIDEO_ANSWERS.clear()
                update_session_progress()
                return self.json_response(200, SESSION)
            self.json_response(404, {"error": "API route not found"})
        except (ValueError, json.JSONDecodeError) as error:
            self.json_response(400, {"error": str(error)})

    def serve_static(self, route: str):
        is_image = route.startswith("/images/")
        root = IMAGE_ROOT if is_image else FRONTEND_ROOT
        relative = route.removeprefix("/images/") if is_image else ("index.html" if route == "/" else route.lstrip("/"))
        target = (root / relative).resolve()
        if (root not in target.parents and target != root) or not target.is_file():
            return self.json_response(404, {"error": "Not found"})
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.end_headers()
        self.wfile.write(target.read_bytes())

    def serve_video(self, route: str):
        target = VIDEO_FILES.get(Path(route).name)
        if not target or not target.is_file():
            return self.json_response(404, {"error": "Video not found"})
        size = target.stat().st_size
        start, end = 0, size - 1
        range_header = self.headers.get("Range")
        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header)
            if not match:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            start = int(match.group(1) or 0)
            end = min(int(match.group(2) or size - 1), size - 1)
            if start >= size or start > end:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.end_headers()
                return
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        with target.open("rb") as video:
            video.seek(start)
            self.wfile.write(video.read(end - start + 1))


def run():
    server = ThreadingHTTPServer(("", PORT), Handler)
    print(f"Expression Norms Python API running at http://localhost:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
