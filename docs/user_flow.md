# User Flow Documentation

---

## Difficulty Level (AI-Detected)

Difficulty is **not** defaulted to 1. The AI infers it from the uploaded or entered material:

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

### Step 2 — User clicks "Start Learning"

**System shows:**
- Enter Prompt
- Upload PDF

### Step 3 — User submits prompt or PDF

**Backend actions:**
- Extract topic
- Extract key concepts
- Generate knowledge graph JSON
- **AI detects and sets `difficulty_level`** from material (e.g. kindergarten → 1, primary → 2, secondary → 3, up to PhD/thesis/researcher)
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
- Load difficulty level
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
