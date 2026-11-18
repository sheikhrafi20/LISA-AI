"""LISA V4 — bilingual AI assistant with basic internet utilities.

Run from the project root with: python -m src.main
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from urllib.error import URLError

from src.ai import AIError, ai_available, generate_reply, get_model, get_provider
from src.config import load_dotenv
from src.network import check_internet, web_search
from src.voice import VoiceError, speak

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
HISTORY_FILE = DATA_DIR / "chat_history.json"
ENV_FILE = PROJECT_ROOT / ".env"
PUNCTUATION = ".,!?;:()\"'।"
VOICE_ON_VALUES = {"on", "1", "true", "yes"}


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
    """Add one message to the history and write the history file."""
    history.append({
        "role": role,
        "message": message,
        "time": datetime.now().astimezone().isoformat(timespec="seconds"),
    })
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def show_welcome() -> None:
    print("\n" + "═" * 54)
    print("  LISA V4  |  PERSONAL ASSISTANT")
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
  voice on / off   - Speak replies aloud (uses the computer's own voice)
  clear            - Clear terminal
  exit             - Close LISA

বাংলা বা English-এ সাধারণ মেসেজও লিখতে পারো।
AI চালু করতে README-র 'Turning on AI' অংশ দেখো (Ollama হলে ফ্রি)।
""")


def _has_any(text: str, words: tuple[str, ...], phrases: tuple[str, ...] = ()) -> bool:
    """Match whole words (so "hi" does not match "this") or exact phrases."""
    tokens = {token.strip(PUNCTUATION) for token in text.split()}
    return any(word in tokens for word in words) or any(phrase in text for phrase in phrases)


def make_reply(message: str) -> str:
    text = message.strip().casefold()
    if _has_any(text, ("hello", "hi", "hey", "হ্যালো", "হাই", "আসসালামু")):
        return "Hello! আমি LISA। আজ কী নিয়ে কাজ করতে চাও?"
    if _has_any(text, (), ("তোমার নাম", "who are you", "your name")):
        return "আমার নাম LISA। আমি RAFI-এর Python assistant project."
    if _has_any(text, (), ("কেমন আছ", "how are you")):
        return "আমি প্রস্তুত আছি! তুমি কীভাবে সাহায্য চাও?"
    if _has_any(text, ("ধন্যবাদ", "thanks"), ("thank you",)):
        return "স্বাগতম! / You're welcome."
    return ("তোমার মেসেজটি পেয়েছি। AI চালু নেই, তাই আমি শুধু সাধারণ কিছু কথা বুঝি। "
            "AI চালু করতে README দেখো, অথবা ওয়েবে খুঁজতে "
            "search <তোমার প্রশ্ন> লিখো।")


def get_reply(history: list[dict[str, str]], message: str) -> str:
    """Use the AI model when a key is set; otherwise (or on error) use basic replies."""
    if ai_available():
        try:
            return generate_reply(history)
        except AIError as error:
            print(f"LISA: AI is not available right now ({error}). Using basic replies.")
    return make_reply(message)


def say_aloud(text: str) -> bool:
    """Speak text with the system voice. Returns False if that was not possible."""
    try:
        speak(text)
    except VoiceError as error:
        print(f"LISA: Could not speak ({error}).")
        return False
    return True


def handle_voice_command(command: str, current: bool) -> bool:
    """Handle voice / voice on / voice off. Returns the new on/off state."""
    if command == "voice off":
        print("LISA: Voice OFF.")
        return False
    if command == "voice on":
        if say_aloud("Voice is on."):
            print("LISA: Voice ON. I will speak my replies.")
            return True
        return False
    print(f"LISA: Voice is {'ON' if current else 'OFF'}. Type 'voice on' or 'voice off'.")
    return current


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
            print("LISA: কোনো ফলাফল পাওয়া যায়নি।")
            return
        for index, (title, url) in enumerate(results, start=1):
            print(f"\n{index}. {title}\n   {url}")
        print("\nLISA: এগুলো বাইরের ওয়েবসাইটের ফলাফল। লিংক খোলার আগে যাচাই করো।")
    except (URLError, TimeoutError, OSError, ValueError) as error:
        print(f"LISA: Search failed: {error}")


def main() -> None:
    load_dotenv(ENV_FILE)
    history = load_history()
    voice_on = os.environ.get("LISA_VOICE", "").strip().casefold() in VOICE_ON_VALUES
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
            print("LISA V4: Python assistant with bilingual chat, local history, web search and AI replies.")
            if ai_available():
                print(f"AI: ON ({get_provider()}, model: {get_model()})")
            else:
                print("AI: OFF — see the README (Turning on AI) to use Ollama or an API key.")
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
        elif command in {"voice", "voice on", "voice off"}:
            voice_on = handle_voice_command(command, voice_on)
        elif command == "clear":
            print("\033[2J\033[H", end="")
            show_welcome()
        else:
            save_message(history, "user", message)
            reply = get_reply(history, message)
            print("\nLISA >", reply)
            if voice_on:
                say_aloud(reply)
            save_message(history, "lisa", reply)


if __name__ == "__main__":
    main()
