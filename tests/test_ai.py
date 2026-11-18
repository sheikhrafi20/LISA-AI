import io
import json
from urllib.error import HTTPError, URLError

import pytest

from src import ai


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("LISA_MODEL", raising=False)


def test_ai_available_depends_on_key(monkeypatch):
    assert ai.ai_available() is False
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    assert ai.ai_available() is True


def test_model_default_and_override(monkeypatch):
    assert ai.get_model() == ai.DEFAULT_MODEL
    monkeypatch.setenv("LISA_MODEL", "my-model")
    assert ai.get_model() == "my-model"


def test_build_messages_maps_roles_and_merges_consecutive():
    history = [
        {"role": "lisa", "message": "old reply without a question"},
        {"role": "user", "message": "hello"},
        {"role": "user", "message": "are you there?"},
        {"role": "lisa", "message": "yes"},
        {"role": "user", "message": "great"},
    ]
    assert ai.build_messages(history) == [
        {"role": "user", "content": "hello\nare you there?"},
        {"role": "assistant", "content": "yes"},
        {"role": "user", "content": "great"},
    ]


def test_build_messages_skips_empty_and_respects_limit():
    history = [{"role": "user", "message": f"m{i}"} for i in range(5)]
    history.insert(2, {"role": "lisa", "message": "   "})
    assert ai.build_messages(history, limit=2)[-1]["content"] == "m3\nm4"


def test_generate_reply_without_key_raises():
    with pytest.raises(ai.AIError, match="ANTHROPIC_API_KEY"):
        ai.generate_reply([{"role": "user", "message": "hi"}])


def test_generate_reply_needs_a_user_message(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    with pytest.raises(ai.AIError):
        ai.generate_reply([{"role": "lisa", "message": "hi"}])


def test_generate_reply_sends_expected_payload_and_returns_text(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    captured = {}

    def fake_post(payload, api_key, timeout):
        captured.update(payload=payload, api_key=api_key)
        return {"content": [{"type": "text", "text": "হ্যালো! "}, {"type": "text", "text": "কেমন আছো?"}]}

    monkeypatch.setattr(ai, "_post", fake_post)
    reply = ai.generate_reply([{"role": "user", "message": "hi"}])

    assert reply == "হ্যালো! কেমন আছো?"
    assert captured["api_key"] == "test-key"
    assert captured["payload"]["model"] == ai.DEFAULT_MODEL
    assert captured["payload"]["system"] == ai.SYSTEM_PROMPT
    assert captured["payload"]["messages"] == [{"role": "user", "content": "hi"}]


def test_generate_reply_empty_response_raises(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setattr(ai, "_post", lambda payload, api_key, timeout: {"content": []})
    with pytest.raises(ai.AIError, match="empty"):
        ai.generate_reply([{"role": "user", "message": "hi"}])


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


def test_post_returns_parsed_json(monkeypatch):
    body = json.dumps({"content": [{"type": "text", "text": "ok"}]}).encode("utf-8")
    monkeypatch.setattr(ai, "urlopen", lambda request, timeout, context: FakeResponse(body))
    assert ai._post({}, "key", 1.0)["content"][0]["text"] == "ok"


def test_post_http_error_includes_api_message(monkeypatch):
    def fake_urlopen(request, timeout, context):
        error_body = json.dumps({"error": {"message": "invalid x-api-key"}}).encode("utf-8")
        raise HTTPError(request.full_url, 401, "Unauthorized", {}, io.BytesIO(error_body))

    monkeypatch.setattr(ai, "urlopen", fake_urlopen)
    with pytest.raises(ai.AIError, match="401.*invalid x-api-key"):
        ai._post({}, "key", 1.0)


def test_post_network_error_becomes_ai_error(monkeypatch):
    def fake_urlopen(request, timeout, context):
        raise URLError("offline")

    monkeypatch.setattr(ai, "urlopen", fake_urlopen)
    with pytest.raises(ai.AIError, match="could not reach"):
        ai._post({}, "key", 1.0)


def test_post_never_leaks_api_key_in_errors(monkeypatch):
    def fake_urlopen(request, timeout, context):
        raise URLError("offline")

    monkeypatch.setattr(ai, "urlopen", fake_urlopen)
    with pytest.raises(ai.AIError) as error:
        ai._post({}, "super-secret-key", 1.0)
    assert "super-secret-key" not in str(error.value)
