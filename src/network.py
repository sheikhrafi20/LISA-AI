"""Secure HTTPS utilities for LISA.

TLS certificate verification stays enabled. Install dependencies with:
    python -m pip install -r requirements.txt
"""

from __future__ import annotations

import ssl
from html.parser import HTMLParser
from urllib.error import URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen
from xml.etree import ElementTree

import certifi

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
USER_AGENT = "Mozilla/5.0 (compatible; LISA/0.3)"


class SearchResultParser(HTMLParser):
    """Extract DuckDuckGo result titles and links from its HTML response."""

    def __init__(self) -> None:
        super().__init__()
        self.results: list[tuple[str, str]] = []
        self._capture = False
        self._title_parts: list[str] = []
        self._href = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        if tag == "a" and "result__a" in classes:
            self._capture = True
            self._title_parts = []
            self._href = attributes.get("href") or ""

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._title_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._capture:
            title = " ".join("".join(self._title_parts).split())
            if title and self._href:
                self.results.append((title, self._href))
            self._capture = False


def _fetch(url: str, timeout: float) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/rss+xml, text/html, */*"})
    with urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
        return response.read(1_500_000)


def _bing_rss_search(query: str, timeout: float, limit: int) -> list[tuple[str, str]]:
    url = "https://www.bing.com/search?format=rss&q=" + quote_plus(query)
    raw = _fetch(url, timeout)
    root = ElementTree.fromstring(raw)
    results: list[tuple[str, str]] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if title and link:
            results.append((title, link))
        if len(results) >= limit:
            break
    return results


def _duckduckgo_html_search(query: str, timeout: float, limit: int) -> list[tuple[str, str]]:
    url = "https://html.duckduckgo.com/html/?q=" + quote_plus(query)
    raw = _fetch(url, timeout)
    html = raw.decode("utf-8", errors="replace")
    parser = SearchResultParser()
    parser.feed(html)
    return parser.results[:limit]


def check_internet(timeout: float = 8.0) -> tuple[bool, str]:
    """Check HTTPS connectivity with certificate verification enabled."""
    try:
        raw = _fetch("https://example.com/", timeout)
        if raw:
            return True, "Connected securely (HTTP 200)"
        return False, "The server returned an empty response"
    except (URLError, TimeoutError, OSError) as error:
        return False, f"HTTPS connection failed: {error}"


def web_search(query: str, timeout: float = 12.0, limit: int = 5) -> list[tuple[str, str]]:
    """Search public web via Bing RSS, then DuckDuckGo HTML as fallback."""
    cleaned_query = query.strip()
    if not cleaned_query:
        return []

    errors: list[str] = []
    try:
        results = _bing_rss_search(cleaned_query, timeout, limit)
        if results:
            return results
        errors.append("Bing RSS: response contained no result items")
    except Exception as error:
        errors.append(f"Bing RSS: {type(error).__name__}: {error}")

    try:
        results = _duckduckgo_html_search(cleaned_query, timeout, limit)
        if results:
            return results
        errors.append("DuckDuckGo HTML: response contained no result links")
    except Exception as error:
        errors.append(f"DuckDuckGo HTML: {type(error).__name__}: {error}")

    raise ValueError(" | ".join(errors))
