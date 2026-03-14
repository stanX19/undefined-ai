# MarkGraph Progress Summary (March 14, 2026)

## Current State
The project is a React-based graph visualizer (MarkGraph) with a Python/FastAPI backend using SQLite. Core features (physics-based force graphs, interactive markdown parsing, Gemini-driven UI editing, and tool-use memory) are implemented and stable.

## Progress & Recent Fixes
- **Fixed SQLite Connection Error**: Resolved `sqlite3.OperationalError: unable to open database file` by removing a redundant and problematic volume mount (`- ./backend/database.db:/app/database.db`) in `compose.yml`. Docker was creating the database as a directory on the host when it didn't exist.
- **SQLite Concurrency**: Addressed `database table is locked` errors by enabling **WAL mode**, setting `busy_timeout=30000`, and ensuring LLM calls are executed outside database transactions using scoped sessions.
- **Tool Memory**: Implemented a recursive truncation system for tool results (JSON in DB) to prevent context explosion while maintaining agent recall across turns.
- **UI Editing**: Segmented UI editing allows agents to modify specific MarkGraph sections without re-writing the entire document.

## Findings
- SQLite is sensitive to file-to-file volume mounts in Docker if the files don't pre-exist on the host.
- "Phantom rollbacks" in SQLite were resolved by ensuring shared memory cache parameters are consistent across connection strings.

