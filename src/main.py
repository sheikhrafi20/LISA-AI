"""LISA V3 — bilingual assistant with basic internet utilities.

Run from the project root with: python -m src.main
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from urllib.error import URLError

from src.network import check_internet, web_search

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
HISTORY_FILE = DATA_DIR / "chat_history.json"


def load_history() -> list[dict[str, str]]:
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
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def show_welcome() -> None:
    print("\n" + "═" * 54)
    print("  LISA V3  |  PERSONAL ASSISTANT")
    print("  Built by RAFI • বাংলা + English • Internet tools")
    print("═" * 54)
    print("  আমি LISA. কীভাবে সাহায্য করতে পারি?")
    print("  Commands: help | internet | search <query> | history | exit")
    print("  Note: Search results are links, not AI-generated answers.")
    print("═" * 54)


def show_help() -> None:
    print("""
Commands / কমান্ড:
  help             - Show commands
  about            - About LISA
  time             - Show local time
  internet         - Check internet connection
  search <query>   - Search the public web
  history          - Show recent local chat history
  clear            - Clear terminal
  exit             - Close LISA

বাংলা বা English-এ সাধারণ মেসেজও লিখতে পারো।
এই সংস্করণে এখনো AI model যুক্ত হয়নি।
""")


def make_reply(message: str) -> str:
    text = message.strip().casefold()
    if any(word in text for word in ("hello", "hi", "hey", "হ্যালো", "হাই", "আসসালামু")):
        return "Hello! আমি LISA। আজ কী নিয়ে কাজ করতে চাও?"
    if any(word in text for word in ("তোমার নাম", "তোমার নাম কি", "who are you", "your name")):
        return "আমার নাম LISA। আমি RAFI-এর Python assistant project."
    if any(word in text for word in ("কেমন আছ", "কেমন আছো", "how are you")):
        return "আমি প্রস্তুত আছি! তুমি কীভাবে সাহায্য চাও?"
    if any(word in text for word in ("ধন্যবাদ", "thanks", "thank you")):
        return "স্বাগতম! / You're welcome."
    return ("তোমার মেসেজটি পেয়েছি। এই সংস্করণে সাধারণ কথোপকথনের জন্য এখনো AI model নেই। "
            "ওয়েবে খুঁজতে search <তোমার প্রশ্ন> লিখো।")


def show_recent_history(history: list[dict[str, str]], limit: int = 10) -> None:
    if not history:
        print("LISA: এখনো কোনো chat history নেই।")
        return
    print("\n--- Recent chat ---")
    for item in history[-limit:]:
        role = "You" if item.get("role") == "user" else "LISA"
        print(f"{role}: {item.get('message', '')}")


def run_search(query: str) -> None:
    if not query.strip():
        print("Usage: search <your question>")
        return
    print("\nLISA: Searching the public web...")
    try:
        results = web_search(query)
        if not results:
            print("LISA: কোনো ফলাফল পাওয়া যায়নি।")
            return
        for index, (title, url) in enumerate(results, start=1):
            print(f"\n{index}. {title}\n   {url}")
        print("\nLISA: এগুলো বাইরের ওয়েবসাইটের ফলাফল। লিংক খোলার আগে যাচাই করো।")
    except (URLError, TimeoutError, OSError, ValueError) as error:
        print(f"LISA: Search failed: {error}")


def main() -> None:
    history = load_history()
    show_welcome()
    while True:
        try:
            message = input("\nRAFI > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nLISA: Session closed.")
            break
        if not message:
            continue

        command = message.casefold()
        if command in {"exit", "quit", "বন্ধ", "বের হও"}:
            print("LISA: Goodbye, RAFI.")
            break
        if command == "help":
            show_help()
        elif command == "about":
            print("LISA V3: Python assistant with bilingual chat, local history and basic web search.")
            print("এখনো AI model যুক্ত হয়নি।")
        elif command == "time":
            print("LISA:", datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"))
        elif command == "internet":
            print("LISA: Checking internet...")
            connected, detail = check_internet()
            print(("ONLINE ✓ " if connected else "OFFLINE ✗ ") + detail)
        elif command.startswith("search "):
            run_search(message[7:].strip())
        elif command == "search":
            run_search("")
        elif command == "history":
            show_recent_history(history)
        elif command == "clear":
            print("\033[2J\033[H", end="")
            show_welcome()
        else:
            history.append({"role": "user", "message": message,
                            "time": datetime.now().astimezone().isoformat(timespec="seconds")})
            reply = make_reply(message)
            print("\nLISA >", reply)
            history.append({"role": "lisa", "message": reply,
                            "time": datetime.now().astimezone().isoformat(timespec="seconds")})
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
