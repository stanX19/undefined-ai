# MarkGraph Progress Summary (March 15, 2026)

## Current State
React visualizer with Python/FastAPI. The UI versioning system is fully implemented and interactive.
- **UI Versioning Support**: Robust Git-like pointer system on `Topic` (HEAD).
- **History API**: Endpoints now exist to list all historical scenes (`GET /history`) and trigger instant rollbacks (`POST /rollback`).
- **Frontend History**: A "History" button is placed in the Workspace top bar (beside "Share"). It toggles a dropdown listing previous versions with auto-extracted titles (headings) and timestamps.
- **Rollback Functionality**: Selecting a version from history instantly updates the MarkGraph UI to that state.

## Recent Changes
- **Backend API**: Added `UIHistoryItem`, `UIHistoryResponse`, and `RollbackRequest` DTOs.
- **UI Service**: Implemented `get_history` with regex-based heading extraction for scene descriptions.
- **Frontend Store**: Added `fetchHistory` and `rollbackVersion` actions to `useMarkGraphStore`. Fixed `apiFetch` missing `Content-Type: application/json` for POST requests.
- **Workspace UI**: Added `History` icon-button, dropdown menu, and click-away listeners in `WorkspacePage.tsx`.

## Inline ID Support (March 17, 2026)

### Thoughts & Findings
- **Structural Integrity**: Fragmentation of `TextNode` into multiple fragments was rejected because it breaks sensitive Markdown structures (e.g., tables, lists). 
- **Data-Mapping Approach**: We adopted a "dictionary map" approach where `{#id}` is stripped from the text and stored in a node-level map (`inline_texts`) associated with the preceding text chunk.
- **Parser Bug fix**: Fixed a critical bug in `markgraph_parser.py` where a missing `last_end` update caused tags to be re-captured in subsequent fragments and displayed in the UI.

### Progress
- **Backend Parser**: `markgraph_parser.py` now extracts and strips `{#id}` tags, populating an `inline_texts` dict and registering them in the global `id_map`.
- **Frontend Types**: Updated `types.ts` to include `inline_texts` in the `TextNode` AST.
- **Navigation**: Updated `useMarkGraphStore`'s `navigateScene` to resolve inline IDs by checking the node-level maps.
- **Rendering**: `MarkGraphRoot.tsx` now renders invisible `<span>` anchors for all inline IDs, allowing `scrollIntoView` to target the correct block even though the tags are hidden.

### Next Steps
- **Granular Highlighting**: Leverage the `inline_texts` map (which stores the original text) to implement visual highlighting of assigned text segments.
- **Edge Cases**: Verify behavior when IDs are placed inside code fences or at the very start of a text node.
