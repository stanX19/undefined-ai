from langchain_core.tools import tool

@tool
def toggle_ui(enabled: bool) -> str:
    """Toggle the UI visibility.

    Args:
        enabled: ``True`` to show the UI, ``False`` to hide it.

    Returns:
        A confirmation string.
    """
    return "Success"
