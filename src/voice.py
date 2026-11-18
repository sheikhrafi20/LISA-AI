"""Speak LISA's replies aloud (text-to-speech) with the operating system's own voices.

Free and offline: no extra Python packages and no account.

* Windows: System.Speech through PowerShell (built into Windows)
* macOS:   the `say` command
* Linux:   `espeak-ng` (or `espeak`), if installed

The text to speak is passed through an environment variable (or stdin), never
pasted into a command line, so odd characters cannot break or hijack the command.
"""

from __future__ import annotations

import base64
import os
import re
import shutil
import subprocess
import sys

MAX_SPOKEN_CHARS = 1000
TIMEOUT = 120.0
NO_VOICE_EXIT_CODE = 3

_POWERSHELL_SCRIPT = """
Add-Type -AssemblyName System.Speech
$text = $env:LISA_SPEAK_TEXT
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($env:LISA_SPEAK_LANG -eq 'bn') {
  $voice = $synth.GetInstalledVoices() | Where-Object {
    $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'bn'
  } | Select-Object -First 1
  if (-not $voice) { exit 3 }
  $synth.SelectVoice($voice.VoiceInfo.Name)
}
$synth.Speak($text)
"""


class VoiceError(Exception):
    """Raised when a reply cannot be spoken."""


def has_bengali(text: str) -> bool:
    return any("\u0980" <= char <= "\u09ff" for char in text)


def clean_for_speech(text: str) -> str:
    """Remove markdown symbols and extra spaces, and cap the length."""
    text = re.sub(r"[*_`#>]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_SPOKEN_CHARS]


def _build_command(text: str, language: str) -> tuple[list[str], str | None]:
    """Return (command, stdin_text) for the current operating system."""
    if sys.platform.startswith("win"):
        encoded = base64.b64encode(_POWERSHELL_SCRIPT.encode("utf-16-le")).decode("ascii")
        return ["powershell", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded], None
    if sys.platform == "darwin":
        return ["say", "--", text], None
    tool = shutil.which("espeak-ng") or shutil.which("espeak")
    if not tool:
        raise VoiceError("no speech tool found; install espeak-ng (for example: sudo apt install espeak-ng)")
    return [tool, "-v", language, "--stdin"], text


def speak(text: str) -> None:
    """Say the text aloud. Raises VoiceError if that is not possible."""
    spoken = clean_for_speech(text)
    if not spoken:
        return
    language = "bn" if has_bengali(spoken) else "en"
    command, stdin_text = _build_command(spoken, language)
    env = {**os.environ, "LISA_SPEAK_TEXT": spoken, "LISA_SPEAK_LANG": language}
    try:
        result = subprocess.run(
            command,
            input=stdin_text,
            env=env,
            capture_output=True,
            text=True,
            errors="replace",
            timeout=TIMEOUT,
        )
    except subprocess.TimeoutExpired as error:
        raise VoiceError("speaking took too long") from error
    except OSError as error:
        raise VoiceError(f"could not start the speech tool: {error}") from error

    if result.returncode == NO_VOICE_EXIT_CODE and sys.platform.startswith("win"):
        raise VoiceError(
            "no Bengali voice is installed in Windows, so Bengali text cannot be spoken "
            "(English replies still work)"
        )
    if result.returncode != 0:
        detail = (result.stderr or "").strip().splitlines()
        raise VoiceError(detail[0] if detail else f"speech tool failed (exit code {result.returncode})")
