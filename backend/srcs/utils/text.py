"""Small text helpers shared across pricing and content flows."""
from __future__ import annotations

import re

_WORD_RE = re.compile(r"\S+")


def count_words(text: str | None) -> int:
    """Return a simple whitespace-based word count."""
    if not text:
        return 0
    return len(_WORD_RE.findall(text))
