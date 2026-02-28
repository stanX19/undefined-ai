"""Unit tests for Phase 1 routes: health, auth, topics.

Run: ``python -m tests.test`` from the backend root.
"""
import os
import time
import threading
import tempfile

import requests
import uvicorn

from tests.test_client import TestClient, Colors, ThreadFilter

ThreadFilter.redirect_all_other()
from main import app


def start_server():
    """Start uvicorn in a daemon thread with in-memory DB."""
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="error")


def run_tests():
    print(f"{Colors.BLUE}Starting Server (port 8001)...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(2)
    start_time = time.time()

    base_url = "http://127.0.0.1:8001"
    client = TestClient(base_url, actor_name="Tester")

    print(f"\n{Colors.BOLD}=== RUNNING PHASE 1 UNIT TESTS ==={Colors.END}\n")

    try:
        # ── 1. Health Check ──────────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 1. Health Check ---{Colors.END}")
        res = client.get("/health", description="Health probe")
        assert res == {"status": "healthy"}, f"Expected healthy, got {res}"

        # ── 2. Login — new user ──────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 2. Auth: Login new user ---{Colors.END}")
        res = client.post(
            "/api/v1/auth/login",
            description="Login new user",
            json={"user_id": "test_user_001"},
        )
        assert "user_id" in res, "Missing user_id in login response"
        assert res["user_id"] == "test_user_001"
        assert "created_at" in res, "Missing created_at"
        user_id = res["user_id"]

        # ── 3. Login — idempotent ────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 3. Auth: Login same user again ---{Colors.END}")
        res2 = client.post(
            "/api/v1/auth/login",
            description="Login same user (idempotent)",
            json={"user_id": user_id},
        )
        assert res2["user_id"] == user_id, "Login should return same user_id"
        assert res2["created_at"] == res["created_at"], "created_at should stay the same"

        # ── 4. Create topic ──────────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 4. Topics: Create ---{Colors.END}")
        res = client.post(
            "/api/v1/topics/",
            description="Create topic",
            json={"user_id": user_id, "title": "Test Topic"},
        )
        topic_id = res["topic_id"]
        assert topic_id, "topic_id should not be empty"
        assert res["title"] == "Test Topic"
        assert res["user_id"] == user_id

        # ── 5. List topics ───────────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 5. Topics: List ---{Colors.END}")
        res = client.get(
            f"/api/v1/topics/?user_id={user_id}",
            description="List topics for user",
        )
        assert isinstance(res, list) and len(res) > 0, "Should return non-empty list"
        assert res[0]["topic_id"] == topic_id

        # ── 6. Get topic ─────────────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 6. Topics: Get by ID ---{Colors.END}")
        res = client.get(
            f"/api/v1/topics/{topic_id}",
            description="Get single topic",
        )
        assert res["title"] == "Test Topic"
        assert res.get("document_text") is None, "No doc uploaded yet"

        # ── 7. Get topic — 404 ───────────────────────────────────────────
        print(f"\n{Colors.BOLD}--- 7. Topics: 404 for nonexistent ---{Colors.END}")
        raw = requests.get(f"{base_url}/api/v1/topics/nonexistent_id_999")
        assert raw.status_code == 404, f"Expected 404, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly returned 404{Colors.END}")

        # ── 8. Upload — reject non-PDF ───────────────────────────────────
        print(f"\n{Colors.BOLD}--- 8. Topics: Upload rejects non-PDF ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id}/upload",
            files={"file": ("notes.txt", b"hello world", "text/plain")},
        )
        assert raw.status_code == 400, f"Expected 400 for .txt upload, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected non-PDF upload{Colors.END}")

        # ── Done ─────────────────────────────────────────────────────────
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}Started at:  {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(start_time))}{Colors.END}")
        print(f"{Colors.GREEN}Finished at: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(time.time()))}{Colors.END}")
        print(f"{Colors.GREEN}Total time:  {time.time() - start_time:.2f}s{Colors.END}")

    except AssertionError as e:
        print(f"\n{Colors.RED}{Colors.BOLD}TEST FAILED: {e}{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING TESTS: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_tests()
