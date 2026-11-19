"""Settings for LISA, read from environment variables and an optional .env file."""

from __future__ import annotations

import codecs
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

DEFAULT_MODEL = "llama3.2"
DEFAULT_HOST = "http://localhost:11434"


@dataclass(frozen=True)
class Settings:
    model: str = DEFAULT_MODEL
    host: str = DEFAULT_HOST
    max_tokens: int = 600
    timeout: float = 120.0  # a local model can be slow, especially on the first reply
    history_limit: int = 20  # how many recent messages LISA remembers in one chat


def _positive_int(value: str, default: int, minimum: int = 1) -> int:
    try:
        number = int(value.strip())
    except ValueError:
        return default
    return number if number >= minimum else default


def load_settings(env: Mapping[str, str] | None = None) -> Settings:
    """Build Settings from LISA_MODEL, OLLAMA_HOST, LISA_MAX_TOKENS and LISA_HISTORY."""
    env = os.environ if env is None else env
    host = env.get("OLLAMA_HOST", "").strip().rstrip("/") or DEFAULT_HOST
    if "://" not in host:  # Ollama itself accepts values like 127.0.0.1:11434
        host = "http://" + host
    return Settings(
        model=env.get("LISA_MODEL", "").strip() or DEFAULT_MODEL,
        host=host,
        max_tokens=_positive_int(env.get("LISA_MAX_TOKENS", ""), 600),
        history_limit=_positive_int(env.get("LISA_HISTORY", ""), 20, minimum=2),
    )


def _read_text(path: Path) -> str:
    """Read UTF-8, UTF-8 with BOM, or UTF-16 (Windows PowerShell `echo X > .env` writes UTF-16)."""
    raw = path.read_bytes()
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return raw.decode("utf-16")
    return raw.decode("utf-8-sig")


def load_dotenv(path: Path) -> None:
    """Put KEY=VALUE lines from a .env file into os.environ (never overriding real variables)."""
    try:
        lines = _read_text(path).splitlines()
    except (OSError, UnicodeDecodeError):
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("\"'")
        if key and key not in os.environ:
            os.environ[key] = value
