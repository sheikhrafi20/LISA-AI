"""Local HTTP bridge between the Godot 4 office and the existing LISA AI backend.

Binds only to 127.0.0.1. Start from the repository root:
    python -m office_bridge.server
"""
from __future__ import annotations

import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from src.config import load_dotenv
from src.main import ENV_FILE, get_reply, load_history

HOST = "127.0.0.1"
PORT = 8765
ROLES = (
    ("Researcher", "Research the task. Identify facts, assumptions, and missing information."),
    ("Planner", "Create a practical step-by-step plan with dependencies and acceptance criteria."),
    ("Analyst", "Analyze requirements, edge cases, and technical or practical details."),
    ("Critic", "Challenge weak assumptions and identify risks, failure cases, and privacy concerns."),
    ("Writer", "Prepare a clear, structured deliverable or implementation outline."),
)
_lock = threading.Lock()
_state: dict[str, Any] = {
    "task_id": "", "state": "idle", "current_role": "", "completed": 0,
    "total": len(ROLES), "notes": [], "final": "", "error": "",
}


def snapshot() -> dict[str, Any]:
    with _lock:
        return json.loads(json.dumps(_state, ensure_ascii=False))


def run_task(task_id: str, task: str) -> None:
    context = load_history()[-8:]
    notes: list[dict[str, str]] = []
    try:
        for index, (name, instruction) in enumerate(ROLES, start=1):
            with _lock:
                _state.update(state="working", current_role=name, completed=index - 1)
            prompt = (
                f"[LISA OFFICE STAFF: {name}]\\n{instruction}\\n"
                "Work only on the user's task. Be concrete. State uncertainty; "
                "do not claim external verification or actions you did not perform.\\n"
                f"USER TASK:\\n{task}"
            )
            result = get_reply([*context, {"role": "user", "message": prompt}], prompt)
            notes.append({"role": name, "result": result})
            with _lock:
                _state.update(completed=index, notes=notes)
        with _lock:
            _state.update(state="coordinating", current_role="LISA Boss")
        summary = "\\n\\n".join(f"{n['role']}:\\n{n['result']}" for n in notes)
        coordinator_prompt = (
            "[LISA OFFICE — BOSS / COORDINATOR]\\n"
            "Synthesize the five staff reports. Resolve conflicts, distinguish "
            "verified facts from assumptions, and give the user a detailed useful result. "
            "Do not claim the staff are independent model providers.\\n"
            f"USER TASK:\\n{task}\\n\\nSTAFF REPORTS:\\n{summary}"
        )
        final = get_reply([*context, {"role": "user", "message": coordinator_prompt}], coordinator_prompt)
        with _lock:
            _state.update(state="completed", current_role="LISA Boss", final=final)
    except Exception as exc:
        with _lock:
            _state.update(state="error", error=str(exc), current_role="")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._send(200, {"ok": True, "service": "LISA Office Bridge"})
        elif self.path == "/api/status":
            self._send(200, snapshot())
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path != "/api/task":
            self._send(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 100_000:
                self._send(400, {"error": "Invalid request size"})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            task = str(payload.get("task", "")).strip()
        except (ValueError, UnicodeDecodeError, AttributeError):
            self._send(400, {"error": "Expected JSON with a task string"})
            return
        if not task:
            self._send(400, {"error": "Task cannot be empty"})
            return
        with _lock:
            if _state["state"] in {"working", "coordinating"}:
                self._send(409, {"error": "An office task is already running"})
                return
            task_id = uuid.uuid4().hex
            _state.update(
                task_id=task_id, state="queued", current_role="Messenger",
                completed=0, total=len(ROLES), notes=[], final="", error="",
            )
        threading.Thread(target=run_task, args=(task_id, task), daemon=True).start()
        self._send(202, {"accepted": True, "task_id": task_id})

    def log_message(self, _format: str, *_args: Any) -> None:
        return


def main() -> None:
    load_dotenv(ENV_FILE)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"LISA Office Bridge listening at http://{HOST}:{PORT}")
    print("Keep this window open while the Godot office is running. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nLISA Office Bridge stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
