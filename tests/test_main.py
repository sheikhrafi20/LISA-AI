import json

import pytest

from src import main


@pytest.fixture
def temp_history(tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    monkeypatch.setattr(main, "DATA_DIR", data_dir)
    monkeypatch.setattr(main, "HISTORY_FILE", data_dir / "chat_history.json")
    return data_dir / "chat_history.json"


@pytest.mark.parametrize("message", ["hello", "Hi there", "HEY!", "হ্যালো", "আসসালামু আলাইকুম"])
def test_greetings(message):
    assert main.make_reply(message).startswith("Hello!")


@pytest.mark.parametrize("message", ["what is this", "which one is better", "history of python"])
def test_greeting_not_triggered_inside_other_words(message):
    assert not main.make_reply(message).startswith("Hello!")


def test_name_question():
    assert "LISA" in main.make_reply("Who are you?")
    assert "LISA" in main.make_reply("তোমার নাম কি?")


def test_how_are_you():
    assert "প্রস্তুত" in main.make_reply("how are you")


def test_thanks():
    assert "You're welcome" in main.make_reply("Thank you!")
    assert "You're welcome" in main.make_reply("ধন্যবাদ")


def test_fallback_mentions_search():
    assert "search" in main.make_reply("something unknown")


def test_save_and_load_history_roundtrip(temp_history):
    history: list[dict[str, str]] = []
    main.save_message(history, "user", "হ্যালো")
    main.save_message(history, "lisa", "Hello!")

    assert temp_history.exists()
    loaded = main.load_history()
    assert [item["role"] for item in loaded] == ["user", "lisa"]
    assert loaded[0]["message"] == "হ্যালো"
    assert "time" in loaded[0]


def test_load_history_without_file_returns_empty(temp_history):
    assert main.load_history() == []


def test_load_history_with_corrupt_file_returns_empty(temp_history):
    temp_history.parent.mkdir(parents=True)
    temp_history.write_text("{not valid json", encoding="utf-8")
    assert main.load_history() == []


def test_load_history_ignores_non_list_json(temp_history):
    temp_history.parent.mkdir(parents=True)
    temp_history.write_text(json.dumps({"a": 1}), encoding="utf-8")
    assert main.load_history() == []
