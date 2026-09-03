import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from src.evaluation.scoring import build_report
from src.image_task.tasks import IMAGE_TASK, IMAGE_TASKS, validate_answer
from src.report.generator import generate_report
from src.video_task.analyzer import analyze_video

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = ROOT / "frontend"
IMAGE_ROOT = ROOT / "data" / "images"
VIDEO_ROOT = ROOT / "data" / "videos"
PORT = int(os.getenv("PORT", "5173"))
SESSION = {"id": "demo-session-001", "childName": "乐乐小朋友", "status": "进行中", "completed": 1, "total": 4}
ANSWERS: list[dict] = []


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
        if route == "/api/tasks/image": return self.json_response(200, {"tasks": IMAGE_TASKS, "total": len(IMAGE_TASKS), "maxScore": 20})
        if route == "/api/video/sample": return self.json_response(200, analyze_video())
        if route == "/api/report": return self.json_response(200, generate_report(SESSION["id"], ANSWERS))
        self.serve_static(route)

    def do_POST(self):
        route = urlparse(self.path).path
        try:
            body = self.read_body()
            if route == "/api/answers/image":
                answer = validate_answer(body.get("optionId"), body.get("taskId", "image-q1"))
                ANSWERS.append({**answer, "answeredAt": "server-time"})
                return self.json_response(200, answer)
            if route == "/api/video/analyze": return self.json_response(200, analyze_video(body.get("fileName")))
            if route == "/api/session/reset":
                ANSWERS.clear()
                return self.json_response(200, SESSION)
            self.json_response(404, {"error": "API route not found"})
        except (ValueError, json.JSONDecodeError) as error:
            self.json_response(400, {"error": str(error)})

    def serve_static(self, route: str):
        relative = "index.html" if route == "/" else route.lstrip("/")
        root = IMAGE_ROOT if route.startswith("/images/") else VIDEO_ROOT if route.startswith("/videos/") else FRONTEND_ROOT
        relative = route[len("/images/"):] if route.startswith("/images/") else route[len("/videos/"):] if route.startswith("/videos/") else relative
        target = (root / relative).resolve()
        if root not in target.parents and target != root or not target.is_file():
            return self.json_response(404, {"error": "Not found"})
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8" if content_type.startswith("text/") else content_type)
        self.end_headers()
        self.wfile.write(target.read_bytes())


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
