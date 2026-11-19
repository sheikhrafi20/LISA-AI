"""LISA's command-line chat."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Callable, Iterator, TextIO

from lisa.brain import BrainError, stream_reply
from lisa.config import Settings, load_dotenv, load_settings

ROOT = Path(__file__).resolve().parent.parent

WELCOME = """
==================================================
  LISA — your personal AI
  Type a message and press Enter.
  Commands: help | new | about | exit
==================================================
"""

HELP = """
Commands:
  help   show this list
  new    forget this chat and start again
  about  show the model LISA is using
  exit   close LISA
"""

StreamFn = Callable[[Settings, list[dict[str, str]]], Iterator[str]]


def run(
    settings: Settings,
    read: Callable[[str], str] = input,
    out: TextIO | None = None,
    stream: StreamFn = stream_reply,
) -> int:
    """The chat loop. `read`, `out` and `stream` can be replaced in tests."""
    out = out or sys.stdout

    def say(text: str = "") -> None:
        out.write(text)
        out.flush()

    history: list[dict[str, str]] = []
    say(WELCOME)
    while True:
        try:
            message = read("\nYou > ").strip()
        except (EOFError, KeyboardInterrupt):
            say("\nLISA: Bye.\n")
            return 0
        if not message:
            continue

        command = message.casefold()
        if command in {"exit", "quit", "বন্ধ"}:
            say("LISA: Goodbye.\n")
            return 0
        if command == "help":
            say(HELP)
            continue
        if command == "new":
            history.clear()
            say("LISA: Okay, I forgot this chat. Let’s start again.\n")
            continue
        if command == "about":
            say(f"LISA: model {settings.model} on {settings.host} (free, runs on your computer).\n")
            continue

        history.append({"role": "user", "content": message})
        say("\nLISA > ")
        pieces: list[str] = []
        try:
            for piece in stream(settings, history):
                pieces.append(piece)
                say(piece)
        except BrainError as error:
            history.pop()
            say(f"\nLISA: {error}\n")
            continue
        except KeyboardInterrupt:
            history.pop()
            say("\nLISA: (stopped)\n")
            continue
        reply = "".join(pieces).strip()
        if reply:
            history.append({"role": "assistant", "content": reply})
        else:
            history.pop()
            say("(no reply)")
        say("\n")


def main() -> int:
    load_dotenv(ROOT / ".env")
    return run(load_settings())
