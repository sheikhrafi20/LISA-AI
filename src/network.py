"""Small standard-library network utilities for LISA."""

from __future__ import annotations

from html.parser import HTMLParser
from urllib.error import URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen


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
        if tag == "a" and "result__a" in (attributes.get("class") or ""):
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


def check_internet(timeout: float = 5.0) -> tuple[bool, str]:
    """Check HTTPS connectivity using a small request."""
    request = Request(
        "https://example.com/",
        headers={"User-Agent": "LISA-Personal-Assistant/0.1"},
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            if 200 <= response.status < 400:
                return True, f"Connected (HTTP {response.status})"
            return False, f"Server returned HTTP {response.status}"
    except (URLError, TimeoutError, OSError) as error:
        return False, f"Connection unavailable: {error}"


def web_search(query: str, timeout: float = 10.0, limit: int = 5) -> list[tuple[str, str]]:
    """Fetch public search-result links. Results are untrusted external content."""
    if not query.strip():
        return []

    url = "https://html.duckduckgo.com/html/?q=" + quote_plus(query.strip())
    request = Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; LISA/0.1)"},
    )
    with urlopen(request, timeout=timeout) as response:
        html = response.read(1_500_000).decode("utf-8", errors="replace")

    parser = SearchResultParser()
    parser.feed(html)
    return parser.results[:limit]
