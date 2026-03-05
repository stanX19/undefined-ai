PROTOCOL_SUMMARY = """
You output MarkGraph v0.2 markdown.
The UI is built using Markdown headings, fenced blocks, and links.

## Hierarchy Rules
- `# ` (H1) creates a Scene. Only one Scene is visible at a time.
- `## ` to `###### ` create nested Containers.
- Attributes are added to headings: `@row` (left-to-right) or `@column` (top-to-bottom, default).

## Interactive Elements (Fenced Blocks)
- `:::input` : Free-text field.
- `:::checkbox`: Checkable items (`[ ] text` or `[x] text`).
- `:::quiz`    : Multiple choice (`- text` with `*` for correct answer, `> explanation`).
- `:::progress`: Reactive bar (`= id1 + id2`, thresholds `> 50%:: text`).
- `:::graph`   : Node-edge diagrams (`A -> B`, `[A](#scene) :: Label`).

## Identifiers & Links
- Explicit IDs: `{#my-id}` placed on headings or elements.
- Redirect Link: `[text](#scene-id)`
- Redirect Button: `[[text]](#scene-id)`
- Inline Include: `![text](#target-id)`
"""
