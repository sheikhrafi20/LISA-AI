import os

from lisa.config import DEFAULT_HOST, DEFAULT_MODEL, load_dotenv, load_settings


def test_defaults():
    settings = load_settings({})
    assert settings.model == DEFAULT_MODEL
    assert settings.host == DEFAULT_HOST
    assert settings.max_tokens == 600
    assert settings.history_limit == 20


def test_overrides():
    settings = load_settings({
        "LISA_MODEL": " gemma3:4b ",
        "OLLAMA_HOST": "http://192.168.0.5:11434/",
        "LISA_MAX_TOKENS": "900",
        "LISA_HISTORY": "8",
    })
    assert settings.model == "gemma3:4b"
    assert settings.host == "http://192.168.0.5:11434"
    assert settings.max_tokens == 900
    assert settings.history_limit == 8


def test_host_without_scheme_gets_http():
    assert load_settings({"OLLAMA_HOST": "127.0.0.1:11434"}).host == "http://127.0.0.1:11434"


def test_bad_numbers_fall_back_to_defaults():
    settings = load_settings({"LISA_MAX_TOKENS": "lots", "LISA_HISTORY": "1"})
    assert settings.max_tokens == 600
    assert settings.history_limit == 20


def test_dotenv_sets_variables(tmp_path, monkeypatch):
    for name in ("LISA_T_A", "LISA_T_B", "LISA_T_C"):
        monkeypatch.delenv(name, raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# comment\n\nLISA_T_A=one\nLISA_T_B = \"two\"\nexport LISA_T_C='three'\nnot a pair\n",
        encoding="utf-8",
    )
    load_dotenv(env_file)
    assert (os.environ["LISA_T_A"], os.environ["LISA_T_B"], os.environ["LISA_T_C"]) == ("one", "two", "three")


def test_dotenv_does_not_override_real_variables(tmp_path, monkeypatch):
    monkeypatch.setenv("LISA_T_A", "from-env")
    env_file = tmp_path / ".env"
    env_file.write_text("LISA_T_A=from-file\n", encoding="utf-8")
    load_dotenv(env_file)
    assert os.environ["LISA_T_A"] == "from-env"


def test_dotenv_reads_powershell_utf16_file(tmp_path, monkeypatch):
    monkeypatch.delenv("LISA_T_A", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_bytes("LISA_T_A=ollama\r\n".encode("utf-16"))  # what `echo ... > .env` writes
    load_dotenv(env_file)
    assert os.environ["LISA_T_A"] == "ollama"


def test_dotenv_reads_utf8_with_bom(tmp_path, monkeypatch):
    monkeypatch.delenv("LISA_T_A", raising=False)
    env_file = tmp_path / ".env"
    env_file.write_bytes("LISA_T_A=ollama\n".encode("utf-8-sig"))
    load_dotenv(env_file)
    assert os.environ["LISA_T_A"] == "ollama"


def test_dotenv_missing_or_unreadable_file_is_ignored(tmp_path):
    load_dotenv(tmp_path / "missing.env")
    bad = tmp_path / ".env"
    bad.write_bytes(b"\x80\x81\x82 not text")
    load_dotenv(bad)
