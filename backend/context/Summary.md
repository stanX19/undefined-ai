# MarkGraph Refactoring Summary

## Overview
We have successfully replaced the old A2UI protocol with the MarkGraph protocol across both the backend and frontend. The system now uses deterministic, markdown-based parsing to generate graphical UIs instead of relying on tool calling and JSON trees.

## Backend Changes
- **Database Models**: Updated `Scene` model (`srcs/models/scene.py`) to store the raw MarkGraph string as `ui_markdown` instead of `ui_json`.
- **UI Agent Refactoring**: 
  - Completely rewrote the `UIAgent` prompt and logic to generate a full MarkGraph markdown document in one single LLM pass.
  - Removed A2UI-specific tool calling.
  - Implemented a retry loop that compiles the LLM output with `markgraph_parser.py`. If syntax errors exist, they are fed back into the agent for correction.
- **Service Layer**: 
  - Updated `UIService` to persist markdown. 
  - Updated the `/api/v1/ui/` REST endpoint (`srcs/routes/ui.py`) to fetch the stored `ui_markdown` and compile it into an AST before sending to the frontend.
- **Streaming Context**: Injected the current UI state (`ui_markdown`) into the main Chatbot context (`chat_service.py`), allowing it to refer to the current UI during conversations.
- **SSE Push Updates**: `edit_ui` tool in `tools.py` now broadcasts the compiled `ui_json` and original `ui_markdown` to the frontend `UIUpdate` event stream.

## Frontend Changes
- **New Types & Store**: Created `src/features/markgraph/types.ts` to map AST structures and a Zustand store `store.ts` to hold AST data and process reactive updates (e.g. check boxes, answering quizzes).
- **Physics Layout**: Implemented a custom 2D force-directed layout engine (`useForceLayout.ts`) to make nodes repel each other.
- **MarkGraph Rendering**: Wrote `MarkGraphRoot.tsx` to handle the recursive container rendering and node positioning.
- **Block Components**: Built custom React components for MarkGraph functionality:
  - `CheckboxBlockView`
  - `QuizBlockView`
  - `InputBlockView`
  - `ProgressBlockView` (handles reactive evaluations like `= my-quiz + my-checkbox`)
  - `GraphBlockView` (utilizing `@xyflow/react` for connected node diagrams)
- **Integration**: Updated `WorkspacePage.tsx` to conditionally render `MarkGraphRoot` when MarkGraph AST data is present, otherwise falling back to `UIRoot` to keep old tests working. Updated `useChat.ts` to parse the new SSE payloads into the MarkGraph store.

## Current Bug & Next Steps
- **Issue**: There is a bug when starting a new conversation and generating a new topic. It results in a SQLAlchemy trace: `InvalidRequestError: Could not refresh instance '<Topic at ...>'` during `TopicService.create_topic()`.
- **Cause Analysis**: This is likely related to SQLAlchemy's `AsyncSession`, specifically the `await db.refresh(topic)` call executing after `db.commit()` in SQLite without active transaction bounds, or the SQLite async dialect interaction with the instance lifecycle.
- **Next Steps**: Address the SQLAlchemy `refresh` failure in `TopicService.create_topic()`, and ensure seamless end-to-end creation of new scenes with the MarkGraph renderer attached.
