"""Lightweight animated 2D avatar for LISA's Tkinter desktop UI.

This is a native Canvas character (not a rendered 3D model). A future 3D
renderer can replace this widget without changing the chat/AI engine.
"""
from __future__ import annotations

import tkinter as tk


class LisaAvatar(tk.Canvas):
    def __init__(self, master: tk.Misc, width: int = 230, height: int = 270) -> None:
        super().__init__(
            master, width=width, height=height, bg="#171226",
            highlightthickness=1, highlightbackground="#3c2d60",
        )
        self.width = width
        self.height = height
        self._blink = False
        self._talking = False
        self._mouth_open = False
        self._draw()
        self.after(700, self._animate)

    def set_talking(self, talking: bool) -> None:
        self._talking = talking

    def _draw(self) -> None:
        self.delete("all")
        cx = self.width // 2
        # Soft neon halo and shoulders
        self.create_oval(cx-91, 22, cx+91, 204, fill="#251b42", outline="#7654b8", width=2)
        self.create_oval(cx-72, 150, cx+72, 292, fill="#6d4b9e", outline="#b89aff", width=2)
        # Hair behind face
        self.create_oval(cx-69, 42, cx+69, 185, fill="#302044", outline="#b18be9", width=2)
        # Face
        self.create_oval(cx-51, 62, cx+51, 174, fill="#f4cbbd", outline="#e9b5ad", width=1)
        # Side locks and fringe
        self.create_oval(cx-67, 69, cx-39, 184, fill="#332044", outline="")
        self.create_oval(cx+39, 69, cx+67, 184, fill="#332044", outline="")
        self.create_polygon(
            cx-54, 100, cx-50, 52, cx-17, 35, cx+20, 43,
            cx+55, 78, cx+37, 91, cx+12, 72, cx-7, 91,
            cx-28, 75, fill="#44305f", outline="#b18be9", width=2,
        )
        # Eyes
        if self._blink:
            self.create_line(cx-32, 112, cx-14, 112, fill="#392642", width=3)
            self.create_line(cx+14, 112, cx+32, 112, fill="#392642", width=3)
        else:
            for x in (cx-23, cx+23):
                self.create_oval(x-8, 103, x+8, 124, fill="#fff8ff", outline="#49335f")
                self.create_oval(x-4, 106, x+5, 121, fill="#7651a5", outline="")
                self.create_oval(x-1, 108, x+2, 114, fill="#21172e", outline="")
                self.create_oval(x-2, 108, x+1, 111, fill="#ffffff", outline="")
        # Nose, blush and mouth
        self.create_oval(cx-2, 128, cx+2, 132, fill="#d99b91", outline="")
        self.create_oval(cx-39, 128, cx-25, 135, fill="#e9a6a9", outline="")
        self.create_oval(cx+25, 128, cx+39, 135, fill="#e9a6a9", outline="")
        if self._talking and self._mouth_open:
            self.create_oval(cx-7, 139, cx+7, 151, fill="#8e405e", outline="#a95c78")
        else:
            self.create_arc(cx-9, 135, cx+9, 151, start=205, extent=130, style="arc", outline="#a65d70", width=2)
        # Headset accents
        self.create_arc(cx-63, 52, cx+63, 166, start=35, extent=110, style="arc", outline="#c6a3ff", width=4)
        self.create_text(cx, 235, text="LISA", fill="#e8d9ff", font=("Segoe UI", 15, "bold"))
        self.create_text(cx, 256, text="AI COMPANION", fill="#a995c8", font=("Segoe UI", 8))

    def _animate(self) -> None:
        self._blink = not self._blink if not self._blink else False
        self._mouth_open = not self._mouth_open if self._talking else False
        self._draw()
        self.after(180 if self._talking else 650, self._animate)
