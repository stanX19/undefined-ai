# UndefinedAI — Backend Architecture Plan

---

# 0. High-Level Architecture

## Core Services

1. API Gateway (REST / GraphQL)
2. Auth Service (Simple ID-based for POC → JWT later)
3. Agent Orchestrator Service
4. Ingestion Pipeline Service
5. Knowledge Graph Service
6. UI Definition Service (A2UI Protocol Engine)
7. Recommendation Service
8. Persistence Layer (PostgreSQL)
9. Vector Store (for semantic retrieval)
10. Object Storage (PDF storage)

---

# 1️⃣ PHASE 1 — POC

Goal:

* User login via ID
* Agent can fetch stored data
* Basic Q&A over hardcoded or full uploaded document

---

## 1.1 Database Schema (POC)

### users

* user_id (PK)
* created_at

### topics

* topic_id (PK)
* user_id (FK)
* title
* difficulty_level
* created_at

### chat_history

* message_id (PK)
* topic_id (FK)
* role ("user" | "assistant")
* message
* created_at

---

## 1.2 Basic Flow

1. User logs in with ID
2. User uploads PDF OR enters prompt
3. Backend stores file
4. Extract raw text (no chunking yet)
5. Store full text in DB
6. Agent answers questions using:

   * Entire document as context
   * Chat history

---

## 1.3 Agent Architecture (POC)

Single LLM call:

Input:

* user_prompt
* document_text
* chat_history

Output:

* answer text only

No UI generation yet.

---

# 2️⃣ PHASE 2 — MAIN FEATURE #1 (UI DEFINITION)

Goal:

* Agent can output structured UI (A2UI protocol)
* Persist scenes
* Support history stack

---

## 2.1 New Tables

### scenes

* scene_id (PK)
* topic_id (FK)
* parent_scene_id (nullable)
* created_at

### ui_elements

* ui_id (PK)
* scene_id (FK)
* on_click_scene_id (nullable FK → scenes)
* value (JSONB)

---

## 2.2 A2UI Protocol Layer

Agent Output Example:
{
"scene": {
"type": "graph",
"nodes": [...],
"edges": [...]
}
}

Backend Responsibilities:

1. Validate JSON schema
2. Create new scene
3. Store each UI element
4. Link clickable elements to future scene_id

---

## 2.3 Orchestrator Design

Main Agent
├── Knowledge Subagent
└── UI Subagent

Flow:

1. Knowledge subagent gathers facts
2. UI subagent converts facts → A2UI JSON
3. Persist scene

---

## 2.4 History Stack Implementation

Option A (recommended):

* Store parent_scene_id
* Back = load parent_scene

Option B:

* Separate history_stack table

Recommended: parent pointer model (tree navigation).

---

# 3️⃣ PHASE 3 — MAIN FEATURE #2 (INGESTION PIPELINE)

Goal:
Transform document → atomic knowledge hierarchy

---

## 3.1 New Tables

### atomic_facts

* fact_id (PK)
* topic_id (FK)
* parent_fact_id (nullable FK)
* level (int)  # 0=raw, 1=1000, 2=100, 3=10
* content (text)

### embeddings

* fact_id (FK)
* vector

---

## 3.2 Pipeline Stages

Stage 1 — Raw Extraction
PDF → Clean text

Stage 2 — Atomic Split
Text → ~1000 atomic facts

Stage 3 — First Compression
1000 → 100 main facts

Stage 4 — Second Compression
100 → 10 core concepts

Stage 5 — Embedding Generation
Generate embedding for each fact
Store in vector DB

---

## 3.3 Retrieval Strategy

When user clicks node:

1. Retrieve fact
2. Retrieve children facts
3. Retrieve related via vector similarity
4. Send to Knowledge Subagent

---

# 4️⃣ PHASE 4 — FULL PRODUCT (SUGGESTIONS ENGINE)

Goal:
Adaptive difficulty progression

---

## 4.1 Track Progress

### topic_progress

* topic_id
* user_id
* last_scene_id
* difficulty_level
* last_accessed

---

## 4.2 Recommendation Algorithm

Inputs:

* current difficulty_level
* last visited facts
* embedding similarity

Outputs:

* Same level
* Level +1
* Level +2

Strategy:

1. Find adjacent higher-level facts
2. Expand scope breadth
3. Increase abstraction depth

---

## 4.3 Difficulty Detection

LLM classification prompt:
Classify material into:
1 kindergarten
2 primary
3 secondary
4 undergraduate
5 graduate
6 phd/research

Store result in topics.difficulty_level

---

# 5️⃣ AGENT SYSTEM DESIGN

## 5.1 Tool Access

Agent tools:

* retrieve_facts()
* search_web()
* generate_ui()
* classify_difficulty()

---

## 5.2 Execution Graph

User Input
→ Orchestrator
→ Knowledge Subagent
→ Retrieval
→ UI Subagent
→ Persist Scene
→ Return A2UI JSON

---

# 6️⃣ INFRASTRUCTURE STACK

Backend: FastAPI / Node
Database: PostgreSQL
Vector DB: pgvector / Pinecone
Queue: Redis / Celery
Storage: S3-compatible
LLM Provider: OpenAI

---

# 7️⃣ STATE MODEL

User
└── Topics
└── Scenes (Tree)
└── UI Elements

Topics
└── Atomic Fact Tree

---

# 8️⃣ DEPLOYMENT STRATEGY

POC:
Monolith service

Scale phase:

* Separate ingestion worker
* Separate agent service
* Horizontal scaling for retrieval

---

# 9️⃣ CRITICAL DESIGN DECISIONS

1. Tree-based scene navigation (not stack array)
2. Atomic fact hierarchy is mandatory
3. UI is data-driven JSON
4. Knowledge layer separated from presentation layer
5. Difficulty is AI-detected, not user-defined

---

# 🔟 FINAL SYSTEM FLOW (FULL PRODUCT)

Upload → Ingestion → Fact Hierarchy → Embeddings

User Click → Retrieve Facts → Agent → UI JSON → Persist Scene

Return Visit → Load Progress → Recommend Harder → Generate New Graph

---

This document captures all structural requirements for backend implementation.

---

Python 3.14.3
langchain 1.2.10
langchain-google-genai 4.2.1