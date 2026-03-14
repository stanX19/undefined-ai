"""Auth-specific tests for register, login, token validation, and profile update.

Run: ``python -m tests.test_auth`` from the backend root.
"""
import time
import threading

import requests
import uvicorn

from tests.test_client import TestClient, Colors, ThreadFilter

ThreadFilter.redirect_all_other()
from main import app


def start_server():
    """Start uvicorn in a daemon thread."""
    uvicorn.run(app, host="127.0.0.1", port=8003, log_level="error")


def run_tests():
    print(f"{Colors.BLUE}Starting Server (port 8003)...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(2)
    start_time = time.time()

    base_url = "http://127.0.0.1:8003"
    client = TestClient(base_url, actor_name="AuthTest")

    TEST_EMAIL = "test@example.com"
    TEST_PASSWORD = "SecurePass1"

    print(f"\n{Colors.BOLD}=== RUNNING AUTH TESTS ==={Colors.END}\n")

    try:
        # -- 1. Health Check -----------------------------------------------
        print(f"\n{Colors.BOLD}--- 1. Health Check ---{Colors.END}")
        res = client.get("/health", description="Health probe")
        assert res == {"status": "healthy"}, f"Expected healthy, got {res}"

        # -- 2. Register — valid -------------------------------------------
        print(f"\n{Colors.BOLD}--- 2. Register: valid email + password ---{Colors.END}")
        res = client.post(
            "/api/v1/auth/register",
            description="Register new user",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "username": "testuser001"},
        )
        assert "access_token" in res, f"Missing access_token: {res}"
        assert res["token_type"] == "bearer"
        assert res["email"] == TEST_EMAIL
        assert "user_id" in res
        token = res["access_token"]
        user_id = res["user_id"]
        print(f"{Colors.GREEN}Registered: {res['email']} (user_id={user_id[:8]}...){Colors.END}")

        # -- 3. Register — duplicate email ---------------------------------
        print(f"\n{Colors.BOLD}--- 3. Register: duplicate email → 400 ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/auth/register",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD, "username": "testuser002"},
        )
        assert raw.status_code == 400, f"Expected 400, got {raw.status_code}"
        assert "already registered" in raw.json()["detail"].lower()
        print(f"{Colors.GREEN}Correctly rejected duplicate email{Colors.END}")

        # -- 4. Register — weak password -----------------------------------
        print(f"\n{Colors.BOLD}--- 4. Register: weak password → 422 ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/auth/register",
            json={"email": "weak@example.com", "password": "short", "username": "weakuser"},
        )
        assert raw.status_code == 422, f"Expected 422, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected weak password{Colors.END}")

        # -- 5. Register — password missing number -------------------------
        print(f"\n{Colors.BOLD}--- 5. Register: password without number → 422 ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/auth/register",
            json={"email": "nonumber@example.com", "password": "NoNumberHere", "username": "nonumberuser"},
        )
        assert raw.status_code == 422, f"Expected 422, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected password without number{Colors.END}")

        # -- 6. Login — correct credentials --------------------------------
        print(f"\n{Colors.BOLD}--- 6. Login: correct credentials ---{Colors.END}")
        res = client.post(
            "/api/v1/auth/login",
            description="Login with correct credentials",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        assert "access_token" in res, f"Missing access_token: {res}"
        assert res["email"] == TEST_EMAIL
        assert res["user_id"] == user_id
        login_token = res["access_token"]
        print(f"{Colors.GREEN}Login successful, got JWT{Colors.END}")

        # -- 7. Login — wrong password -------------------------------------
        print(f"\n{Colors.BOLD}--- 7. Login: wrong password → 401 ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/auth/login",
            json={"email": TEST_EMAIL, "password": "WrongPass1"},
        )
        assert raw.status_code == 401, f"Expected 401, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected wrong password{Colors.END}")

        # -- 8. Login — nonexistent email ----------------------------------
        print(f"\n{Colors.BOLD}--- 8. Login: nonexistent email → 401 ---{Colors.END}")
        raw = requests.post(
            f"{base_url}/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "Whatever1"},
        )
        assert raw.status_code == 401, f"Expected 401, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected nonexistent email{Colors.END}")

        # -- 9. Protected route — no token → 401 --------------------------
        print(f"\n{Colors.BOLD}--- 9. Protected route: no token → 401 ---{Colors.END}")
        raw = requests.get(f"{base_url}/api/v1/topics/")
        assert raw.status_code == 401, f"Expected 401, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected request without token{Colors.END}")

        # -- 10. Protected route — valid token → 200 -----------------------
        print(f"\n{Colors.BOLD}--- 10. Protected route: valid token → 200 ---{Colors.END}")
        client.headers["Authorization"] = f"Bearer {login_token}"
        res = client.get(
            "/api/v1/topics/",
            description="List topics with bearer token",
        )
        assert isinstance(res, list), f"Expected list, got {type(res)}"
        print(f"{Colors.GREEN}Correctly returned topics with valid token{Colors.END}")

        # -- 11. Protected route — invalid token → 401 --------------------
        print(f"\n{Colors.BOLD}--- 11. Protected route: invalid token → 401 ---{Colors.END}")
        raw = requests.get(
            f"{base_url}/api/v1/topics/",
            headers={"Authorization": "Bearer invalidtoken123"},
        )
        assert raw.status_code == 401, f"Expected 401, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected invalid token{Colors.END}")

        # -- 12. Profile update — set education level ----------------------
        print(f"\n{Colors.BOLD}--- 12. Profile: update education level ---{Colors.END}")
        raw = requests.patch(
            f"{base_url}/api/v1/auth/profile",
            json={"education_level": "Undergraduate"},
            headers={"Authorization": f"Bearer {login_token}"},
        )
        assert raw.status_code == 200, f"Expected 200, got {raw.status_code}"
        profile = raw.json()
        assert profile["education_level"] == "Undergraduate"
        assert profile["user_id"] == user_id
        assert "password_hash" not in profile, "password_hash must never be exposed"
        print(f"{Colors.GREEN}Education level updated to: {profile['education_level']}{Colors.END}")

        # -- 13. Profile update — no token → 401 --------------------------
        print(f"\n{Colors.BOLD}--- 13. Profile: no token → 401 ---{Colors.END}")
        raw = requests.patch(
            f"{base_url}/api/v1/auth/profile",
            json={"education_level": "Graduate"},
        )
        assert raw.status_code == 401, f"Expected 401, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected profile update without token{Colors.END}")

        # -- 14. Expired token → 401 ---------------------------------------
        print(f"\n{Colors.BOLD}--- 14. Expired token → 401 ---{Colors.END}")
        from jose import jwt as jose_jwt
        from srcs.config import get_settings
        from datetime import datetime, timedelta, timezone

        _settings = get_settings()
        expired_payload = {
            "sub": user_id,
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),  # expired 1h ago
        }
        expired_token = jose_jwt.encode(
            expired_payload, _settings.JWT_SECRET_KEY, algorithm=_settings.JWT_ALGORITHM
        )
        raw = requests.get(
            f"{base_url}/api/v1/topics/",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert raw.status_code == 401, f"Expected 401 for expired token, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly rejected expired token{Colors.END}")

        # -- 15. Rate limit on login (6 rapid attempts → 429) ---------------
        print(f"\n{Colors.BOLD}--- 15. Rate limit: 6 rapid logins → 429 ---{Colors.END}")
        got_429 = False
        for i in range(8):
            raw = requests.post(
                f"{base_url}/api/v1/auth/login",
                json={"email": TEST_EMAIL, "password": "WrongPass1"},
            )
            if raw.status_code == 429:
                got_429 = True
                print(f"{Colors.GREEN}Rate limited on attempt {i + 1} (429 Too Many Requests){Colors.END}")
                break
        assert got_429, "Expected 429 rate limit response after rapid login attempts"

        # -- 16. Cross-user ownership — user B can't access user A's topic --
        print(f"\n{Colors.BOLD}--- 16. Ownership: user B can't access user A's topic ---{Colors.END}")
        # Create a topic as user A
        client.headers["Authorization"] = f"Bearer {login_token}"
        topic_res = client.post(
            "/api/v1/topics/",
            description="Create topic as user A",
            json={"title": "User A's Private Topic"},
        )
        topic_id_a = topic_res["topic_id"]

        # Register user B
        res_b = client.post(
            "/api/v1/auth/register",
            description="Register user B",
            json={"email": "userB@example.com", "password": "UserBPass1", "username": "userB"},
        )
        token_b = res_b["access_token"]

        # Try to access user A's topic as user B
        raw = requests.get(
            f"{base_url}/api/v1/topics/{topic_id_a}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert raw.status_code == 404, f"Expected 404 for cross-user topic access, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly blocked user B from accessing user A's topic{Colors.END}")

        # Try to access chat history of user A's topic as user B
        raw = requests.get(
            f"{base_url}/api/v1/chat/history?topic_id={topic_id_a}",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert raw.status_code == 404, f"Expected 404 for cross-user chat history, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly blocked user B from accessing user A's chat history{Colors.END}")

        # -- Done ---------------------------------------------------------
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL AUTH TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}Total time: {time.time() - start_time:.2f}s{Colors.END}")

    except AssertionError as e:
        print(f"\n{Colors.RED}{Colors.BOLD}TEST FAILED: {e}{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING TESTS: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_tests()
