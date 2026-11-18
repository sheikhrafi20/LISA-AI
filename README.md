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

The current version (**V4**) is a command-line assistant that chats in **বাংলা + English**, can use a real **AI model** for replies, and has basic internet utilities.

## 🚀 Features (V4)

- 🤖 **AI replies** through the Anthropic API (turn on by adding your own API key)
- 🔁 Automatic fallback to basic rule-based replies when AI is off or unavailable
- 🗣️ Bilingual (বাংলা + English) conversation
- 🌐 Internet connection check
- 🔎 Web search from the terminal (returns links, not AI-generated answers)
- 🕒 Local time
- 💾 Local chat history, saved on your own computer only
- 📜 `history` command to view recent messages

## 🔑 Turning on AI

AI is **off by default**. LISA uses it only when you add your own API key:

1. Create an API key in the [Anthropic Console](https://console.anthropic.com/).
2. Copy `.env.example` to `.env` and put your key in it:

   ```text
   ANTHROPIC_API_KEY=your-api-key-here
   ```

3. Run LISA and type `about`. It should show `AI: ON`.

Optional: set `LISA_MODEL` in `.env` to use a different model (default: `claude-haiku-5-5`).

`.env` is listed in `.gitignore`, so your key is never committed. If the AI service cannot be reached (no internet, wrong key, rate limit), LISA prints the reason and answers with basic replies instead.

## 🖥️ Demo

This is real output from running LISA **without** an API key (basic replies):

```text
══════════════════════════════════════════════════════
  LISA V4  |  PERSONAL ASSISTANT
  Built by RAFI • বাংলা + English • Internet tools
══════════════════════════════════════════════════════
  আমি LISA. কীভাবে সাহায্য করতে পারি?
  Commands: help | internet | search <query> | history | exit
  Note: Search results are links, not AI-generated answers.
══════════════════════════════════════════════════════

RAFI > about
LISA V4: Python assistant with bilingual chat, local history, web search and AI replies.
AI: OFF — add ANTHROPIC_API_KEY to the .env file to turn it on.

RAFI > hello

LISA > Hello! আমি LISA। আজ কী নিয়ে কাজ করতে চাও?

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
| `about` | About LISA and whether AI is on |
| `time` | Show local time |
| `internet` | Check internet connection |
| `search <query>` | Search the public web |
| `history` | Show recent chat history |
| `clear` | Clear the terminal |
| `exit` | Close LISA |

Anything else you type is a chat message.

## 🧪 Running tests

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

Tests cover reply matching, the AI request/response handling, `.env` loading, chat history saving/loading, and the web search and internet check. They use fake network responses, so they run offline and never need an API key.

## 🧰 Technology

| Technology | Purpose |
|---|---|
| Python | Main programming language |
| Anthropic Messages API | Optional AI replies |
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
│   ├── ai.py              # AI replies (Anthropic API)
│   ├── config.py          # Small .env loader
│   └── network.py         # Internet check and web search
├── tests/
│   ├── test_main.py
│   ├── test_ai.py
│   ├── test_config.py
│   └── test_network.py
├── .env.example
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

- Chat history is stored locally in `data/chat_history.json`, which is excluded from Git via `.gitignore`.
- Web search sends only the query you type.
- **When AI is on**, your recent chat messages (up to the last 20) are sent to the Anthropic API to produce each reply. Do not type secrets into the chat. With no API key, nothing is sent to any AI service.

## 🚧 Project status

LISA is in **active early development**. See the [open issues](https://github.com/sheikhrafi20/LISA-AI/issues) for the roadmap.

## 👨‍💻 Developer

**RAFI** — [@sheikhrafi20](https://github.com/sheikhrafi20)

---

<div align="center">

*Built with curiosity, Python, and consistent learning.*

</div>
