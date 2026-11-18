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
