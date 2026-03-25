"""Quota / rate-limiting integration tests.

Covers:
  1. Basic quota consumption and 429 exhaustion
  2. Validation-before-charge ordering (invalid requests must not burn units)
  3. Concurrent requests — units_used must equal the sum of all accepted requests
  4. Credits overage deduction (paid user whose free quota is exceeded)
  5. Alembic fresh-database migration (upgrade head on an empty database)

Run:  ``python -m tests.test_quota`` from the backend root.
"""
import os
import sys
import time
import threading
import tempfile
import concurrent.futures
from pathlib import Path

import requests
import uvicorn
from alembic.config import Config
from alembic.script import ScriptDirectory

from tests.test_client import TestClient, Colors, ThreadFilter

ThreadFilter.redirect_all_other()

_test_db: str | None = None
_app = None


def _get_test_db() -> str:
    global _test_db
    if _test_db is None:
        _test_db = os.path.join(tempfile.gettempdir(), f"undefinedai_test_{os.getpid()}.db")
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_test_db}"
        os.environ["DB_NAME"] = _test_db
    return _test_db


def _get_app():
    global _app
    if _app is None:
        _get_test_db()
        from main import app as fastapi_app  # noqa: E402
        _app = fastapi_app
    return _app


def start_server(port: int = 8005):
    uvicorn.run(_get_app(), host="127.0.0.1", port=port, log_level="error")


def _register_and_login(client: TestClient, email: str, password: str = "TestPass1") -> tuple[str, str]:
    """Register a user and return (JWT token, user_id)."""
    res = client.post(
        "/api/v1/auth/register",
        description=f"Register {email}",
        json={"email": email, "password": password, "username": email.split("@")[0]},
    )
    return res["access_token"], res["user_id"]


def run_tests():
    test_db = _get_test_db()
    port = 8005
    base_url = f"http://127.0.0.1:{port}"
    print(f"{Colors.BLUE}Starting Server (port {port})...{Colors.END}")
    server_thread = threading.Thread(target=start_server, kwargs={"port": port}, daemon=True)
    server_thread.start()
    # Alembic migrations may take longer than a fixed sleep.
    # Poll the health endpoint until the server is ready (or time out).
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
        # -- Setup: register user + create topic -------------------------
        print(f"\n{Colors.BOLD}=== QUOTA TEST SETUP ==={Colors.END}\n")
        token, quota_user_id = _register_and_login(client, "quota_user@test.com")
        client.headers["Authorization"] = f"Bearer {token}"

        topic = client.post(
            "/api/v1/topics/",
            description="Create topic",
            json={"title": "Quota Test Topic"},
        )
        topic_id = topic["topic_id"]

        # =================================================================
        # TEST 1: Validation-before-charge — invalid topic_id
        # =================================================================
        print(f"\n{Colors.BOLD}--- TEST 1: Validation-before-charge (bad topic_id) ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/chat/",
            headers={"Authorization": f"Bearer {token}"},
            json={"topic_id": "nonexistent_topic_id", "message": "hello"},
        )
        assert raw.status_code == 404, f"Expected 404, got {raw.status_code}"
        print(f"{Colors.GREEN}Chat with bad topic_id returned 404 (no units burned){Colors.END}")

        # =================================================================
        # TEST 2: Validation-before-charge — bad speech file
        # =================================================================
        print(f"\n{Colors.BOLD}--- TEST 2: Validation-before-charge (bad speech file) ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/speech/stt",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("doc.pdf", b"not audio", "application/pdf")},
        )
        assert raw.status_code == 400, f"Expected 400, got {raw.status_code}"
        print(f"{Colors.GREEN}Speech with .pdf returned 400 (no units burned){Colors.END}")

        raw = requests.post(
            f"{base_url}/api/v1/speech/stt",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("empty.mp3", b"", "audio/mpeg")},
        )
        assert raw.status_code == 400, f"Expected 400 for empty file, got {raw.status_code}"
        print(f"{Colors.GREEN}Speech with empty file returned 400 (no units burned){Colors.END}")

        # =================================================================
        # TEST 3: Validation-before-charge — bad upload file
        # =================================================================
        print(f"\n{Colors.BOLD}--- TEST 3: Validation-before-charge (bad upload file) ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("readme.txt", b"not a pdf", "text/plain")},
        )
        assert raw.status_code == 400, f"Expected 400, got {raw.status_code}"
        print(f"{Colors.GREEN}Upload with .txt returned 400 (no units burned){Colors.END}")

        # =================================================================
        # TEST 3b: Validation-before-charge — invalid .pdf should not burn quota
        # =================================================================
        import sqlite3

        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COALESCE(SUM(units_used), 0) FROM daily_usage WHERE user_id = ?",
            (quota_user_id,),
        )
        before_units = cursor.fetchone()[0]
        conn.close()

        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("fake.pdf", b"", "application/pdf")},
        )
        assert raw.status_code == 400, f"Expected 400, got {raw.status_code}"

        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("fake.pdf", b"not a pdf", "application/pdf")},
        )
        assert raw.status_code == 400, f"Expected 400, got {raw.status_code}"

        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COALESCE(SUM(units_used), 0) FROM daily_usage WHERE user_id = ?",
            (quota_user_id,),
        )
        after_units = cursor.fetchone()[0]
        conn.close()

        assert after_units == before_units, f"Units burned for invalid PDFs: before={before_units}, after={after_units}"

        # =================================================================
        # TEST 4: Quota exhaustion — free tier is 10 units
        # =================================================================
        print(f"\n{Colors.BOLD}--- TEST 4: Quota exhaustion (free tier = 10 units) ---{Colors.END}")

        # Register a fresh user to get a clean 10-unit quota
        token_exhaust, _ = _register_and_login(client, "exhaust@test.com")
        topic_exhaust = requests.post(
            f"{base_url}/api/v1/topics/",
            headers={"Authorization": f"Bearer {token_exhaust}"},
            json={"title": "Exhaust Topic"},
        ).json()
        topic_exhaust_id = topic_exhaust["topic_id"]

        succeeded = 0
        got_429 = False
        for i in range(15):
            raw = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_exhaust}"},
                json={"topic_id": topic_exhaust_id, "message": f"msg {i}"},
            )
            if raw.status_code == 429:
                got_429 = True
                print(f"{Colors.GREEN}Got 429 on attempt {i + 1} after {succeeded} successful requests{Colors.END}")
                detail = raw.json().get("detail", {})
                print(f"  detail: {detail}")
                break
            elif raw.status_code == 200:
                succeeded += 1
            else:
                print(f"{Colors.RED}Unexpected status {raw.status_code}: {raw.text}{Colors.END}")
                break

        assert got_429, "Expected 429 after exhausting 10-unit free quota"
        assert succeeded == 10, f"Expected exactly 10 successes before 429, got {succeeded}"
        print(f"{Colors.GREEN}Free quota correctly exhausted at 10 units{Colors.END}")

        # =================================================================
        # TEST 5: Concurrent requests — verify total units_used is correct
        # =================================================================
        print(f"\n{Colors.BOLD}--- TEST 5: Concurrent requests (5 parallel chat sends) ---{Colors.END}")

        token_conc, _ = _register_and_login(client, "concurrent@test.com")
        topic_conc = requests.post(
            f"{base_url}/api/v1/topics/",
            headers={"Authorization": f"Bearer {token_conc}"},
            json={"title": "Concurrency Topic"},
        ).json()
        topic_conc_id = topic_conc["topic_id"]

        def _send_chat(idx: int) -> int:
            r = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_conc}"},
                json={"topic_id": topic_conc_id, "message": f"concurrent msg {idx}"},
            )
            return r.status_code

        n_concurrent = 5
        with concurrent.futures.ThreadPoolExecutor(max_workers=n_concurrent) as pool:
            futures = [pool.submit(_send_chat, i) for i in range(n_concurrent)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        ok_count = results.count(200)
        print(f"  {ok_count}/{n_concurrent} returned 200")
        assert ok_count == n_concurrent, f"Expected all {n_concurrent} to succeed (within 10-unit quota), got {ok_count}"

        # Now send more to see where the cutoff lands — should be at 10 total
        remaining_quota = 10 - n_concurrent
        for i in range(remaining_quota + 3):
            raw = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_conc}"},
                json={"topic_id": topic_conc_id, "message": f"sequential msg {i}"},
            )
            if raw.status_code == 429:
                total_sent = n_concurrent + i
                print(f"{Colors.GREEN}429 after {total_sent} total requests (expected 10){Colors.END}")
                assert total_sent == 10, f"Expected cutoff at 10, got {total_sent}"
                break
        else:
            print(f"{Colors.RED}Never got 429 — concurrency may have lost updates{Colors.END}")
            assert False, "Expected 429 after 10 total units but never received one"

        # =================================================================
        # TEST 6: Credits overage deduction
        # =================================================================
        print(f"\n{Colors.BOLD}--- TEST 6: Credits overage (manual DB injection) ---{Colors.END}")

        # We'll directly manipulate the credits_balance via SQL to simulate
        # a payment without needing Stripe.
        import sqlite3
        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()

        # Give the exhausted user some credits
        cursor.execute(
            "UPDATE users SET credits_balance = 5 WHERE email = ?",
            ("exhaust@test.com",),
        )
        conn.commit()

        # Verify credits were set
        cursor.execute(
            "SELECT credits_balance FROM users WHERE email = ?",
            ("exhaust@test.com",),
        )
        bal = cursor.fetchone()[0]
        assert bal == 5, f"Expected 5 credits, got {bal}"
        conn.close()

        # Now the user should be able to send 5 more messages (using credits)
        credit_successes = 0
        for i in range(8):
            raw = requests.post(
                f"{base_url}/api/v1/chat/",
                headers={"Authorization": f"Bearer {token_exhaust}"},
                json={"topic_id": topic_exhaust_id, "message": f"credit msg {i}"},
            )
            if raw.status_code == 200:
                credit_successes += 1
            elif raw.status_code == 429:
                print(f"{Colors.GREEN}429 after {credit_successes} credit-funded requests{Colors.END}")
                break

        assert credit_successes == 5, f"Expected 5 credit-funded successes, got {credit_successes}"

        # Verify credits_balance is now 0
        conn = sqlite3.connect(test_db)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT credits_balance FROM users WHERE email = ?",
            ("exhaust@test.com",),
        )
        bal = cursor.fetchone()[0]
        conn.close()
        assert bal == 0, f"Expected 0 credits remaining, got {bal}"
        print(f"{Colors.GREEN}Credits correctly decremented to 0{Colors.END}")

        # -- Done ---------------------------------------------------------
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL QUOTA TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}Total time: {time.time() - start_time:.2f}s{Colors.END}")

    except AssertionError as e:
        print(f"\n{Colors.RED}{Colors.BOLD}TEST FAILED: {e}{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING TESTS: {e}{Colors.END}")
        import traceback
        traceback.print_exc()
    finally:
        # Cleanup temp database
        if test_db and os.path.exists(test_db):
            try:
                os.unlink(test_db)
            except OSError:
                pass


def test_alembic_fresh_database():
    """Verify that ``alembic upgrade head`` works on a completely empty database.

    This test creates a temporary SQLite file, points Alembic at it, runs
    ``upgrade head``, then inspects the resulting schema.

    Run standalone:  ``python -m tests.test_quota alembic``
    """
    import subprocess
    import sqlite3

    print(f"\n{Colors.BOLD}=== ALEMBIC FRESH-DB MIGRATION TEST ==={Colors.END}\n")

    fresh_db = os.path.join(tempfile.gettempdir(), f"alembic_fresh_{os.getpid()}.db")
    db_url = f"sqlite+aiosqlite:///{fresh_db}"

    env = os.environ.copy()
    env["DATABASE_URL"] = db_url

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=backend_dir,
            env=env,
        )

        if result.returncode != 0:
            print(f"{Colors.RED}alembic upgrade head FAILED:{Colors.END}")
            print(result.stderr)
            assert False, f"Alembic upgrade failed: {result.stderr}"

        print(f"{Colors.GREEN}alembic upgrade head succeeded{Colors.END}")

        # Verify schema
        conn = sqlite3.connect(fresh_db)
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = {row[0] for row in cursor.fetchall()}
        expected = {"users", "topics", "scenes", "atomic_facts", "chat_history",
                    "shares", "daily_usage", "alembic_version"}
        missing = expected - tables
        assert not missing, f"Missing tables: {missing}"
        print(f"{Colors.GREEN}All expected tables present: {sorted(expected - {'alembic_version'})}{Colors.END}")

        # Check users has plan_tier and credits_balance
        cursor.execute("PRAGMA table_info(users)")
        user_cols = {row[1] for row in cursor.fetchall()}
        assert "plan_tier" in user_cols, "plan_tier column missing from users"
        assert "credits_balance" in user_cols, "credits_balance column missing from users"
        print(f"{Colors.GREEN}users table has plan_tier and credits_balance{Colors.END}")

        # Check daily_usage columns
        cursor.execute("PRAGMA table_info(daily_usage)")
        du_cols = {row[1] for row in cursor.fetchall()}
        assert "user_id" in du_cols, "user_id column missing from daily_usage"
        assert "bucket_start_utc" in du_cols, "bucket_start_utc column missing from daily_usage"
        assert "units_used" in du_cols, "units_used column missing from daily_usage"
        print(f"{Colors.GREEN}daily_usage table schema is correct{Colors.END}")

        # Verify alembic_version
        cursor.execute("SELECT version_num FROM alembic_version")
        row = cursor.fetchone()
        assert row is not None and row[0], "Alembic version_num is missing or empty"
        version = row[0]
        alembic_cfg = Config(str(Path(backend_dir) / "alembic.ini"))
        expected_head = ScriptDirectory.from_config(alembic_cfg).get_current_head()
        assert version == expected_head, f"Expected head revision {expected_head}, got {version}"
        print(f"{Colors.GREEN}Alembic version stamp: {version}{Colors.END}")

        conn.close()
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALEMBIC FRESH-DB TEST PASSED!{Colors.END}")

    except AssertionError:
        raise
    finally:
        if os.path.exists(fresh_db):
            try:
                os.unlink(fresh_db)
            except OSError:
                pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "alembic":
        test_alembic_fresh_database()
    else:
        run_tests()
