<div align="center">

<img src="assets/lisa-banner.svg" alt="LISA — Personal AI Assistant" width="100%"/>

### Your personal AI assistant, built step by step with Python.

[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Status](https://img.shields.io/badge/Status-In%20Development-8B5CF6?style=for-the-badge)](#-project-status)
[![Tests](https://img.shields.io/badge/Tests-pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](#-running-tests)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)
[![Made by RAFI](https://img.shields.io/badge/Made%20by-RAFI-EC4899?style=for-the-badge)](https://github.com/sheikhrafi20)

</div>

---

## ✨ About LISA

**LISA** is a personal AI assistant project by **RAFI**, built with Python. It is developed gradually, starting with a clean foundation and adding useful assistant capabilities in small, testable stages.

The current version (**V3**) is a command-line assistant that understands simple **বাংলা + English** messages and has basic internet utilities.

## 🚀 Features (V3)

- 🗣️ Bilingual (বাংলা + English) replies to common messages
- 🌐 Internet connection check
- 🔎 Web search from the terminal (returns links, not AI-generated answers)
- 🕒 Local time
- 💾 Local chat history, saved on your own computer only
- 📜 `history` command to view recent messages

> ⚠️ This version does **not** include an AI language model yet. Replies are rule-based.

## 🖥️ Demo

```text
══════════════════════════════════════════════════════
  LISA V3  |  PERSONAL ASSISTANT
  Built by RAFI • বাংলা + English • Internet tools
══════════════════════════════════════════════════════
  আমি LISA. কীভাবে সাহায্য করতে পারি?
  Commands: help | internet | search <query> | history | exit
  Note: Search results are links, not AI-generated answers.
══════════════════════════════════════════════════════

RAFI > hello

LISA > Hello! আমি LISA। আজ কী নিয়ে কাজ করতে চাও?

RAFI > time
LISA: 2026-11-17 21:56:09 UTC

RAFI > exit
LISA: Goodbye, RAFI.
```

## ⚡ Quick start

```bash
git clone https://github.com/sheikhrafi20/LISA-AI.git
cd LISA-AI
python -m pip install -r requirements.txt
python -m src.main
```

Run it from the project root.

## 💬 Commands

| Command | What it does |
|---|---|
| `help` | Show all commands |
| `about` | About LISA |
| `time` | Show local time |
| `internet` | Check internet connection |
| `search <query>` | Search the public web |
| `history` | Show recent chat history |
| `clear` | Clear the terminal |
| `exit` | Close LISA |

## 🧪 Running tests

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

Tests cover reply matching, chat history saving/loading, and the web search and internet check (using fake network responses, so they run offline).

## 🧰 Technology

| Technology | Purpose |
|---|---|
| Python | Main programming language |
| certifi | Secure HTTPS certificates |
| pytest | Automated tests |
| Git & GitHub | Version control and project hosting |

## 📁 Project structure

```text
LISA-AI/
├── assets/
│   └── lisa-banner.svg
├── src/
│   ├── main.py            # CLI, commands and chat loop
│   └── network.py         # Internet check and web search
├── tests/
│   ├── test_main.py
│   └── test_network.py
├── .gitignore
├── LICENSE
├── README.md
├── requirements.txt
└── requirements-dev.txt
```

## 🎯 Project goals

- Build a solid Python-based assistant foundation
- Create a simple, user-friendly interface
- Explore conversational AI features
- Add features in small, testable stages
- Keep user permissions and privacy in mind

## 🔒 Privacy

Chat history is stored locally in `data/chat_history.json`, which is excluded from Git via `.gitignore`. Web search sends only the query you type.

## 🚧 Project status

LISA is in **active early development**. See the [open issues](https://github.com/sheikhrafi20/LISA-AI/issues) for the roadmap.

## 👨‍💻 Developer

**RAFI** — [@sheikhrafi20](https://github.com/sheikhrafi20)

---

<div align="center">

*Built with curiosity, Python, and consistent learning.*

</div>
