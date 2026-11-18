"""LISA Office: a local web UI served by Python.

Run from the project root:  python -m src.web
It opens http://127.0.0.1:8765 in your browser. The server only accepts
connections from this computer.
"""

from __future__ import annotations

import json
import re
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from src.ai import AIError, ai_available, generate_reply, get_model, get_provider
from src.config import load_dotenv
from src.voice import VoiceError, speak

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "web" / "index.html"
PORT = 8765
MAX_BODY = 20_000
AGENTS = ("LISA", "NOVA", "KAI", "MIRA", "ORION")
LOCAL_HOSTS = ("127.0.0.1", "localhost")
_speak_lock = threading.Lock()

PROMPT = (
    "You write the script of an AI office meeting. Team: LISA (lead), NOVA (researcher), "
    "KAI (engineer), MIRA (designer), ORION (reviewer). The boss gave this task: \"{task}\".\n"
    "Reply with JSON only, in the same language as the task:\n"
    '{"talk":[{"a":"LISA","t":"one short sentence"}],"work":{"NOVA":"max 10 words","KAI":"...",'
    '"MIRA":"...","ORION":"..."},"final":"concrete final answer, max 120 words"}\n'
    '"talk" has 6 to 8 items about this specific task; LISA opens; "a" is one of '
    "LISA, NOVA, KAI, MIRA, ORION."
)


def local_plan(task: str) -> dict:
    """Offline plan used when no AI is on. It splits the work but does not solve the task."""
    short = task if len(task) <= 70 else task[:70] + "…"
    return {
        "live": False,
        "talk": [
            {"a": "LISA", "t": f"বস একটি নতুন কাজ দিয়েছেন: “{short}”। সবাই নিজের অংশ বলো।"},
            {"a": "NOVA", "t": "আমি আগে তথ্য ও উৎস জোগাড় করছি, তারপর মূল পয়েন্ট সাজাব।"},
            {"a": "KAI", "t": "আমি কাজটাকে ছোট ছোট ধাপে ভাগ করে কাঠামো বানাচ্ছি।"},
            {"a": "MIRA", "t": "আমি সহজ ও সুন্দর উপস্থাপনা ঠিক করছি।"},
            {"a": "ORION", "t": "আমি শেষে ভুল আর ঝুঁকি যাচাই করব।"},
            {"a": "LISA", "t": "ঠিক আছে, সবাই শুরু করো। শেষে আমি সারসংক্ষেপ দেব।"},
        ],
        "work": {"NOVA": "তথ্য ও উৎস সংগ্রহ", "KAI": "ধাপভিত্তিক কাঠামো",
                 "MIRA": "সহজ উপস্থাপনা", "ORION": "ভুল ও ঝুঁকি যাচাই"},
        "final": ("এটা অফলাইন মোড, তাই আমি আপনার কাজের আসল উত্তর তৈরি করতে পারছি না। টিম শুধু কাজটা এভাবে ভাগ করেছে: "
                  "১) তথ্য সংগ্রহ ২) ধাপ ঠিক করা ৩) সহজ উপস্থাপনা ৪) ভুল যাচাই। "
                  "AI চালু করলে (README-র Turning on AI) এই টিম আসল উত্তর তৈরি করবে।"),
    }


def parse_plan(text: str) -> dict | None:
    """Pull a valid meeting plan out of an AI reply, or return None."""
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
    except ValueError:
        return None
    if not isinstance(data, dict):
        return None
    talk, work, final = data.get("talk"), data.get("work"), data.get("final")
    if not (isinstance(talk, list) and isinstance(work, dict) and isinstance(final, str) and final.strip()):
        return None
    lines = [
        {"a": item["a"], "t": item["t"].strip()[:300]}
        for item in talk
        if isinstance(item, dict) and item.get("a") in AGENTS
        and isinstance(item.get("t"), str) and item["t"].strip()
    ]
    if not lines:
        return None
    work = {k: str(v)[:120] for k, v in work.items() if k in AGENTS and k != "LISA"}
    return {"talk": lines[:10], "work": work, "final": final.strip()[:1500]}


def make_plan(task: str) -> dict:
    """Ask LISA's AI for a meeting plan; fall back to the offline plan."""
    if ai_available():
        try:
            reply = generate_reply([{"role": "user", "message": PROMPT.replace("{task}", task)}])
            plan = parse_plan(reply)
            if plan:
                plan["live"] = True
                return plan
        except AIError as error:
            print(f"LISA: AI is not available right now ({error}). Using the offline plan.")
    return local_plan(task)


class Handler(BaseHTTPRequestHandler):
    server_version = "LISA"

    def log_message(self, *args) -> None:  # keep the terminal quiet
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code: int, obj: dict) -> None:
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def _allowed(self) -> bool:
        """Only this computer, and only pages served by this server (blocks other websites)."""
        host = self.headers.get("Host", "").rsplit(":", 1)[0]
        origin = self.headers.get("Origin")
        return host in LOCAL_HOSTS and (origin is None or urlparse(origin).hostname in LOCAL_HOSTS)

    def do_GET(self) -> None:
        if not self._allowed():
            return self._json(403, {"error": "forbidden"})
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            try:
                self._send(200, INDEX.read_bytes(), "text/html; charset=utf-8")
            except OSError:
                self._json(500, {"error": "web/index.html not found"})
        elif path == "/api/status":
            on = ai_available()
            self._json(200, {"ai": on, "provider": get_provider(), "model": get_model() if on else ""})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self) -> None:
        if not self._allowed():
            return self._json(403, {"error": "forbidden"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = -1
        if not 0 < length <= MAX_BODY:
            return self._json(400, {"error": "bad request size"})
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except ValueError:
            data = None
        if not isinstance(data, dict):
            return self._json(400, {"error": "bad json"})
        path = urlparse(self.path).path
        if path == "/api/chat":
            task = str(data.get("task", "")).strip()[:500]
            if not task:
                return self._json(400, {"error": "empty task"})
            self._json(200, make_plan(task))
        elif path == "/api/speak":
            with _speak_lock:
                try:
                    speak(str(data.get("text", "")))
                    self._json(200, {"ok": True})
                except VoiceError as error:
                    self._json(200, {"ok": False, "error": str(error)})
        else:
            self._json(404, {"error": "not found"})


def main(port: int = PORT) -> None:
    load_dotenv(ROOT / ".env")
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}"
    print(f"LISA Office is running at {url}  (press Ctrl+C to stop)")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
