# MarkGraph Progress Summary

This document summarizes the current state, progress made, and remaining issues from the recent development session on the Undefined AI MarkGraph project.

## 1. D3 Force Integration via React Flow
- Replaced static layout in `GraphBlockView.tsx` with robust physics-based `d3-force` simulation.
- Added drag-and-drop support: nodes dynamically pin for natural "springy" interaction.
- Resolved physics crash by adding initial random jitter to prevent division by zero.

## 2. Graph Visual Aesthetics
- Migrated graph nodes to a circular `<NeoNode>` resembling Neo4j badges.
- Standardized text wrapping and removed default dot background.
- Reduced `d3-force` repulsion `charge` from `-1500` to `-400` for stability.

## 3. Scene Navigation and AST Parsing
- Fixed scene transitions by adopting `navigateScene(targetId)` instead of hash navigation.
- Overhauled `MarkGraphRoot.tsx` to map `TextNode.fragments`, enabling interactive elements within markdown.

## 4. Stability and Loop Prevention
- Resolved critical infinite re-render loop inside `GraphBlockView.tsx`.
- Used `useMemo` and strict equality checks to trigger updates only when coordinates change.

## 5. Viewport Intelligence and "Lost Prevention"
- **Auto-Fit**: Automatically calls `fitView` once simulation settles.
- **Lost Prevention**: Re-centers graph if panned off-screen, with a manual reset button.

## 6. Visual and Protocol Refinement
- **Advanced Labeling**: `NeoNode` shows `(ID) Description`, integrated tooltips, and centered thickened edges.
- **Bidirectional Edges**: Added `<->` support and scaled physics dynamically by node count.

## 7. Current State
- The MarkGraph renderer is visually polished, interactive, and stable.
- **Next Steps**: Refine mobile responsiveness and track vertex IDs via `:::progress`.

## 8. Partial UI Editing Integration
- **Context**: Bypassed inefficiency of passing large UIs back and forth to agents.
- **Parser Updates**: Introduced `get_section_range` and updated `edit_ui` to target specific headers.
- **Agent Focus**: `UIAgent` edits segmented fragments and automatically stitches them back.
- **Bug Fixes**: Handled AST import duck-typing quirks and adjusted multi-line markdown strings.

## 9. Backend Stability & Authentication Refactor
- **Phantom Rollback Bug**: Fixed SQLite in-memory ghost rollbacks via shared memory cache parameterization.
- **Centralized Auth**: Transitioned entirely to `X-User-Id` header-based dependency (`get_current_user`).
- **Frontend Sync**: Updated `authStore` to uniformly inject headers into all requests.

## 10. Agent UI Prompt Refinement
- **UI Prompts**: Promoted graph-centric UI, structured `# scenes` utilization (Overview, Flow, Quiz), and prevented AI from generating raw layout primitives natively.

## 11. Topic Management & Auto-Summarization
- **Topic Control**: Added secure `DELETE /api/v1/topics/{topic_id}` endpoint.
- **Auto-Summarization**: Service generates dynamic titles at intervals with real-time SSE propagation.

## 12. End-to-End Authentication & Safety Hardening
- **Test Suite**: Synchronized backend tests with auth requirements, resolving `401` blocks.
- **Fail-safes**: Handled missing search API keys securely via `WebSearchNotAvailableException` and mapped proper user onboarding flows.

## 13. SSE Real-Time Sync & UI Updates
- **Automatic Renaming**: Topics sidebar updates immediately upon SSE event triggers.
- **Ingestion Tracking**: Exposed file processing stages to chat logs to improve visibility.

## 14. Sidebar UI Polish
- **Dynamic Identity**: Sidebar dynamically references `userAuthStore` credentials instead of hardcoded stubs.

## 15. Tool Memory Architecture (Latest Update)
- **Goal**: Allow the LangGraph `chatbot` agent to remember its previous tool calls and their results across conversation turns without permanently bloating the context window or exposing JSON logs to the frontend UI.
- **Backend Architecture**: 
  - Stored `tool_call` and `tool_result` roles inside existing `ChatMessage.message` Text columns as JSON payloads.
  - Created `ChatService.get_chat_history()` to exclusively fetch standard `user` and `assistant` messages for the frontend API.
  - Created `ChatService.get_history_for_chatbot()` to fetch the full context, including JSON-persisted tool execution data, for the LLM.
- **Truncation System**: Implemented rigorous recursive truncation (`_truncate_dict`, `_truncate_text` bounded to max lengths of ~500 chars) to cleanly shrink large inputs (like `edit_ui` descriptions) and returns before saving to the database. This significantly prevents context explosion while still providing sufficient recall to the agent.

## 16. UI State Awareness & Registry-based Memory Cleaning
- **Problem**: The main chatbot was "blind" to UI changes made mid-turn via `edit_ui`, and permanently storing large UI states in history led to context bloat.
- **Solution (Option 6)**: Implemented a robust "Immediate Injection + Memory Cleaning" mechanism.
  - **tool_registry.py**: Introduced a central metadata registry to track tool behaviors (e.g., replacement text for logs) without polluting LangChain's tool wrapping logic.
  - **Immediate Awareness**: `edit_ui` now returns the full updated MarkGraph markdown to the LLM for immediate mid-turn grounding.
  - **Memory Cleaning**: `ChatService._persist_agent_memory` intercepts tool results registered in `ToolRegistry` and replaces raw markdown with concise summaries (e.g., `[UI Updated Successfully]`) before DB persistence.
  - **Across-turn Sync**: Initial state still "Pulls" the latest UI from the database at the start of every message turn, ensuring the agent always starts with the source of truth.
- **Status**: Completed and verified.
