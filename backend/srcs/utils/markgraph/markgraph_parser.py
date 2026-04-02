"""
MarkGraph Parser v0.2
=====================
Three-pass compiler: Tokenise → Parse → Resolve

Usage:
    from markgraph_parser import compile_markgraph

    with open("my_ui.md") as f:
        result = compile_markgraph(f.read())

    print(result.scenes)       # Scene Graph IR
    print(result.warnings)     # non-fatal issues
    print(result.errors)       # fatal issues per scene
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# IR  (Scene Graph nodes)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Diagnostic:
    level: str          # "warning" | "error"
    message: str
    line: int = 0

@dataclass
class Attr:
    name: str           # e.g. "row", "column"

@dataclass
class RedirLink:
    label: str
    target: str
    kind: str = "link"  # "link" | "button"

@dataclass
class Include:
    label: str
    target: str

@dataclass
class TextNode:
    markdown: str
    explicit_id: str | None = None
    fragments: list[Any] = field(default_factory=list)
    inline_texts: dict[str, str] = field(default_factory=dict)

@dataclass
class GraphVertex:
    id: str
    display: str
    nav_target: str | None = None   # #target-id if vertex has nav link

@dataclass
class GraphEdge:
    src: str
    op: str             # "->" | "<-" | "--"
    dst: str

@dataclass
class GraphBlock:
    vertices: list[GraphVertex] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)
    explicit_id: str | None = None

@dataclass
class QuizBlock:
    question: str
    answers: list[tuple[str, bool]] = field(default_factory=list)  # (text, is_correct)
    explanation: str | None = None
    explicit_id: str | None = None
    user_answer_idx: int | None = None

@dataclass
class CheckboxBlock:
    items: list[tuple[bool, str]] = field(default_factory=list)    # (checked, text)
    explicit_id: str | None = None

@dataclass
class InputBlock:
    question: str
    placeholder: str | None = None
    explicit_id: str | None = None
    user_text: str = ""

@dataclass
class ThresholdBody:
    text: str | None = None
    include: Include | None = None

@dataclass
class Threshold:
    percent: float
    body: ThresholdBody

@dataclass
class ProgressBlock:
    description: str | None = None
    value_fixed: float | None = None
    value_ids: list[str] = field(default_factory=list)
    thresholds: list[Threshold] = field(default_factory=list)
    explicit_id: str | None = None

Element = RedirLink | Include | TextNode | GraphBlock | QuizBlock | CheckboxBlock | InputBlock | ProgressBlock

@dataclass
class Container:
    id: str
    depth: int
    attrs: list[Attr]
    children: list[Any] = field(default_factory=list)   # Container | Element
    raw_heading: str = ""
    line: int = 0

@dataclass
class Scene:
    id: str
    attrs: list[Attr]
    children: list[Any] = field(default_factory=list)   # Container | Element
    raw_heading: str = ""
    line: int = 0

@dataclass
class CompileResult:
    scenes: list[Scene]
    warnings: list[Diagnostic]
    errors: list[Diagnostic]
    id_map: dict[str, Any] = field(default_factory=dict)

# ─────────────────────────────────────────────────────────────────────────────
# Regex patterns
# ─────────────────────────────────────────────────────────────────────────────

RE_SCENE        = re.compile(r'^#\s+(.+)$')
RE_CONTAINER    = re.compile(r'^(#{2,6})\s+(.+)$')
RE_ATTR         = re.compile(r'@([a-z][a-z0-9_-]*)')
RE_EXPLICIT_ID  = re.compile(r'\{#([a-z0-9][a-z0-9_-]*)\}')
RE_BUTTON       = re.compile(r'^(?:\[\[([^\]]+)\]\]\(#([^)]+)\)|\[\[([^\]]+)\]\(#([^)]+)\)\])\s*$')
RE_INCLUDE_ONLY = re.compile(r'^!\[([^\]]*)\]\(#([^)]+)\)\s*$')
RE_FENCE_OPEN   = re.compile(r'^:::([a-z]+)\s*$')
RE_FENCE_CLOSE  = re.compile(r'^:::\s*$')
RE_HR           = re.compile(r'^[-=]{3,}\s*$')
RE_TABLE_ROW    = re.compile(r'^\s*\|.*\|\s*$')

# inline patterns (used inside text / threshold bodies)
RE_INLINE_INCLUDE = re.compile(r'!\[([^\]]*)\]\(#([^)]+)\)')
RE_INLINE_BUTTON  = re.compile(r'(?:\[\[([^\]]+)\]\]\(#([^)]+)\)|\[\[([^\]]+)\]\(#([^)]+)\)\])')

RE_INLINE = re.compile(
    r'(?P<button>\[\[(?P<btn_label>[^\]]+)\]\]\(#(?P<btn_target>[^)]+)\))|'
    r'(?P<button2>\[\[(?P<btn2_label>[^\]]+)\]\(#(?P<btn2_target>[^)]+)\)\])|'
    r'(?P<include>!\[(?P<inc_label>[^\]]*)\]\(#(?P<inc_target>[^)]+)\))|'
    r'(?P<link>(?<!\[)\[(?P<lnk_label>[^\]]+)\]\(#(?P<lnk_target>[^)]+)\))|'
    r'(?P<inline_id>\{#(?P<iid>[a-z0-9][a-z0-9_-]*)\})'
)

def parse_inline(text: str) -> tuple[list[Any], dict[str, str]]:
    fragments = []
    inline_texts: dict[str, str] = {}
    last_end = 0
    current_string = ""

    for m in RE_INLINE.finditer(text):
        start, end = m.span()
        
        if start > last_end:
            current_string += text[last_end:start]
        
        if m.group('inline_id'):
            # It's an inline id tag like {#foo}. 
            # We map whatever is currently in our accumulated string buffer to this ID.
            # (In a more complex implementation, we might split by words, but grabbing all preceding accumulated text in this fragment is a safe superset).
            iid = m.group('iid')
            if current_string:
                inline_texts[iid] = current_string.strip()
            else:
                inline_texts[iid] = "" # fallback if it's the very first token
            # We DO NOT append the {#id} to the current_string. It is silently consumed.
            last_end = end
            continue
            
        # Check if we are inside a table
        line_start = text.rfind('\n', 0, start) + 1
        line_end = text.find('\n', end)
        if line_end == -1:
            line_end = len(text)
        current_line = text[line_start:line_end]
        is_table = RE_TABLE_ROW.search(current_line) is not None

        if is_table:
            if m.group('button') or m.group('button2'):
                lbl = m.group('btn_label') or m.group('btn2_label')
                target = m.group('btn_target') or m.group('btn2_target')
                current_string += f"[{lbl}](#{target})"
            else:
                current_string += m.group(0)
        else:
            if current_string:
                fragments.append(current_string)
                current_string = ""
            
            if m.group('button'):
                fragments.append(RedirLink(label=m.group('btn_label'), target=m.group('btn_target'), kind='button'))
            elif m.group('button2'):
                fragments.append(RedirLink(label=m.group('btn2_label'), target=m.group('btn2_target'), kind='button'))
            elif m.group('include'):
                fragments.append(Include(label=m.group('inc_label'), target=m.group('inc_target')))
            elif m.group('link'):
                fragments.append(RedirLink(label=m.group('lnk_label'), target=m.group('lnk_target'), kind='link'))
            
        last_end = end
        
    if last_end < len(text):
        current_string += text[last_end:]
        
    if current_string:
        fragments.append(current_string)
        
    return fragments, inline_texts

# block sub-parsers
RE_GRAPH_VERTEX_DEF  = re.compile(r'^\[([^\]]+)\]\(#([^)]+)\)\s*::\s*(.+)$')  # [id](#nav) :: text
RE_GRAPH_VERTEX_BARE = re.compile(r'^([A-Za-z0-9_-]+)\s*::\s*(.+)$')           # id :: text
RE_GRAPH_EDGE        = re.compile(r'^(.+?)\s*(<-+>|<-+|-+>|--+)\s*(.+)$')  # flexible arrow lengths, normalized in parse_graph_block

RE_QUIZ_ANSWER       = re.compile(r'^-\s+(.+?)(\s+\*)?\s*$')
RE_QUIZ_EXPL         = re.compile(r'^>\s+(.+)$')

RE_CHECKBOX_ITEM     = re.compile(r'^\[(x| )\]\s+(.+)$')

RE_INPUT_PLACEHOLDER = re.compile(r'^>\s+(.+)$')

RE_PROGRESS_VALUE_FIXED    = re.compile(r'^=\s*([0-9]+(?:\.[0-9]+)?)\s*$')
RE_PROGRESS_VALUE_REACTIVE = re.compile(r'^=\s*([a-z][a-z0-9_-]*(?:\s*\+\s*[a-z][a-z0-9_-]*)*)\s*$')
RE_PROGRESS_THRESHOLD      = re.compile(r'^>\s*([0-9]+)%\s*::\s*(.+)$')

RESERVED_IDS = {"NOTIFY_AGENT"}

# ─────────────────────────────────────────────────────────────────────────────
# Pass 1 — Tokeniser
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Token:
    kind: str
    value: str
    line: int
    meta: dict = field(default_factory=dict)   # parsed sub-fields

def tokenise(source: str) -> tuple[list[Token], list[Diagnostic]]:
    tokens: list[Token] = []
    diags: list[Diagnostic] = []
    lines = source.splitlines()

    # Lexer contexts
    CTX_ROOT   = "root"
    CTX_FENCED = "fenced"

    ctx          = CTX_ROOT
    block_type   = None
    block_lines: list[str] = []
    block_start  = 0

    def flush_block(end_line: int):
        nonlocal ctx, block_type, block_lines
        tokens.append(Token(
            kind=f"BLOCK_{block_type.upper()}",
            value="\n".join(block_lines),
            line=block_start,
            meta={"type": block_type, "lines": list(block_lines)}
        ))
        block_lines = []
        block_type  = None
        ctx         = CTX_ROOT

    for lineno, raw in enumerate(lines, start=1):
        line = raw.rstrip()

        # ── Fenced context ────────────────────────────────────────────────────
        if ctx == CTX_FENCED:
            if RE_FENCE_CLOSE.match(line):
                flush_block(lineno)
            elif RE_FENCE_OPEN.match(line):
                # Illegal nested fence — treat as text, emit error
                diags.append(Diagnostic("error",
                    f"Nested fenced block ':::' inside ':::{block_type}' is illegal — treated as text",
                    lineno))
                block_lines.append(line)
            else:
                block_lines.append(line)
            continue

        # ── Root context ──────────────────────────────────────────────────────

        if not line or RE_HR.match(line):
            tokens.append(Token("HR", line, lineno))
            continue

        m = RE_FENCE_OPEN.match(line)
        if m:
            ctx         = CTX_FENCED
            block_type  = m.group(1)
            block_start = lineno
            block_lines = []
            continue

        m = RE_SCENE.match(line)
        if m:
            tokens.append(Token("SCENE", line, lineno, {"heading_text": m.group(1)}))
            continue

        m = RE_CONTAINER.match(line)
        if m:
            tokens.append(Token("CONTAINER", line, lineno,
                                {"depth": len(m.group(1)), "heading_text": m.group(2)}))
            continue

        tokens.append(Token("TEXT", line, lineno))

    if ctx == CTX_FENCED:
        diags.append(Diagnostic("error",
            f"Unclosed ':::{block_type}' block starting at line {block_start}",
            block_start))

    return tokens, diags

# ─────────────────────────────────────────────────────────────────────────────
# Block sub-parsers
# ─────────────────────────────────────────────────────────────────────────────

def _derive_id(text: str) -> str:
    """Auto-derive an id from heading text (strip attrs and explicit ids first)."""
    text = RE_ATTR.sub("", text)
    text = RE_EXPLICIT_ID.sub("", text)
    text = text.strip().lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-') or "unnamed"

def _parse_heading_meta(heading_text: str) -> tuple[str, list[Attr], str | None]:
    """Returns (clean_text, attrs, explicit_id_or_None)."""
    attrs = [Attr(name=m) for m in RE_ATTR.findall(heading_text)]
    eid_m = RE_EXPLICIT_ID.search(heading_text)
    explicit_id = eid_m.group(1) if eid_m else None
    clean = RE_ATTR.sub("", heading_text)
    clean = RE_EXPLICIT_ID.sub("", clean).strip()
    return clean, attrs, explicit_id

def parse_graph_block(block_lines: list[str], lineno: int, diags: list[Diagnostic]) -> GraphBlock:
    vertices: dict[str, GraphVertex] = {}
    edges: list[GraphEdge] = []

    for i, line in enumerate(block_lines):
        line = line.strip()
        if not line:
            continue

        m = RE_GRAPH_VERTEX_DEF.match(line)
        if m:
            vid, nav, display = m.group(1), m.group(2), m.group(3)
            vertices[vid] = GraphVertex(id=vid, display=display.strip(), nav_target=nav)
            continue

        m = RE_GRAPH_VERTEX_BARE.match(line)
        if m:
            vid, display = m.group(1), m.group(2)
            vertices[vid] = GraphVertex(id=vid, display=display.strip())
            continue

        m = RE_GRAPH_EDGE.match(line)
        if m:
            src_raw, raw_op, dst_raw = m.group(1).strip(), m.group(2), m.group(3).strip()
            
            # Normalize to canonical arrows: -> | <- | -- | <->
            if '<' in raw_op and '>' in raw_op:
                op = "<->"
            elif '<' in raw_op:
                op = "<-"
            elif '>' in raw_op:
                op = "->"
            else:
                op = "--"
            
            # Helper to parse vertex reference (e.g. "[id](#nav) :: text" or "id :: text")
            def parse_ref(ref: str) -> tuple[str, str | None, str | None]:
                display_text = None
                nav_target    = None
                
                # 1. Handle :: delimiter for display text
                if "::" in ref:
                    ref, display_text = [p.strip() for p in ref.split("::", 1)]
                
                # 2. Handle [id](#nav) for navigation links
                # We reuse the same logic as the main vertex patterns but on the extracted ref
                m_nav = re.match(r'^\[([^\]]+)\]\(#([^)]+)\)$', ref)
                if m_nav:
                    return m_nav.group(1), display_text, m_nav.group(2)
                
                return ref, display_text, None

            src_id, src_disp, src_nav = parse_ref(src_raw)
            dst_id, dst_disp, dst_nav = parse_ref(dst_raw)

            # auto-create/update implicit vertices
            for vid, vdisp, vnav in [(src_id, src_disp, src_nav), (dst_id, dst_disp, dst_nav)]:
                if vid not in vertices:
                    vertices[vid] = GraphVertex(id=vid, display=vdisp or vid, nav_target=vnav)
                else:
                    # Update existing vertices if compact syntax provides more details
                    if vdisp: vertices[vid].display = vdisp
                    if vnav:  vertices[vid].nav_target = vnav
            
            edges.append(GraphEdge(src=src_id, op=op, dst=dst_id))
            continue

        diags.append(Diagnostic("warning",
            f"Unrecognised graph line (ignored): '{line}'", lineno + i))

    return GraphBlock(vertices=list(vertices.values()), edges=edges)

def parse_quiz_block(block_lines: list[str], lineno: int, diags: list[Diagnostic]) -> QuizBlock | None:
    if not block_lines:
        diags.append(Diagnostic("error", "Empty :::quiz block", lineno))
        return None

    question_text = ""
    answers: list[tuple[str, bool]] = []
    explanation = None
    state = "question"

    for i, line in enumerate(block_lines):
        line = line.rstrip()
        if not line:
            continue

        if state == "question":
            if not line.endswith("?"):
                diags.append(Diagnostic("warning",
                    f"Quiz question should end with '?': '{line}'", lineno + i))
            question_text = line
            state = "answers"
            continue

        if state in ("answers", "explanation"):
            m = RE_QUIZ_ANSWER.match(line)
            if m:
                state = "answers"
                text    = m.group(1).strip()
                correct = m.group(2) is not None
                answers.append((text, correct))
                continue

            m = RE_QUIZ_EXPL.match(line)
            if m:
                explanation = m.group(1)
                state = "explanation"
                continue

            diags.append(Diagnostic("warning",
                f"Unexpected quiz line (ignored): '{line}'", lineno + i))

    correct_count = sum(1 for _, c in answers if c)
    if correct_count == 0:
        diags.append(Diagnostic("error",
            f"Quiz has no correct answer (mark one with trailing ' *')", lineno))
    elif correct_count > 1:
        diags.append(Diagnostic("warning",
            f"Quiz has {correct_count} correct answers; only the first will be used", lineno))

    return QuizBlock(question=question_text, answers=answers, explanation=explanation)

def parse_checkbox_block(block_lines: list[str], lineno: int, diags: list[Diagnostic]) -> CheckboxBlock | None:
    items: list[tuple[bool, str]] = []
    for i, line in enumerate(block_lines):
        line = line.rstrip()
        if not line:
            continue
        m = RE_CHECKBOX_ITEM.match(line)
        if m:
            checked = m.group(1) == "x"
            items.append((checked, m.group(2).strip()))
        else:
            diags.append(Diagnostic("warning",
                f"Unrecognised checkbox line (ignored): '{line}'", lineno + i))
    if not items:
        diags.append(Diagnostic("error", "Empty :::checkbox block", lineno))
        return None
    return CheckboxBlock(items=items)

def parse_input_block(block_lines: list[str], lineno: int, diags: list[Diagnostic]) -> InputBlock | None:
    question = None
    placeholder = None
    for i, line in enumerate(block_lines):
        line = line.rstrip()
        if not line:
            continue
        if question is None:
            if not line.endswith("?"):
                diags.append(Diagnostic("warning",
                    f"Input question should end with '?': '{line}'", lineno + i))
            question = line
            continue
        m = RE_INPUT_PLACEHOLDER.match(line)
        if m:
            placeholder = m.group(1)
        else:
            diags.append(Diagnostic("warning",
                f"Unrecognised input line (ignored): '{line}'", lineno + i))
    if not question:
        diags.append(Diagnostic("error", ":::input block has no question", lineno))
        return None
    return InputBlock(question=question, placeholder=placeholder)

def parse_progress_block(block_lines: list[str], lineno: int, diags: list[Diagnostic]) -> ProgressBlock | None:
    description   = None
    value_fixed   = None
    value_ids     = []
    thresholds    = []
    found_value   = False

    for i, line in enumerate(block_lines):
        line = line.rstrip()
        if not line:
            continue

        m = RE_PROGRESS_VALUE_FIXED.match(line)
        if m:
            value_fixed = float(m.group(1))
            found_value = True
            continue

        m = RE_PROGRESS_VALUE_REACTIVE.match(line)
        if m:
            value_ids = [s.strip() for s in m.group(1).split("+")]
            found_value = True
            continue

        m = RE_PROGRESS_THRESHOLD.match(line)
        if m:
            pct  = float(m.group(1)) / 100.0
            body_text = m.group(2).strip()
            # check if body contains an include
            inc_m = RE_INLINE_INCLUDE.match(body_text)
            if inc_m:
                body = ThresholdBody(include=Include(label=inc_m.group(1), target=inc_m.group(2)))
            else:
                body = ThresholdBody(text=body_text)
            thresholds.append(Threshold(percent=pct, body=body))
            continue

        if not found_value and description is None:
            description = line
            continue

        diags.append(Diagnostic("warning",
            f"Unrecognised progress line (ignored): '{line}'", lineno + i))

    if not found_value:
        diags.append(Diagnostic("error", ":::progress block missing value line (= ...)", lineno))
        return None

    # sort thresholds ascending
    thresholds.sort(key=lambda t: t.percent)

    return ProgressBlock(
        description=description,
        value_fixed=value_fixed,
        value_ids=value_ids,
        thresholds=thresholds,
    )

def parse_block_token(tok: Token, diags: list[Diagnostic]) -> Element | None:
    btype = tok.meta.get("type", "")
    lines = tok.meta.get("lines", [])
    ln    = tok.line

    if btype == "graph":
        return parse_graph_block(lines, ln, diags)
    if btype == "quiz":
        return parse_quiz_block(lines, ln, diags)
    if btype == "checkbox":
        return parse_checkbox_block(lines, ln, diags)
    if btype == "input":
        return parse_input_block(lines, ln, diags)
    if btype == "progress":
        return parse_progress_block(lines, ln, diags)

    diags.append(Diagnostic("error",
        f"Unknown fenced block type ':::{btype}' (skipped)", ln))
    return None

# ─────────────────────────────────────────────────────────────────────────────
# Pass 2 — Parse  (token stream → Scene Graph)
# ─────────────────────────────────────────────────────────────────────────────

def _merge_text_tokens(tokens: list[Token]) -> list[Token]:
    """Merge consecutive TEXT tokens into a single TEXT token."""
    merged: list[Token] = []
    for tok in tokens:
        if tok.kind == "TEXT" and merged and merged[-1].kind == "TEXT":
            merged[-1] = Token("TEXT", merged[-1].value + "\n" + tok.value,
                               merged[-1].line, merged[-1].meta)
        else:
            merged.append(tok)
    return merged

def build_scene_graph(tokens: list[Token], diags: list[Diagnostic]) -> list[Scene]:
    tokens = _merge_text_tokens(tokens)
    scenes: list[Scene] = []
    id_registry: dict[str, int] = {}   # id → count of times seen

    def register_id(raw_id: str, lineno: int) -> str:
        if raw_id in RESERVED_IDS:
            diags.append(Diagnostic("error",
                f"Reserved id '{raw_id}' cannot be used as a heading id", lineno))
            raw_id = raw_id.lower() + "-reserved"
        if raw_id not in id_registry:
            id_registry[raw_id] = 1
            return raw_id
        else:
            id_registry[raw_id] += 1
            n = id_registry[raw_id]
            new_id = f"{raw_id}--{n}"
            diags.append(Diagnostic("warning",
                f"Duplicate id '{raw_id}' — shadowed node gets id '{new_id}'", lineno))
            return new_id

    current_scene:  Scene | None     = None
    # Stack of open containers: list[(depth, Container)]
    container_stack: list[tuple[int, Container]] = []

    def current_parent():
        """The current insertion target (deepest open container, or scene)."""
        if container_stack:
            return container_stack[-1][1]
        return current_scene

    def pop_to_depth(depth: int):
        """Close all containers at >= depth."""
        while container_stack and container_stack[-1][0] >= depth:
            container_stack.pop()

    def append_element(el: Any):
        p = current_parent()
        if p is not None:
            p.children.append(el)

    for tok in tokens:

        # ── New Scene (H1) ────────────────────────────────────────────────────
        if tok.kind == "SCENE":
            container_stack.clear()
            ht = tok.meta["heading_text"]
            clean, attrs, eid = _parse_heading_meta(ht)
            sid = register_id(eid or _derive_id(clean), tok.line)
            current_scene = Scene(id=sid, attrs=attrs, raw_heading=clean, line=tok.line)
            scenes.append(current_scene)
            continue

        if current_scene is None:
            diags.append(Diagnostic("warning",
                f"Element before first scene (ignored)", tok.line))
            continue

        # ── Container (H2–H6) ─────────────────────────────────────────────────
        if tok.kind == "CONTAINER":
            depth = tok.meta["depth"]
            ht    = tok.meta["heading_text"]
            clean, attrs, eid = _parse_heading_meta(ht)
            cid = register_id(eid or _derive_id(clean), tok.line)
            pop_to_depth(depth)
            c = Container(id=cid, depth=depth, attrs=attrs, raw_heading=clean, line=tok.line)
            parent = current_parent()
            if parent is not None:
                parent.children.append(c)
            container_stack.append((depth, c))
            continue

        # ── Fenced block ──────────────────────────────────────────────────────
        if tok.kind.startswith("BLOCK_"):
            el = parse_block_token(tok, diags)
            if el is not None:
                append_element(el)
            continue

        # ── Text / HR ─────────────────────────────────────────────────────────
        if tok.kind in ("TEXT", "HR"):
            frags, inl_texts = parse_inline(tok.value)
            
            # Since fragments has the #id stripped, let's also reconstruct 
            # the clean markdown string for rendering without the tags.
            # Text nodes might be entirely string based if in a table.
            clean_md = "".join(f if isinstance(f, str) else tok.value for f in frags) # simple fallback reconstruction, though renderer uses fragments usually
            # Actually, `frags` represents the parsed structure. Let's rebuild `markdown` field accurately
            
            # A more accurate clean markdown reconstruction from fragments
            parts = []
            for f in frags:
                if isinstance(f, str):
                    parts.append(f)
                elif isinstance(f, RedirLink):
                    if f.kind == 'button':
                        parts.append(f"[[{f.label}](#{f.target})]")
                    else:
                        parts.append(f"[{f.label}](#{f.target})")
                elif isinstance(f, Include):
                    parts.append(f"![{f.label}](#{f.target})")
            clean_md = "".join(parts)
            
            append_element(TextNode(markdown=clean_md, fragments=frags, inline_texts=inl_texts))
            continue

    return scenes

# ─────────────────────────────────────────────────────────────────────────────
# Pass 3 — Resolve  (bind IDs, detect cycles, validate signals)
# ─────────────────────────────────────────────────────────────────────────────

def _collect_ids(scenes: list[Scene]) -> dict[str, Any]:
    """Build a flat map of id -> node for all scenes, containers, and block elements.

    A fenced block (quiz, checkbox, input, progress) that is the sole signal-emitting
    child of a container inherits the container id as its signal id.  Primary pattern:

        ## pq-1       <- container id = "pq-1"
        :::quiz       <- this quiz is addressable as "pq-1"
        :::
    """
    registry: dict[str, Any] = {}

    def walk(node: Any):
        if isinstance(node, (Scene, Container)):
            signal_children = [c for c in node.children
                               if isinstance(c, (QuizBlock, CheckboxBlock, InputBlock, ProgressBlock))]
            registry[node.id] = node
            for child in node.children:
                if isinstance(child, (QuizBlock, CheckboxBlock, InputBlock, ProgressBlock)):
                    if child.explicit_id:
                        registry[child.explicit_id] = child
                    if signal_children and child is signal_children[0]:
                        # First signal child inherits parent container id
                        registry[node.id] = child
                        if not child.explicit_id:
                            child.explicit_id = node.id
                elif isinstance(child, TextNode):
                    if child.inline_texts:
                        for inl_id, text in child.inline_texts.items():
                            registry[inl_id] = {"type": "InlineText", "parent_id": node.id, "text": text}
                    walk(child)
                else:
                    walk(child)
        elif isinstance(node, TextNode):
            if getattr(node, "inline_texts", None):
                for inl_id, text in node.inline_texts.items():
                    # For top-level TextNodes (direct children of scene usually handled above, but just in case)
                    registry[inl_id] = {"type": "InlineText", "text": text}

    for scene in scenes:
        walk(scene)
    return registry

SIGNAL_TYPES = (QuizBlock, CheckboxBlock, InputBlock, ProgressBlock)

def resolve(scenes: list[Scene], diags: list[Diagnostic]) -> dict[str, Any]:
    id_map = _collect_ids(scenes)
    scene_ids = [s.id for s in scenes]

    # ── Word-overlap fuzzy resolver ───────────────────────────────────────────
    # LLM-generated markdown often uses a short/abbreviated anchor in buttons
    # (e.g. #what-is-os) that doesn't match the auto-derived scene ID
    # (e.g. what-is-an-operating-system). We resolve the mismatch here so the
    # AST the frontend receives already contains the correct, navigable IDs.
    def _fuzzy_resolve(target: str) -> str | None:
        """Return the best-matching scene ID by Jaccard word-overlap, or None."""
        target_words = set(target.split('-'))
        best_id: str | None = None
        best_score = 0.0
        for sid in scene_ids:
            scene_words = set(sid.split('-'))
            common = len(target_words & scene_words)
            if common == 0:
                continue
            # Jaccard similarity: |intersection| / |union|
            # This correctly differentiates candidates that share equal numbers
            # of matching words with the target (e.g. os-quiz vs os-history vs
            # operating-systems-quiz — Jaccard picks the smaller union winner).
            score = common / len(target_words | scene_words)
            if score > best_score:
                best_score = score
                best_id = sid
        return best_id if best_score >= 0.2 else None

    # ── 1. Bind all link/button/include targets ───────────────────────────────
    def check_target(target: str, lineno: int) -> str:
        """Return resolved target ID; rewrites dead links via fuzzy matching."""
        if target in RESERVED_IDS:
            return target
        if target in id_map:
            return target
        # Fuzzy fallback: LLM used an abbreviated anchor that doesn't exactly
        # match the auto-derived slug. Rewrite to the best-matching scene ID.
        resolved = _fuzzy_resolve(target)
        if resolved:
            diags.append(Diagnostic("warning",
                f"Link '#{target}' resolved to '#{resolved}' via fuzzy match", lineno))
            return resolved
        diags.append(Diagnostic("warning",
            f"Dead link — target '#{target}' not found", lineno))
        return target

    def walk_links(node: Any):
        if isinstance(node, (Scene, Container)):
            for child in node.children:
                walk_links(child)
        elif isinstance(node, TextNode):
            for frag in getattr(node, "fragments", []):
                if isinstance(frag, (RedirLink, Include)):
                    walk_links(frag)
        elif isinstance(node, RedirLink):
            node.target = check_target(node.target, 0)
        elif isinstance(node, Include):
            node.target = check_target(node.target, 0)
        elif isinstance(node, ProgressBlock):
            for tid in node.value_ids:
                if tid not in id_map:
                    diags.append(Diagnostic("warning",
                        f"Progress references unknown signal id '{tid}'", 0))
                elif not isinstance(id_map[tid], SIGNAL_TYPES):
                    diags.append(Diagnostic("warning",
                        f"Progress references '{tid}' which does not emit a signal", 0))
            for th in node.thresholds:
                if th.body.include:
                    th.body.include.target = check_target(th.body.include.target, 0)

    for scene in scenes:
        walk_links(scene)

    # ── 2. Cycle detection over Include edges (DFS) ───────────────────────────
    visited: set[str] = set()
    stack:   list[str] = []

    def dfs(node_id: str):
        if node_id not in id_map:
            return
        if node_id in stack:
            cycle = " → ".join(stack[stack.index(node_id):] + [node_id])
            diags.append(Diagnostic("warning", f"Circular include detected: {cycle}", 0))
            return
        if node_id in visited:
            return
        visited.add(node_id)
        stack.append(node_id)
        node = id_map[node_id]
        
        def check_includes(n: Any):
            if hasattr(n, "children"):
                for c in n.children:
                    check_includes(c)
            elif isinstance(n, TextNode):
                for frag in getattr(n, "fragments", []):
                    check_includes(frag)
            elif isinstance(n, Include):
                dfs(n.target)
                
        check_includes(node)
        stack.pop()

    for sid in [s.id for s in scenes]:
        dfs(sid)

    return id_map

# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def compile_markgraph(source: str) -> CompileResult:
    diags: list[Diagnostic] = []

    # Pass 1
    tokens, tok_diags = tokenise(source)
    diags.extend(tok_diags)

    # Pass 2
    scenes = build_scene_graph(tokens, diags)

    # Pass 3
    id_map = resolve(scenes, diags)

    warnings = [d for d in diags if d.level == "warning"]
    errors   = [d for d in diags if d.level == "error"]
    return CompileResult(scenes=scenes, warnings=warnings, errors=errors, id_map=id_map)

def get_section_range(source: str, header_id_or_name: str) -> tuple[int, int] | None:
    """Find the 1-indexed [start, end] line range of a section.

    Matches against node ID (slugified) or raw heading text (case-insensitive).
    """
    result = compile_markgraph(source)
    target_node = None

    # Flatten the scene graph to find the node
    all_nodes = []
    def walk(node: Any):
        if hasattr(node, "children"):
            all_nodes.append(node)
            for child in node.children:
                walk(child)

    for s in result.scenes:
        walk(s)

    # Search for the node
    for node in all_nodes:
        # Check both id and raw_heading safely
        nid = getattr(node, "id", "")
        nheading = getattr(node, "raw_heading", "")
        
        if nid == header_id_or_name or nheading.lower() == header_id_or_name.lower():
            target_node = node
            break

    if target_node is None:
        return None

    start_line = target_node.line

    # The end line is either the line before the next heading of same or higher depth,
    # or the last line of the source.
    lines = source.splitlines()
    end_line = len(lines)

    target_depth = getattr(target_node, "depth", 1)

    next_node_line = float('inf')
    for node in all_nodes:
        if getattr(node, "line", 0) <= getattr(target_node, "line", 0):
            continue

        node_depth = getattr(node, "depth", 1)
        if node_depth <= target_depth:
            next_node_line = min(next_node_line, getattr(node, "line", 0))

    if next_node_line != float('inf'):
        end_line = int(next_node_line) - 1

    # Strip trailing empty lines from the range
    while end_line > start_line and end_line <= len(lines) and not lines[end_line-1].strip():
        end_line -= 1

    return (start_line, end_line)

def export_to_dict(obj: Any) -> Any:
    """Recursively converts Scene Graph AST nodes to plain dictionaries, injecting a 'type' field."""
    if isinstance(obj, list):
        return [export_to_dict(i) for i in obj]
    elif hasattr(obj, "__dataclass_fields__"):
        d = {"type": obj.__class__.__name__}
        d.update({k: export_to_dict(getattr(obj, k)) for k in obj.__dataclass_fields__})
        return d
    return obj

# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, json

    content = """# Root Scene
## Section A
Some content A

## Section B
Some content B
:::quiz
Question?
- Answer *
:::

## Section C
Some content C
"""

    result = compile_markgraph(content)

    print(json.dumps(export_to_dict(result.scenes), indent=2))

    if result.errors:
        print("ERRORS:")
        for d in result.errors:
            loc = f" (line {d.line})" if d.line else ""
            print(f"  ✗ {d.message}{loc}")
        print()

    if result.warnings:
        print("WARNINGS:")
        for d in result.warnings:
            loc = f" (line {d.line})" if d.line else ""
            print(f"  ⚠ {d.message}{loc}")
        print()

    if not result.errors and not result.warnings:
        print("  No issues found.")
        print()

    print("SCENES:")
    for scene in result.scenes:
        layout = next((a.name for a in scene.attrs), "column")
        print(f"  [{scene.id}]  @{layout}  ({len(scene.children)} children)")
