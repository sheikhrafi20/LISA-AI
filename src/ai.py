"""AI replies for LISA, using the Anthropic Messages API.

Only the standard library and certifi are used (TLS verification stays on).
Set ANTHROPIC_API_KEY (for example in a .env file) to turn AI replies on.
Optionally set LISA_MODEL to choose a different model.
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
MAX_HISTORY = 20
MAX_TOKENS = 600
TIMEOUT = 30.0

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


def get_model() -> str:
    return os.environ.get("LISA_MODEL", "").strip() or DEFAULT_MODEL


def ai_available() -> bool:
    return bool(get_api_key())


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
    try:
        body = json.loads(error.read(20_000).decode("utf-8"))
        message = body.get("error", {}).get("message")
        if message:
            return str(message)
    except (OSError, ValueError, AttributeError):
        pass
    return str(error.reason)


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
    try:
        with urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            data = json.loads(response.read(2_000_000).decode("utf-8"))
    except HTTPError as error:
        raise AIError(f"API error {error.code}: {_error_message(error)}") from error
    except (URLError, TimeoutError, OSError, ValueError) as error:
        raise AIError(f"could not reach the AI service: {error}") from error
    if not isinstance(data, dict):
        raise AIError("unexpected response from the AI service")
    return data


def generate_reply(history: list[dict[str, str]]) -> str:
    """Return an AI reply to the last user message in history."""
    api_key = get_api_key()
    if not api_key:
        raise AIError("ANTHROPIC_API_KEY is not set")

    messages = build_messages(history)
    if not messages or messages[-1]["role"] != "user":
        raise AIError("there is no user message to answer")

    payload = {
        "model": get_model(),
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": messages,
    }
    data = _post(payload, api_key, TIMEOUT)
    blocks = data.get("content") or []
    text = "".join(
        block.get("text", "") for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ).strip()
    if not text:
        raise AIError("the AI returned an empty reply")
    return text
