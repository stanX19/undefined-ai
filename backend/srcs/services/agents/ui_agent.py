"""UIAgent — LLM agent specialised for MarkGraph protocol editing.

Reads the current MarkGraph UI state, receives a prompt, and outputs the NEW
MarkGraph state wholesale. Automatically reiterates if the parser finds syntax errors.
Called by the ``edit_ui`` chatbot tool.
"""
import json
import traceback

from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, BaseMessage

from srcs.services.agents.rotating_llm import rotating_llm, LLMResponse
from srcs.services.agents.prompts.ui_agent import UI_AGENT_PROMPT
from srcs.services.agents.id_mapper import current_mapper
from srcs.utils.markgraph.markgraph_parser import compile_markgraph, export_to_dict


class UIAgent:
    """Agent for MarkGraph UI protocol generation.

    Instantiate once and reuse.
    """

    def __init__(self) -> None:
        self.system_prompt = UI_AGENT_PROMPT

    async def edit(self, topic_id: str, prompt: str) -> dict:
        """Run the agent to edit the UI for *topic_id* per *prompt*.

        Returns a dictionary containing "ui_json" (the parsed AST)
        and "ui_markdown". If there's an error, returns {"error": "..."}.
        """
        from srcs.database import AsyncSessionLocal
        from srcs.services.ui_service import UIService

        async with AsyncSessionLocal() as db:
            current_ui = await UIService.get_ui_markdown(db, topic_id)

        messages: list[BaseMessage] = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=(
                f"Topic ID: {current_mapper().shorten(topic_id, prefix='T')}\n\n"
                f"--- CURRENT UI STATE ---\n{current_ui}\n--- END UI STATE ---\n\n"
                f"Instruction: {prompt}"
            )),
        ]

        max_retries = 3
        for attempt in range(max_retries):
            try:
                llm_response: LLMResponse = await rotating_llm.send_message(messages, temperature=0.3)
                content: str = rotating_llm.strip_code_block(llm_response.text)

                # Parse and validate the new MarkGraph text
                result = compile_markgraph(content)

                if result.errors:
                    print(f"UIAgent syntax error on attempt {attempt + 1}. Retrying.")
                    error_lines = [f"Line {e.line}: {e.message}" for e in result.errors]
                    messages.append(AIMessage(content=llm_response.text))
                    messages.append(
                        HumanMessage(content=(
                            "The MarkGraph parser reported the following syntax errors:\n"
                            + "\n".join(error_lines) +
                            "\n\nPlease fix these errors and output the FULL corrected MarkGraph document."
                        ))
                    )
                    continue

                # Success — save the raw markdown to db
                async with AsyncSessionLocal() as db:
                    await UIService.replace_ui_markdown(db, topic_id, content)

                # Return the parsed AST as a dict, alongside the raw text for reference
                ast_dict = export_to_dict(result.scenes)
                return {
                    "ui_json": {"version": "0.2", "scenes": ast_dict, "id_map": {k: export_to_dict(v) for k,v in result.id_map.items()}},
                    "ui_markdown": content
                }

            except Exception as exc:
                traceback.print_exc()
                return {"error": str(exc)}
                
        return {"error": "Max retries exceeded while fixing syntax errors."}


# -- Module-level singleton ---------------------------------------------------
ui_agent = UIAgent()


if __name__ == "__main__":
    print("UIAgent loaded OK")
    print(f"  Prompt length: {len(ui_agent.system_prompt)} chars")
