# Product Requirements Document (PRD)

**Project Name:** undefined ai
**Event:** Hack The East 2026

---

## 1. Executive Summary

undefined ai is a minimalist, Agent2UI-driven educational platform that eradicates traditional, static learning interfaces. Instead of a pre-built dashboard, the UI is entirely "undefined" until the user interacts via a single floating chat command center. Using the MiniMax API, the AI ingests user input (text, audio, PDFs, URLs) and dynamically generates the optimal UI format — such as interactive node graphs, tables, slideshows, or video/audio lessons — tailored to the user's specific education level, learning style, and real-time knowledge gaps.

---

## 2. Problem Statement

- **Static Learning:** Education platforms treat all topics and users the same, utilizing rigid UI templates (e.g., endless scrolling text or standard video players).
- **Content Overload:** Learners are overwhelmed by dense materials (theses, exam papers, fast-moving industry news).
- **The "Trust Gap" in Learning:** Users don't know what they don't know. They struggle to bridge the gap between beginner concepts and advanced mastery without getting lost.

---

## 3. Hackathon Alignment & Target Tracks

- **MiniMax Creative Usage Award:** Deep integration of MiniMax LLM, audio (STT/TTS), and video generation to dynamically render multimodal learning UIs.
- **RevisionDojo Future of Learning Award:** Reimagines pedagogy by personalizing both the content and the medium (Agent2UI), ensuring both strong and struggling learners excel.
- **OAX Foundation AI EdTech Platform Award:** Tackles content overload by intelligently curating ingested PDFs/URLs and creating adaptive, future-proof learning paths.

---

## 4. Core Mechanics (The Agent2UI Engine)

The platform operates on a reactive architecture where the AI outputs both **Content** and **UI State**.

1. **Input:** User uploads a PDF, pastes a URL, or speaks via mic ("Explain quantum computing").
2. **Context Analysis:** The AI evaluates the input against the user's historical state to determine their education level (Beginner / Intermediate / Advanced).
3. **UI Decision (Agent2UI):** The AI determines the most effective cognitive format (e.g., a Node Graph for relationships, a Timeline for history, a Table for comparisons).
4. **Render:** The frontend dynamically builds the chosen UI component on the fly.

---

## 5. Feature Requirements & Prioritization

### Priority 1: Custom UI (Agent2UI Engine) — P0 (Must Have)

- **Zero-Navigation Interface:** No taskbars, no menus. A single chatbox handles all commands.
- **Dynamic Component Rendering:** The frontend must support receiving a JSON payload from the backend dictating the `ui_type` (e.g., `markdown`, `table`, `mindmap`, `quiz`, `video_player`) and rendering it instantly.
- **Split/Float View:** The chat acts as a floating overlay or a collapsible right-side panel alongside the dynamically generated main content.

### Priority 2: Ingestion, Search & Context — P0 (Must Have)

- **Multimodal Input:** Support for text chat, audio recording (STT via MiniMax), and file/URL uploads.
- **Prompt-Driven Leveling:** System prompts must instruct the LLM to identify the user's educational level based on their queries and the uploaded material (e.g., summarizing a Ph.D. thesis for a high schooler vs. a grad student).
- **Knowledge Gap Detection:** AI actively assesses what the user *doesn't* ask about a topic to subtly introduce necessary foundational concepts.

### Priority 3: Interest-Centric Recommendation — P1 (High Priority)

- **Dynamic Forking:** At the end of a module, the system prompts the user with dynamically generated options: *"Continue Exploring [Current Topic]"* or *"Explore New Connections [Suggested Topic based on latest trends]"*.
- **"Everyday Improve" Loop:** Track user success on quizzes and dwell time to inform the AI of their preferred learning format (e.g., "User learns 40% faster with node graphs; bias future UI generation towards graphs").

### Priority 4: Hackathon Shortcuts (Out of Scope / Mocked)

- **Authentication:** None. Open access for demo purposes.
- **Long-term memory scaling:** Use in-memory or a simple local document DB (like Firebase/MongoDB) rather than complex vector DB pipelines to save hackathon time. Simulate "Everyday Improve" over a mocked timeline for the judges.

---

## 6. Technical Architecture & Implementation Plan

### Frontend (User Interface)

| Concern | Choice |
|---------|--------|
| Framework | React (Next.js) or Flutter |
| Styling | TailwindCSS |
| Node Graphs / Trees | React Flow |
| Data Visualization | Recharts |
| State Management | Lightweight state to handle transitions between UI components based on the AI's JSON response |

### Backend & Middleware

| Concern | Choice |
|---------|--------|
| Language / Framework | Python (FastAPI) |
| Document Parsing | PyPDF2 or Unstructured.io |
| Agent Orchestration | LangChain or LlamaIndex |

### AI Integration (MiniMax API)

| Concern | Choice |
|---------|--------|
| LLM Core | MiniMax text models for reasoning, summarization, and JSON formatting (Agent2UI logic) |
| Audio / Video | MiniMax Speech-to-Text for input; Text-to-Speech / Video APIs for rich media UI components |
