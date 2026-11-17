from urllib.error import URLError

import pytest

from src import network

BING_RSS = b"""<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
  <item><title>First result</title><link>https://example.com/1</link></item>
  <item><title>Second result</title><link>https://example.com/2</link></item>
  <item><title></title><link>https://example.com/skipped</link></item>
</channel></rss>"""

DDG_HTML = """
<html><body>
  <a class="result__a" href="https://example.org/a">Alpha   <b>result</b></a>
  <a class="other" href="https://example.org/ignored">Ignored</a>
  <a class="result__a" href="https://example.org/b">Beta result</a>
</body></html>
"""


def test_search_result_parser_extracts_titles_and_links():
    parser = network.SearchResultParser()
    parser.feed(DDG_HTML)
    assert parser.results == [
        ("Alpha result", "https://example.org/a"),
        ("Beta result", "https://example.org/b"),
    ]


def test_bing_rss_search_parses_items_and_respects_limit(monkeypatch):
    monkeypatch.setattr(network, "_fetch", lambda url, timeout: BING_RSS)
    results = network._bing_rss_search("python", 5.0, 1)
    assert results == [("First result", "https://example.com/1")]


def test_web_search_empty_query_returns_empty_list():
    assert network.web_search("   ") == []


def test_web_search_uses_bing_first(monkeypatch):
    monkeypatch.setattr(network, "_fetch", lambda url, timeout: BING_RSS)
    results = network.web_search("python")
    assert results[0] == ("First result", "https://example.com/1")


def test_web_search_falls_back_to_duckduckgo(monkeypatch):
    def fake_fetch(url, timeout):
        if "bing.com" in url:
            raise URLError("bing down")
        return DDG_HTML.encode("utf-8")

    monkeypatch.setattr(network, "_fetch", fake_fetch)
    results = network.web_search("python")
    assert results[0] == ("Alpha result", "https://example.org/a")


def test_web_search_raises_when_all_providers_fail(monkeypatch):
    def fake_fetch(url, timeout):
        raise URLError("offline")

    monkeypatch.setattr(network, "_fetch", fake_fetch)
    with pytest.raises(ValueError) as error:
        network.web_search("python")
    assert "Bing RSS" in str(error.value)
    assert "DuckDuckGo HTML" in str(error.value)


def test_check_internet_success(monkeypatch):
    monkeypatch.setattr(network, "_fetch", lambda url, timeout: b"<html></html>")
    connected, detail = network.check_internet()
    assert connected is True
    assert "Connected" in detail


def test_check_internet_failure(monkeypatch):
    def fake_fetch(url, timeout):
        raise URLError("no route")

    monkeypatch.setattr(network, "_fetch", fake_fetch)
    connected, detail = network.check_internet()
    assert connected is False
    assert "failed" in detail
