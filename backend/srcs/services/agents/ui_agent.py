"""UIAgent - LLM agent specialised for MarkGraph protocol editing.

Reads the current MarkGraph UI state, receives a prompt, and outputs the NEW
MarkGraph state wholesale. Automatically reiterates if the parser finds syntax errors.
Called by the ``edit_ui`` chatbot tool.
"""
from dataclasses import dataclass
import asyncio
import traceback

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage
from sqlalchemy import select

from srcs.config import get_settings
from srcs.logger import logger
from srcs.models.topic import Topic
from srcs.models.user import User
from srcs.services.agents.rotating_llm import rotating_llm, LLMResponse, RotatingLLM
from srcs.services.agents.prompts.ui_agent import (
    UI_AGENT_PROMPT,
    UI_PLANNER_PROMPT,
    UI_SCENE_BUILDER_PROMPT,
)
from srcs.services.agents.id_mapper import current_mapper
from srcs.services.usage_service import UsageService
from srcs.utils.markgraph.markgraph_parser import compile_markgraph, export_to_dict
from srcs.utils.markgraph.markgraph_spec import MARKGRAPH_SPEC
from srcs.utils.text import count_words


@dataclass(slots=True)
class UIChargeContext:
    """Captured billing context for a single top-level UI generation."""

    current_ui: str
    user_id: str
    units: int


class UIAgent:
    """Agent for MarkGraph UI protocol generation.

    Instantiate once and reuse.
    """

    def __init__(self) -> None:
        self.system_prompt = UI_AGENT_PROMPT + "\n\n" + MARKGRAPH_SPEC

    async def edit(self, topic_id: str, prompt: str, header_name: str | None = None) -> dict:
        """Run the agent to edit the UI for *topic_id* per *prompt*.

        If *header_name* is specified, the agent works only on that section.
        Returns a dictionary containing "ui_json" (the parsed AST)
        and "ui_markdown". If there's an error, returns {"error": "..."}.
        """
        charge_ctx: UIChargeContext | None = None
        try:
            charge_ctx = await self._charge_generation_units(topic_id)
            result = await self._edit_with_current_ui(
                topic_id=topic_id,
                prompt=prompt,
                current_ui=charge_ctx.current_ui,
                header_name=header_name,
            )
            if "error" in result:
                await self._refund_generation_units(charge_ctx)
            return result
        except Exception as exc:
            if charge_ctx is not None:
                await self._refund_generation_units(charge_ctx)
            traceback.print_exc()
            return {"error": str(exc)}

    async def plan_and_edit(self, topic_id: str, prompt: str) -> dict:
        """Two-step UI editing: plan, then build all scenes in parallel.

        Used for complex full-document rewrites with many facts. The planner emits
        a strict JSON scene blueprint; the backend then fans out one LLM call per
        scene and stitches the results. Falls back to single-shot generation if
        the JSON plan is unparseable or stitched output fails MarkGraph validation.
        """
        charge_ctx: UIChargeContext | None = None
        try:
            charge_ctx = await self._charge_generation_units(topic_id)
            current_ui = charge_ctx.current_ui

            plan_json = await self._plan_scene_blueprint(topic_id, prompt, current_ui)

            # Fallback: planner did not return parseable JSON → use existing serial path
            # so we never regress below current behaviour.
            if not plan_json or not isinstance(plan_json.get("scenes"), list) or not plan_json["scenes"]:
                logger.info("[UIAgent] Planner JSON missing/empty — falling back to serial generation")
                result = await self._edit_with_current_ui(
                    topic_id=topic_id,
                    prompt=prompt,
                    current_ui=current_ui,
                    header_name=None,
                )
                if "error" in result:
                    await self._refund_generation_units(charge_ctx)
                return result

            stitched = await self._build_scenes_in_parallel(
                topic_id=topic_id,
                user_prompt=prompt,
                plan_json=plan_json,
            )

            # Validate stitched output. If it's invalid, fall back to single-shot
            # generation rather than pushing a broken document.
            full_result = compile_markgraph(stitched)
            if full_result.errors:
                first_err = full_result.errors[0]
                logger.warning(
                    "[UIAgent] Parallel stitched output invalid (line %s: %s) — falling back to serial",
                    first_err.line, first_err.message,
                )
                result = await self._edit_with_current_ui(
                    topic_id=topic_id,
                    prompt=prompt,
                    current_ui=current_ui,
                    header_name=None,
                )
                if "error" in result:
                    await self._refund_generation_units(charge_ctx)
                return result

            from srcs.database import AsyncSessionLocal
            from srcs.services.ui_service import UIService

            async with AsyncSessionLocal() as db:
                await UIService.push_ui_version(db, topic_id, stitched)

            ast_dict = export_to_dict(full_result.scenes)
            return {
                "ui_json": {
                    "version": "0.2",
                    "scenes": ast_dict,
                    "id_map": {k: export_to_dict(v) for k, v in full_result.id_map.items()},
                },
                "ui_markdown": stitched,
            }
        except Exception as exc:
            if charge_ctx is not None:
                await self._refund_generation_units(charge_ctx)
            traceback.print_exc()
            return {"error": f"Planning phase failed: {exc}"}

    async def _plan_scene_blueprint(
        self, topic_id: str, prompt: str, current_ui: str,
    ) -> dict | None:
        """Run the planner and return the parsed JSON blueprint, or None if unusable."""
        planning_messages = [
            SystemMessage(content=UI_PLANNER_PROMPT),
            HumanMessage(content=(
                f"Topic ID: {current_mapper().shorten(topic_id, prefix='T')}\n\n"
                f"=== CURRENT FULL UI STATE ===\n{current_ui}\n=== END UI STATE ===\n\n"
                f"Instruction: {prompt}"
            )),
        ]
        try:
            planner_response: LLMResponse = await rotating_llm.send_message_get_json(
                planning_messages, temperature=0.2, retry=2,
            )
        except Exception as exc:
            logger.warning("[UIAgent] Planner JSON parse failed: %s", exc)
            return None

        plan = planner_response.json_data
        if not isinstance(plan, dict):
            return None
        return plan

    async def _build_scenes_in_parallel(
        self, topic_id: str, user_prompt: str, plan_json: dict,
    ) -> str:
        """Fan out one LLM call per scene and stitch the results in plan order.

        Returns the stitched MarkGraph document. Does NOT validate or persist —
        the caller is responsible for compile_markgraph + push_ui_version.
        """
        scenes = plan_json["scenes"]
        plan_blob = self._format_plan_for_scene_builder(plan_json)
        topic_short = current_mapper().shorten(topic_id, prefix="T")

        async def build_one(scene_spec: dict) -> str:
            return await self._build_one_scene(
                topic_short=topic_short,
                user_prompt=user_prompt,
                plan_blob=plan_blob,
                scene_spec=scene_spec,
            )

        # Run all scene builders concurrently. asyncio.gather preserves input order
        # so the stitched document matches plan_json["scenes"] order.
        scene_markdowns = await asyncio.gather(*(build_one(s) for s in scenes))
        # Strip per-scene whitespace and join with a single blank line between scenes.
        return "\n\n".join(md.strip() for md in scene_markdowns if md and md.strip())

    @staticmethod
    def _format_plan_for_scene_builder(plan_json: dict) -> str:
        """Format the full plan as a compact text blob to pass to each scene builder."""
        import json as _json
        try:
            return _json.dumps(plan_json, indent=2, ensure_ascii=False)
        except Exception:
            return str(plan_json)

    async def _build_one_scene(
        self, topic_short: str, user_prompt: str, plan_blob: str, scene_spec: dict,
    ) -> str:
        """Generate one MarkGraph scene from a plan entry. Returns raw markdown."""
        scene_id = scene_spec.get("id", "")
        scene_name = scene_spec.get("name", scene_id)
        scene_role = scene_spec.get("role", "detail")

        system_content = UI_SCENE_BUILDER_PROMPT + "\n\n" + MARKGRAPH_SPEC
        human_content = (
            f"Topic ID: {topic_short}\n\n"
            f"Original user instruction: {user_prompt}\n\n"
            f"=== FULL PLAN (all scenes) ===\n{plan_blob}\n=== END PLAN ===\n\n"
            f"=== YOUR SCENE TO BUILD ===\n"
            f"id: {scene_id}\n"
            f"name: {scene_name}\n"
            f"role: {scene_role}\n"
            f"=== END YOUR SCENE ===\n\n"
            f"Output ONLY the raw MarkGraph for this single scene, starting with "
            f"`# {scene_name} {{#{scene_id}}}`."
        )

        messages: list[BaseMessage] = [
            SystemMessage(content=system_content),
            HumanMessage(content=human_content),
        ]
        response: LLMResponse = await rotating_llm.send_message(messages, temperature=0.3)
        return RotatingLLM.strip_code_block(response.text)


    async def _edit_with_current_ui(
        self,
        topic_id: str,
        prompt: str,
        current_ui: str,
        header_name: str | None,
    ) -> dict:
        from srcs.database import AsyncSessionLocal
        from srcs.services.ui_service import UIService
        from srcs.utils.markgraph.markgraph_parser import get_section_range

        section_range: tuple[int, int] | None = None
        ui_to_edit: str = current_ui
        context_label: str = "CURRENT FULL UI STATE"

        if header_name:
            section_range = get_section_range(current_ui, header_name)
            if not section_range:
                raise ValueError(f"Section with header or ID '{header_name}' not found.")

            start, end = section_range
            lines = current_ui.splitlines()
            # MarkGraph lines are 1-indexed
            ui_to_edit = "\n".join(lines[start - 1:end])
            context_label = f"CURRENT UI SECTION '{header_name}'"

        messages: list[BaseMessage] = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=(
                f"Topic ID: {current_mapper().shorten(topic_id, prefix='T')}\n\n"
                f"=== {context_label} ===\n{ui_to_edit}\n=== END UI STATE ===\n\n"
                f"Instruction: {prompt}"
            )),
        ]

        max_retries = 3
        for attempt in range(max_retries):
            llm_response: LLMResponse = await rotating_llm.send_message(messages, temperature=0.3)
            content: str = rotating_llm.strip_code_block(llm_response.text)

            result = compile_markgraph(content)

            if result.errors:
                print(f"UIAgent syntax error on attempt {attempt + 1}. Retrying.")
                error_lines = [f"Line {e.line}: {e.message}" for e in result.errors]
                messages.append(AIMessage(content=content))
                messages.append(
                    HumanMessage(content=(
                        "The MarkGraph parser reported the following syntax errors:\n"
                        + "\n".join(error_lines) +
                        "\n\nPlease fix these errors and output the FULL corrected document/fragment."
                    ))
                )
                continue

            final_content = content
            if section_range:
                start, end = section_range
                lines = current_ui.splitlines()
                prefix = lines[:start - 1]
                suffix = lines[end:]
                final_content = "\n".join(prefix + [content] + suffix)

            full_result = compile_markgraph(final_content)
            if full_result.errors:
                return {"error": f"Full document became invalid after merge: {full_result.errors[0].message}"}

            async with AsyncSessionLocal() as db:
                await UIService.push_ui_version(db, topic_id, final_content)

            ast_dict = export_to_dict(full_result.scenes)
            return {
                "ui_json": {
                    "version": "0.2",
                    "scenes": ast_dict,
                    "id_map": {k: export_to_dict(v) for k, v in full_result.id_map.items()},
                },
                "ui_markdown": final_content,
            }

        return {"error": "Max retries exceeded while fixing syntax errors."}

    async def _charge_generation_units(self, topic_id: str) -> UIChargeContext:
        from srcs.database import AsyncSessionLocal
        from srcs.services.ui_service import UIService

        settings = get_settings()
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Topic, User)
                .join(User, Topic.user_id == User.user_id)
                .where(Topic.topic_id == topic_id)
            )
            row = result.first()
            if row is None:
                raise ValueError(f"Topic {topic_id} not found")

            _, owner = row
            current_ui = await UIService.get_ui_markdown(db, topic_id)
            current_ui_words = count_words(current_ui)
            units = max(settings.UI_MIN_UNITS, current_ui_words // settings.UI_WORDS_PER_UNIT)
            await UsageService.check_and_consume_units(db, owner, units)
            return UIChargeContext(
                current_ui=current_ui,
                user_id=owner.user_id,
                units=units,
            )

    async def _refund_generation_units(self, charge_ctx: UIChargeContext) -> None:
        from srcs.database import AsyncSessionLocal

        async with AsyncSessionLocal() as db:
            user = await db.get(User, charge_ctx.user_id)
            if user is None:
                return
            await UsageService.safe_refund_units(db, user, charge_ctx.units)


# -- Module-level singleton ---------------------------------------------------
ui_agent = UIAgent()

if __name__ == '__main__':
    async def main() -> None:
        """Test suite for partial UI editing."""
        from srcs.utils.markgraph.markgraph_parser import get_section_range
        from unittest.mock import AsyncMock, patch

        print("Running UIAgent tests...")

        test_mg = """# Root Scene
## Section A
Some content A

## Section B
Some content B
:::quiz
Question?
- Answer *
:::

## Section C
Some content C
"""

        # Test 1: Section retrieval
        print("\nTest 1: Section Retrieval")
        range_a = get_section_range(test_mg, "Section A")
        print(f"Section A range: {range_a} (Expected: (2, 3))")
        assert range_a == (2, 3)

        range_b = get_section_range(test_mg, "section-b")
        print(f"Section B (by ID) range: {range_b} (Expected: (5, 9))")
        assert range_b == (5, 10)

        # Test 2: Mocked Partial Edit
        print("\nTest 2: Mocked Partial Edit")
        with patch("srcs.services.ui_service.UIService.get_ui_markdown", return_value=test_mg), \
             patch("srcs.services.ui_service.UIService.push_ui_version", return_value=None), \
             patch("srcs.services.agents.ui_agent.UIAgent._charge_generation_units", new_callable=AsyncMock) as mock_charge, \
             patch("srcs.services.agents.rotating_llm.rotating_llm.send_message", new_callable=AsyncMock) as mock_send:

            mock_charge.return_value = UIChargeContext(current_ui=test_mg, user_id="test_user", units=2)
            mock_send.return_value = LLMResponse(text="## Section B\nUpdated content B\n", tokens=10, model="test", status="success")

            agent = UIAgent()
            result = await agent.edit("test_topic", "Update Section B", header_name="Section B")

            if "error" in result:
                print(f"Error: {result['error']}")
            else:
                updated_mg = result["ui_markdown"]
                print("Updated MarkGraph:")
                print(updated_mg)
                assert "Updated content B" in updated_mg
                assert "Some content A" in updated_mg
                assert "Some content C" in updated_mg
                assert "Some content B" not in updated_mg

        print("\nAll tests passed locally!")


    import asyncio
    asyncio.run(main())
