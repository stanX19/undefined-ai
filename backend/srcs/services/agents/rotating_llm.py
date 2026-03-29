import enum
import logging
import traceback
import os
import asyncio
import random
import json
import re
from typing import Optional, Any

import requests
from dotenv import load_dotenv
from langchain_core.callbacks import (
    CallbackManagerForLLMRun,
    AsyncCallbackManagerForLLMRun,
)
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import RunnableWithFallbacks, Runnable
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from google.api_core.exceptions import ResourceExhausted
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, ConfigDict
from srcs.config import get_settings

# Mute Gemini "ALTS creds ignored. Not running on GCP and untrusted ALTS is not enabled."
os.environ['GRPC_VERBOSITY'] = 'NONE'

# Configure logging
logger = logging.getLogger(__name__)

# Type aliases
MessagesType = str | dict[str, Any] | BaseMessage | list[str | dict[str, Any] | BaseMessage] | None


class _Outcome(enum.Enum):
    """Outcomes of an LLM call for error classification and penalization."""
    SUCCESS = "success"
    RATE_LIMIT = "rate_limit"
    ACCESS_DENIED = "access_denied"
    UNKNOWN_ERROR = "unknown_error"


# -----------------------------------------------------------------------------
# ChatMinimax — custom LangChain BaseChatModel wrapping MiniMax's API
# -----------------------------------------------------------------------------

class ChatMinimax(BaseChatModel):
    """LangChain chat model backed by MiniMax chatcompletion_v2.

    Drop-in replacement for ChatGoogleGenerativeAI inside RotatingLLM.
    Supports regular chat and tool calling (OpenAI-compatible format).
    """

    model: str = "MiniMax-M2.5"
    api_key: str = ""
    base_url: str = "https://api.minimax.io"
    temperature: float = 0.7
    max_tokens: int = 4096

    @property
    def _llm_type(self) -> str:
        return "minimax"

    def bind_tools(self, tools: Any, **kwargs: Any) -> Runnable:
        """Bind tools to the model."""
        from langchain_core.utils.function_calling import convert_to_openai_tool
        formatted_tools = [convert_to_openai_tool(tool) for tool in tools]
        return self.bind(tools=formatted_tools, **kwargs)

    @staticmethod
    def _convert_messages(messages: list[BaseMessage]) -> list[dict]:
        """Convert LangChain message objects to OpenAI-format dicts."""
        result: list[dict] = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                result.append({"role": "system", "content": msg.content})
            elif isinstance(msg, HumanMessage):
                result.append({"role": "user", "content": msg.content})
            elif isinstance(msg, AIMessage):
                d: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
                if msg.tool_calls:
                    d["tool_calls"] = [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": (
                                    json.dumps(tc["args"])
                                    if isinstance(tc["args"], dict)
                                    else tc["args"]
                                ),
                            },
                        }
                        for tc in msg.tool_calls
                    ]
                result.append(d)
            elif isinstance(msg, ToolMessage):
                result.append({
                    "role": "tool",
                    "content": msg.content,
                    "tool_call_id": msg.tool_call_id,
                })
            else:
                result.append({"role": "user", "content": str(msg.content)})
        return result

    @staticmethod
    def _parse_response(data: dict) -> AIMessage:
        """Parse MiniMax JSON response into an AIMessage."""
        choices = data.get("choices", [])
        if not choices:
            return AIMessage(content="")

        message = choices[0].get("message", {})
        content = message.get("content", "") or ""
        
        # Remove <think>...</think> tags which MiniMax sometimes includes
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        
        tool_calls_data = message.get("tool_calls", [])

        if tool_calls_data:
            tool_calls = []
            for tc in tool_calls_data:
                func = tc.get("function", {})
                args_str = func.get("arguments", "{}")
                try:
                    args = json.loads(args_str) if isinstance(args_str, str) else args_str
                except json.JSONDecodeError:
                    args = {"raw": args_str}
                tool_calls.append({
                    "id": tc.get("id", ""),
                    "name": func.get("name", ""),
                    "args": args,
                })
            return AIMessage(content=content, tool_calls=tool_calls)

        return AIMessage(content=content)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(self, messages: list[BaseMessage], **kwargs: Any) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": self._convert_messages(messages),
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if kwargs.get("tools"):
            payload["tools"] = kwargs["tools"]
        return payload

    def _call_api(self, payload: dict) -> dict:
        """Synchronous HTTP POST to MiniMax chatcompletion_v2."""
        resp = requests.post(
            f"{self.base_url}/v1/text/chatcompletion_v2",
            headers=self._headers(),
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()

        base = data.get("base_resp", {})
        if base.get("status_code", 0) != 0:
            raise RuntimeError(
                f"MiniMax API error {base.get('status_code')}: "
                f"{base.get('status_msg', 'unknown')}"
            )
        return data

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        payload = self._build_payload(messages, **kwargs)
        if stop:
            payload["stop"] = stop

        data = self._call_api(payload)
        ai_message = self._parse_response(data)
        usage = data.get("usage", {})

        return ChatResult(
            generations=[
                ChatGeneration(message=ai_message, generation_info={"usage": usage})
            ]
        )

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Optional[AsyncCallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        return await asyncio.to_thread(
            self._generate, messages, stop, None, **kwargs
        )


# -----------------------------------------------------------------------------
# LLMResponse / LLMConfig / RotatingLLM — unchanged public API
# -----------------------------------------------------------------------------

class LLMResponse(BaseModel):
    """Container for the response from an LLM."""
    text: str
    model: str
    status: str
    json_data: dict[str, Any] | list[Any] | None = None


class LLMConfig:
    """Stores configuration for creating an LLM instance."""

    def __init__(self, provider: str, api_key: str, model: str) -> None:
        self.provider: str = provider
        self.api_key: str = api_key
        self.model: str = model

    def create_runnable(
            self,
            temperature: float = 0.7,
            model: str | None = None,
            **kwargs: Any
    ) -> Runnable:
        """Create a runnable with specified parameters.

        Args:
            temperature: Sampling temperature.
            model: Model name override.
            **kwargs: Extra parameters for the LLM.

        Returns:
            A LangChain Runnable.
        """
        use_model: str = model if model else self.model
        if self.provider == "gemini":
            return ChatGoogleGenerativeAI(
                model=use_model,
                google_api_key=self.api_key,
                temperature=temperature,
                **kwargs
            )
        if self.provider == "minimax":
            return ChatMinimax(
                model=use_model,
                api_key=self.api_key,
                temperature=temperature,
                **kwargs
            )
        raise ValueError(f"Unknown provider: {self.provider}")

    def __str__(self) -> str:
        return f"{self.provider.capitalize()} ({self.model}) {{api=...{self.api_key[-10:]}}}"


class RotatingRunnable(BaseChatModel):
    """Proxy chat model that delegates calls to RotatingLLM._invoke_core.

    This ensures all calls (including those from LangGraph agents) pass through
    the rotation, counting, and retry logic.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    rotating_llm: Any
    temperature: float = 0.7
    model: str | None = None
    extra_kwargs: dict[str, Any] = {}

    @property
    def _llm_type(self) -> str:
        return "rotating_proxy"

    def _generate(
            self,
            messages: list[BaseMessage],
            stop: list[str] | None = None,
            run_manager: CallbackManagerForLLMRun | None = None,
            **kwargs: Any
    ) -> ChatResult:
        raise NotImplementedError("Use async interface (_agenerate)")

    async def _agenerate(
            self,
            messages: list[BaseMessage],
            stop: list[str] | None = None,
            run_manager: AsyncCallbackManagerForLLMRun | None = None,
            **kwargs: Any
    ) -> ChatResult:
        merged: dict[str, Any] = {**self.extra_kwargs, **kwargs}
        if stop:
            merged["stop"] = stop

        result, _ = await self.rotating_llm._invoke_core(
            messages, self.temperature, self.model, **merged
        )
        return ChatResult(generations=[ChatGeneration(message=result)])

    def bind_tools(self, tools: Any, **kwargs: Any) -> Runnable:
        """Bind tools to the proxy model."""
        from langchain_core.utils.function_calling import convert_to_openai_tool
        formatted: list[dict[str, Any]] = [convert_to_openai_tool(t) for t in tools]
        return self.bind(tools=formatted, **kwargs)


class RotatingLLM:
    MAX_RETRIES = 2

    _PENALTIES: dict[_Outcome, int] = {
        _Outcome.SUCCESS: 1,
        _Outcome.RATE_LIMIT: 30,
        _Outcome.ACCESS_DENIED: 10000,
        _Outcome.UNKNOWN_ERROR: 10,
    }

    def __init__(
            self,
            llm_configs: list[LLMConfig],
            cooldown_seconds: int = 60
    ) -> None:
        """Initialize RotatingLLM with a pool of configurations.

        Args:
            llm_configs: List of LLM configurations to rotate.
            cooldown_seconds: Wait time (seconds) after rate limit (not used in current logic).
        """
        self.llm_configs: list[LLMConfig] = llm_configs
        self.cooldown_seconds: int = cooldown_seconds
        self._lock: asyncio.Lock = asyncio.Lock()
        self._call_counts: dict[str, int] = {c.api_key: 0 for c in llm_configs}
        random.shuffle(self.llm_configs)

    @staticmethod
    def _normalize_message(messages: str | dict[str, Any] | BaseMessage) -> BaseMessage:
        """Convert various message formats to LangChain BaseMessage.

        Args:
            messages: Input message in str, dict, or BaseMessage format.

        Returns:
            The normalized BaseMessage.

        Raises:
            ValueError: If input message type is unsupported.
        """
        if isinstance(messages, str):
            return HumanMessage(content=messages)
        elif isinstance(messages, dict):
            role: str = messages.get("role", "user")
            text: str = messages.get("text", "")
            mapping: dict[str, type[BaseMessage]] = {
                "system": SystemMessage,
                "assistant": AIMessage,
                "tool": ToolMessage
            }
            return mapping.get(role, HumanMessage)(content=text)
        elif isinstance(messages, BaseMessage):
            return messages
        raise ValueError(f"Unsupported message type: {type(messages)}")

    @staticmethod
    def format_messages(messages: MessagesType) -> list[BaseMessage] | None:
        """Format input into a list of LangChain BaseMessages."""
        if messages is None:
            return None
        if isinstance(messages, (str, dict, BaseMessage)):
            return [RotatingLLM._normalize_message(messages)]
        elif isinstance(messages, list):
            return [RotatingLLM._normalize_message(i) for i in messages]
        raise ValueError(f"Unsupported message type: {type(messages)}")

    @staticmethod
    def _log_request(messages: list[BaseMessage]) -> None:
        """Log the request messages at debug level.

        Args:
            messages: List of messages to log.
        """
        if not get_settings().DEBUG:
            return

        logger.debug("\n[ROTATING_LLM] === SENDING REQUEST ===")
        for idx, msg in enumerate(messages):
            content: str = str(msg.content)
            if len(content) > 500:
                content = f"{content[:250]}\n... [TRUNCATED] ...\n{content[-250:]}"

            role: str = getattr(msg, 'type', 'unknown')
            logger.debug("[ROTATING_LLM] %s [%d]: %s", role.capitalize(), idx, content)

    async def _invoke_core(
            self,
            messages: list[BaseMessage],
            temperature: float,
            model: str | None,
            **kwargs: Any
    ) -> tuple[AIMessage, LLMConfig]:
        """Single chokepoint for picking key, calling LLM, and recording outcome.

        Args:
            messages: List of messages to send.
            temperature: Sampling temperature.
            model: Model name override.
            **kwargs: Additional LLM parameters.

        Returns:
            Tuple of (AI response message, config used).

        Raises:
            Exception: The last exception encountered if all retries fail.
        """
        last_exc: Exception | None = None
        self._log_request(messages)

        for attempt in range(self.MAX_RETRIES + 1):
            config: LLMConfig = await self._pick_config()
            runnable: Runnable = config.create_runnable(temperature=temperature, model=model)

            try:
                result: AIMessage = await runnable.ainvoke(messages, **kwargs)
                async with self._lock:
                    self._call_counts[config.api_key] += self._PENALTIES[_Outcome.SUCCESS]
                logger.info("[RotatingLLM] OK key=...%s | count=%d",
                            config.api_key[-6:], self._call_counts[config.api_key])
                return result, config

            except Exception as exc:
                outcome: _Outcome = self._classify_error(exc)
                penalty: int = self._PENALTIES[outcome]
                if penalty > 0:
                    async with self._lock:
                        self._call_counts[config.api_key] += penalty

                logger.warning("[RotatingLLM] %d/%d %s: %s | key=...%s | count=%d",
                               attempt + 1, self.MAX_RETRIES + 1, outcome.value,
                               type(exc).__name__, config.api_key[-6:],
                               self._call_counts[config.api_key])
                last_exc = exc

        raise last_exc

    @staticmethod
    def _classify_error(exc: Exception) -> _Outcome:
        """Classify exceptions into rate limit, access denied, or unknown error.

        Args:
            exc: Exception to classify.

        Returns:
            The classified outcome.
        """
        if isinstance(exc, ResourceExhausted):
            return _Outcome.RATE_LIMIT

        status: int = getattr(getattr(exc, 'response', None), 'status_code', 0)
        if status == 429:
            return _Outcome.RATE_LIMIT
        if status in (401, 403):
            return _Outcome.ACCESS_DENIED

        msg: str = str(exc)
        if "API key not valid" in msg or "PERMISSION_DENIED" in msg:
            return _Outcome.ACCESS_DENIED

        return _Outcome.UNKNOWN_ERROR

    async def _pick_config(self) -> LLMConfig:
        """Pick the configuration with the lowest call count.

        Returns:
            The LLM configuration with the lowest count.
        """
        async with self._lock:
            return min(self.llm_configs, key=lambda c: self._call_counts[c.api_key])

    @staticmethod
    def _extract_text(content: str | list[str | dict[str, Any]]) -> str:
        """Extract text from various content formats.

        Args:
            content: Raw content string or list of content blocks.

        Returns:
            The extracted text.
        """
        if isinstance(content, str):
            return content
        if not isinstance(content, list):
            return str(content)

        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
                continue
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))

        return "".join(parts) if parts else str(content)

    async def get_runnable(
            self,
            temperature: float = 0.7,
            model: str | None = None,
            **kwargs: Any
    ) -> Runnable:
        """Get a proxy runnable that routes calls through the rotation pool.

        Args:
            temperature: Sampling temperature.
            model: Model name override.
            **kwargs: Extra parameters for the LLM.

        Returns:
            A RotatingRunnable instance.
        """
        return RotatingRunnable(
            rotating_llm=self,
            temperature=temperature,
            model=model,
            extra_kwargs=kwargs
        )

    async def get_runnable_with_tools(
            self,
            tools: list[Any],
            temperature: float = 0.7,
            model: str | None = None,
            **kwargs: Any
    ) -> Runnable:
        """Get a proxy runnable with tools bound.

        Args:
            tools: List of tools to bind.
            temperature: Sampling temperature.
            model: Model name override.
            **kwargs: Extra parameters for the LLM.

        Returns:
            A bound proxy runnable.
        """
        runnable: Runnable = await self.get_runnable(
            temperature=temperature, model=model, **kwargs
        )
        return runnable.bind_tools(tools)


    @staticmethod
    def strip_code_block(text: str):
        clean_text = re.sub(
            r'^\s*```.*\s*([\s\S]*?)\s*```\s*$',
            r'\1',
            text.strip(),
        ).strip()
        return clean_text

    @staticmethod
    def try_get_json(text: str):
        try:
            return json.loads(RotatingLLM.strip_code_block(text))
        except json.JSONDecodeError:
            return None

    async def send_message_get_json(
            self,
            messages: MessagesType,
            config: dict[str, Any] | None = None,
            retry: int = 3,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs: Any
    ) -> LLMResponse:
        """
        Sends a message to the rotating LLM pool and gets the result with parsed json

        Args:
            messages: Input messages.
            config: LangChain config (e.g. callbacks).
            retry: Number of JSON parsing retries.
            temperature: Temperature for LLM generation
            model: Specific model to use, overriding config
            **llm_kwargs: Extra LLM parameters.

        Returns:
            The LLMResponse with json_data populated if successful.

        Raises:
            RuntimeError: If all retries fail or parsing fails.
        """
        result: LLMResponse | None = None
        for _ in range(retry):
            result = await self.send_message(
                messages, config, temperature=temperature, model=model, **llm_kwargs
            )
            parsed: Any = RotatingLLM.try_get_json(result.text)
            if parsed is not None:
                result.json_data = parsed
                return result

        if result is None:
            raise RuntimeError("Failed to get response from LLM")

        raise RuntimeError(f"Failed to parse JSON from LLM: {result.model_dump_json()}")

    async def send_message(
            self,
            messages: MessagesType,
            config: dict[str, Any] | None = None,
            temperature: float = 0.0,
            model: str | None = None,
            **llm_kwargs: Any
    ) -> LLMResponse:
        """
        Sends a message to the rotating LLM pool and gets the result

        Args:
            messages: Input messages.
            config: ainvoke's config
            temperature: Temperature for LLM generation
            model: Specific model to use, overriding config
            **llm_kwargs: Extra LLM parameters.

        Returns:
            The LLMResponse object.
        """
        msgs: list[BaseMessage] | None = self.format_messages(messages)
        if msgs is None:
            return LLMResponse(text="", model="", status="fail")

        try:
            result, used_config = await self._invoke_core(
                msgs, temperature, model, **llm_kwargs
            )
            text: str = self._extract_text(result.content)
            return LLMResponse(text=text, model=str(used_config), status="ok")

        except Exception as exc:
            logger.error("[RotatingLLM] All retries exhausted: \n%s", traceback.format_exc())
            return LLMResponse(text=str(exc), model="", status="fail")

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

        if get_settings().MINIMAX_API_KEY:
            llm_configs.append(LLMConfig(
                provider="minimax",
                api_key=get_settings().MINIMAX_API_KEY,
                model=get_settings().MINIMAX_TEXT_MODEL
            ))

        return RotatingLLM(llm_configs)

    @staticmethod
    def _format_runnable(runnable: Runnable) -> str:
        api_key = ""
        if isinstance(runnable, ChatGoogleGenerativeAI):
            api_key = str(runnable.google_api_key.get_secret_value())
        elif isinstance(runnable, ChatMinimax):
            api_key = runnable.api_key
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

        # Example with exception
        result3 = await rotating_llm.send_message(
            "Say hello",
            temperature="Error"
        )
        print("With error key:", result3)

        runnable = await rotating_llm.get_runnable()
        result4 = await runnable.ainvoke("Say hello")
        print("With runnable:", result4)


    import sys

    if sys.platform.startswith("win") and sys.version_info < (3, 14):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
