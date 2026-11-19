import io

from lisa import cli
from lisa.brain import BrainError
from lisa.config import Settings


def run_chat(lines, stream):
    """Run the chat with scripted input; returns (exit_code, everything LISA printed)."""
    inputs = iter(lines)

    def read(prompt):
        try:
            return next(inputs)
        except StopIteration:
            raise EOFError

    out = io.StringIO()
    code = cli.run(Settings(), read=read, out=out, stream=stream)
    return code, out.getvalue()


def test_reply_is_printed_and_remembered():
    seen = []

    def stream(settings, history):
        seen.append([m["content"] for m in history])
        yield "Hel"
        yield "lo"

    code, text = run_chat(["hi", "again", "exit"], stream)
    assert code == 0
    assert "LISA > Hello" in text
    assert seen == [["hi"], ["hi", "Hello", "again"]]


def test_new_forgets_the_chat():
    seen = []

    def stream(settings, history):
        seen.append(len(history))
        yield "ok"

    run_chat(["one", "new", "two", "exit"], stream)
    assert seen == [1, 1]


def test_error_is_shown_and_message_not_kept():
    calls = []

    def stream(settings, history):
        calls.append([m["content"] for m in history])
        if len(calls) == 1:
            raise BrainError("could not reach Ollama")
        yield "fine"

    code, text = run_chat(["first", "second", "exit"], stream)
    assert code == 0
    assert "could not reach Ollama" in text
    assert calls == [["first"], ["second"]]


def test_empty_reply_is_not_remembered():
    seen = []

    def stream(settings, history):
        seen.append(len(history))
        return iter(())

    _, text = run_chat(["a", "b", "exit"], stream)
    assert "(no reply)" in text
    assert seen == [1, 1]


def test_commands_and_blank_lines_do_not_call_the_model():
    def stream(settings, history):
        raise AssertionError("the model must not be called")

    code, text = run_chat(["", "  ", "help", "about", "বন্ধ"], stream)
    assert code == 0
    assert "Commands:" in text
    assert "llama3.2" in text
    assert "Goodbye" in text


def test_end_of_input_exits_cleanly():
    code, text = run_chat([], lambda settings, history: iter(()))
    assert code == 0
    assert "Bye" in text
