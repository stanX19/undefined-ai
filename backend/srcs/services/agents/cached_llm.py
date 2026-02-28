"""
Caching wrapper around RotatingLLM.
Caches successful LLM responses as JSON files in {UPLOAD_DIR}/llm_cache/.
Cache key = hash of (messages + temperature + model).
Only responses with status == "ok" are cached.
"""

import hashlib
import json
import os

from langchain_core.messages import BaseMessage

from srcs.config import get_settings
from srcs.services.agents.rotating_llm import RotatingLLM, LLMResponse, rotating_llm


def _cache_dir() -> str:
    path = os.path.join(get_settings().UPLOAD_DIR, "llm_cache")
    os.makedirs(path, exist_ok=True)
    return path


def _serialize_messages(messages) -> str:
    """Deterministically serialize messages for hashing."""
    if messages is None:
        return ""
    if isinstance(messages, str):
        return messages
    if isinstance(messages, dict):
        return json.dumps(messages, sort_keys=True)
    if isinstance(messages, BaseMessage):
        return json.dumps({"type": messages.type, "content": messages.content}, sort_keys=True)
    if isinstance(messages, list):
        return json.dumps([
            {"type": m.type, "content": m.content} if isinstance(m, BaseMessage)
            else json.dumps(m, sort_keys=True) if isinstance(m, dict)
            else m
            for m in messages
        ], sort_keys=True)
    return str(messages)


def _cache_key(messages, temperature: float, model: str | None) -> str:
    raw = json.dumps({
        "messages": _serialize_messages(messages),
        "temperature": temperature,
        "model": model,
    }, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _load_cache(key: str) -> LLMResponse | None:
    path = os.path.join(_cache_dir(), f"{key}.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return LLMResponse(**data)
    except Exception:
        return None


def _save_cache(key: str, response: LLMResponse) -> None:
    path = os.path.join(_cache_dir(), f"{key}.json")
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(response.model_dump(), f, ensure_ascii=False, indent=2)
    except Exception:
        pass


class CachedLLM:
    """Wraps a RotatingLLM and adds file-based caching for send_message / send_message_get_json."""

    def __init__(self, llm: RotatingLLM):
        self._llm = llm

    # -- delegate everything else straight through --
    def __getattr__(self, name):
        return getattr(self._llm, name)

    async def send_message(
            self,
            messages,
            config=None,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs
    ) -> LLMResponse:
        key = _cache_key(messages, temperature, model)
        cached = _load_cache(key)
        if cached is not None:
            print(f"[CACHED_LLM] Cache HIT  ({key[:12]}…)")
            return cached

        print(f"[CACHED_LLM] Cache MISS ({key[:12]}…)")
        result = await self._llm.send_message(messages, config, temperature=temperature, model=model, **llm_kwargs)

        if result.status == "ok":
            _save_cache(key, result)

        return result

    async def send_message_get_json(
            self,
            messages,
            config=None,
            retry: int = 3,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs
    ) -> LLMResponse:
        key = _cache_key(messages, temperature, model)
        cached = _load_cache(key)
        if cached is not None and cached.json_data is not None:
            print(f"[CACHED_LLM] Cache HIT  ({key[:12]}…)")
            return cached

        print(f"[CACHED_LLM] Cache MISS ({key[:12]}…)")
        result = await self._llm.send_message_get_json(
            messages, config, retry=retry, temperature=temperature, model=model, **llm_kwargs
        )

        if result.status == "ok" and result.json_data is not None:
            _save_cache(key, result)

        return result


cached_llm = CachedLLM(rotating_llm)
