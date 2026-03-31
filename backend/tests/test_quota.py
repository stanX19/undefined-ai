"""Quota / rate-limiting integration tests focused on chat quota semantics.

Covers:
  1. Validation-before-charge for chat on invalid topic IDs
  2. Basic free-tier quota exhaustion for chat
  3. Concurrent chat requests preserve total units used
  4. Credits overage deduction after free quota is exhausted

`tests.test_pricing` owns the revised pricing coverage for uploads, speech,
recommendations, and UI generation/read behavior.

Run: ``python -m tests.test_quota`` from the backend root.
"""
from __future__ import annotations

import os
import sys
import time
import types
import threading
import tempfile
import concurrent.futures

import requests
import uvicorn

from tests.test_client import TestClient, Colors, ThreadFilter

ThreadFilter.redirect_all_other()

_test_db: str | None = None
_app = None


def _prioritize_site_packages() -> None:
    """Ensure installed packages win over local namespace folders like ./alembic."""
    import site

    for path in reversed(site.getsitepackages()):
        if path in sys.path:
            sys.path.remove(path)
        sys.path.insert(0, path)


def _ensure_alembic_importable() -> None:
    """Provide a small Alembic shim when the package is unavailable in the test venv."""
    try:
        from alembic import command as _command  # noqa: F401
        return
    except Exception:
        pass

    alembic_mod = types.ModuleType("alembic")
    command_mod = types.ModuleType("alembic.command")
    config_mod = types.ModuleType("alembic.config")

    class Config:
        def __init__(self, *args, **kwargs) -> None:
            self.args = args
            self.kwargs = kwargs

    def _upgrade(cfg: Config, revision: str) -> None:
        import asyncio
        import srcs.models  # noqa: F401
        from srcs.database import Base, engine

        async def _create_schema() -> None:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(_create_schema())

    def _stamp(cfg: Config, revision: str) -> None:
        return None

    command_mod.upgrade = _upgrade
    command_mod.stamp = _stamp
    config_mod.Config = Config
    alembic_mod.command = command_mod

    sys.modules["alembic"] = alembic_mod
    sys.modules["alembic.command"] = command_mod
    sys.modules["alembic.config"] = config_mod


def _ensure_optional_dependencies() -> None:
    """Stub optional libraries imported at module import time in this repo."""
    try:
        import docx  # noqa: F401
    except Exception:
        docx_mod = types.ModuleType("docx")

        class _DummyParagraph:
            text = ""

        class _DummyDocument:
            def __init__(self, *args, **kwargs) -> None:
                self.paragraphs = [_DummyParagraph()]

        docx_mod.Document = _DummyDocument
        sys.modules["docx"] = docx_mod

    try:
        from elevenlabs.client import ElevenLabs as _ElevenLabs  # noqa: F401
    except Exception:
        elevenlabs_mod = types.ModuleType("elevenlabs")
        elevenlabs_client_mod = types.ModuleType("elevenlabs.client")

        class ElevenLabs:
            def __init__(self, *args, **kwargs) -> None:
                pass

        elevenlabs_client_mod.ElevenLabs = ElevenLabs
        elevenlabs_mod.client = elevenlabs_client_mod
        sys.modules["elevenlabs"] = elevenlabs_mod
        sys.modules["elevenlabs.client"] = elevenlabs_client_mod


def _get_test_db() -> str:
    global _test_db
    if _test_db is None:
        _test_db = os.path.join(tempfile.gettempdir(), f"undefinedai_quota_{os.getpid()}.db")
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_test_db}"
        os.environ["DB_NAME"] = _test_db
        os.environ["DEBUG"] = "false"
        os.environ["FAKE_LOGIN_TOKEN"] = "fake_demo_token_123"
    return _test_db


def _get_app():
    global _app
    if _app is None:
        _get_test_db()
        _prioritize_site_packages()
        _ensure_alembic_importable()
        _ensure_optional_dependencies()
        from main import app as fastapi_app  # noqa: E402

        _app = fastapi_app
    return _app


def start_server(port: int = 8005) -> None:
    uvicorn.run(_get_app(), host="127.0.0.1", port=port, log_level="error")


def _register_and_login(client: TestClient, email: str, password: str = "TestPass1") -> tuple[str, str]:
    """Register a user and return (JWT token, user_id)."""
    res = client.post(
        "/api/v1/auth/register",
        description=f"Register {email}",
        json={"email": email, "password": password, "username": email.split("@")[0]},
    )
    return res["access_token"], res["user_id"]


def _get_units_used(test_db: str, user_id: str) -> int:
    import sqlite3

    conn = sqlite3.connect(test_db, timeout=30)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COALESCE(SUM(units_used), 0) FROM daily_usage WHERE user_id = ?",
            (user_id,),
        )
        return int(cursor.fetchone()[0] or 0)
    finally:
        conn.close()


def run_tests() -> None:
    test_db = _get_test_db()
    _get_app()
    from srcs.config import get_settings

    settings = get_settings()
    free_units = settings.RATE_LIMIT_FREE_UNITS_BY_PLAN["free"]
    chat_unit_cost = settings.UNIT_COST_CHAT
    expected_chat_successes = free_units // chat_unit_cost

    port = 8005
    base_url = f"http://127.0.0.1:{port}"
    print(f"{Colors.BLUE}Starting Server (port {port})...{Colors.END}")
    server_thread = threading.Thread(target=start_server, kwargs={"port": port}, daemon=True)
    server_thread.start()

    for _ in range(40):
        try:
            raw = requests.get(f"{base_url}/health", timeout=0.5)
            if raw.status_code == 200:
                break
        except Exception:
            pass
        time.sleep(0.25)
    else:
        raise RuntimeError("Server did not become ready in time")

    start_time = time.time()
    client = TestClient(base_url, actor_name="QuotaTest")

    try:
        print(f"\n{Colors.BOLD}=== QUOTA TEST SETUP ==={Colors.END}\n")
        token, quota_user_id = _register_and_login(client, "quota_user@test.com")
        client.headers["Authorization"] = f"Bearer {token}"

        topic = client.post(
            "/api/v1/topics/",
            description="Create topic",
            json={"title": "Quota Test Topic"},
        )
        topic_id = topic["topic_id"]

        print(f"\n{Colors.BOLD}--- TEST 1: Validation-before-charge (bad topic_id) ---{Colors.END}")
        before_units = _get_units_used(test_db, quota_user_id)
        raw = requests.post(
            f"{base_url}/api/v1/chat/",
            headers={"Authorization": f"Bearer {token}"},
            json={"topic_id": "nonexistent_topic_id", "message": "hello"},
            timeout=30,
        )
        assert raw.status_code == 404, f"Expected 404, got {raw.status_code}"
        after_units = _get_units_used(test_db, quota_user_id)
        assert after_units == before_units, "Invalid chat topic should not consume units"
        print(f"{Colors.GREEN}Chat with bad topic_id returned 404 and did not burn units{Colors.END}")

        print(f"\n{Colors.BOLD}--- TEST 2: Quota exhaustion (free tier chat quota = {expected_chat_successes} requests) ---{Colors.END}")
        token_exhaust, exhaust_user_id = _register_and_login(client, "exhaust@test.com")
        topic_exhaust = requests.post(
            f"{base_url}/api/v1/topics/",
            headers={"Authorization": f"Bearer {token_exhaust}"},
            json={"title": "Exhaust Topic"},
            timeout=30,
        ).json()
        topic_exhaust_id = topic_exhaust["topic_id"]

        succeeded = 0
        got_429 = False
        for i in range(expected_chat_successes + 5):
            raw = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_exhaust}"},
                json={"topic_id": topic_exhaust_id, "message": f"msg {i}"},
                timeout=30,
            )
            if raw.status_code == 429:
                got_429 = True
                print(f"{Colors.GREEN}Got 429 on attempt {i + 1} after {succeeded} successful requests{Colors.END}")
                break
            if raw.status_code == 200:
                succeeded += 1
                continue
            raise AssertionError(f"Unexpected status {raw.status_code}: {raw.text}")

        assert got_429, f"Expected 429 after exhausting free chat quota of {expected_chat_successes} requests"
        assert succeeded == expected_chat_successes, f"Expected exactly {expected_chat_successes} successes before 429, got {succeeded}"
        assert _get_units_used(test_db, exhaust_user_id) == free_units, "Units used should equal exhausted free quota"
        print(f"{Colors.GREEN}Free quota correctly exhausted at {expected_chat_successes} chat requests{Colors.END}")

        print(f"\n{Colors.BOLD}--- TEST 3: Concurrent requests preserve units_used ---{Colors.END}")
        token_conc, conc_user_id = _register_and_login(client, "concurrent@test.com")
        topic_conc = requests.post(
            f"{base_url}/api/v1/topics/",
            headers={"Authorization": f"Bearer {token_conc}"},
            json={"title": "Concurrency Topic"},
            timeout=30,
        ).json()
        topic_conc_id = topic_conc["topic_id"]

        def _send_chat(idx: int) -> int:
            r = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_conc}"},
                json={"topic_id": topic_conc_id, "message": f"concurrent msg {idx}"},
                timeout=30,
            )
            return r.status_code

        n_concurrent = 5
        with concurrent.futures.ThreadPoolExecutor(max_workers=n_concurrent) as pool:
            futures = [pool.submit(_send_chat, i) for i in range(n_concurrent)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        ok_count = results.count(200)
        print(f"  {ok_count}/{n_concurrent} returned 200")
        assert ok_count == n_concurrent, f"Expected all {n_concurrent} to succeed within free chat quota, got {ok_count}"
        assert _get_units_used(test_db, conc_user_id) == n_concurrent * chat_unit_cost, "Concurrent accepted requests should increment units_used exactly once each"

        remaining_quota = max(0, expected_chat_successes - n_concurrent)
        for i in range(remaining_quota + 3):
            raw = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_conc}"},
                json={"topic_id": topic_conc_id, "message": f"sequential msg {i}"},
                timeout=30,
            )
            if raw.status_code == 429:
                total_sent = n_concurrent + i
                print(f"{Colors.GREEN}429 after {total_sent} total requests (expected {expected_chat_successes}){Colors.END}")
                assert total_sent == expected_chat_successes, f"Expected cutoff at {expected_chat_successes}, got {total_sent}"
                break
        else:
            raise AssertionError(f"Expected 429 after {expected_chat_successes} total requests but never received one")

        print(f"\n{Colors.BOLD}--- TEST 4: Credits overage deduction ---{Colors.END}")
        import sqlite3

        conn = sqlite3.connect(test_db, timeout=30)
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET credits_balance = 5 WHERE email = ?",
            ("exhaust@test.com",),
        )
        conn.commit()
        cursor.execute(
            "SELECT credits_balance FROM users WHERE email = ?",
            ("exhaust@test.com",),
        )
        bal = cursor.fetchone()[0]
        assert bal == 5, f"Expected 5 credits, got {bal}"
        conn.close()

        credit_successes = 0
        for i in range(8):
            raw = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_exhaust}"},
                json={"topic_id": topic_exhaust_id, "message": f"credit msg {i}"},
                timeout=30,
            )
            if raw.status_code == 200:
                credit_successes += 1
            elif raw.status_code == 429:
                print(f"{Colors.GREEN}429 after {credit_successes} credit-funded requests{Colors.END}")
                break

        assert credit_successes == 5, f"Expected 5 credit-funded successes, got {credit_successes}"

        conn = sqlite3.connect(test_db, timeout=30)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT credits_balance FROM users WHERE email = ?",
            ("exhaust@test.com",),
        )
        bal = cursor.fetchone()[0]
        conn.close()
        assert bal == 0, f"Expected 0 credits remaining, got {bal}"
        print(f"{Colors.GREEN}Credits correctly decremented to 0{Colors.END}")

        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL QUOTA TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}Total time: {time.time() - start_time:.2f}s{Colors.END}")

    except AssertionError as e:
        print(f"\n{Colors.RED}{Colors.BOLD}TEST FAILED: {e}{Colors.END}")
        raise
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING TESTS: {e}{Colors.END}")
        raise
    finally:
        if test_db:
            for path in (test_db, f"{test_db}-wal", f"{test_db}-shm"):
                if os.path.exists(path):
                    try:
                        os.unlink(path)
                    except OSError:
                        pass


if __name__ == "__main__":
    run_tests()
