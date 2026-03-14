"""
Caching wrapper around RotatingLLM.
Caches successful LLM responses as JSON files in {UPLOAD_DIR}/llm_cache/.
Cache key = hash of (messages + temperature + model).
Only responses with status == "ok" are cached.
"""

import asyncio
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
        self._in_flight = {}  # key -> Task

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
        return await self._cached_call(
            messages,
            temperature,
            model,
            lambda: self._llm.send_message(messages, config, temperature=temperature, model=model, **llm_kwargs),
            check_json=False
        )

    async def send_message_get_json(
            self,
            messages,
            config=None,
            retry: int = 3,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs
    ) -> LLMResponse:
        return await self._cached_call(
            messages,
            temperature,
            model,
            lambda: self._llm.send_message_get_json(
                messages, config, retry=retry, temperature=temperature, model=model, **llm_kwargs
            ),
            check_json=True
        )

    async def _cached_call(
            self,
            messages,
            temperature: float,
            model: str | None,
            call_llm_func,
            check_json: bool = False
    ) -> LLMResponse:
        key = _cache_key(messages, temperature, model)

        # 1. Deduplicate concurrent requests
        if key in self._in_flight:
            print(f"[CACHED_LLM] Concurrent HIT ({key[:12]}…)")
            return await self._in_flight[key]

        # 2. Check disk cache
        cached = _load_cache(key)
        if cached is not None:
            if not check_json or (cached.json_data is not None):
                print(f"[CACHED_LLM] Cache HIT  ({key[:12]}…)")
                return cached

        # 3. Define the LLM call work
        async def _do_work():
            print(f"[CACHED_LLM] Cache MISS ({key[:12]}…)")
            res = await call_llm_func()
            if res.status == "ok":
                if not check_json or (res.json_data is not None):
                    _save_cache(key, res)
            return res

        # 4. Create and register task
        task = asyncio.create_task(_do_work())
        self._in_flight[key] = task
        try:
            return await task
        finally:
            # Only remove if we are the one who set it (though with the key logic it should be fine)
            if self._in_flight.get(key) == task:
                self._in_flight.pop(key, None)


cached_llm = CachedLLM(rotating_llm)


if __name__ == "__main__":
    import unittest
    from unittest.mock import AsyncMock, MagicMock

    class TestCachedLLM(unittest.IsolatedAsyncioTestCase):
        async def test_concurrent_deduplication(self):
            # Setup mock LLM
            mock_llm = MagicMock()
            mock_llm.send_message = AsyncMock(return_value=LLMResponse(status="ok", text="shared result", model="mock-model"))
            
            # Create instance (bypass disk for simplicity in this test)
            instance = CachedLLM(mock_llm)
            
            # To ensure it misses disk, we can mock _load_cache too or just use a unique message
            # But here let's actually just verify the call count
            msg = "test message 1"
            
            # Fire off two concurrent requests
            results = await asyncio.gather(
                instance.send_message(msg),
                instance.send_message(msg)
            )
            
            # Verify results are the same
            self.assertEqual(results[0].text, "shared result")
            self.assertEqual(results[1].text, "shared result")
            
            # Verify LLM was only called ONCE
            self.assertEqual(mock_llm.send_message.call_count, 1)
            print("\n[TEST] Concurrent deduplication verified: 2 requests -> 1 LLM call.")

    async def run_test():
        test_suite = unittest.TestLoader().loadTestsFromTestCase(TestCachedLLM)
        await asyncio.to_thread(unittest.TextTestRunner().run, test_suite)

    asyncio.run(run_test())
