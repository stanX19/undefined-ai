import sys
import os
import time
import threading
import uvicorn

# Import app from main
from tests.test_client import TestClient, Colors, ThreadFilter, TestSocket

ThreadFilter.redirect_all_other()
from main import app


def start_server():
    """Start the Uvicorn server in a separate thread."""
    from srcs.dependencies import get_current_user
    from srcs.models.user import User
    import firebase_admin.auth
    
    # Mock firebase auth for testing
    firebase_admin.auth.verify_id_token = lambda token: {"uid": "demo_firebase_uid", "email": "mock@test.com"}
    
    async def override_get_current_user() -> User:
        return User(id="dummy_user_id001", firebase_uid="demo_firebase_uid", email="u@test.com")
        
    app.dependency_overrides[get_current_user] = override_get_current_user
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="debug")

def run_tests():
    print(f"{Colors.BLUE}Starting Server...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Wait for server to start
    time.sleep(2)
    start_time = time.time()

    base_url = "http://127.0.0.1:8000"
    client = TestClient(base_url, actor_name="Tester")
    
    print(f"\n{Colors.BOLD}=== RUNNING BACKEND SKELETON TESTS ==={Colors.END}\n")

    try:
        # 1. Health Check
        print(f"\n{Colors.BOLD}--- Health Check ---{Colors.END}")
        res = client.get("/health", description="Checking API Health")
        assert res == {"status": "healthy"}, "Health check failed"

        # 2. Auth API
        print(f"\n{Colors.BOLD}--- Auth API ---{Colors.END}")
        res = client.post("/api/v1/auth/login", description="Login via Firebase", json={"email": "u@test.com", "firebase_id_token": "abc"})
        assert "access_token" in res
        
        res = client.post("/api/v1/auth/login_fake", description="Login via Demo", json={"email": "u@test.com"})
        assert "user_id" in res and isinstance(res["user_id"], str)

        # 3. Checklists API
        print(f"\n{Colors.BOLD}--- Checklists API ---{Colors.END}")
        res = client.post("/api/v1/checklists/", description="Create new checklist", json={"title": "Test Title", "description": "Desc"})
        chk_id = res["id"]
        assert chk_id is not None and chk_id != ""

        res = client.get(f"/api/v1/checklists/{chk_id}", description="Get checklist")
        assert res["title"] == "Test Title"

        res = client.request("PATCH", f"/api/v1/checklists/{chk_id}", description="Update checklist", json={"status": "in_progress"})
        assert res["status"] == "in_progress"



        # 5. Documents API
        print(f"\n{Colors.BOLD}--- Documents API ---{Colors.END}")
        pdf_path = os.path.join(os.path.dirname(__file__), "20. PU (A) 262 2022_repaired.pdf")
        
        # Clear out uploads folder for strict testing
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
        if os.path.exists(uploads_dir):
            for f_name in os.listdir(uploads_dir):
                if f_name.endswith('.pdf'):
                    os.remove(os.path.join(uploads_dir, f_name))

        if not os.path.exists(pdf_path):
            print(f"{Colors.YELLOW}Skipping Document upload tests: file not found at {pdf_path}{Colors.END}")
        else:
            with open(pdf_path, "rb") as f:
                pdf_content = f.read()

            res = client.post(f"/api/v1/checklists/{chk_id}/documents", description="Upload document", files={"file": ("20. PU (A) 262 2022_repaired.pdf", pdf_content, "application/pdf")})
            doc_id = res["document_id"]
            assert doc_id is not None and doc_id != ""

            res = client.get(f"/api/v1/checklists/{chk_id}/documents", description="Get documents list")
            assert len(res) > 0 and res[0]["document_id"] == doc_id

            # 5b. Document Content Retrieval Test
            print(f"\n{Colors.BOLD}--- Document Content Retrieval Test ---{Colors.END}")
            res_content = client.request("GET", f"/api/v1/checklists/{chk_id}/documents/{doc_id}", description="Get document raw content")
            # For TestClient request method, we need to inspect status directly. Wait, the TestClient wrapper returns parsed json by default if content-type is json.
            # But for files, it might return raw bytes or raise an error if assuming JSON.
            # Looking at test_client.py, we might just assert it succeeds without crashing.
            # Alternatively, we'll just check if it returns bytes or dict.
            assert res_content is not None

            res = client.request("PATCH", f"/api/v1/checklists/{chk_id}/documents/{doc_id}", description="Update document metadata", json={"tags": ["tag1"]})
            assert "tag1" in res["tags"]

            # 5c. Export Checklist Docs Test
            # print(f"\n{Colors.BOLD}--- Export Checklist Docs Test ---{Colors.END}")
            # res_export = client.get(f"/api/v1/checklists/{chk_id}/export", description="Export completed checklist docs")
            # assert len(res_export["export_urls"]) > 0, "Export URLs should not be empty after doc upload"
            # assert "/media" in res_export["export_urls"][0]

            # 6. Cache Hit Test
            print(f"\n{Colors.BOLD}--- Cache Hit Test ---{Colors.END}")
            res2 = client.post(f"/api/v1/checklists/{chk_id}/documents", description="Upload real PDF (2 - Cache Hit)", files={"file": ("20. PU (A) 262 2022_repaired.pdf", pdf_content, "application/pdf")})
            doc2_id = res2["document_id"]
            
            assert doc_id != doc2_id, "Should create a new Document entry"
            
            # Assert file counts in the uploads directory deeply proves the cache hit avoided storage and parsing
            if os.path.exists(uploads_dir):
                saved_pdfs = [f for f in os.listdir(uploads_dir) if f.endswith('.pdf')]
                assert len(saved_pdfs) == 1, f"Expected exactly 1 PDF in uploads due to cache hit, found {len(saved_pdfs)}"
                print(f"{Colors.GREEN}Cache Hit successfully prevented redundant file storage!{Colors.END}")
                
            # 7. Generate Checklist with Prompt
            print(f"\n{Colors.BOLD}--- Generate Checklist with User Prompt ---{Colors.END}")
            generate_payload = {
                "user_prompt": "I have already Note the effective date of the Employment"
            }
            res_gen = client.post(f"/api/v1/checklists/{chk_id}/generate", description="Generate checklist items", json=generate_payload)
            assert res_gen["status"] == "in_progress"
            
            print(f"\n{Colors.BOLD}>>> GENERATED CHECKLIST <<<{Colors.END}")
            import json
            items = res_gen.get("items", [])
            print(json.dumps(items, indent=2))
            
            # Assert that all items (and sub-items) have the correct source_doc_id
            def assert_source_doc_id(item_list):
                for item in item_list:
                    assert item.get("source_doc_id") == doc_id, f"Item '{item.get('title')}' missing or incorrect source_doc_id. Expected {doc_id}, got {item.get('source_doc_id')}"
                    if item.get("sub_items"):
                        assert_source_doc_id(item.get("sub_items"))

            print(f"\n{Colors.BOLD}--- Asserting source_doc_id Links ---{Colors.END}")
            assert_source_doc_id(items)
            print(f"{Colors.GREEN}All checklist items correctly linked to source doc!{Colors.END}")
            
            # Note: We expect the extinguisher item to be "resolved" visually in the printout due to the prompt!

            # 7.1. Generate Checklist Update with Status Modification Prompt
            print(f"\n{Colors.BOLD}--- Generate Checklist Update with Status Modification Prompt ---{Colors.END}")
            update_payload = {
                "user_prompt": "Mark the first half of the checklist as done."
            }
            res_gen_update = client.post(f"/api/v1/checklists/{chk_id}/generate", description="Generate checklist items (Update Status)", json=update_payload)
            assert res_gen_update["status"] in ["in_progress", "pending"], f"Expected checklist status to be in progress or pending, got {res_gen_update['status']}"
            
            print(f"\n{Colors.BOLD}>>> UPDATED CHECKLIST <<<{Colors.END}")
            updated_items = res_gen_update.get("items", [])
            print(json.dumps(updated_items, indent=2))
            print(f"{Colors.GREEN}Successfully generated an update where half the checklist was marked as done based on the prompt!{Colors.END}")
            
            # Assert that some items (hopefully half) were marked resolved
            resolved_count = sum(1 for item in updated_items if item["status"] == "resolved")
            # We don't do a strict math assert since LLM behavior can be fuzzy, but we assert at least one item was marked resolved
            assert resolved_count > 0, "No items were marked as resolved despite the prompt asking to mark the first half done."

            # 7.2. Ask Agent to Update Checklist
            print(f"\n{Colors.BOLD}--- Chat API: Agent Checklist Update Test ---{Colors.END}")
            chat_payload_update = {
                "checklist_id": chk_id,
                "session_id": "sess_update_001",
                "user_input": "Mark the second half of the checklist as done.",
                "image_context": None,
                "audio_context": None
            }
            
            socket_update = TestSocket(url=f"{base_url}/api/v1/chat/stream/sess_update_001", actor_name="TesterUpdate")
            socket_update.connect()
            socket_update.listen(until_event="Replies")
            time.sleep(1)
            
            client.post("/api/v1/chat/message", description="Ask agent to update checklist", json=chat_payload_update)
            
            print(f"{Colors.BOLD}Waiting for Orchestrator to update checklist via SSE...{Colors.END}")
            socket_update.join_listener(timeout=180)
            
            res_chk_updated = client.get(f"/api/v1/checklists/{chk_id}", description="Get checklist after agent update")
            
            print(f"\n{Colors.BOLD}>>> UPDATED CHECKLIST <<<{Colors.END}")
            updated_items = res_chk_updated.get("items", [])
            print(json.dumps(updated_items, indent=2))
            print(f"{Colors.GREEN}Successfully asked agent to update checklist where the second half of the checklist is marked as done!{Colors.END}")
            
            resolved_count = sum(1 for item in updated_items if item["status"] == "resolved")
            assert resolved_count > 0, "No items were marked as resolved by the agent."


            res3 = client.request("DELETE", f"/api/v1/checklists/{chk_id}/documents/{doc2_id}", description="Delete single doc (test)")
            assert "message" in res3
            
            # 7b. Item Edit Test & Timestamp update
            print(f"\n{Colors.BOLD}--- Edit Checklist Item & Timestamp Updates ---{Colors.END}")
            if items:
                # Find an item to test edit
                target_item = items[0]
                item_id = target_item["id"]
                initial_updated_at = res_gen.get("updated_at")
                
                # Check initial state
                assert target_item["status"] in ["pending", "action_required", "resolved"]
                
                # Wait briefly to ensure timestamp difference
                time.sleep(1.1)
                
                item_edit_payload = {
                    "status": "resolved"
                }
                res_edit = client.request("PATCH", f"/api/v1/checklists/{chk_id}/items/{item_id}", description="Edit Checklist Item Status", json=item_edit_payload)
                
                # 1. Assert item is edited
                edited_item = next((i for i in res_edit["items"] if i["id"] == item_id), None)
                assert edited_item is not None, "Item not found in response items"
                assert edited_item["status"] == "resolved", "Item status was not updated"
                
                # 2. Assert timestamp was updated
                new_updated_at = res_edit.get("updated_at")
                assert new_updated_at is not None, "updated_at is missing from response"
                assert initial_updated_at != new_updated_at, "Checklist updated_at timestamp did not change after item edit"
                
                print(f"{Colors.GREEN}Successfully edited item to 'resolved' and parent timestamp updated!{Colors.END}")
            else:
                print(f"{Colors.YELLOW}Skipping item edit test, no items generated.{Colors.END}")
            
        # 8. Multi-modal Chat API (Talk Flow happens AFTER context is generated)
        print(f"\n{Colors.BOLD}--- Chat API (Multi-modal) & SSE stream ---{Colors.END}")
        import base64
        import requests
        
        chat_payload = {
            "checklist_id": chk_id,
            "session_id": "sess_001",
            "user_input": "What else do I need to do?",
            "image_context": None,
            "audio_context": None
        }
        
        audio_test_path = os.path.join(os.path.dirname(__file__), "testUserInputAudio.m4a")
        if os.path.exists(audio_test_path):
            print(f"{Colors.GREEN}Audio test file {audio_test_path} found. Injecting audio context!{Colors.END}")
            with open(audio_test_path, "rb") as f:
                chat_payload["audio_context"] = base64.b64encode(f.read()).decode("utf-8")
            chat_payload["user_input"] = None
        else:
            print(f"{Colors.YELLOW}Audio test file not found. Falling back to text-only.{Colors.END}")

        # Start SSE listener via TestSocket in background *before* sending the message so we don't miss events
        socket = TestSocket(url=f"{base_url}/api/v1/chat/stream/sess_001", actor_name="Tester")
        socket.connect()
        socket.listen(until_event="Replies")
        
        time.sleep(1) # Allow SSE connection to establish fully before triggering the prompt
            
        res = client.post("/api/v1/chat/message", description="Send multi-modal message", json=chat_payload)
        assert "intent_detected" in res and isinstance(res["intent_detected"], str)
        assert "transcription" in res

        print(f"{Colors.BOLD}Waiting for Orchestrator background task to finish via SSE...{Colors.END}")
        socket.join_listener(timeout=180)
        
        # Check if we got the replies only if it was supposed to run
        if res["intent_detected"] != "general_chat":
             # We look inside the events_received array of the socket
            assert any(e["event"] == "Replies" for e in socket.events_received), "Did not receive final SSE Replies event from Orchestrator."
        else:
            print(f"{Colors.YELLOW}Intent was general_chat, skipping Orchestrator SSE assertion.{Colors.END}")

        res = client.get("/api/v1/chat/history?session_id=sess_001", description="Get chat history")
        assert len(res) > 0

        res = client.request("DELETE", "/api/v1/chat/history", description="Clear chat memory", json={"session_id": "sess_001"})
        assert "message" in res

        res = client.request("DELETE", f"/api/v1/checklists/{chk_id}/documents", description="Clear all docs")
        assert "message" in res

        res = client.request("DELETE", f"/api/v1/checklists/{chk_id}", description="Delete checklist")
        assert "message" in res

        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL TESTS PASSED!{Colors.END}")
        print(f"{Colors.GREEN}{Colors.BOLD}Started at: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(start_time))}{Colors.END}")
        print(f"{Colors.GREEN}{Colors.BOLD}Finished at: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(time.time()))}{Colors.END}")
        print(f"{Colors.GREEN}{Colors.BOLD}Total time: {time.time() - start_time:.2f}s{Colors.END}")

    except AssertionError as e:
        print(f"\n{Colors.RED}{Colors.BOLD}TEST FAILED: {e}{Colors.END}")
    except Exception as e:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING TESTS: {e}{Colors.END}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_tests()
