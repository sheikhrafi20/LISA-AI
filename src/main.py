"""LISA — RAFI's personal AI assistant.

Run with: python -m src.main
"""

from datetime import datetime


def show_welcome() -> None:
    print("=" * 48)
    print("  LISA | Personal AI Assistant")
    print("  Built by RAFI")
    print("=" * 48)
    print(f"  Local time: {datetime.now().astimezone():%Y-%m-%d %H:%M:%S}")
    print("\nLISA is starting in foundation mode.")
    print("Type 'help' to see commands or 'exit' to quit.")


def show_help() -> None:
    print("\nAvailable commands:")
    print("  help  - show this help message")
    print("  about - show project information")
    print("  exit  - close LISA")


def main() -> None:
    show_welcome()

    while True:
        try:
            command = input("\nRAFI > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nLISA: Session closed.")
            break

        if command in {"exit", "quit"}:
            print("LISA: Goodbye.")
            break
        elif command == "help":
            show_help()
        elif command == "about":
            print("\nLISA is a Python-based personal assistant project.")
            print("AI features will be added in later development stages.")
        elif command:
            print(f"LISA: I don't know that command yet: {command!r}")
            print("Type 'help' to see available commands.")


if __name__ == "__main__":
    main()
