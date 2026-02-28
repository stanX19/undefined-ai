"""Interactive terminal Q&A chat session for Phase 1.

Run: ``python -m tests.test_chat`` from the backend root.

Mirrors the pattern from sample_test_chat.py but uses Phase 1's
synchronous POST /api/v1/chat/ route (no SSE / orchestrator).
"""
import time
import threading

import uvicorn

from tests.test_client import TestClient, Colors, ThreadFilter

ThreadFilter.redirect_all_other()
from main import app


def start_server():
    """Start uvicorn in a daemon thread."""
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="error")


def run_interactive_chat():
    print(f"{Colors.BLUE}Starting Server (port 8002)...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(2)
    base_url = "http://127.0.0.1:8002"
    client = TestClient(base_url, actor_name="User")

    try:
        # Setup: login + create topic
        client.post("/api/v1/auth/login", description="Login", json={"user_id": "interactive_user_001"})

        res = client.post(
            "/api/v1/topics/",
            description="Create topic",
            json={"user_id": "interactive_user_001", "title": "Interactive Chat Session"},
        )
        topic_id = res["topic_id"]

        print(f"\n{Colors.GREEN}{Colors.BOLD}--- Interactive Agent Chat Started ---{Colors.END}")
        print(f"Topic ID: {topic_id}")
        print("Type 'exit' or 'quit' to stop.\n")

        while True:
            try:
                user_msg = input(f"{Colors.BLUE}{Colors.BOLD}You: {Colors.END}")
            except (EOFError, KeyboardInterrupt):
                break

            if user_msg.lower() in ["exit", "quit", "q"]:
                print("Exiting chat...")
                break

            if not user_msg.strip():
                continue

            # Send message via synchronous chat endpoint
            res = client.post(
                "/api/v1/chat/",
                description=None,
                json={"topic_id": topic_id, "message": user_msg},
            )

            reply = res.get("assistant_message", {}).get("message", "")
            print(f"\n{Colors.GREEN}{Colors.BOLD}Agent:{Colors.END} {reply}\n")

    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING CHAT: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_interactive_chat()
