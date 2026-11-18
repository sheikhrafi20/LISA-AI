import base64
import subprocess
from types import SimpleNamespace

import pytest

from src import voice


class Recorder:
    """Stands in for subprocess.run and remembers how it was called."""

    def __init__(self, returncode=0, stderr=""):
        self.calls = []
        self.result = SimpleNamespace(returncode=returncode, stderr=stderr, stdout="")

    def __call__(self, command, **kwargs):
        self.calls.append((command, kwargs))
        return self.result


def set_platform(monkeypatch, name):
    monkeypatch.setattr(voice.sys, "platform", name)


def test_has_bengali():
    assert voice.has_bengali("হ্যালো") is True
    assert voice.has_bengali("Hello 123") is False
    assert voice.has_bengali("Hello আমি LISA") is True


def test_clean_for_speech_removes_markdown_and_extra_space():
    assert voice.clean_for_speech("**Hello**   `code`\n\n# Title") == "Hello code Title"


def test_clean_for_speech_caps_length():
    assert len(voice.clean_for_speech("a" * 5000)) == voice.MAX_SPOKEN_CHARS


def test_speak_empty_text_does_nothing(monkeypatch):
    run = Recorder()
    monkeypatch.setattr(voice.subprocess, "run", run)
    voice.speak("  **  ")
    assert run.calls == []


def test_speak_on_windows_uses_encoded_powershell_and_env(monkeypatch):
    set_platform(monkeypatch, "win32")
    run = Recorder()
    monkeypatch.setattr(voice.subprocess, "run", run)

    voice.speak("Hello 'world'; Remove-Item *")

    command, kwargs = run.calls[0]
    assert command[0] == "powershell"
    assert "-EncodedCommand" in command
    script = base64.b64decode(command[-1]).decode("utf-16-le")
    assert "System.Speech" in script
    # the spoken text is never part of the command line
    assert not any("Remove-Item" in part for part in command)
    assert kwargs["env"]["LISA_SPEAK_TEXT"] == "Hello 'world'; Remove-Item"
    assert kwargs["env"]["LISA_SPEAK_LANG"] == "en"


def test_speak_bengali_text_sets_bengali_language(monkeypatch):
    set_platform(monkeypatch, "win32")
    run = Recorder()
    monkeypatch.setattr(voice.subprocess, "run", run)
    voice.speak("আমি LISA")
    assert run.calls[0][1]["env"]["LISA_SPEAK_LANG"] == "bn"


def test_windows_without_bengali_voice_gives_clear_error(monkeypatch):
    set_platform(monkeypatch, "win32")
    monkeypatch.setattr(voice.subprocess, "run", Recorder(returncode=voice.NO_VOICE_EXIT_CODE))
    with pytest.raises(voice.VoiceError, match="Bengali voice"):
        voice.speak("আমি LISA")


def test_failure_message_comes_from_stderr(monkeypatch):
    set_platform(monkeypatch, "win32")
    monkeypatch.setattr(voice.subprocess, "run", Recorder(returncode=1, stderr="boom happened\nmore"))
    with pytest.raises(voice.VoiceError, match="boom happened"):
        voice.speak("hello")


def test_failure_without_stderr_mentions_exit_code(monkeypatch):
    set_platform(monkeypatch, "win32")
    monkeypatch.setattr(voice.subprocess, "run", Recorder(returncode=5))
    with pytest.raises(voice.VoiceError, match="exit code 5"):
        voice.speak("hello")


def test_timeout_becomes_voice_error(monkeypatch):
    set_platform(monkeypatch, "win32")

    def slow(command, **kwargs):
        raise subprocess.TimeoutExpired(command, 1)

    monkeypatch.setattr(voice.subprocess, "run", slow)
    with pytest.raises(voice.VoiceError, match="too long"):
        voice.speak("hello")


def test_missing_tool_becomes_voice_error(monkeypatch):
    set_platform(monkeypatch, "win32")

    def missing(command, **kwargs):
        raise FileNotFoundError("powershell")

    monkeypatch.setattr(voice.subprocess, "run", missing)
    with pytest.raises(voice.VoiceError, match="could not start"):
        voice.speak("hello")


def test_macos_uses_say_with_double_dash(monkeypatch):
    set_platform(monkeypatch, "darwin")
    run = Recorder()
    monkeypatch.setattr(voice.subprocess, "run", run)
    voice.speak("-rf hello")
    assert run.calls[0][0] == ["say", "--", "-rf hello"]


def test_linux_without_espeak_gives_install_hint(monkeypatch):
    set_platform(monkeypatch, "linux")
    monkeypatch.setattr(voice.shutil, "which", lambda name: None)
    with pytest.raises(voice.VoiceError, match="espeak-ng"):
        voice.speak("hello")


def test_linux_with_espeak_sends_text_on_stdin(monkeypatch):
    set_platform(monkeypatch, "linux")
    monkeypatch.setattr(voice.shutil, "which", lambda name: "/usr/bin/espeak-ng" if name == "espeak-ng" else None)
    run = Recorder()
    monkeypatch.setattr(voice.subprocess, "run", run)
    voice.speak("hello there")
    command, kwargs = run.calls[0]
    assert command == ["/usr/bin/espeak-ng", "-v", "en", "--stdin"]
    assert kwargs["input"] == "hello there"
