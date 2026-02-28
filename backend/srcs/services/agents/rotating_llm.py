import traceback
import os

from dotenv import load_dotenv
from langchain_core.runnables import RunnableWithFallbacks, Runnable
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
import asyncio
import random
import json
import re
from pydantic import BaseModel
from srcs.config import get_settings

# to mute gemini "ALTS creds ignored. Not running on GCP and untrusted ALTS is not enabled."
os.environ['GRPC_VERBOSITY'] = 'NONE'

MessagesType = None | str | dict | BaseMessage | list[str | dict | BaseMessage]

class LLMResponse(BaseModel):
    text: str
    model: str
    status: str
    json_data: dict | list | None = None

class LLMConfig:
    """Stores configuration for creating an LLM instance"""

    def __init__(self, provider: str, api_key: str, model: str):
        self.provider = provider  # "openai" or "gemini"
        self.api_key = api_key
        self.model = model

    def create_runnable(self, temperature: float = 0.7, model: str | None = None, **kwargs) -> Runnable:
        """Create a runnable with specified parameters"""
        use_model = model if model else self.model
        if self.provider == "gemini":
            return ChatGoogleGenerativeAI(
                model=use_model,
                google_api_key=self.api_key,
                temperature=temperature,
                **kwargs
            )
        else:
            raise ValueError(f"Unknown provider: {self.provider}")

    def __str__(self):
        return f"{self.provider.capitalize()} ({self.model}) {{api=...{self.api_key[-10:]}}}"


class RotatingLLM:
    MAX_RETRIES = 2

    def __init__(self, llm_configs: list[LLMConfig], cooldown_seconds: int = 60):
        self.llm_configs: list[LLMConfig] = llm_configs
        self.cooldown_seconds = cooldown_seconds
        self._rotation_index = 0
        self._lock = asyncio.Lock()
        random.shuffle(self.llm_configs)

    @staticmethod
    def _normalize_message(messages: str | dict | BaseMessage) -> BaseMessage:
        if isinstance(messages, str):
            return HumanMessage(content=messages)
        elif isinstance(messages, dict):
            role = messages.get("role", "user")
            text = messages.get("text", "")
            mappings = {
                "system": SystemMessage,
                "assistant": AIMessage,
                "tool": ToolMessage
            }
            return mappings.get(role, HumanMessage)(content=text)
        elif isinstance(messages, BaseMessage):
            return messages
        raise ValueError(f"Unsupported message type: {type(messages)}")

    @staticmethod
    def format_messages(
            messages: MessagesType
    ) -> list[BaseMessage] | None:
        if messages is None:
            return None
        if isinstance(messages, str | dict | BaseMessage):
            return [RotatingLLM._normalize_message(messages)]
        elif isinstance(messages, list):
            return [RotatingLLM._normalize_message(i) for i in messages]
        raise ValueError(f"Unsupported message type: {type(messages)}")

    async def _rotate(self) -> list[LLMConfig]:
        async with self._lock:
            self.llm_configs = self.llm_configs[1:] + self.llm_configs[:1]
            return self.llm_configs

    async def get_runnable(self, temperature: float = 0.7, model: str | None = None, **kwargs) -> RunnableWithFallbacks:
        """
        Get a runnable with fallbacks, creating LLM instances with specified parameters

        :param temperature: Temperature for LLM generation
        :param model: Specific model to use, overriding config
        :param kwargs: Additional arguments to pass to LLM constructors
        :return: RunnableWithFallbacks instance
        """
        ordered = await self._rotate()
        ordered = ordered[:RotatingLLM.MAX_RETRIES + 1]  # +1 for main
        runnables = [config.create_runnable(temperature=temperature, model=model, **kwargs) for config in ordered]
        primary, *fallbacks = runnables
        return RunnableWithFallbacks(runnable=primary, fallbacks=fallbacks)

    async def get_runnable_with_tools(self, tools: list, temperature: float = 0.7, model: str | None = None, **kwargs) -> RunnableWithFallbacks:
        """
        Get a runnable with fallbacks, where each LLM instance has the specified tools bound to it.

        :param tools: The tools to bind to the LLM instances
        :param temperature: Temperature for LLM generation
        :param model: Specific model to use, overriding config
        :param kwargs: Additional arguments to pass to LLM constructors
        :return: RunnableWithFallbacks instance
        """
        ordered = await self._rotate()
        runnables = [config.create_runnable(temperature=temperature, model=model, **kwargs).bind_tools(tools) for config in ordered]
        primary, *fallbacks = runnables
        return RunnableWithFallbacks(runnable=primary, fallbacks=fallbacks)

    async def get_next_api_key(self, provider: str = "gemini") -> str:
        """
        Get the next API key for the specified provider.

        :param provider: The provider to get the API key for
        :return: The next API key for the specified provider
        """
        async with self._lock:
            key_list = list(filter(lambda x: x.provider == provider, await self._rotate()))
            if not key_list:
                raise ValueError(f"No API key found for provider: {provider}")
            return key_list[0].api_key

    @staticmethod
    def try_get_json(text: str):
        try:
            clean_text = re.sub(
                r'^\s*```json\s*([\s\S]*?)\s*```\s*$',
                r'\1',
                text.strip(),
            ).strip()
            return json.loads(clean_text)
        except json.JSONDecodeError:
            return None

    async def send_message_get_json(
            self,
            messages: str | list[BaseMessage] | dict[str, str],
            config: dict | None = None,
            retry: int = 3,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs
    ) -> LLMResponse:
        """
        Sends a message to the rotating LLM pool and gets the result with parsed json

        :param messages: the messages to send
        :param config: ainvoke's config
        :param retry: number of retries
        :param temperature: Temperature for LLM generation
        :param model: Specific model to use, overriding config
        :param llm_kwargs: Additional arguments to pass to LLM constructors
        :return: LLMResponse
        """
        result = None

        for i in range(retry):
            result = await self.send_message(messages, config, temperature=temperature, model=model, **llm_kwargs)
            parsed = RotatingLLM.try_get_json(result.text)
            if parsed is None:
                continue
            result.json_data = parsed
            return result

        if result is None:
            raise RuntimeError("Failed to get response from LLM")
            
        raise RuntimeError(f"Failed to parse json from LLM {result.model_dump_json()}")

    async def send_message(
            self,
            messages: str | list[BaseMessage] | dict[str, str],
            config: dict | None = None,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs
    ) -> LLMResponse:
        """
        Sends a message to the rotating LLM pool and gets the result

        :param messages: the messages to send
        :param config: ainvoke's config
        :param temperature: Temperature for LLM generation
        :param model: Specific model to use, overriding config
        :param llm_kwargs: Additional arguments to pass to LLM constructors
        :return: LLMResponse
        """
        msgs = self.format_messages(messages)
        runnable: Runnable = await self.get_runnable(temperature=temperature, model=model, **llm_kwargs)

        print(f"\n[ROTATING_LLM] === SENDING REQUEST ===")
        for idx, m in enumerate(msgs):
            content_str: str = str(m.content)
            if len(content_str) > 500:
                content_str = content_str[:250] + "\n... [TRUNCATED] ...\n" + content_str[-250:]

            if type(m) == HumanMessage:
                print(f"[ROTATING_LLM] Human [{idx}]: {content_str}")
            elif type(m) == SystemMessage:
                print(f"[ROTATING_LLM] System [{idx}]: {content_str}")
            elif type(m) == AIMessage:
                print(f"[ROTATING_LLM] AI [{idx}]: {content_str}")
            else:
                print(f"[ROTATING_LLM] {m.type} [{idx}]: {content_str}")

        for attempt in range(self.MAX_RETRIES):
            try:
                result = await runnable.ainvoke(msgs, config=config)
                content = result.content if hasattr(result, "content") else str(result)
                if isinstance(content, list):
                    text = "".join(
                        block["text"] for block in content
                        if isinstance(block, dict) and block.get("type") == "text"
                    )
                else:
                    text = content

                text_out: str = text
                if len(text_out) > 500:
                    text_out = text_out[:250] + "\n... [TRUNCATED] ...\n" + text_out[-250:]

                print(f"\n[ROTATING_LLM] === RESPONSE ===")
                print(f"[ROTATING_LLM] {text_out}\n")

                return LLMResponse(
                    text=text,
                    model=RotatingLLM._format_runnable(runnable),
                    status="ok"
                )

            except Exception as e:
                traceback.print_exc()
                if attempt == self.MAX_RETRIES - 1:
                    return LLMResponse(text=str(e), model="", status="fail")
                continue

    @staticmethod
    def create_instance_with_env():
        """Create RotatingLLM instance from environment variables"""
        llm_configs = []
        load_dotenv()

        for key in get_settings().GEMINI_API_KEY_LIST:
            llm_configs.append(LLMConfig(
                provider="gemini",
                api_key=key,
                model=get_settings().GEMINI_MODEL_NAME
            ))

        return RotatingLLM(llm_configs)

    @staticmethod
    def _format_runnable(runnable: Runnable) -> str:
        api_key = ""
        if isinstance(runnable, ChatGoogleGenerativeAI):
            api_key = str(runnable.google_api_key.get_secret_value())
        elif isinstance(runnable, RunnableWithFallbacks):
            return RotatingLLM._format_runnable(runnable.runnable)

        return f"{runnable.__class__.__name__} ({runnable.model}) {{api=...{api_key[-10:]}}}"

    def __str__(self):
        configs_str = ",\n  ".join([str(config) for config in self.llm_configs])
        return f"{self.__class__.__name__} ({len(self.llm_configs)})[\n  {configs_str}\n]"


rotating_llm = RotatingLLM.create_instance_with_env()

__all__ = ["rotating_llm"]

if __name__ == "__main__":
    async def main():
        # Example with default temperature (0.7)
        result1 = await rotating_llm.send_message_get_json("Return a JSON: {\"hello\": \"world\"}", temperature=0.7)
        print("Default temperature:", result1)

        # Example with custom temperature
        result2 = await rotating_llm.send_message_get_json(
            "Return a JSON: {\"hello\": \"world\"}",
            temperature=0.2
        )
        print("Custom temperature:", result2)

        # Example with additional parameters
        result3 = await rotating_llm.send_message(
            "Say hello",
            temperature=1.0,
            max_tokens=50
        )
        print("With max_tokens:", result3)


    import sys

    if sys.platform.startswith("win") and sys.version_info < (3, 14):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())