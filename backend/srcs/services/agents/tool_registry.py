"""Registry-based metadata for agent tools."""
from typing import Any, Callable


class ToolRegistry:
    """Central registry to track tool metadata without modifying the functions.
    
    This avoids issues with metadata getting lost when tools are wrapped by LangChain 
    or other decorators.
    """
    
    # Structure: {tool_name: {"log_replacement": "text", ...}}
    _metadata: dict[str, dict[str, Any]] = {}

    @classmethod
    def register_metadata(cls, func_name: str, key: str, value: Any):
        if func_name not in cls._metadata:
            cls._metadata[func_name] = {}
        cls._metadata[func_name][key] = value

    @classmethod
    def get_metadata(cls, tool_name: str, key: str, default: Any = None) -> Any:
        return cls._metadata.get(tool_name, {}).get(key, default)

    @staticmethod
    def get_log_replacement(tool_name: str, default: str = "") -> str:
        return ToolRegistry.get_metadata(tool_name, "log_replacement", default)

class ToolDecorator:
    @staticmethod
    def replace_log_memory(replacement_text: str):
        """Decorator that registers a replacement string for a tool's log output.
        
        Usage:
            @ToolRegistry.replace_log_memory("Success")
            @tool
            def my_tool(...): ...
        """
        def _decorator(func: Callable) -> Callable:
            # Register by function name
            ToolRegistry.register_metadata(func.__name__, "log_replacement", replacement_text)
            # Return function unchanged
            return func
        return _decorator