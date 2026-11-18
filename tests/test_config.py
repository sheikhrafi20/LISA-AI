import os

from src.config import load_dotenv


def test_load_dotenv_sets_variables(tmp_path, monkeypatch):
    monkeypatch.delenv("LISA_TEST_A", raising=False)
    monkeypatch.delenv("LISA_TEST_B", raising=False)
    monkeypatch.delenv("LISA_TEST_C", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# comment\n\nLISA_TEST_A=one\nLISA_TEST_B = \"two\"\nexport LISA_TEST_C='three'\nnot a pair\n",
        encoding="utf-8",
    )
    load_dotenv(env_file)
    assert os.environ["LISA_TEST_A"] == "one"
    assert os.environ["LISA_TEST_B"] == "two"
    assert os.environ["LISA_TEST_C"] == "three"


def test_load_dotenv_does_not_override_existing(tmp_path, monkeypatch):
    monkeypatch.setenv("LISA_TEST_A", "from-env")
    env_file = tmp_path / ".env"
    env_file.write_text("LISA_TEST_A=from-file\n", encoding="utf-8")
    load_dotenv(env_file)
    assert os.environ["LISA_TEST_A"] == "from-env"


def test_load_dotenv_missing_file_is_ignored(tmp_path):
    load_dotenv(tmp_path / "missing.env")


def test_load_dotenv_reads_powershell_utf16_file(tmp_path, monkeypatch):
    monkeypatch.delenv("LISA_TEST_A", raising=False)
    env_file = tmp_path / ".env"
    # `echo LISA_TEST_A=ollama > .env` in Windows PowerShell: UTF-16 LE with BOM and CRLF
    env_file.write_bytes("LISA_TEST_A=ollama\r\n".encode("utf-16"))
    load_dotenv(env_file)
    assert os.environ["LISA_TEST_A"] == "ollama"


def test_load_dotenv_reads_utf8_with_bom(tmp_path, monkeypatch):
    monkeypatch.delenv("LISA_TEST_A", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_bytes("LISA_TEST_A=ollama\n".encode("utf-8-sig"))
    load_dotenv(env_file)
    assert os.environ["LISA_TEST_A"] == "ollama"


def test_load_dotenv_unreadable_encoding_does_not_crash(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_bytes(b"\x80\x81\x82 not text")
    load_dotenv(env_file)
