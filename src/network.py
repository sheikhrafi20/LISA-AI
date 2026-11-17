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

import certifi

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())


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


def check_internet(timeout: float = 8.0) -> tuple[bool, str]:
    """Check HTTPS connectivity with certificate verification enabled."""
    request = Request(
        "https://example.com/",
        headers={"User-Agent": "LISA-Personal-Assistant/0.2"},
    )
    try:
        with urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
            if 200 <= response.status < 400:
                return True, f"Connected securely (HTTP {response.status})"
            return False, f"Server returned HTTP {response.status}"
    except (URLError, TimeoutError, OSError) as error:
        return False, f"HTTPS connection failed: {error}"


def web_search(query: str, timeout: float = 12.0, limit: int = 5) -> list[tuple[str, str]]:
    """Fetch public search-result links; external content is untrusted."""
    if not query.strip():
        return []

    url = "https://html.duckduckgo.com/html/?q=" + quote_plus(query.strip())
    request = Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LISA/0.2)"},
    )
    with urlopen(request, timeout=timeout, context=SSL_CONTEXT) as response:
        html = response.read(1_500_000).decode("utf-8", errors="replace")

    parser = SearchResultParser()
    parser.feed(html)
    return parser.results[:limit]
