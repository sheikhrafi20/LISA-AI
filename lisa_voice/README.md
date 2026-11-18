# LISA Live Talking AI — Voice API starter

This adds a separate localhost API for a future Godot 4 realistic 3D avatar client.
It reuses the existing Python AI engine, local chat history and OS text-to-speech.
It does not replace or modify the existing office bridge.

## Start

From the repository root, in PowerShell:

```powershell
python -m lisa_voice.server
```

The API listens only on `127.0.0.1:8766`.

## Endpoints

- `GET /api/health` — service check
- `POST /api/chat` — JSON `{"text":"Hello LISA"}`; returns `{"reply":"..."}`
- `POST /api/speak` — JSON `{"text":"Hello"}`; uses the existing Windows speech voice
- `POST /api/transcribe` — raw WAV bytes; returns recognized text

## Enable microphone transcription

Install the optional CPU speech-to-text dependency:

```powershell
python -m pip install -r requirements-voice.txt
```

The first transcription downloads the Whisper `tiny` model. It then runs locally on CPU.
The Godot client must record microphone audio and POST a WAV file to `/api/transcribe`.

## Current scope and limitations

- The API is a first integration milestone, not yet a finished live conversation app.
- Godot microphone capture, two selectable realistic 3D human GLB models, facial blend-shape lip-sync, and avatar UI are not included in this commit.
- Windows speech output uses the existing OS voice; available voice/language depends on Windows.
- A realistic 3D character requires properly licensed rigged GLB assets. The project does not yet contain those model files.
- Do not expose this unauthenticated local API to the public internet.
