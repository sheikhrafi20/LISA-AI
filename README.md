# LISA: my personal AI

A fresh start. LISA is meant to become **one personal AI that has everything inside it**: chat, voice, memory, tools, and an anime-style team that works on tasks together.

The previous version (CLI, Anthropic option, voice output, web office, 72 tests) is saved on the [`archive-v4`](https://github.com/sheikhrafi20/LISA-AI/tree/archive-v4) branch.

## Step 1: chat with a free local AI (done)

LISA chats in the terminal using [Ollama](https://ollama.com/). It is **free, private and needs no account or API key**: the model runs on your computer. Replies appear word by word.

### Run it (Windows PowerShell)

1. Install Ollama, then download a model once (about 2 GB):

   ```powershell
   ollama pull llama3.2
   ```

2. Get LISA and start it:

   ```powershell
   git clone https://github.com/sheikhrafi20/LISA-AI.git
   cd LISA-AI
   python -m lisa
   ```

   If you already cloned it, run `git pull` inside the `LISA-AI` folder instead. Always start LISA from inside that folder.

LISA needs no Python packages. Ollama must be running (its icon is in the taskbar).

### Commands

| Command | What it does |
|---|---|
| `help` | Show the commands |
| `new` | Forget this chat and start again |
| `about` | Show which model LISA uses |
| `exit` | Close LISA |

Anything else is a message to LISA. If something goes wrong (for example Ollama is not running), LISA says what happened instead of making up a reply.

### Settings (optional)

Copy `.env.example` to `.env` and uncomment a line:

| Setting | Default | Meaning |
|---|---|---|
| `LISA_MODEL` | `llama3.2` | Ollama model to use |
| `OLLAMA_HOST` | `http://localhost:11434` | Where Ollama is running |
| `LISA_MAX_TOKENS` | `600` | Longest reply |
| `LISA_HISTORY` | `20` | Recent messages LISA remembers in one chat |

On an 8 GB computer, `llama3.2` works. Small models are weaker in বাংলা than in English.

### Tests

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest
```

The tests use fake replies, so they do not need Ollama.

## What is coming

1. ~~Chat and a local AI~~
2. Voice: speaking and listening
3. The office: a web UI with an anime team that works on a task together
4. Memory and tools

## Privacy

Chat stays in memory and is gone when you close LISA. With the default setup nothing leaves your computer.

## License

[MIT](LICENSE)
