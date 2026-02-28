"""Interactive terminal Q&A chat session for Phase 1 (SSE mode).

Run: ``python -m tests.test_chat`` from the backend root.

Connects an SSE stream per topic, POSTs messages, and reads
the agent reply from the SSE ``Replies`` event.
"""
import json
import time
import threading

import uvicorn

from tests.test_client import TestClient, TestSocket, Colors, ThreadFilter

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

        print(f"\n{Colors.GREEN}{Colors.BOLD}--- Interactive Agent Chat Started (SSE) ---{Colors.END}")
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

            # 1. Open SSE stream before sending the message
            socket = TestSocket(url=f"{base_url}/api/v1/chat/stream/{topic_id}", actor_name="Agent")
            socket.connect()
            socket.listen(until_event="Replies")
            time.sleep(0.5)

            # 2. Send message — returns immediately with status: success
            res = client.post(
                "/api/v1/chat/",
                description=None,
                json={"topic_id": topic_id, "message": user_msg},
            )

            if res.get("status") != "success":
                print(f"{Colors.RED}Unexpected response: {res}{Colors.END}")
                continue

            # 3. Wait for the agent reply via SSE
            socket.join_listener(timeout=180)

            reply_event = next((e for e in socket.events_received if e["event"] == "Replies"), None)
            if reply_event:
                data = reply_event["data"]
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                    except (json.JSONDecodeError, ValueError):
                        pass
                reply_text = data.get("text", data) if isinstance(data, dict) else data
                print(f"\n{Colors.GREEN}{Colors.BOLD}Agent:{Colors.END} {reply_text}\n")
            else:
                print(f"{Colors.RED}No SSE reply received.{Colors.END}\n")

    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING CHAT: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_interactive_chat()
