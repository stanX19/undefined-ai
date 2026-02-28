# User Flow Documentation

---

## Difficulty Level

Difficulty is **not** defaulted to 1. It is set in one of two ways:

| Source | When |
|--------|------|
| **From PDF** | User uploads a PDF → AI infers `difficulty_level` from the material. |
| **From user** | User enters only a prompt (no PDF) → We ask education level and use it as `difficulty_level` so we can teach the right depth (simple vs complicated). |

| Level | Material type / audience |
|-------|--------------------------|
| 1 | Kindergarten |
| 2 | Primary school |
| 3 | Secondary school |
| 4 | Undergraduate |
| 5 | Graduate / master’s |
| 6+ | PhD, thesis, researcher-level |

---

## 1. First Time User Flow

### Step 1 — User enters website

**System shows:**
- Start button

### Step 2 — User clicks "Start"

**System shows:**
- Enter Prompt

  Options align with the difficulty scale (see table above), e.g.:
  - Kindergarten / Early years
  - Primary school
  - Secondary school
  - Undergraduate
  - Graduate / Master’s
  - PhD / Researcher

- Enter Prompt
- Upload PDF

(No education level is asked at this step.)

### Step 3 — User submits prompt or PDF

**Backend actions:**
- Extract topic
- Extract key concepts
- Generate knowledge graph JSON
- **Set `difficulty_level`** from **user’s chosen education level** (primary source). Optionally, AI can still infer from material and use it to refine or validate.
- Use `difficulty_level` to decide whether to provide **simple** or **complicated** knowledge for the same topic.
- Save `topic_id`
- Save `UI_type = graph`
- Initialize `history_stack = []`

### Step 4 — System renders Graph UI

User can now click nodes to explore deeper.

---

## 2. Graph Navigation Flow

### Step 1 — User clicks a node

**Frontend sends:**
- `topic_id`
- `node_id`
- `difficulty_level`

### Step 2 — Backend generates deeper subgraph

- Save current graph into `history_stack`
- Generate new graph based on node

### Step 3 — System renders new graph

### Step 4 — If user clicks "Back"

- Pop last graph from `history_stack`
- Render previous graph

---

## 3. Returning User Flow (Next Day)

### Step 1 — Show options

- **CONTINUE**
- **RECOMMEND HARDER MATERIAL** — one recommendation for each level.  
  If user’s previous upload was level 1, show recommendations for level 1, 2, and 3.

### Step 2 — If user clicks CONTINUE

- Load last topic
- Load last graph JSON
- Load difficulty level (no need show to user but load from database)
- Render previous UI

---

## 4. Recommendation (Harder Material) Flow

### Step 1 — User clicks RELOAD BUTTON

### Step 2 — Backend updates recommendations

- Recommend material at **same level** as current, **+1**, and **+2**.
- Example: if current level is 1 → recommendations are level 1, level 2, and level 3.

### Step 3 — AI regenerates

- Same topic
- Deeper explanation
- Harder concepts
- More connections

### Step 4 — System renders new graph for the recommended topic

---

## 5. UI Redefinition Flow

### Step 1 — User prompts (examples)

- “Change to table format”
- “Convert to text + image”
- “Make exam answer format”

### Step 2 — Frontend sends

- `current graph_data`
- `requested_format`

### Step 3 — Backend

- Keep knowledge content
- Change only presentation layer

### Step 4 — System renders new UI

---

## 6. Add New Topic Flow

### Step 1 — User clicks [+ Add New Topic]

### Step 2 — Redirect to Input Page

### Step 3 — Generate

- New `topic_id`
- **AI detects `difficulty_level`** from the new material (see Difficulty Level scale above)

### Step 4 — Render new learning session
