"""AI replies for LISA.

Two providers are supported (standard library + certifi only):

* ollama     - a model running on your own computer. Free, private, no API key.
               Turn on with LISA_PROVIDER=ollama.
* anthropic  - the Anthropic Messages API. Needs ANTHROPIC_API_KEY (paid).

Optional settings: LISA_MODEL, OLLAMA_HOST.
"""

from __future__ import annotations

import json
import os
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from src.network import SSL_CONTEXT

API_URL = "https://api.anthropic.com/v1/messages"
API_VERSION = "2023-06-01"
DEFAULT_MODEL = "claude-haiku-5-5"
DEFAULT_OLLAMA_MODEL = "llama3.2"
DEFAULT_OLLAMA_HOST = "http://localhost:11434"
MAX_HISTORY = 20
MAX_TOKENS = 600
TIMEOUT = 30.0
OLLAMA_TIMEOUT = 120.0  # a local model can be slow, especially on the first reply

SYSTEM_PROMPT = (
    "You are LISA, a friendly personal assistant built by RAFI as a Python project. "
    "Reply in the same language the user writes in: বাংলা, English, or Banglish "
    "(Bengali written in English letters). Keep answers short, clear and helpful. "
    "If you do not know something, say so instead of guessing. "
    "You cannot browse the web yourself; tell the user they can type "
    "'search <question>' to get web links."
)


class AIError(Exception):
    """Raised when an AI reply cannot be produced."""


def get_api_key() -> str:
    return os.environ.get("ANTHROPIC_API_KEY", "").strip()


def get_provider() -> str:
    """Return "ollama", "anthropic", or "" when AI is off."""
    provider = os.environ.get("LISA_PROVIDER", "").strip().casefold()
    if provider == "ollama":
        return "ollama"
    if provider in ("", "anthropic") and get_api_key():
        return "anthropic"
    return ""


def get_model() -> str:
    default = DEFAULT_OLLAMA_MODEL if get_provider() == "ollama" else DEFAULT_MODEL
    return os.environ.get("LISA_MODEL", "").strip() or default


def get_ollama_host() -> str:
    return os.environ.get("OLLAMA_HOST", "").strip().rstrip("/") or DEFAULT_OLLAMA_HOST


def ai_available() -> bool:
    return bool(get_provider())


def build_messages(history: list[dict[str, str]], limit: int = MAX_HISTORY) -> list[dict[str, str]]:
    """Turn LISA's saved history into API messages.

    The API needs alternating user/assistant turns that start with a user turn,
    so consecutive messages from the same side are merged.
    """
    messages: list[dict[str, str]] = []
    for item in history[-limit:]:
        text = str(item.get("message", "")).strip()
        if not text:
            continue
        role = "user" if item.get("role") == "user" else "assistant"
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"] += "\n" + text
        else:
            messages.append({"role": role, "content": text})
    while messages and messages[0]["role"] != "user":
        messages.pop(0)
    return messages


def _error_message(error: HTTPError) -> str:
    """Pull a readable message out of an error response (Anthropic or Ollama format)."""
    try:
        body = json.loads(error.read(20_000).decode("utf-8"))
        detail = body.get("error") if isinstance(body, dict) else None
        if isinstance(detail, dict):
            detail = detail.get("message")
        if detail:
            return str(detail)
    except (OSError, ValueError):
        pass
    return str(error.reason)


def _send(request: Request, timeout: float, hint: str = "") -> dict[str, Any]:
    try:
        with urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            data = json.loads(response.read(2_000_000).decode("utf-8"))
    except HTTPError as error:
        raise AIError(f"API error {error.code}: {_error_message(error)}") from error
    except (URLError, TimeoutError, OSError, ValueError) as error:
        raise AIError(f"could not reach the AI service: {error}{hint}") from error
    if not isinstance(data, dict):
        raise AIError("unexpected response from the AI service")
    return data


def _post(payload: dict[str, Any], api_key: str, timeout: float) -> dict[str, Any]:
    request = Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": API_VERSION,
        },
        method="POST",
    )
    return _send(request, timeout)


def _post_ollama(payload: dict[str, Any], host: str, timeout: float) -> dict[str, Any]:
    if not host.startswith(("http://", "https://")):
        raise AIError("OLLAMA_HOST must start with http:// or https://")
    request = Request(
        f"{host}/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    hint = f". Is Ollama running? Start it, then run: ollama pull {payload.get('model', '')}"
    return _send(request, timeout, hint)


def _anthropic_reply(messages: list[dict[str, str]]) -> str:
    api_key = get_api_key()
    if not api_key:
        raise AIError("ANTHROPIC_API_KEY is not set")
    payload = {
        "model": get_model(),
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": messages,
    }
    data = _post(payload, api_key, TIMEOUT)
    blocks = data.get("content") or []
    return "".join(
        block.get("text", "") for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ).strip()


def _ollama_reply(messages: list[dict[str, str]]) -> str:
    payload = {
        "model": get_model(),
        "stream": False,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        "options": {"num_predict": MAX_TOKENS},
    }
    data = _post_ollama(payload, get_ollama_host(), OLLAMA_TIMEOUT)
    message = data.get("message")
    content = message.get("content", "") if isinstance(message, dict) else ""
    return str(content).strip()


def generate_reply(history: list[dict[str, str]]) -> str:
    """Return an AI reply to the last user message in history."""
    provider = get_provider()
    if not provider:
        raise AIError("AI is off: set LISA_PROVIDER=ollama or ANTHROPIC_API_KEY")

    messages = build_messages(history)
    if not messages or messages[-1]["role"] != "user":
        raise AIError("there is no user message to answer")

    text = _ollama_reply(messages) if provider == "ollama" else _anthropic_reply(messages)
    if not text:
        raise AIError("the AI returned an empty reply")
    return text
