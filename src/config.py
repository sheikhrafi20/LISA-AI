"""Tiny .env loader (no extra dependency).

Reads KEY=VALUE lines from a .env file and puts them into os.environ.
Variables that are already set in the real environment are never overwritten.
"""

from __future__ import annotations

import codecs
import os
from pathlib import Path


def _read_text(path: Path) -> str:
    """Read a text file as UTF-8, UTF-8 with BOM, or UTF-16.

    Windows PowerShell's `echo X > .env` writes UTF-16, so UTF-16 must work too.
    """
    raw = path.read_bytes()
    if raw.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return raw.decode("utf-16")
    return raw.decode("utf-8-sig")


def load_dotenv(path: Path) -> None:
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
