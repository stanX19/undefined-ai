# MarkGraph Progress Summary (March 14, 2026)

## Current State
React-based visualizer with Python/FastAPI backend & SQLite. System is stable.
- **SQLite Concurrency**: WAL mode and 30s timeouts resolved `database table is locked`.
- **Docker Fixes**: Volume mount issues resolved (host file creation vs. directory).

## Progress & Recent Fixes (Chat & Ingestion)
- **ID Persistence**: Fixed `ShortIdMapper` state loss across turns. The `rehydrate` method now scans chat history to recover `Short-ID → UUID` mappings, ensuring tools like `retrieve_facts` work for historical results.
- **Context Injection**: Correctly passing `base_info` (current topic ID, UI state, and knowledge levels) to the chatbot agent. The agent is now aware of its topic and document status even when full context is omitted.
- **Enhanced Logging**: Added robust `[CHATBOT]` logging to `chatbot.py`. All tool calls, results (truncated), and final AI responses are now visible in the backend logs for easier debugging.
- **Memory Management**: Recursive truncation for tool results in DB prevents context explosion.

## Findings
- `ShortIdMapper` must be re-hydrated from history at the start of every `ChatService` run to maintain ID resolution consistency.
- Gemini ReAct agent requires explicit topic/UI state in the system context to proactively interact with the document.

## Next Steps (Roadmap)
- **UI Robustness**: Fix table parsing where buttons inside tables break the layout; convert to standard links inside detected table rows.
- **UX Improvements**: Implement custom frontend confirmation dialogs to replace browser default `yes/no` prompts.
- **Verification**: Ensure multi-turn fact drill-down (F0 -> F1 -> Source) remains stable with rehydration.
