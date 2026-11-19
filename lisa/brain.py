"""LISA's brain: talks to a local Ollama model (free, private, no API key).

Only the standard library is used. Replies are streamed, so words appear as
the model writes them.
"""

from __future__ import annotations

import json
from typing import Iterator
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from lisa.config import Settings

SYSTEM_PROMPT = (
    "You are LISA, a friendly personal AI assistant. "
    "Reply in the same language the user writes in: বাংলা, English, or Banglish "
    "(Bengali written in English letters). Keep answers short, clear and helpful. "
    "If you do not know something, say so instead of guessing."
)


class BrainError(Exception):
    """Raised when the model cannot give a reply. The message is safe to show the user."""


def build_messages(history: list[dict[str, str]], limit: int) -> list[dict[str, str]]:
    """System prompt followed by the most recent `limit` chat messages."""
    return [{"role": "system", "content": SYSTEM_PROMPT}, *history[-limit:]]


def _error_text(error: HTTPError) -> str:
    try:
        body = json.loads(error.read(20_000).decode("utf-8"))
        if isinstance(body, dict) and body.get("error"):
            return str(body["error"])
    except (OSError, ValueError):
        pass
    return str(error.reason)


def stream_reply(settings: Settings, history: list[dict[str, str]]) -> Iterator[str]:
    """Yield the model's reply piece by piece. Raises BrainError if it fails."""
    if not settings.host.startswith(("http://", "https://")):
        raise BrainError("OLLAMA_HOST must start with http:// or https://")
    payload = {
        "model": settings.model,
        "stream": True,
        "messages": build_messages(history, settings.history_limit),
        "options": {"num_predict": settings.max_tokens},
    }
    request = Request(
        f"{settings.host}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.timeout) as response:
            for raw in response:
                line = raw.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except ValueError as error:
                    raise BrainError("Ollama sent a reply LISA could not read") from error
                if not isinstance(data, dict):
                    raise BrainError("Ollama sent a reply LISA could not read")
                if data.get("error"):
                    raise BrainError(f"Ollama error: {data['error']}")
                message = data.get("message")
                piece = message.get("content", "") if isinstance(message, dict) else ""
                if piece:
                    yield piece
                if data.get("done"):
                    return
    except HTTPError as error:
        raise BrainError(f"Ollama error {error.code}: {_error_text(error)}") from error
    except (URLError, TimeoutError, OSError) as error:
        raise BrainError(
            f"could not reach Ollama at {settings.host} ({error}). "
            f"Is it running? Start it, then run: ollama pull {settings.model}"
        ) from error
