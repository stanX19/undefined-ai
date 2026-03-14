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
