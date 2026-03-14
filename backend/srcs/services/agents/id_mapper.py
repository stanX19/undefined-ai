"""ShortIdMapper — bidirectional UUID ↔ short-alias mapping.

Provides a per-conversation mapping so the LLM sees compact IDs like
``T0`` (topic) or ``F3`` (fact) instead of raw 36-char UUIDs.

Usage
-----
1. At the start of an agent run, create a mapper and set the context var::

       mapper = ShortIdMapper()
       mapper.register(topic_id, prefix="T")   # → "T0"
       _mapper_var.set(mapper)

2. Inside any ``@tool`` function, resolve short IDs back to real UUIDs::

       real_id = current_mapper().resolve(short_or_full_id)

3. When returning IDs to the LLM, shorten them::

       alias = current_mapper().shorten(fact_id, prefix="F")
"""

from __future__ import annotations

import contextvars
from typing import Optional


class ShortIdMapper:
    """Bidirectional mapping between full UUIDs and short aliases.

    Short aliases are generated as ``<prefix><counter>``
    (e.g. ``T0``, ``F0``, ``F1``, …).
    """

    def __init__(self) -> None:
        self._to_short: dict[str, str] = {}   # full → short
        self._to_full: dict[str, str] = {}     # short → full
        self._counters: dict[str, int] = {}    # prefix → next index

    # -- Public API --------------------------------------------------------

    def register(self, full_id: str, prefix: str = "ID") -> str:
        """Register a full UUID and return its short alias.

        If already registered, return the existing alias.
        """
        if full_id in self._to_short:
            return self._to_short[full_id]

        idx = self._counters.get(prefix, 0)
        self._counters[prefix] = idx + 1

        short = f"{prefix}{idx}"
        self._to_short[full_id] = short
        self._to_full[short] = full_id
        return short

    def shorten(self, full_id: str, prefix: str = "ID") -> str:
        """Return the short alias for *full_id*, registering it if needed."""
        return self.register(full_id, prefix)

    def resolve(self, short_or_full: str) -> str:
        """Resolve a short alias to the full UUID.

        If *short_or_full* is already a full UUID (not in the short→full
        map), it is returned unchanged — this makes the function safe to
        call even when the LLM passes a raw UUID.
        """
        return self._to_full.get(short_or_full, short_or_full)

    def summary(self) -> str:
        """Return a human-readable mapping table for injection into prompts."""
        if not self._to_full:
            return ""
        lines = ["Short-ID mapping (use the short ID in tool calls):"]
        for short, full in sorted(self._to_full.items()):
            lines.append(f"  {short} → {full}")
        return "\n".join(lines)

    def rehydrate(self, history: list[Any]) -> None:
        """Scan chat history to recover short-to-full mappings.
        
        This looks for '→' patterns in human-readable mapping descriptions 
        that might have been injected into previous prompts or tool results.
        """
        import re
        # Pattern: [Short ID] → [Full ID]
        pattern = re.compile(r"([A-Z]+\d+)\s*→\s*([a-f0-9]{32}|[a-f0-9-]{36})", re.IGNORECASE)

        for msg in history:
            text = ""
            if hasattr(msg, "content"):
                text = str(msg.content)
            elif isinstance(msg, dict):
                text = str(msg.get("message", ""))
            
            if not text:
                continue

            for match in pattern.finditer(text):
                short_id, full_id = match.groups()
                # Clean up UUID (hex format)
                full_id = full_id.replace("-", "").lower()
                
                if short_id not in self._to_full:
                    self._to_full[short_id] = full_id
                    self._to_short[full_id] = short_id
                    
                    # Ensure counters don't overlap with recovered IDs
                    prefix = "".join(re.findall(r'[A-Z]+', short_id))
                    idx_str = "".join(re.findall(r'\d+', short_id))
                    if idx_str:
                        idx = int(idx_str)
                        current_idx = self._counters.get(prefix, 0)
                        if idx >= current_idx:
                            self._counters[prefix] = idx + 1


# -- Context variable ------------------------------------------------------

_mapper_var: contextvars.ContextVar[Optional[ShortIdMapper]] = contextvars.ContextVar(
    "short_id_mapper", default=None,
)


def set_mapper(mapper: ShortIdMapper) -> None:
    """Set the mapper for the current async context."""
    _mapper_var.set(mapper)


def current_mapper() -> ShortIdMapper:
    """Return the mapper for the current context, or a no-op passthrough."""
    mapper = _mapper_var.get()
    if mapper is None:
        # Fallback: return a fresh mapper that won't resolve anything,
        # so IDs pass through unchanged.
        return ShortIdMapper()
    return mapper
