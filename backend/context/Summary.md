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

## 4. Pending / Next Steps
- **Critical Bug during handoff:** The graph disappeared immediately after applying `useNodesState` and `useEdgesState`. The root cause is `animatedNodes` starts empty during the first cycle. When `useEffect` triggers, `nds` (the internal React Flow node state) maps over an empty array and never populates the graph! 
- *Fix included below but should be verified in next chat: `useEffect` should assign the array wholesale on first successful tick if `nds` is empty.*
- Needs thorough testing on other interactive fields (checkboxes, inputs) to ensure they integrate seamlessly with `markgraph_parser.py` reactive signals.
