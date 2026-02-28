import sys
import os
import time
import threading
import json
import uvicorn
from tests.test_client import TestClient, Colors, ThreadFilter, TestSocket

ThreadFilter.redirect_all_other()
from main import app

def start_server():
    from srcs.dependencies import get_current_user
    from srcs.models.user import User
    import firebase_admin.auth
    
    firebase_admin.auth.verify_id_token = lambda token: {"uid": "demo_firebase_uid", "email": "mock@test.com"}
    
    async def override_get_current_user() -> User:
        return User(id="dummy_user_id001", firebase_uid="demo_firebase_uid", email="u@test.com")
        
    app.dependency_overrides[get_current_user] = override_get_current_user
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")

def run_interactive_chat():
    print(f"{Colors.BLUE}Starting Server in background...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    time.sleep(2)
    base_url = "http://127.0.0.1:8000"
    client = TestClient(base_url, actor_name="Tester")
    
    try:
        # Auth
        client.post("/api/v1/auth/login_fake", description="Login via Demo", json={"email": "u@test.com"})
        
        # Create Checklist
        res = client.post("/api/v1/checklists/", description="Create new checklist", json={"title": "Interactive Chat Session", "description": "Interactive CLI Checklists"})
        chk_id = res["id"]
        session_id = "sess_interactive_001"
        
        print(f"\n{Colors.GREEN}{Colors.BOLD}--- Interactive Agent Chat Started ---{Colors.END}")
        print(f"Checklist ID: {chk_id}")
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

            chat_payload = {
                "checklist_id": chk_id,
                "session_id": session_id,
                "user_input": user_msg,
                "image_context": None,
                "audio_context": None
            }
            
            socket = TestSocket(url=f"{base_url}/api/v1/chat/stream/{session_id}", actor_name="Agent")
            socket.connect()
            socket.listen(until_event="Replies")
            time.sleep(0.5) # Let SSE connect
            
            # Send message
            res_chat = client.post("/api/v1/chat/message", description=None, json=chat_payload)
            intent = res_chat.get("intent_detected", "unknown")
            print(f"{Colors.MAGENTA}[Intent Detected: {intent}]{Colors.END}")
            
            if intent != "general_chat":
                # Wait for orchestrator SSE events
                print(f"{Colors.YELLOW}Orchestrator is working...{Colors.END}")
                socket.join_listener(timeout=180)
                
                # Check events for final reply
                reply_event = next((e for e in socket.events_received if e["event"] == "Replies"), None)
                if reply_event:
                    data = reply_event["data"]
                    if isinstance(data, str):
                        try:
                            data = json.loads(data)
                        except:
                            pass
                    print(f"\n{Colors.GREEN}{Colors.BOLD}Agent:{Colors.END} {data.get('text', '')}")
                    if isinstance(data, dict) and data.get("audio_url"):
                        print(f"Audio URL: {data['audio_url']}")
                else:
                    print(f"{Colors.RED}No final SSE reply received.{Colors.END}")
            else:
                # Synchronous reply
                print(f"\n{Colors.GREEN}{Colors.BOLD}Agent:{Colors.END} {res_chat.get('response_text')}")
                
            # If the command was to update checklist, fetch and show it (optional)
            if intent == "update_checklist":
                chk = client.get(f"/api/v1/checklists/{chk_id}", description=None)
                print(f"{Colors.CYAN}-- Checklist Updated: {len(chk.get('items', []))} items currently --{Colors.END}")

    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING CHAT: {e}{Colors.END}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_interactive_chat()
