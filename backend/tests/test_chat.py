"""Interactive terminal Q&A chat session for Phase 1 (SSE mode).

Run: ``python -m tests.test_chat`` from the backend root.

Connects an SSE stream per topic, POSTs messages, and reads
the agent reply from the SSE ``Replies`` event.
"""
import json
import os
import time
import threading

import uvicorn

from tests.test_client import TestClient, TestSocket, Colors, ThreadFilter

ThreadFilter.redirect_all_other()
from main import app


def start_server():
    """Start uvicorn in a daemon thread."""
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="debug")


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
        print("Type 'upload' to upload AttentionIsAllYouNeed.pdf")
        print("Type 'exit' or 'quit' to stop.\n")

        # 1. Open a persistent SSE stream (no until_event → listens forever)
        socket = TestSocket(url=f"{base_url}/api/v1/chat/stream/{topic_id}", actor_name="Agent")
        socket.connect()
        socket.listen()  # background thread, never stops
        time.sleep(0.5)

        seen = 0  # index into socket.events_received we've already handled

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

            if user_msg.lower() == "upload":
                pdf_path = os.path.join(os.path.dirname(__file__), "AttentionIsAllYouNeed.pdf")#"HTEChallengeStatements.pdf")
                if not os.path.isfile(pdf_path):
                    print(f"{Colors.RED}PDF not found: {pdf_path}{Colors.END}")
                    continue
                with open(pdf_path, "rb") as f:
                    upload_res = client.post(
                        f"/api/v1/topics/{topic_id}/upload",
                        description="Upload PDF",
                        files={"file": ("HTEChallengeStatements.pdf", f, "application/pdf")},
                    )
                print(f"{Colors.GREEN}Document uploaded. Extracted {len(upload_res.get('document_text', ''))} chars.{Colors.END}")
                continue

            res = client.post(
                "/api/v1/chat/",
                description=None,
                json={"topic_id": topic_id, "message": user_msg},
            )

            if res.get("status") != "success":
                print(f"{Colors.RED}Unexpected response: {res}{Colors.END}")
                continue

            # 2. Poll for new Replies event (with timeout)
            reply_text = None
            deadline = time.time() + 180
            while time.time() < deadline:
                new_events = socket.events_received[seen:]
                reply_event = next((e for e in new_events if e["event"] == "Replies"), None)
                tts_event = next((e for e in new_events if e["event"] == "TTSResult"), None)
                if reply_event:
                    data = reply_event["data"]
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except (json.JSONDecodeError, ValueError):
                            pass
                    reply_text = data.get("text", data) if isinstance(data, dict) else data
                    # Mark all events up to (and including) this one as seen
                    seen = socket.events_received.index(reply_event) + 1
                if tts_event:
                    break
                time.sleep(0.3)

            if reply_text:
                print(f"\n{Colors.GREEN}{Colors.BOLD}Agent:{Colors.END} {reply_text}\n")
            else:
                print(f"{Colors.RED}No SSE reply received (timeout).{Colors.END}\n")

    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING CHAT: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_interactive_chat()
