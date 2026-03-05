# MarkGraph Grammar v0.2

MarkGraph is a Markdown-based language for authoring interactive, multi-screen UIs. A MarkGraph document describes a **Scene Graph**: a set of named screens (Scenes) connected by navigation links. Only one Scene is visible at a time. Scenes contain layout containers and interactive elements — quizzes, checklists, inputs, progress bars, and node-edge graphs — all wired together through a shared ID system. The output is a fully navigable, reactive UI generated entirely from plain text.

---

## Document Structure

A MarkGraph document is a sequence of **Scenes**. One Scene is visible at a time.

```
document  ::= scene+
scene     ::= H1 attr* child*
child     ::= container | element
container ::= H2..H6 attr* child*
element   ::= fenced_block | redir_button | include | text_node
```

**Heading depth = nesting depth.** A heading becomes a child of the nearest open heading one level above it. H1 closes all containers from the previous scene.

---

## IDs

Every H1–H6 has an id:
- Explicit: `## My Section {#my-id}` → id = `my-id`
- Auto: heading text lowercased, non-alphanumeric → `-`, trimmed → `## My Section` → id = `my-section`
- Collision: first wins, later nodes get `id--2`, `id--3`, etc. (warning, not error)

Non-heading elements use `{#id}` only. No auto-derivation.

---

## Layout Attributes

Appear on the **heading line only**, after heading text.

| Syntax | Effect |
|---|---|
| `@column` | Children flow top-to-bottom *(default)* |
| `@row` | Children flow left-to-right |

No other element accepts `@` attributes.

---

## Interactive Elements

### Redirect Link
```
[Label](#target-id)
```
Navigates to scene `target-id`. Inline when inside a paragraph; block when on its own line.

### Redirect Button
```
[[Label]](#target-id)
```
Same as redirect link, rendered as a button. Always a block element.

### Inline Include
```
![label](#target-id)
```
Injects the subtree of `target-id` at this position as a **live reference** (not a copy).
Valid in root context and inside fenced blocks.
Circular includes halt at the back-edge (warning, not error).

### Special Targets

| Target | Effect |
|---|---|
| `#NOTIFY_AGENT` | Fires an outbound event to the host agent |

`NOTIFY_AGENT` is reserved and cannot be used as a heading id.

---

## Fenced Blocks

Open: `:::block-type` — Close: `:::` on its own line.
Nesting fenced blocks is illegal. `INCLUDE` (`![](#id)`) is valid inside any fenced block.

---

### `:::graph`

Renders a node-edge diagram.

```
graph        ::= (vertex_def | edge)*
vertex_def   ::= vertex_ref "::" display_text
vertex_ref   ::= id
              |  "[" id "]" "(" "#" target_id ")"   ← vertex with nav link
edge         ::= vertex_ref "->" vertex_ref           ← directed
              |  vertex_ref "<-" vertex_ref           ← directed (reversed)
              |  vertex_ref "--" vertex_ref           ← undirected
display_text ::= <text to end of line>
```

- `A :: Label` — vertex with display text
- `[A](#scene) :: Label` — vertex with display text; clicking navigates to `#scene`
- Bare ids in edges with no prior `vertex_def` are auto-created (display = id)
- `[id](#target)` on a `vertex_def` line is a **vertex-with-link**, not a Redirect Link

**Example:**
```
:::graph
[Start](#intro) :: Introduction
B :: Processing
C :: Output
Start -> B
B -- C
C <- Start
:::
```

---

### `:::quiz`

Renders a multiple-choice question. Signal: `0.0` unanswered/wrong, `1.0` correct.

```
quiz        ::= question answer+ explanation?
question    ::= <text> "?"
answer      ::= "-" <text>        ← wrong
             |  "-" <text> "*"    ← correct (exactly one required)
explanation ::= ">" <text>        ← shown after answering (optional)
```

**Example:**
```
:::quiz
What is 2 + 2?
- 3
- 4 *
- 5
> Addition of two identical primes.
:::
```

---

### `:::checkbox`

Renders a checklist. Signal: `checked_count / total_count`.

```
checkbox ::= item+
item     ::= "[ ]" <text>    ← unchecked
          |  "[x]" <text>    ← checked
```

**Example:**
```
:::checkbox
[x] Read the docs
[ ] Write a scene
[ ] Test navigation
:::
```

---

### `:::input`

Renders a free-text field. Signal: `0.0` empty, `1.0` non-empty.

```
input       ::= question placeholder?
question    ::= <text> "?"
placeholder ::= ">" <text>
```

**Example:**
```
:::input
What is your name?
> e.g. Ada Lovelace
:::
```

---

### `:::progress`

Renders a progress bar. Reactive to other element signals.

```
progress       ::= description? value threshold*
description    ::= <text line>
value          ::= "=" float                    ← fixed, e.g. = 0.75
                |  "=" id ("+" id)*             ← reactive, e.g. = q1 + q2 + cb1
float          ::= [0-9]+ ("." [0-9]+)?
threshold      ::= ">" percent "::" threshold_body
percent        ::= [0-9]+ "%"
threshold_body ::= <text> | INCLUDE
```

**Value semantics:**
- `= 0.75` — static, never changes
- `= id-a + id-b` — `mean(signal(id-a), signal(id-b))`, clamped to `[0.0, 1.0]`

**Threshold semantics:** fires once when value first reaches or exceeds the stated percent, evaluated ascending.

**Example:**
```
:::progress
Quiz completion
= q1 + q2 + q3
> 33%:: Keep going!
> 66%:: Almost there!
> 100%:: ![done](#NOTIFY_AGENT)
:::
```

---

## Signal Reference

| Block | Signal |
|---|---|
| `:::quiz` | `0.0` unanswered or wrong / `1.0` correct |
| `:::checkbox` | `checked / total` |
| `:::input` | `0.0` empty / `1.0` non-empty |
| `:::progress` | its computed value |

---

## Text Nodes

Any line not matching a heading, fenced block, or standalone interactive element is a **text node** rendered as CommonMark Markdown. Inline redirect links and includes within paragraphs are parsed inline. CommonMark escaping (`\[`, `\*`, `\:`, etc.) applies everywhere.

---

## Complete Example

```
# Home @column
## header @row
[[Docs]](#docs) [[Quiz]](#quiz)

Welcome to **MarkGraph**.

# Docs @column
## concept-map
:::graph
[Scenes](#home) :: Scenes
Containers :: Containers
Elements :: Elements
Scenes -> Containers
Containers -> Elements
:::

[[Back]](#home) [[Take Quiz]](#quiz)

# Quiz @column
## q1
:::quiz
How many scenes can be visible at once?
- Many
- One *
- None
> Only one scene is active at a time.
:::

## q2
:::checkbox
[ ] I understand scenes
[ ] I understand containers
[ ] I understand fenced blocks
:::

## score @column
:::progress
Your progress
= q1 + q2
> 50%:: Halfway!
> 100%:: ![All done](#NOTIFY_AGENT)
:::

[[Back to Docs]](#docs)
```
