"""LISA Desktop — a Tkinter chat window with Bengali-friendly typography.

Run from the project root with: python -m src.gui
The original terminal app remains available with: python -m src.main
"""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import font, messagebox, scrolledtext, ttk

from src.ai import ai_available, get_model, get_provider
from src.config import load_dotenv
from src.main import ENV_FILE, get_reply, load_history, save_message, say_aloud

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BG = "#100d1c"
PANEL = "#1b1630"
PANEL_LIGHT = "#241d3d"
PURPLE = "#9b7bff"
TEXT = "#f4f0ff"
MUTED = "#b8aecf"
GREEN = "#8ee6bd"


def choose_font(root: tk.Tk) -> str:
    """Prefer Nirmala UI for Bengali; use a common Windows fallback otherwise."""
    try:
        available = set(font.families(root))
    except tk.TclError:
        available = set()
    for candidate in ("Nirmala UI", "Noto Sans Bengali", "Segoe UI"):
        if candidate in available:
            return candidate
    return "TkDefaultFont"


class LisaDesktop:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("LISA — Personal AI Assistant")
        self.root.geometry("900x680")
        self.root.minsize(640, 520)
        self.root.configure(bg=BG)
        self.ui_font = choose_font(root)
        self.history = load_history()
        self.voice_enabled = False
        self.results: queue.Queue[tuple[str, str]] = queue.Queue()
        self.busy = False

        self._build_ui()
        self._restore_history()
        self._set_status()
        self.root.after(100, self._poll_results)

    def _build_ui(self) -> None:
        header = tk.Frame(self.root, bg=PANEL, padx=22, pady=16)
        header.pack(fill="x")
        title = tk.Label(
            header, text="LISA", bg=PANEL, fg=TEXT,
            font=(self.ui_font, 22, "bold"),
        )
        title.pack(side="left")
        subtitle = tk.Label(
            header, text="PERSONAL AI  •  বাংলা + ENGLISH",
            bg=PANEL, fg=MUTED, font=(self.ui_font, 9),
        )
        subtitle.pack(side="left", padx=(14, 0), pady=(8, 0))
        self.status = tk.Label(
            header, text="Checking AI…", bg=PANEL, fg=GREEN,
            font=(self.ui_font, 9),
        )
        self.status.pack(side="right", pady=(8, 0))

        body = tk.Frame(self.root, bg=BG, padx=18, pady=16)
        body.pack(fill="both", expand=True)
        self.chat = scrolledtext.ScrolledText(
            body, wrap="word", state="disabled", relief="flat",
            bg=BG, fg=TEXT, insertbackground=TEXT,
            font=(self.ui_font, 11), padx=14, pady=12,
            borderwidth=0, highlightthickness=1,
            highlightbackground=PANEL_LIGHT,
        )
        self.chat.pack(fill="both", expand=True)
        self.chat.tag_configure("user", foreground="#c7b7ff", font=(self.ui_font, 10, "bold"), spacing1=12)
        self.chat.tag_configure("lisa", foreground=GREEN, font=(self.ui_font, 10, "bold"), spacing1=12)
        self.chat.tag_configure("body", foreground=TEXT, lmargin1=12, lmargin2=12, spacing3=8)
        self.chat.tag_configure("system", foreground=MUTED, font=(self.ui_font, 9, "italic"), spacing1=8, spacing3=8)

        composer = tk.Frame(self.root, bg=PANEL, padx=16, pady=14)
        composer.pack(fill="x")
        self.entry = tk.Entry(
            composer, bg=PANEL_LIGHT, fg=TEXT, insertbackground=TEXT,
            relief="flat", font=(self.ui_font, 11), borderwidth=0,
        )
        self.entry.pack(side="left", fill="x", expand=True, ipady=12, padx=(0, 10))
        self.entry.bind("<Return>", self._send_event)
        self.send_button = tk.Button(
            composer, text="Send", command=self.send_message,
            bg=PURPLE, fg="#100d1c", activebackground="#b6a2ff",
            activeforeground="#100d1c", relief="flat",
            font=(self.ui_font, 10, "bold"), padx=22, pady=10,
            cursor="hand2",
        )
        self.send_button.pack(side="right")

        footer = tk.Frame(self.root, bg=BG, padx=20, pady=8)
        footer.pack(fill="x")
        self.voice_button = tk.Button(
            footer, text="Voice: OFF", command=self.toggle_voice,
            bg=PANEL_LIGHT, fg=TEXT, activebackground=PANEL,
            activeforeground=TEXT, relief="flat",
            font=(self.ui_font, 9), padx=12, pady=6, cursor="hand2",
        )
        self.voice_button.pack(side="left")
        tk.Label(
            footer, text="Chats are saved locally on this computer",
            bg=BG, fg=MUTED, font=(self.ui_font, 9),
        ).pack(side="right")
        self.entry.focus_set()

    def _set_status(self) -> None:
        if ai_available():
            self.status.configure(text=f"AI ON · {get_provider()} · {get_model()}", fg=GREEN)
        else:
            self.status.configure(text="BASIC MODE · AI OFFLINE", fg=MUTED)

    def _append(self, speaker: str, message: str, tag: str) -> None:
        self.chat.configure(state="normal")
        self.chat.insert("end", f"{speaker}\n", tag)
        self.chat.insert("end", f"{message}\n\n", "body")
        self.chat.configure(state="disabled")
        self.chat.see("end")

    def _restore_history(self) -> None:
        if not self.history:
            self._append("LISA", "আমি LISA। কীভাবে সাহায্য করতে পারি?", "lisa")
            return
        for item in self.history[-100:]:
            role = item.get("role")
            speaker, tag = ("You", "user") if role == "user" else ("LISA", "lisa")
            self._append(speaker, str(item.get("message", "")), tag)

    def _send_event(self, _event: tk.Event) -> str:
        self.send_message()
        return "break"

    def send_message(self) -> None:
        message = self.entry.get().strip()
        if not message or self.busy:
            return
        self.entry.delete(0, "end")
        if message.casefold() in {"exit", "quit"}:
            self.root.destroy()
            return
        save_message(self.history, "user", message)
        self._append("You", message, "user")
        self.busy = True
        self.send_button.configure(state="disabled", text="…")
        self.status.configure(text="LISA is thinking…", fg=PURPLE)
        threading.Thread(target=self._answer_worker, args=(message,), daemon=True).start()

    def _answer_worker(self, message: str) -> None:
        try:
            reply = get_reply(self.history, message)
            self.results.put(("reply", reply))
            if self.voice_enabled:
                say_aloud(reply)
        except Exception as error:
            self.results.put(("error", str(error)))

    def _poll_results(self) -> None:
        try:
            while True:
                kind, value = self.results.get_nowait()
                if kind == "reply":
                    save_message(self.history, "lisa", value)
                    self._append("LISA", value, "lisa")
                else:
                    self._append("LISA", f"সমস্যা হয়েছে: {value}", "system")
                self.busy = False
                self.send_button.configure(state="normal", text="Send")
                self._set_status()
        except queue.Empty:
            pass
        self.root.after(100, self._poll_results)

    def toggle_voice(self) -> None:
        self.voice_enabled = not self.voice_enabled
        self.voice_button.configure(text=f"Voice: {'ON' if self.voice_enabled else 'OFF'}")
        self._append(
            "LISA",
            "Voice চালু হয়েছে।" if self.voice_enabled else "Voice বন্ধ হয়েছে।",
            "system",
        )


def main() -> None:
    load_dotenv(ENV_FILE)
    root = tk.Tk()
    LisaDesktop(root)
    root.mainloop()


if __name__ == "__main__":
    main()
