import io
import json
from urllib.error import HTTPError, URLError

import pytest

from lisa import brain
from lisa.config import Settings


class FakeStream:
    """Stands in for the HTTP response: iterating gives one line at a time."""

    def __init__(self, lines):
        self.lines = lines

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def __iter__(self):
        return iter(self.lines)


def ndjson(*objects):
    return [json.dumps(obj).encode("utf-8") + b"\n" for obj in objects]


def chunk(text, done=False):
    return {"message": {"role": "assistant", "content": text}, "done": done}


HISTORY = [{"role": "user", "content": "hi"}]


def test_streams_pieces_in_order(monkeypatch):
    lines = ndjson(chunk("হ্যা"), chunk("লো"), chunk("", done=True))
    monkeypatch.setattr(brain, "urlopen", lambda request, timeout: FakeStream(lines))
    assert list(brain.stream_reply(Settings(), HISTORY)) == ["হ্যা", "লো"]


def test_stops_at_done_and_ignores_blank_lines(monkeypatch):
    lines = [b"\n"] + ndjson(chunk("a"), chunk("b", done=True), chunk("never"))
    monkeypatch.setattr(brain, "urlopen", lambda request, timeout: FakeStream(lines))
    assert "".join(brain.stream_reply(Settings(), HISTORY)) == "ab"


def test_request_has_model_system_prompt_and_limited_history(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["payload"] = json.loads(request.data.decode("utf-8"))
        captured["timeout"] = timeout
        return FakeStream(ndjson(chunk("ok", done=True)))

    monkeypatch.setattr(brain, "urlopen", fake_urlopen)
    history = [{"role": "user", "content": f"m{i}"} for i in range(10)]
    list(brain.stream_reply(Settings(model="gemma3:4b", history_limit=3, max_tokens=50, timeout=7.0), history))

    assert captured["url"] == "http://localhost:11434/api/chat"
    assert captured["timeout"] == 7.0
    payload = captured["payload"]
    assert payload["model"] == "gemma3:4b"
    assert payload["stream"] is True
    assert payload["options"] == {"num_predict": 50}
    assert payload["messages"][0] == {"role": "system", "content": brain.SYSTEM_PROMPT}
    assert [m["content"] for m in payload["messages"][1:]] == ["m7", "m8", "m9"]


def test_error_line_from_ollama(monkeypatch):
    lines = ndjson({"error": "model requires more memory"})
    monkeypatch.setattr(brain, "urlopen", lambda request, timeout: FakeStream(lines))
    with pytest.raises(brain.BrainError, match="more memory"):
        list(brain.stream_reply(Settings(), HISTORY))


def test_unreadable_line(monkeypatch):
    monkeypatch.setattr(brain, "urlopen", lambda request, timeout: FakeStream([b"not json\n"]))
    with pytest.raises(brain.BrainError, match="could not read"):
        list(brain.stream_reply(Settings(), HISTORY))


def test_model_not_found_shows_server_message(monkeypatch):
    def fake_urlopen(request, timeout):
        body = json.dumps({"error": "model 'nope' not found"}).encode("utf-8")
        raise HTTPError(request.full_url, 404, "Not Found", {}, io.BytesIO(body))

    monkeypatch.setattr(brain, "urlopen", fake_urlopen)
    with pytest.raises(brain.BrainError, match="404.*not found"):
        list(brain.stream_reply(Settings(model="nope"), HISTORY))


def test_ollama_not_running_gives_helpful_hint(monkeypatch):
    def fake_urlopen(request, timeout):
        raise URLError(ConnectionRefusedError(111, "Connection refused"))

    monkeypatch.setattr(brain, "urlopen", fake_urlopen)
    with pytest.raises(brain.BrainError, match="Is it running.*ollama pull llama3.2"):
        list(brain.stream_reply(Settings(), HISTORY))


def test_timeout_is_a_brain_error(monkeypatch):
    def fake_urlopen(request, timeout):
        raise TimeoutError("timed out")

    monkeypatch.setattr(brain, "urlopen", fake_urlopen)
    with pytest.raises(brain.BrainError, match="could not reach"):
        list(brain.stream_reply(Settings(), HISTORY))


def test_host_must_be_http(monkeypatch):
    monkeypatch.setattr(brain, "urlopen", lambda *a, **k: pytest.fail("must not connect"))
    with pytest.raises(brain.BrainError, match="http"):
        list(brain.stream_reply(Settings(host="file:///etc/passwd"), HISTORY))
