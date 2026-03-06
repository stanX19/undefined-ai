# MarkGraph and Force-Directed Graph Progress Summary

This document summarizes the current state, progress made, and remaining issues from the recent development session on the `MarkGraph` UI renderer and force-directed graph interactions.

## 1. D3 Force Integration via React Flow
- We completely replaced the static layout logic in `GraphBlockView.tsx` with a robust physics-based simulation using the `d3-force` library, managed via the `useForceLayout.ts` hook.
- Added drag-and-drop support: Dragging a node in React Flow now dynamically pins the node (`fx`, `fy`) in the `d3-force` simulation, and releasing it returns the node to the physics engine, creating a natural "springy" interaction.
- Resolved an explosive physics crash by adding initial random jitter (`Math.random() - 0.5`) to new nodes. (Before, multiple nodes placed precisely at `(0,0)` would cause a division by zero in the simulation, generating `NaN` values and crashing the frontend).

## 2. Graph Visual Aesthetics
- Migrated graph nodes to a custom `<NeoNode>` rendering component, shaped like circular Neo4j badges (`w-16 h-16 rounded-full`), rather than the default React Flow rectangles.
- The node text is styled to correctly wrap natively inside the circle (`px-1 break-words leading-tight`).
- The edges are styled to be highly distinct (`strokeWidth: 3`), and the default dot background was removed for a cleaner minimal aesthetic.
- Tweaked `d3-force` parameters: The `charge` repulsion force was reduced from `-1500` to `-400`. The prior high repulsion caused nodes to shoot off the screen at lightspeed every time the physics engine was "re-heated" (`alpha = 0.3`) following a user drag.

## 3. Scene Navigation and AST Parsing
- Fixed scene transitions by replacing standard browser hashtag navigations (`href="#target"`) with our `navigateScene(targetId)` action in `useMarkGraphStore`.
- This ensures interacting with markdown links and graph nodes immediately toggles the active `SceneRenderer` in memory without triggering a full-page refresh that disrupts the AST context.
- We discovered that `ReactMarkdown` was exclusively rendering the raw `element.markdown` string and blindly ignoring the advanced inline constructs (like custom `[[Button]](#target)` components) that `markgraph_parser.py` had painstakingly identified and included in `element.fragments`. 
- Overhauled `MarkGraphRoot.tsx`'s `TextNode` renderer to manually map through `TextNode.fragments`, allowing us to dynamically return interactive `RedirLink` (`<button>` and `<a>`) and `Include` placeholders alongside native markdown parsing.

## 4. Stability and Loop Prevention
- Resolved a critical **Maximum update depth exceeded** crash in `GraphBlockView.tsx`. The issue was caused by an infinite re-render loop between the d3-force simulation and React Flow's state updates. 
- Implemented strict equality checks and used `useMemo` for node/edge arrays to ensure state updates only trigger when coordinates actually change.

## 5. Viewport Intelligence and "Lost Prevention"
- **Auto-Fit**: Integrated `ReactFlowProvider` and the `useReactFlow` hook to trigger an automatic `fitView` once the d3-force simulation has settled (`alpha < 0.1`).
- **Lost Prevention**: Implemented a viewport monitor that detects when all nodes have been panned off-screen. If the user gets "lost" in the infinite canvas, the view smoothly animates back to center the graph.
- **Recenter Control**: Added a manual "Re-center" button in a React Flow `Panel` for quick manual resets.

## 6. Visual and Protocol Refinement
- **Advanced Labeling**: Updated `NeoNode` to show both the unique ID and descriptive text: `(ID) Description`. Added `title` attributes for native browser tooltips and `line-clamp-3` for long identifiers.
- **Edge UI**: Thickened edges (`strokeWidth: 5`) and moved hidden handles to the exact node center (`50%, 50%`). This ensures edges point toward the center and intersect the circle's border perfectly at any angle.
- **Bidirectional Edges**: Updated `markgraph.lark` and the frontend renderer to support the `<->` bidirectional edge operator, including blue markers for both start and end points.
- **Adaptive Physics**: Modified `useForceLayout.ts` to dynamically scale repulsion (`charge`) based on node count—ensuring small graphs stay integrated while large graphs have room to detangle.

## 7. Current State
- The MarkGraph renderer is now highly stable, interactive, and visually polished.
- **Next Steps**: Refine the responsive behavior for mobile viewports and ensure `:::progress` bars correctly track these new graph vertex IDs.

## 8. Partial UI Editing Integration
- **Context**: For extremely large AI-generated MarkGraph UIs, it's inefficient to pass the entire document back and forth to the `UIAgent` for small changes.
- **Parser Enhancements**: Modified `markgraph_parser.py` (specifically augmenting `Scene` and `Container` AST nodes with 1-indexed line numbers) to implement `get_section_range(source, header_name)`. This allows robust extraction of any specific container or scene from the raw markdown string. 
- **Tooling Updates**: Updated the `edit_ui` function in `tools.py` to accept an optional `header_name: str` argument.
- **Agent Focus**: The `UIAgent` now dynamically splices the targeted section out of the document, provides only that fragment to the LLM (with specific prompt rules ensuring it only edits and returns that fragment), and automatically performs string replacement to stitch the modified code back into the full `.mg` document before saving to the database.
- **Bug Fixes**: Handled Python's duck-typing quirks during AST traversal by checking attributes (`hasattr`, `getattr`) instead of strict `isinstance` checks, which bypassed import context issues when running tests. Resolved an issue where indented python strings in tests threw off the markdown parser expecting `#` at the start of a line. Let's remember to strictly dedent multi-line markdown strings!
