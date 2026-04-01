## Historical Context
# MarkGraph Progress Summary (March 15-18, 2026)
### Core Infrastructure & UI
- **UI Versioning**: Implemented Git-like (HEAD) History API (`GET /history`, `POST /rollback`) with frontend support.
- **Inline ID Support**: Dictionary-map for `{#id}` tags; parser strips IDs into `inline_texts` for navigation anchors.
- **Bug Fixes**: Resolved re-capture issues in parser; fixed `apiFetch` POST headers.

### Two-Step UIAgent Architecture
- **Structural Planning**: Decoupled "Structural Planning" from "MarkGraph Generation" to ensure stable modification.
- **Planner Prompt**: Created `UI_PLANNER_PROMPT` in `prompts/ui_agent.py` defining "Linking Blueprints", ID mapping, and pedagogical flow rules.
- **Pipeline Implementation**: Added `plan_and_edit` in `ui_agent.py` for Planner -> Generator chaining.
- **Intelligent Routing**: Updated `edit_ui` tool to use the Two-Step architecture only for complex requests (>5 facts) to balance latency.

### Graph Layout & Visualization
- **Sugiyama-lite Layout**: Solved "cluttered" D3 graphs by implementing a hierarchical pre-positioning algorithm in `useForceLayout.ts` (layering + barycenter ordering).
- **Interactive Simulation**: Integrated Sugiyama positions with `d3-force` to start graphs untangled while maintaining draggability.
- **Visual Polish**: Switched edges in `GraphBlockView.tsx` to Bezier curves for a premium aesthetic; tuned physics parameters (charge, gravity) for separation.

## Current Session Context
### Thoughts & Reasoning
- Identified that LLM-generated MarkGraph often defaults to Mermaid-style arrows (`-->`) and inline vertex definitions (`ID :: Display`), which the existing parser rejected.
- Goal: Modernize the parser to handle these common patterns without breaking the existing Scene Graph IR or downstream renderers.

### Findings & Discoveries
- **Arrow Rigidity**: `RE_GRAPH_EDGE` was hardcoded to 2-character tokens, causing any arrow longer than `->` to fail and emit "Unrecognised graph line" warnings.
- **Greedy Edge Parsing**: The edge regex `(.+?)` was swallowing the `::` delimiter as part of the node ID when definitions were placed inside an edge line.
- **Auto-creation Failures**: This caused the parser to auto-create "bare" nodes where the ID and Display label were identical and cluttered with delimiters.

### Progress made so far
- **Enhanced Regex**: Modernized `RE_GRAPH_EDGE` in `markgraph_parser.py` to support quantifier-based flexible arrow lengths (`--+>`, `<-+`, `<-+>`, `--+`).
- **Normalization Layer**: Added an operator normalization step to convert all arrow variations to canonical IR forms (`->`, `<-`, `--`, `<->`).
- **Inline Vertex Parsing**: Implemented `parse_ref` helper in `parse_graph_block` to correctly split `ID :: Display` and `[ID](#NAV)` within edge strings.
- **ID Registry Sync**: Updated logic to ensure compact edge syntax either registers new vertices or updates existing ones with correct display labels and nav targets.

### Exact Next Steps to execute
- Update `MarkGraph.md` documentation to officially reflect the supported "Compact Syntax" for graph edges.
- Perform a stress test with a complex circular graph to ensure Sugiyama-lite and the new parser logic handle back-edges correctly.
- Review performance for large graphs (>50 nodes) where the new `parse_ref` logic might add non-trivial overhead during the build pass.
