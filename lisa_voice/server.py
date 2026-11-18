"""Local voice/chat API for the LISA 3D talking-avatar client.

Run from the repository root: python -m lisa_voice.server
Binds to localhost only. Speech recognition is optional and uses faster-whisper.
"""
from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from src.config import load_dotenv
from src.main import ENV_FILE, get_reply, load_history, save_message
from src.voice import speak

HOST = "127.0.0.1"
PORT = 8766
MAX_AUDIO_BYTES = 20 * 1024 * 1024
_whisper_model = None
_model_lock = threading.Lock()


def transcribe_wav(audio: bytes) -> str:
    global _whisper_model
    if not audio:
        raise ValueError("No audio data received")
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(
            "Speech recognition is not installed. Run: "
            "python -m pip install -r requirements-voice.txt"
        ) from exc
    with _model_lock:
        if _whisper_model is None:
            _whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
        import tempfile
        from pathlib import Path
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp:
            temp.write(audio)
            temp_path = Path(temp.name)
        try:
            segments, _info = _whisper_model.transcribe(
                str(temp_path), beam_size=1, vad_filter=True
            )
            return " ".join(segment.text.strip() for segment in segments).strip()
        finally:
            temp_path.unlink(missing_ok=True)


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
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
            self._send(200, {"ok": True, "service": "LISA Voice API", "speech_input": "optional"})
        else:
            self._send(404, {"error": "Not found"})

    def do_POST(self) -> None:
        if self.path == "/api/transcribe":
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_AUDIO_BYTES:
                self._send(400, {"error": "Audio size is invalid"})
                return
            try:
                text = transcribe_wav(self.rfile.read(length))
                self._send(200, {"text": text})
            except (RuntimeError, ValueError, OSError) as exc:
                self._send(503, {"error": str(exc)})
            return

        if self.path not in {"/api/chat", "/api/speak"}:
            self._send(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 100_000:
                self._send(400, {"error": "Invalid request size"})
                return
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            text = str(payload.get("text", "")).strip()
        except (ValueError, UnicodeDecodeError, AttributeError):
            self._send(400, {"error": "Expected JSON with a text field"})
            return
        if not text:
            self._send(400, {"error": "Text cannot be empty"})
            return

        if self.path == "/api/speak":
            try:
                speak(text)
                self._send(200, {"ok": True})
            except Exception as exc:
                self._send(503, {"error": str(exc)})
            return

        history = load_history()
        save_message(history, "user", text)
        reply = get_reply(history, text)
        save_message(history, "lisa", reply)
        self._send(200, {"reply": reply})


def main() -> None:
    load_dotenv(ENV_FILE)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"LISA Voice API listening at http://{HOST}:{PORT}")
    print("Localhost only. Keep this window open while the avatar app runs.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nLISA Voice API stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
