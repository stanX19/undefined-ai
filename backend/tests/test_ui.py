"""Interactive terminal UI agent test session.

Run: ``python -m tests.test_ui`` from the backend root.

Connects an SSE stream per topic, sends chat messages that trigger
the UIAgent via ``edit_ui``, and prints the resulting UI JSON after
each interaction.
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
    uvicorn.run(app, host="127.0.0.1", port=8003, log_level="debug")


def pretty_ui(ui_json: dict) -> str:
    """Return a compact but readable UI summary."""
    lines = [
        f"  version : {ui_json.get('version', '?')}",
        f"  root_id : {ui_json.get('root_id', '?')}",
    ]
    elements = ui_json.get("elements", {})
    lines.append(f"  elements: {len(elements)}")
    for eid, edata in elements.items():
        etype = edata.get("type", "?")
        extra = ""
        if etype == "text":
            content = edata.get("content", "")
            extra = f' content="{content[:60]}..."' if len(content) > 60 else f' content="{content}"'
        elif etype == "linear_layout":
            extra = f' orientation={edata.get("orientation", "?")} children={edata.get("children", [])}'
        elif etype == "node":
            extra = f' title="{edata.get("title", "")}"'
        elif etype == "quiz":
            extra = f' question="{edata.get("question", "")[:50]}"'
        elif etype == "graph":
            extra = f' layout={edata.get("layout_type", "?")} children={len(edata.get("children", []))}'
        lines.append(f"    [{eid}] type={etype}{extra}")
    return "\n".join(lines)


def run_ui_test():
    print(f"{Colors.BLUE}Starting Server (port 8003)...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    time.sleep(2)
    base_url = "http://127.0.0.1:8003"
    client = TestClient(base_url, actor_name="User")

    try:
        # Setup: login + create topic + upload doc
        client.post("/api/v1/auth/login", description="Login", json={"user_id": "ui_test_user"})

        res = client.post(
            "/api/v1/topics/",
            description="Create topic",
            json={"user_id": "ui_test_user", "title": "UI Agent Test"},
        )
        topic_id = res["topic_id"]

        # Upload a test PDF if available
        pdf_path = os.path.join(os.path.dirname(__file__), "AttentionIsAllYouNeed.pdf")
        if os.path.isfile(pdf_path):
            with open(pdf_path, "rb") as f:
                upload_res = client.post(
                    f"/api/v1/topics/{topic_id}/upload",
                    description="Upload PDF",
                    files={"file": ("AttentionIsAllYouNeed.pdf", f, "application/pdf")},
                )
            print(f"{Colors.GREEN}Document uploaded. Extracted {len(upload_res.get('document_text', ''))} chars.{Colors.END}")
        else:
            print(f"{Colors.YELLOW}No test PDF found at {pdf_path}, skipping upload.{Colors.END}")

        # Check initial UI (should be empty)
        print(f"\n{Colors.CYAN}--- Initial UI State ---{Colors.END}")
        initial_ui = client.get(f"/api/v1/ui/{topic_id}", description="Get initial UI")
        print(pretty_ui(initial_ui.get("ui_json", initial_ui)))

        print(f"\n{Colors.GREEN}{Colors.BOLD}--- Interactive UI Agent Test (SSE) ---{Colors.END}")
        print(f"Topic ID: {topic_id}")
        print("Type a prompt to send to the agent (e.g. 'show me a knowledge graph').")
        print("Type 'ui' to fetch and print the current UI JSON.")
        print("Type 'ui full' to print the raw JSON.")
        print("Type 'exit' or 'quit' to stop.\n")

        # Open SSE stream
        socket = TestSocket(url=f"{base_url}/api/v1/chat/stream/{topic_id}", actor_name="Agent")
        socket.connect()
        socket.listen()
        time.sleep(0.5)

        seen = 0

        while True:
            try:
                user_msg = input(f"{Colors.BLUE}{Colors.BOLD}You: {Colors.END}")
            except (EOFError, KeyboardInterrupt):
                break

            if user_msg.lower() in ["exit", "quit", "q"]:
                print("Exiting UI test...")
                break

            if not user_msg.strip():
                continue

            # Manual UI fetch commands
            if user_msg.lower().startswith("ui"):
                ui_data = client.get(f"/api/v1/ui/{topic_id}", description="Get UI")
                ui_json = ui_data.get("ui_json", ui_data)
                if "full" in user_msg.lower():
                    print(f"\n{Colors.CYAN}--- Full UI JSON ---{Colors.END}")
                    print(json.dumps(ui_json, indent=2))
                else:
                    print(f"\n{Colors.CYAN}--- Current UI ---{Colors.END}")
                    print(pretty_ui(ui_json))
                print()
                continue

            if user_msg.lower().startswith("upload"):
                try:
                    name = user_msg.split()[1]
                except Exception:
                    name = "AttentionIsAllYouNeed"
                pdf = os.path.join(os.path.dirname(__file__), f"{name}.pdf")
                if not os.path.isfile(pdf):
                    print(f"{Colors.RED}PDF not found: {pdf}{Colors.END}")
                    continue
                with open(pdf, "rb") as f:
                    upload_res = client.post(
                        f"/api/v1/topics/{topic_id}/upload",
                        description="Upload PDF",
                        files={"file": (f"{name}.pdf", f, "application/pdf")},
                    )
                print(f"{Colors.GREEN}Uploaded. Extracted {len(upload_res.get('document_text', ''))} chars.{Colors.END}")
                continue

            # Send chat message
            res = client.post(
                "/api/v1/chat/",
                description=None,
                json={"topic_id": topic_id, "message": user_msg},
            )

            if res.get("status") != "success":
                print(f"{Colors.RED}Unexpected response: {res}{Colors.END}")
                continue

            # Poll for Replies + UIUpdate events
            reply_text = None
            ui_update = None
            deadline = time.time() + 180
            while time.time() < deadline:
                new_events = socket.events_received[seen:]

                reply_event = next((e for e in new_events if e["event"] == "Replies"), None)
                ui_event = next((e for e in new_events if e["event"] == "UIUpdate"), None)

                if reply_event:
                    data = reply_event["data"]
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except (json.JSONDecodeError, ValueError):
                            pass
                    reply_text = data.get("text", data) if isinstance(data, dict) else data
                    seen = socket.events_received.index(reply_event) + 1

                if ui_event:
                    data = ui_event["data"]
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except (json.JSONDecodeError, ValueError):
                            pass
                    ui_update = data
                    seen = socket.events_received.index(ui_event) + 1

                # Wait until we have at least the reply
                if reply_text:
                    # Give a little extra time for UIUpdate to arrive
                    time.sleep(1)
                    # Re-check for UIUpdate
                    late_events = socket.events_received[seen:]
                    late_ui = next((e for e in late_events if e["event"] == "UIUpdate"), None)
                    if late_ui:
                        data = late_ui["data"]
                        if isinstance(data, str):
                            try:
                                data = json.loads(data)
                            except (json.JSONDecodeError, ValueError):
                                pass
                        ui_update = data
                        seen = socket.events_received.index(late_ui) + 1
                    break

                time.sleep(0.3)

            # Print reply
            if reply_text:
                print(f"\n{Colors.GREEN}{Colors.BOLD}Agent:{Colors.END} {reply_text}")
            else:
                print(f"{Colors.RED}No SSE reply received (timeout).{Colors.END}")

            # Print UI state (from SSE event or fetch)
            if ui_update:
                ui_json = ui_update.get("ui_json", ui_update)
                print(f"\n{Colors.CYAN}--- UI Updated (via SSE) ---{Colors.END}")
                print(pretty_ui(ui_json))
            else:
                # Fetch current UI even if no SSE event came
                ui_data = client.get(f"/api/v1/ui/{topic_id}", description="Get UI")
                ui_json = ui_data.get("ui_json", ui_data)
                print(f"\n{Colors.CYAN}--- Current UI (fetched) ---{Colors.END}")
                print(pretty_ui(ui_json))

            print()

    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_ui_test()
