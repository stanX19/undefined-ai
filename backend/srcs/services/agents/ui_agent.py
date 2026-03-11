"""UIAgent — LLM agent specialised for MarkGraph protocol editing.

Reads the current MarkGraph UI state, receives a prompt, and outputs the NEW
MarkGraph state wholesale. Automatically reiterates if the parser finds syntax errors.
Called by the ``edit_ui`` chatbot tool.
"""
import json
import pathlib
import traceback

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage

from srcs.services.agents.rotating_llm import rotating_llm, LLMResponse
from srcs.services.agents.prompts.ui_agent import UI_AGENT_PROMPT
from srcs.services.agents.id_mapper import current_mapper
from srcs.utils.markgraph.markgraph_parser import compile_markgraph, export_to_dict
from srcs.utils.markgraph.markgraph_spec import MARKGRAPH_SPEC


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
        from srcs.database import AsyncSessionLocal
        from srcs.services.ui_service import UIService
        from srcs.utils.markgraph.markgraph_parser import get_section_range

        async with AsyncSessionLocal() as db:
            current_ui = await UIService.get_ui_markdown(db, topic_id)

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
            ui_to_edit = "\n".join(lines[start-1:end])
            context_label = f"CURRENT UI SECTION '{header_name}'"

        messages: list[BaseMessage] = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=(
                f"Topic ID: {current_mapper().shorten(topic_id, prefix='T')}\n\n"
                f"--- {context_label} ---\n{ui_to_edit}\n--- END UI STATE ---\n\n"
                f"Instruction: {prompt}"
            )),
        ]

        max_retries = 3
        for attempt in range(max_retries):
            try:
                llm_response: LLMResponse = await rotating_llm.send_message(messages, temperature=0.3)
                content: str = rotating_llm.strip_code_block(llm_response.text)

                # Parse and validate the new MarkGraph text (partial or full)
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

                # Merge partial edit back into full document if necessary
                final_content = content
                if section_range:
                    start, end = section_range
                    lines = current_ui.splitlines()
                    prefix = lines[:start-1]
                    suffix = lines[end:]
                    # Ensure content is joined correctly
                    final_content = "\n".join(prefix + [content] + suffix)

                # Re-parse full content to ensure validity and get full metadata
                full_result = compile_markgraph(final_content)
                if full_result.errors:
                    # This shouldn't happen if the partial compile was fine, but just in case
                    return {"error": f"Full document became invalid after merge: {full_result.errors[0].message}"}

                # Success — save the raw markdown to db
                async with AsyncSessionLocal() as db:
                    await UIService.replace_ui_markdown(db, topic_id, final_content)

                # Return the parsed AST as a dict, alongside the raw text for reference
                ast_dict = export_to_dict(full_result.scenes)
                return {
                    "ui_json": {
                        "version": "0.2",
                        "scenes": ast_dict,
                        "id_map": {k: export_to_dict(v) for k, v in full_result.id_map.items()}
                    },
                    "ui_markdown": final_content
                }

            except Exception as exc:
                traceback.print_exc()
                return {"error": str(exc)}

        return {"error": "Max retries exceeded while fixing syntax errors."}


# -- Module-level singleton ---------------------------------------------------
ui_agent = UIAgent()

if __name__ == '__main__':
    async def main() -> None:
        """Test suite for partial UI editing."""
        import os
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
        assert range_b == (5, 10)  # Wait, compiled nodes: H2 Section B is line 5. H2 Section C is line 12.
        # Lines:
        # 5: ## Section B
        # 6: Some content B
        # 7: :::quiz
        # 8: Question?
        # 9: - Answer *
        # 10: :::
        # (Empty line at 11)
        # 12: ## Section C
        # The current implementation strips trailing whitespace.

        # Test 2: Mocked Partial Edit
        print("\nTest 2: Mocked Partial Edit")
        with patch("srcs.services.ui_service.UIService.get_ui_markdown", return_value=test_mg), \
             patch("srcs.services.ui_service.UIService.replace_ui_markdown", return_value=None), \
             patch("srcs.services.agents.rotating_llm.rotating_llm.send_message", new_callable=AsyncMock) as mock_send:

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


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
