"""Automated tests for Phase 3 ingestion pipeline.

Run: ``python -m tests.test_ingestion`` from the backend root.

Monkey-patches:
- ``Chatbot.ask`` — no LLM calls for chat
- ``RotatingLLM.send_message_get_json`` — deterministic JSON for pipeline stages

Uses the existing ``tests/AttentionIsAllYouNeed.pdf`` for a real upload.
"""
import json
import os
import time
import threading

import requests
import uvicorn

from tests.test_client import TestClient, Colors, ThreadFilter, TestSocket

ThreadFilter.redirect_all_other()

# ---------------------------------------------------------------------------
# Monkey-patch Chatbot.ask so agent chat never fires real LLM.
# ---------------------------------------------------------------------------

async def _mock_ask(
    self,
    user_prompt: str,
    document_text: str | None = None,
    chat_history=None,
) -> str:
    return f"Mock reply to: {user_prompt}"


import srcs.services.agents.chatbot as _chatbot_mod
_chatbot_mod.Chatbot.ask = _mock_ask

# ---------------------------------------------------------------------------
# Monkey-patch RotatingLLM.send_message_get_json for pipeline stages.
#
# The ingestion pipeline calls send_message_get_json with prompts containing
# either "extract ALL atomic facts" (stage 2) or "compress them" (stages 3-4).
# We return deterministic JSON arrays so tests are reproducible.
# ---------------------------------------------------------------------------

from srcs.services.agents.rotating_llm import RotatingLLM, LLMResponse

_send_call_count: int = 0


async def _mock_send_message_get_json(
    self,
    messages,
    config=None,
    retry: int = 3,
    temperature: float = 0.0,
    model: str | None = None,
    **llm_kwargs,
) -> LLMResponse:
    global _send_call_count
    _send_call_count += 1

    prompt_text: str = str(messages) if isinstance(messages, str) else str(messages)

    # Stage 2: atomic split
    if "extract ALL atomic facts" in prompt_text.lower() or "atomic fact" in prompt_text.lower():
        facts: list[str] = [
            f"Atomic fact {_send_call_count}.1 extracted from chunk.",
            f"Atomic fact {_send_call_count}.2 extracted from chunk.",
            f"Atomic fact {_send_call_count}.3 extracted from chunk.",
        ]
        return LLMResponse(
            text=json.dumps(facts),
            model="mock-model",
            status="ok",
            json_data=facts,
        )

    # Stages 3 & 4: compression
    if "compress" in prompt_text.lower() or "summary" in prompt_text.lower():
        summaries: list[str] = [
            f"Compressed summary {_send_call_count}.1",
            f"Compressed summary {_send_call_count}.2",
        ]
        return LLMResponse(
            text=json.dumps(summaries),
            model="mock-model",
            status="ok",
            json_data=summaries,
        )

    # Fallback
    return LLMResponse(
        text='["Fallback fact"]',
        model="mock-model",
        status="ok",
        json_data=["Fallback fact"],
    )


RotatingLLM.send_message_get_json = _mock_send_message_get_json

from main import app


BASE_URL: str = "http://127.0.0.1:8002"
PORT: int = 8002


def start_server() -> None:
    """Start uvicorn in a daemon thread."""
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="error")


def run_tests() -> None:
    print(f"{Colors.BLUE}Starting Server (port {PORT})...{Colors.END}")
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    time.sleep(2)

    start_time: float = time.time()
    client = TestClient(BASE_URL, actor_name="Tester")

    print(f"\n{Colors.BOLD}=== RUNNING PHASE 3 INGESTION TESTS ==={Colors.END}\n")

    try:
        # -- 1. Health check ----------------------------------------------
        print(f"\n{Colors.BOLD}--- 1. Health Check ---{Colors.END}")
        res = client.get("/health", description="Health probe")
        assert res == {"status": "healthy"}, f"Expected healthy, got {res}"

        # -- 2. Create user + topic ---------------------------------------
        print(f"\n{Colors.BOLD}--- 2. Setup: Create user + topic ---{Colors.END}")
        user_res = client.post(
            "/api/v1/auth/register",
            description="Register",
            json={"email": "ingest_test@test.com", "password": "SecurePass123", "username": "ingest_user"},
        )
        token = user_res["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"
        user_id: str = user_res["user_id"]

        topic_res = client.post(
            "/api/v1/topics/",
            description="Create topic",
            json={"user_id": user_id, "title": "Ingestion Test Topic"},
        )
        topic_id: str = topic_res["topic_id"]
        assert topic_id, "topic_id should not be empty"

        # -- 3. Check initial ingestion status (pending) ------------------
        print(f"\n{Colors.BOLD}--- 3. Ingestion: Initial status = pending ---{Colors.END}")
        status_res = client.get(
            f"/api/v1/ingestion/{topic_id}/status",
            description="Check initial status",
        )
        assert status_res["status"] == "pending", f"Expected pending, got {status_res['status']}"
        print(f"{Colors.GREEN}Status correctly = pending{Colors.END}")

        # -- 4. Upload PDF → auto-trigger ingestion -----------------------
        print(f"\n{Colors.BOLD}--- 4. Upload PDF (auto-triggers ingestion) ---{Colors.END}")
        pdf_path: str = os.path.join(os.path.dirname(__file__), "AttentionIsAllYouNeed.pdf")

        if not os.path.isfile(pdf_path):
            print(f"{Colors.YELLOW}PDF not found at {pdf_path}, creating synthetic text upload...{Colors.END}")
            # Fallback: create a topic with document text directly
            # We'll need to trigger ingestion manually in this case
            from srcs.services.ingestion_service import IngestionService
            synthetic_text: str = (
                "Machine learning is a subset of artificial intelligence.\n\n"
                "Neural networks are inspired by biological neurons.\n\n"
                "Transformer models use self-attention mechanisms.\n\n"
                "The attention mechanism allows models to focus on relevant parts of the input.\n\n"
                "BERT and GPT are examples of transformer-based models."
            )
            # We can't easily set document_text without the upload route,
            # so let's just skip to a simpler test
            print(f"{Colors.RED}SKIPPING PDF upload test — no PDF available{Colors.END}")
            return

        with open(pdf_path, "rb") as f:
            upload_res = client.post(
                f"/api/v1/topics/{topic_id}/upload",
                description="Upload PDF",
                files={"file": ("AttentionIsAllYouNeed.pdf", f, "application/pdf")},
            )
        assert "document_text" in upload_res, "Response should include document_text"
        doc_len: int = len(upload_res["document_text"])
        assert doc_len > 0, "Extracted text should not be empty"
        print(f"{Colors.GREEN}PDF uploaded, extracted {doc_len} chars. Ingestion auto-triggered.{Colors.END}")

        # -- 5. Poll ingestion status until completed ---------------------
        print(f"\n{Colors.BOLD}--- 5. Ingestion: Poll until completed ---{Colors.END}")
        max_wait: int = 120  # seconds
        poll_interval: float = 2.0
        elapsed: float = 0.0
        final_status: str = "unknown"

        while elapsed < max_wait:
            status_res = client.get(
                f"/api/v1/ingestion/{topic_id}/status",
                description=f"Poll status ({elapsed:.0f}s)",
            )
            final_status = status_res["status"]
            if final_status == "completed":
                break
            if final_status.startswith("failed"):
                print(f"{Colors.RED}Pipeline failed: {final_status}{Colors.END}")
                break
            time.sleep(poll_interval)
            elapsed += poll_interval

        assert final_status == "completed", f"Expected completed, got {final_status} after {elapsed:.0f}s"
        print(f"{Colors.GREEN}Ingestion completed in {elapsed:.0f}s{Colors.END}")

        # -- 6. Check level-0 facts (raw chunks) -------------------------
        print(f"\n{Colors.BOLD}--- 6. Facts: Level 0 (raw chunks) ---{Colors.END}")
        l0_facts = client.get(
            f"/api/v1/ingestion/{topic_id}/facts?level=0",
            description="Get level-0 facts",
        )
        assert isinstance(l0_facts, list), "Should return a list"
        assert len(l0_facts) > 0, "Should have at least 1 chunk"
        # Verify source offsets
        first_chunk = l0_facts[0]
        assert "source_start" in first_chunk, "Chunk should have source_start"
        assert "source_end" in first_chunk, "Chunk should have source_end"
        print(f"{Colors.GREEN}{len(l0_facts)} level-0 chunks with source offsets{Colors.END}")

        # -- 7. Check level-1 facts (atomic) ------------------------------
        print(f"\n{Colors.BOLD}--- 7. Facts: Level 1 (atomic facts) ---{Colors.END}")
        l1_facts = client.get(
            f"/api/v1/ingestion/{topic_id}/facts?level=1",
            description="Get level-1 facts",
        )
        assert len(l1_facts) > 0, "Should have atomic facts"
        # Verify source_chunk_id is set
        for fact in l1_facts[:3]:
            assert fact.get("source_chunk_id"), f"Atomic fact should have source_chunk_id: {fact}"
        print(f"{Colors.GREEN}{len(l1_facts)} level-1 atomic facts{Colors.END}")

        # -- 8. Check level-2 facts (main) --------------------------------
        print(f"\n{Colors.BOLD}--- 8. Facts: Level 2 (main facts) ---{Colors.END}")
        l2_facts = client.get(
            f"/api/v1/ingestion/{topic_id}/facts?level=2",
            description="Get level-2 facts",
        )
        assert len(l2_facts) > 0, "Should have main facts"
        # Verify parent_fact_id is set
        for fact in l2_facts[:3]:
            assert fact.get("parent_fact_id"), f"Main fact should have parent_fact_id: {fact}"
        print(f"{Colors.GREEN}{len(l2_facts)} level-2 main facts{Colors.END}")

        # -- 9. Check level-3 facts (core concepts) ----------------------
        print(f"\n{Colors.BOLD}--- 9. Facts: Level 3 (core concepts) ---{Colors.END}")
        l3_facts = client.get(
            f"/api/v1/ingestion/{topic_id}/facts?level=3",
            description="Get level-3 facts",
        )
        assert len(l3_facts) > 0, "Should have core concepts"
        print(f"{Colors.GREEN}{len(l3_facts)} level-3 core concepts{Colors.END}")

        # -- 10. Get fact with parent chain -------------------------------
        print(f"\n{Colors.BOLD}--- 10. Facts: Get fact with parent chain ---{Colors.END}")
        # Pick a level-2 fact and retrieve its parent chain
        test_fact_id: str = l2_facts[0]["fact_id"]
        fact_detail = client.get(
            f"/api/v1/ingestion/{topic_id}/facts/{test_fact_id}",
            description="Get fact with parents",
        )
        assert "fact" in fact_detail, "Response should have 'fact' key"
        assert "parents" in fact_detail, "Response should have 'parents' key"
        assert fact_detail["fact"]["fact_id"] == test_fact_id
        print(f"{Colors.GREEN}Fact retrieved with {len(fact_detail['parents'])} parent(s){Colors.END}")

        # -- 11. Get fact — 404 -------------------------------------------
        print(f"\n{Colors.BOLD}--- 11. Facts: 404 for nonexistent fact ---{Colors.END}")
        raw = requests.get(f"{BASE_URL}/api/v1/ingestion/{topic_id}/facts/nonexistent_fact_999")
        assert raw.status_code == 404, f"Expected 404, got {raw.status_code}"
        print(f"{Colors.GREEN}Correctly returned 404{Colors.END}")

        # -- 12. Level-1 fact has source chunk linkage --------------------
        print(f"\n{Colors.BOLD}--- 12. Facts: Source provenance chain ---{Colors.END}")
        l1_fact_id: str = l1_facts[0]["fact_id"]
        l1_detail = client.get(
            f"/api/v1/ingestion/{topic_id}/facts/{l1_fact_id}",
            description="Get level-1 fact with source chunk",
        )
        assert l1_detail.get("source_chunk") is not None, "Level-1 fact should have source_chunk resolved"
        assert l1_detail["source_chunk"]["level"] == 0, "Source chunk should be level 0"
        print(f"{Colors.GREEN}Source chunk resolved (level={l1_detail['source_chunk']['level']}){Colors.END}")

        # -- 13. Hierarchy counts make sense ------------------------------
        print(f"\n{Colors.BOLD}--- 13. Hierarchy: Count sanity check ---{Colors.END}")
        assert len(l1_facts) >= len(l2_facts), \
            f"Level-1 ({len(l1_facts)}) should be >= level-2 ({len(l2_facts)})"
        assert len(l2_facts) >= len(l3_facts), \
            f"Level-2 ({len(l2_facts)}) should be >= level-3 ({len(l3_facts)})"
        print(f"{Colors.GREEN}Hierarchy: L0={len(l0_facts)} → L1={len(l1_facts)} → L2={len(l2_facts)} → L3={len(l3_facts)}{Colors.END}")

        # -- Done ---------------------------------------------------------
        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL INGESTION TESTS PASSED!{Colors.END}")
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
