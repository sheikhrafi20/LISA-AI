"""LISA V2 — bilingual local chat interface.

Run from the project root with: python -m src.main

This version is a local rule-based interface, not an online AI model yet.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
HISTORY_FILE = DATA_DIR / "chat_history.json"


def load_history() -> list[dict[str, str]]:
    """Load this device's chat history, if it exists."""
    try:
        if HISTORY_FILE.exists():
            data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
    except (OSError, json.JSONDecodeError):
        print("LISA: Could not read old chat history; starting a new session.")
    return []


def save_message(history: list[dict[str, str]], role: str, message: str) -> None:
    history.append({
        "role": role,
        "message": message,
        "time": datetime.now().astimezone().isoformat(timespec="seconds"),
    })
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(
        json.dumps(history, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def show_welcome() -> None:
    print("\n" + "═" * 54)
    print("  LISA V2  |  PERSONAL AI ASSISTANT")
    print("  Built by RAFI • বাংলা + English")
    print("═" * 54)
    print("  আমি LISA. কীভাবে সাহায্য করতে পারি?")
    print("  I am LISA. How can I help?")
    print("  Type help for commands • সাহায্যের জন্য help লিখুন")
    print("  Note: This version works locally; AI model is not connected.")
    print("═" * 54)


def show_help() -> None:
    print("""
Commands / কমান্ড:
  help      - Show commands / সাহায্য
  about     - About LISA / LISA সম্পর্কে
  time      - Show local time / সময় দেখাও
  history   - Show recent chat / আগের কথোপকথন
  clear     - Clear terminal / স্ক্রিন পরিষ্কার
  exit      - Close LISA / বন্ধ করো

You can also write simple messages in Bangla or English.
তুমি বাংলায় বা ইংরেজিতে সাধারণ মেসেজ লিখতে পারো।
""")


def make_reply(message: str) -> str:
    """Small bilingual starter responses; no claim of AI understanding."""
    text = message.strip().lower()

    if any(word in text for word in ("hello", "hi", "hey", "হ্যালো", "হাই", "আসসালামু")):
        return "Hello! আমি LISA। আজ কী নিয়ে কাজ করতে চাও? / What would you like to work on?"
    if any(word in text for word in ("তোমার নাম", "তোমার নাম কি", "who are you", "your name")):
        return "আমার নাম LISA। আমি RAFI-এর Python assistant project."
    if any(word in text for word in ("কেমন আছ", "কেমন আছো", "how are you")):
        return "আমি প্রস্তুত আছি! তুমি কীভাবে সাহায্য চাও? / I'm ready to help."
    if any(word in text for word in ("ধন্যবাদ", "thanks", "thank you")):
        return "স্বাগতম! / You're welcome."
    if any(word in text for word in ("কি করতে পারো", "কী করতে পারো", "what can you do")):
        return "এখন আমি basic chat, help, time ও local chat history দিতে পারি। প্রকৃত AI response এখনো যুক্ত হয়নি."
    return (
        "তোমার মেসেজটি পেয়েছি। তবে এই সংস্করণে এখনো AI model সংযুক্ত নেই, "
        "তাই জটিল প্রশ্নের উত্তর দিতে পারছি না। / Message received. "
        "An AI model is not connected yet."
    )


def show_recent_history(history: list[dict[str, str]], limit: int = 10) -> None:
    if not history:
        print("LISA: এখনো কোনো chat history নেই। / No chat history yet.")
        return
    print("\n--- Recent chat / সাম্প্রতিক কথোপকথন ---")
    for item in history[-limit:]:
        role = "You" if item.get("role") == "user" else "LISA"
        print(f"{role}: {item.get('message', '')}")


def main() -> None:
    history = load_history()
    show_welcome()

    while True:
        try:
            message = input("\nRAFI > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nLISA: Session closed. / সেশন বন্ধ হয়েছে।")
            break

        if not message:
            continue

        command = message.casefold()

        if command in {"exit", "quit", "বন্ধ", "বের হও"}:
            print("LISA: Goodbye, RAFI. / বিদায়!")
            break
        if command == "help":
            show_help()
            continue
        if command == "about":
            print("\nLISA is a Python-based personal assistant project by RAFI.")
            print("এই সংস্করণে bilingual terminal chat ও local history আছে; online AI এখনো যুক্ত হয়নি।")
            continue
        if command == "time":
            print("LISA:", datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"))
            continue
        if command == "history":
            show_recent_history(history)
            continue
        if command == "clear":
            print("\033[2J\033[H", end="")
            show_welcome()
            continue

        save_message(history, "user", message)
        reply = make_reply(message)
        print("\nLISA >", reply)
        save_message(history, "lisa", reply)


if __name__ == "__main__":
    main()
