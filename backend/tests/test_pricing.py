"""Pricing regression tests for revised usage rules.

Run: ``python -m tests.test_pricing`` from the backend root.

Covers:
  1. Document upload size guard returns 413 without burning units
  2. Ingestion pricing is dynamic based on extracted word count
  3. Over-quota uploads are rejected after extraction and cleaned up
  4. Recommendations are free
  5. Speech-to-text is free
  6. UI read/share/rollback routes are free
  7. UI generation charges once and refunds on failure
"""
from __future__ import annotations

import asyncio
import os
import shutil
import sqlite3
import sys
import tempfile
import threading
import time
import types
from unittest.mock import AsyncMock, patch

import requests
import uvicorn

from tests.test_client import TestClient, Colors, ThreadFilter

ThreadFilter.redirect_all_other()

_test_db: str | None = None
_upload_dir: str | None = None
_app = None


def _prioritize_site_packages() -> None:
    """Ensure installed packages win over local namespace folders like ./alembic."""
    import site

    for path in reversed(site.getsitepackages()):
        if path in sys.path:
            sys.path.remove(path)
        sys.path.insert(0, path)


def _ensure_alembic_importable() -> None:
    """Provide a tiny Alembic shim when the package is unavailable in the test venv."""
    try:
        from alembic import command as _command  # noqa: F401
        from alembic.config import Config as _config  # noqa: F401
        return
    except Exception:
        pass

    alembic_mod = types.ModuleType("alembic")
    command_mod = types.ModuleType("alembic.command")
    config_mod = types.ModuleType("alembic.config")

    class Config:  # noqa: D401 - tiny compatibility shim
        def __init__(self, *args, **kwargs) -> None:
            self.args = args
            self.kwargs = kwargs

    def _upgrade(cfg: Config, revision: str) -> None:
        import srcs.models  # noqa: F401
        from srcs.database import Base, engine

        async def _create_schema() -> None:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

        asyncio.run(_create_schema())

    def _stamp(cfg: Config, revision: str) -> None:
        return None

    command_mod.upgrade = _upgrade
    command_mod.stamp = _stamp
    config_mod.Config = Config
    alembic_mod.command = command_mod

    sys.modules["alembic"] = alembic_mod
    sys.modules["alembic.command"] = command_mod
    sys.modules["alembic.config"] = config_mod


def _ensure_optional_dependencies() -> None:
    """Stub optional libraries that are imported at module import time in this repo."""
    try:
        import docx  # noqa: F401
    except Exception:
        docx_mod = types.ModuleType("docx")

        class _DummyParagraph:
            text = ""

        class _DummyDocument:
            def __init__(self, *args, **kwargs) -> None:
                self.paragraphs = [_DummyParagraph()]

        docx_mod.Document = _DummyDocument
        sys.modules["docx"] = docx_mod

    try:
        from elevenlabs.client import ElevenLabs as _ElevenLabs  # noqa: F401
    except Exception:
        elevenlabs_mod = types.ModuleType("elevenlabs")
        elevenlabs_client_mod = types.ModuleType("elevenlabs.client")

        class ElevenLabs:
            def __init__(self, *args, **kwargs) -> None:
                pass

        elevenlabs_client_mod.ElevenLabs = ElevenLabs
        elevenlabs_mod.client = elevenlabs_client_mod
        sys.modules["elevenlabs"] = elevenlabs_mod
        sys.modules["elevenlabs.client"] = elevenlabs_client_mod


def _get_test_db() -> str:
    global _test_db
    if _test_db is None:
        _test_db = os.path.join(tempfile.gettempdir(), f"undefinedai_pricing_{os.getpid()}.db")
        os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_test_db}"
        os.environ["DB_NAME"] = _test_db
        os.environ["DEBUG"] = "false"
        os.environ["FAKE_LOGIN_TOKEN"] = "fake_demo_token_123"
    return _test_db


def _get_upload_dir() -> str:
    global _upload_dir
    if _upload_dir is None:
        _upload_dir = tempfile.mkdtemp(prefix=f"undefinedai_pricing_uploads_{os.getpid()}_")
    return _upload_dir


def _install_test_patches() -> None:
    from srcs.config import get_settings
    from srcs.services.document_service import DocumentService
    from srcs.services.ingestion_service import IngestionService
    from srcs.services.recommendation_service import RecommendationService
    from srcs.services.speech_service import SpeechService

    settings = get_settings()
    settings.MAX_DOC_UPLOAD_BYTES = 128
    settings.UPLOAD_DIR = _get_upload_dir()

    def _mock_extract_text(file_path: str) -> str:
        filename = os.path.basename(file_path).lower()
        if "large" in filename:
            return "word " * 5500
        if "overquota" in filename:
            return "word " * 11000
        return "word " * 120

    async def _mock_default_recommendations(_: str) -> list[dict]:
        return [
            {"title": "Intro to Algebra", "difficulty": 2, "reason": "Builds core problem-solving skills."},
            {"title": "Intro to Biology", "difficulty": 2, "reason": "Introduces scientific thinking."},
            {"title": "Intro to Programming", "difficulty": 3, "reason": "Helps users create with logic."},
        ]

    async def _mock_recommendations(_: str, __: str) -> list[dict]:
        return [
            {"title": "Linear Algebra", "difficulty": 3, "reason": "Pairs naturally with the current topic."},
            {"title": "Probability", "difficulty": 4, "reason": "Builds a stronger analytical base."},
            {"title": "Optimization", "difficulty": 5, "reason": "Extends the same concepts to advanced methods."},
        ]

    async def _mock_transcribe_audio(_: bytes, language_code: str | None = None) -> str:
        return "mock transcript"

    DocumentService.extract_text = staticmethod(_mock_extract_text)
    IngestionService.trigger_ingestion = staticmethod(lambda topic_id, document_text: None)
    RecommendationService.get_default_recommendations = staticmethod(_mock_default_recommendations)
    RecommendationService.get_recommendations = staticmethod(_mock_recommendations)
    SpeechService.transcribe_audio = staticmethod(_mock_transcribe_audio)


def _get_app():
    global _app
    if _app is None:
        _get_test_db()
        _prioritize_site_packages()
        _ensure_alembic_importable()
        _ensure_optional_dependencies()
        from main import app as fastapi_app  # noqa: E402

        _install_test_patches()
        _app = fastapi_app
    return _app


def start_server(port: int = 8006) -> None:
    uvicorn.run(_get_app(), host="127.0.0.1", port=port, log_level="error")


def _register_and_login(client: TestClient, email: str, password: str = "TestPass1") -> tuple[str, str]:
    res = client.post(
        "/api/v1/auth/register",
        description=f"Register {email}",
        json={"email": email, "password": password, "username": email.split("@")[0]},
    )
    return res["access_token"], res["user_id"]


def _create_topic(base_url: str, token: str, title: str) -> str:
    res = requests.post(
        f"{base_url}/api/v1/topics/",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": title},
        timeout=30,
    )
    assert res.status_code == 200, f"Create topic failed: {res.status_code} {res.text}"
    return res.json()["topic_id"]


def _get_units_used(user_id: str) -> int:
    conn = sqlite3.connect(_get_test_db(), timeout=30)
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COALESCE(SUM(units_used), 0) FROM daily_usage WHERE user_id = ?",
            (user_id,),
        )
        return int(cursor.fetchone()[0] or 0)
    finally:
        conn.close()


def _wait_for_server(base_url: str) -> None:
    for _ in range(40):
        try:
            raw = requests.get(f"{base_url}/health", timeout=0.5)
            if raw.status_code == 200:
                return
        except Exception:
            pass
        time.sleep(0.25)
    raise RuntimeError("Server did not become ready in time")


def _pdf_bytes(size: int = 64) -> bytes:
    prefix = b"%PDF-1.7\n"
    if size <= len(prefix):
        return prefix[:size]
    return prefix + (b"A" * (size - len(prefix)))


async def _run_ui_agent_pricing_checks(user_id: str, topic_id: str) -> None:
    from srcs.services.agents.rotating_llm import LLMResponse
    from srcs.services.agents.ui_agent import ui_agent

    success_result = {
        "ui_json": {"version": "0.2", "scenes": [], "id_map": {}},
        "ui_markdown": "# Root Scene\n",
    }

    before_edit = _get_units_used(user_id)
    with patch.object(ui_agent, "_edit_with_current_ui", new=AsyncMock(return_value=success_result)):
        result = await ui_agent.edit(topic_id, "Add a simple introduction scene")
    assert "error" not in result, f"UI edit unexpectedly failed: {result}"
    after_edit = _get_units_used(user_id)
    assert after_edit - before_edit == 2, f"Expected UI edit to charge 2 units, got {after_edit - before_edit}"

    before_failure = _get_units_used(user_id)
    with patch.object(ui_agent, "_edit_with_current_ui", new=AsyncMock(return_value={"error": "mock failure"})):
        result = await ui_agent.edit(topic_id, "This should fail")
    assert result.get("error") == "mock failure", f"Expected mocked error, got {result}"
    after_failure = _get_units_used(user_id)
    assert after_failure == before_failure, "UI edit failure should refund charged units"

    before_plan = _get_units_used(user_id)
    with patch.object(ui_agent, "_edit_with_current_ui", new=AsyncMock(return_value=success_result)), \
         patch("srcs.services.agents.rotating_llm.rotating_llm.send_message", new=AsyncMock(return_value=LLMResponse(text="Mock UI plan", model="mock", status="ok"))):
        result = await ui_agent.plan_and_edit(topic_id, "Rebuild the page structure")
    assert "error" not in result, f"UI plan_and_edit unexpectedly failed: {result}"
    after_plan = _get_units_used(user_id)
    assert after_plan - before_plan == 2, f"Expected plan_and_edit to charge once (2 units), got {after_plan - before_plan}"


def run_tests() -> None:
    _get_app()

    port = 8006
    base_url = f"http://127.0.0.1:{port}"
    print(f"{Colors.BLUE}Starting Server (port {port})...{Colors.END}")
    server_thread = threading.Thread(target=start_server, kwargs={"port": port}, daemon=True)
    server_thread.start()
    _wait_for_server(base_url)

    client = TestClient(base_url, actor_name="PricingTest")

    try:
        print(f"\n{Colors.BOLD}=== RUNNING PRICING REGRESSION TESTS ==={Colors.END}\n")

        token, user_id = _register_and_login(client, "pricing_user@test.com")
        client.headers["Authorization"] = f"Bearer {token}"
        topic_id = _create_topic(base_url, token, "Pricing Topic")

        print(f"\n{Colors.BOLD}--- 1. Upload size guard returns 413 without charging ---{Colors.END}")
        before_units = _get_units_used(user_id)
        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("oversized.pdf", _pdf_bytes(200), "application/pdf")},
            timeout=30,
        )
        assert raw.status_code == 413, f"Expected 413, got {raw.status_code}: {raw.text}"
        assert _get_units_used(user_id) == before_units, "Oversized upload should not consume units"
        print(f"{Colors.GREEN}Oversized upload rejected without usage impact{Colors.END}")

        print(f"\n{Colors.BOLD}--- 2. Ingestion charges dynamically by word count ---{Colors.END}")
        before_units = _get_units_used(user_id)
        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id}/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("large.pdf", _pdf_bytes(64), "application/pdf")},
            timeout=30,
        )
        assert raw.status_code == 200, f"Expected 200, got {raw.status_code}: {raw.text}"
        after_units = _get_units_used(user_id)
        assert after_units - before_units == 5, f"Expected 5 upload units, got {after_units - before_units}"
        assert raw.json().get("document_text"), "Successful upload should store extracted text"
        print(f"{Colors.GREEN}Large upload charged 5 units as expected{Colors.END}")

        print(f"\n{Colors.BOLD}--- 3. Over-quota upload is rejected and cleaned up ---{Colors.END}")
        token_overquota, user_id_overquota = _register_and_login(client, "pricing_overquota@test.com")
        topic_id_overquota = _create_topic(base_url, token_overquota, "Overquota Topic")
        before_files = set(os.listdir(_get_upload_dir()))
        raw = requests.post(
            f"{base_url}/api/v1/topics/{topic_id_overquota}/upload",
            headers={"Authorization": f"Bearer {token_overquota}"},
            files={"file": ("overquota.pdf", _pdf_bytes(64), "application/pdf")},
            timeout=30,
        )
        assert raw.status_code == 429, f"Expected 429, got {raw.status_code}: {raw.text}"
        after_files = set(os.listdir(_get_upload_dir()))
        assert after_files == before_files, "Rejected over-quota upload should be deleted from disk"
        assert _get_units_used(user_id_overquota) == 0, "Rejected over-quota upload should not persist usage"
        print(f"{Colors.GREEN}Over-quota upload rejected and cleaned up{Colors.END}")

        print(f"\n{Colors.BOLD}--- 4. Recommendations are free ---{Colors.END}")
        before_units = _get_units_used(user_id)
        raw_default = requests.get(
            f"{base_url}/api/v1/recommendations/default",
            headers={"Authorization": f"Bearer {token}"},
            params={"education_level": "secondary"},
            timeout=30,
        )
        raw_latest = requests.get(
            f"{base_url}/api/v1/recommendations/latest",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        raw_topic = requests.get(
            f"{base_url}/api/v1/recommendations/{topic_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert raw_default.status_code == 200, f"default recommendations failed: {raw_default.status_code}"
        assert raw_latest.status_code == 200, f"latest recommendations failed: {raw_latest.status_code}"
        assert raw_topic.status_code == 200, f"topic recommendations failed: {raw_topic.status_code}"
        assert _get_units_used(user_id) == before_units, "Recommendation routes should be free"
        print(f"{Colors.GREEN}Recommendation endpoints no longer consume units{Colors.END}")

        print(f"\n{Colors.BOLD}--- 5. Speech-to-text is free ---{Colors.END}")
        before_units = _get_units_used(user_id)
        raw = requests.post(
            f"{base_url}/api/v1/speech/stt",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("voice.mp3", b"fake audio bytes", "audio/mpeg")},
            timeout=30,
        )
        assert raw.status_code == 200, f"Expected 200, got {raw.status_code}: {raw.text}"
        assert raw.json()["text"] == "mock transcript", f"Unexpected transcript payload: {raw.text}"
        assert _get_units_used(user_id) == before_units, "Speech route should be free"
        print(f"{Colors.GREEN}Speech transcription completed without usage impact{Colors.END}")

        print(f"\n{Colors.BOLD}--- 6. UI read/share/rollback routes are free ---{Colors.END}")
        before_units = _get_units_used(user_id)
        raw_ui = requests.get(
            f"{base_url}/api/v1/ui/{topic_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        assert raw_ui.status_code == 200, f"get_ui failed: {raw_ui.status_code} {raw_ui.text}"
        scene_id = raw_ui.json()["scene_id"]

        raw_history = requests.get(
            f"{base_url}/api/v1/ui/{topic_id}/history",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        raw_share = requests.post(
            f"{base_url}/api/v1/ui/share/{scene_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        raw_rollback = requests.post(
            f"{base_url}/api/v1/ui/{topic_id}/rollback",
            headers={"Authorization": f"Bearer {token}"},
            json={"scene_id": scene_id},
            timeout=30,
        )
        assert raw_history.status_code == 200, f"history failed: {raw_history.status_code} {raw_history.text}"
        assert raw_share.status_code == 200, f"share failed: {raw_share.status_code} {raw_share.text}"
        assert raw_rollback.status_code == 200, f"rollback failed: {raw_rollback.status_code} {raw_rollback.text}"
        assert _get_units_used(user_id) == before_units, "UI read/share/rollback routes should be free"
        print(f"{Colors.GREEN}UI read endpoints stayed free{Colors.END}")

        print(f"\n{Colors.BOLD}--- 7. UI generation charges once and refunds on failure ---{Colors.END}")
        token_ui, user_id_ui = _register_and_login(client, "pricing_ui@test.com")
        topic_id_ui = _create_topic(base_url, token_ui, "UI Pricing Topic")
        asyncio.run(_run_ui_agent_pricing_checks(user_id_ui, topic_id_ui))
        print(f"{Colors.GREEN}UI generation billing behavior is correct{Colors.END}")

        print(f"\n{Colors.GREEN}{Colors.BOLD}ALL PRICING TESTS PASSED!{Colors.END}")

    except AssertionError as exc:
        print(f"\n{Colors.RED}{Colors.BOLD}TEST FAILED: {exc}{Colors.END}")
        raise
    except Exception as exc:
        print(f"\n{Colors.RED}{Colors.BOLD}ERROR EXECUTING TESTS: {exc}{Colors.END}")
        raise
    finally:
        if _test_db:
            for path in (_test_db, f"{_test_db}-wal", f"{_test_db}-shm"):
                if os.path.exists(path):
                    try:
                        os.unlink(path)
                    except OSError:
                        pass
        if _upload_dir and os.path.isdir(_upload_dir):
            shutil.rmtree(_upload_dir, ignore_errors=True)


if __name__ == "__main__":
    run_tests()
