## Historical Context
# MarkGraph Progress Summary (March 15-18, 2026)

## Core Infrastructure (Previous Sessions)
- **UI Versioning & History**: Implemented a Git-like pointer system (HEAD) with a History API (`GET /history`, `POST /rollback`). Frontend now features a history dropdown with rollback support.
- **Inline ID Support**: Adopted a dictionary-map approach for `{#id}` tags to preserve structural integrity (e.g., tables). Parser extracts/strips IDs into an `inline_texts` map for navigation and rendering anchors.
- **Bug Fixes**: Resolved parser issues where tags were re-captured incorrectly. Fixed `apiFetch` JSON headers for POST requests.

## Two-Step UIAgent Architecture (Recent)

### Thoughts & Findings
- **Architectural Decoupling**: Decoupled "Structural Planning" from "MarkGraph Generation". Planning focuses on a high-level linking blueprint rather than syntax, which prevents common "wall of text" failures in complex UIs.
- **Context Necessity**: The planner requires both the current UI state and the design philosophy (visual-first, pedagogical flow) to perform stable modifications.
- **Strict Adherence**: The generator performs better when explicitly forced to follow the planner's Scene IDs and linking schema.

### Progress
- **Planner Prompt**: Created `UI_PLANNER_PROMPT` in `prompts/ui_agent.py` defining "Linking Blueprints", ID mapping for facts, and pedagogical flow rules.
- **Pipeline Implementation**: 
  - Added `plan_and_edit` in `ui_agent.py` that fetches current state and chains the Planner -> Generator.
  - Added "Strict Plan Adherence" constraints to the generator prompt in `ui_agent.py`.
- **Intelligent Routing**: Updated `edit_ui` tool in `tools.py` to only trigger the two-step architecture for complex requests (full rewrite + >5 facts) to balance latency and quality.

## Current Session Context
### Thoughts & Reasoning
- Graphs were "ugly" due to randomly clustered nodes and straight tangled lines that crossed unnecessarily.
- The user wanted to retain `d3-force` for draggability while achieving an untangled initial layout.
- Decided against static `dagre` which breaks interactvity, opting for a custom Sugiyama-lite pre-positioning algorithm.

### Findings & Discoveries
- Standard random-cluster initialization in D3 is the primary cause of line crossing in small-to-medium graphs.
- Top-to-bottom layering combined with barycenter ordering effectively minimizes edge crossings mathematically.

### Progress made so far
- **Sugiyama-lite Algorithm**: Implemented a pure-TS hierarchical layout in `useForceLayout.ts` that handles layer assignment and barycenter sorting.
- **Interactive Handover**: Integrated the Sugiyama positions as the starting point for `d3-force` simulation, ensuring the graph starts untangled but remains draggable.
- **Visual Polish**: Switched edge types in `GraphBlockView.tsx` from `smoothstep` to **Bezier curves** (`default`) for a more organic, premium aesthetic.
- **Physics Tuning**: Adjusted charge, gravity, and collision parameters in `d3-force` for smoother relaxation and better node separation.

### Exact Next Steps to execute
- Verify the layout with complex/circular graphs to ensure Sugiyama-lite handles edge cases.
- Consider propagating this layout utility to `GraphElement.tsx` and `MindMap.tsx`.
- Review performance for large node counts (>50) where layering might require further optimization.
