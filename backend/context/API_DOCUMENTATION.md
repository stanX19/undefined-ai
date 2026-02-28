# UndefinedAI — Phase 1 API Documentation

> **Base URL:** `http://localhost:8000`
> **Version:** `0.1.0`
> **Phase:** 1 — POC

---

## Table of Contents

- [Overview](#overview)
- [Database Schema](#database-schema)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Topics](#topics)
  - [Chat](#chat)
  - [Ingestion](#ingestion)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [Error Handling](#error-handling)

---

## Overview

Phase 1 is a **proof-of-concept** backend built with **FastAPI** and **SQLite** (via `aiosqlite`).

**Core capabilities:**
- Simple ID-based user login (no JWT)
- Topic creation and management
- PDF upload with text extraction
- Chat with a LangGraph ReAct agent (Gemini-backed)
- Real-time responses via Server-Sent Events (SSE)

**Tech stack:** FastAPI · SQLAlchemy (async) · SQLite · LangChain/LangGraph · Google Gemini

---

## Database Schema

### `users`

| Column       | Type              | Constraints       |
|-------------|-------------------|--------------------|
| `user_id`   | `String`          | **PK**, auto UUID  |
| `created_at`| `DateTime (tz)`   | default: `utcnow`  |

### `topics`

| Column            | Type              | Constraints               |
|-------------------|-------------------|---------------------------|
| `topic_id`        | `String`          | **PK**, auto UUID         |
| `user_id`         | `String`          | **FK → users.user_id**    |
| `title`           | `String`          | NOT NULL                  |
| `difficulty_level`| `Integer`         | nullable                  |
| `document_text`   | `Text`            | nullable                  |
| `created_at`      | `DateTime (tz)`   | default: `utcnow`         |

### `chat_history`

| Column       | Type              | Constraints               |
|-------------|-------------------|---------------------------|
| `message_id`| `String`          | **PK**, auto UUID         |
| `topic_id`  | `String`          | **FK → topics.topic_id**  |
| `role`      | `String`          | NOT NULL (`"user"` or `"assistant"`) |
| `message`   | `Text`            | NOT NULL                  |
| `created_at`| `DateTime (tz)`   | default: `utcnow`         |

### `atomic_facts`

| Column            | Type              | Constraints               |
|-------------------|-------------------|---------------------------|
| `fact_id`         | `String`          | **PK**, auto UUID         |
| `topic_id`        | `String`          | **FK → topics.topic_id**  |
| `parent_fact_id`  | `String`          | **FK → atomic_facts.fact_id** (nullable)|
| `level`           | `Integer`         | NOT NULL                  |
| `content`         | `Text`            | NOT NULL                  |
| `source_chunk_id` | `String`          | **FK → atomic_facts.fact_id** (nullable)|
| `source_start`    | `Integer`         | nullable                  |
| `source_end`      | `Integer`         | nullable                  |
| `created_at`      | `DateTime (tz)`   | default: `utcnow`         |

---

## Endpoints

### Health

#### `GET /health`

Simple liveness probe.

**Response** `200 OK`
```json
{ "status": "healthy" }
```

---

### Auth

#### `POST /api/v1/auth/login`

Login or auto-register by user ID. If the `user_id` does not exist, a new user is created.

**Request Body**
```json
{ "user_id": "string" }
```

**Response** `200 OK` — `LoginResponse`
```json
{
  "user_id": "abc123",
  "created_at": "2026-02-28T07:00:00Z"
}
```

---

### Topics

#### `POST /api/v1/topics/`

Create a new topic for a user.

**Request Body** — `TopicCreateRequest`
```json
{
  "title": "Linear Algebra",
  "user_id": "abc123"
}
```

**Response** `200 OK` — `TopicResponse`
```json
{
  "topic_id": "t1",
  "user_id": "abc123",
  "title": "Linear Algebra",
  "difficulty_level": null,
  "created_at": "2026-02-28T07:00:00Z"
}
```

---

#### `GET /api/v1/topics/?user_id={user_id}`

List all topics for a user.

**Query Parameters**

| Param     | Type   | Required |
|-----------|--------|----------|
| `user_id` | string | ✅       |

**Response** `200 OK` — `TopicResponse[]`
```json
[
  {
    "topic_id": "t1",
    "user_id": "abc123",
    "title": "Linear Algebra",
    "difficulty_level": null,
    "created_at": "2026-02-28T07:00:00Z"
  }
]
```

---

#### `GET /api/v1/topics/{topic_id}`

Get a single topic with its stored document text.

**Path Parameters**

| Param      | Type   |
|------------|--------|
| `topic_id` | string |

**Response** `200 OK` — `TopicDetailResponse`
```json
{
  "topic_id": "t1",
  "user_id": "abc123",
  "title": "Linear Algebra",
  "difficulty_level": null,
  "created_at": "2026-02-28T07:00:00Z",
  "document_text": "Extracted PDF text…"
}
```

**Errors**
- `404` — Topic not found

---

#### `POST /api/v1/topics/{topic_id}/upload`

Upload a PDF file, extract its text, and store it on the topic.

**Path Parameters**

| Param      | Type   |
|------------|--------|
| `topic_id` | string |

**Request** — `multipart/form-data`

| Field  | Type         | Required | Notes             |
|--------|--------------|----------|--------------------|
| `file` | `UploadFile` | ✅       | Must be a `.pdf`   |

**Response** `200 OK` — `TopicDetailResponse`
```json
{
  "topic_id": "t1",
  "user_id": "abc123",
  "title": "Linear Algebra",
  "difficulty_level": null,
  "created_at": "2026-02-28T07:00:00Z",
  "document_text": "Extracted PDF text…"
}
```

**Errors**
- `400` — Only PDF files are accepted

---

### Chat

#### `GET /api/v1/chat/stream/{session_id}`

Open a **Server-Sent Events** stream for real-time updates.

> **Connect here _before_ sending a `POST` to `/api/v1/chat/`.**
> In Phase 1, `session_id` equals `topic_id`.

**Path Parameters**

| Param        | Type   |
|--------------|--------|
| `session_id` | string |

**Response** — `text/event-stream`

See [SSE Events](#server-sent-events-sse) for event format.

**Headers set by the server:**
```
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

---

#### `POST /api/v1/chat/`

Send a user message. Returns immediately; the agent reply is delivered over the SSE stream.

**Request Body** — `ChatRequest`
```json
{
  "topic_id": "t1",
  "message": "What is an eigenvalue?"
}
```

**Response** `200 OK` — `ChatAcceptedResponse`
```json
{
  "status": "success",
  "user_message": {
    "message_id": "m1",
    "role": "user",
    "message": "What is an eigenvalue?",
    "created_at": "2026-02-28T07:01:00Z"
  }
}
```

**Errors**
- `404` — Topic not found

---

#### `GET /api/v1/chat/history?topic_id={topic_id}`

Return chat history for a topic (oldest-first, max 50 messages).

**Query Parameters**

| Param      | Type   | Required |
|------------|--------|----------|
| `topic_id` | string | ✅       |

**Response** `200 OK` — `ChatMessageResponse[]`
```json
[
  {
    "message_id": "m1",
    "role": "user",
    "message": "What is an eigenvalue?",
    "created_at": "2026-02-28T07:01:00Z"
  },
  {
    "message_id": "m2",
    "role": "assistant",
    "message": "An eigenvalue is…",
    "created_at": "2026-02-28T07:01:05Z"
  }
]
```

---

#### `DELETE /api/v1/chat/history?topic_id={topic_id}`

Delete all chat messages for a topic.

**Query Parameters**

| Param      | Type   | Required |
|------------|--------|----------|
| `topic_id` | string | ✅       |

**Response** `200 OK`
```json
{ "message": "Cleared 12 messages" }
```

---

### Ingestion

#### `GET /api/v1/ingestion/{topic_id}/status`

Return the current ingestion pipeline status for a topic.

**Path Parameters**

| Param      | Type   |
|------------|--------|
| `topic_id` | string |

**Response** `200 OK` — `IngestionStatusResponse`
```json
{
  "topic_id": "t1",
  "status": "completed",
  "message": null
}
```

---

#### `GET /api/v1/ingestion/{topic_id}/facts`

List all facts for a topic at a specific compression level.

**Path Parameters**

| Param      | Type   |
|------------|--------|
| `topic_id` | string |

**Query Parameters**

| Param   | Type    | Required | Notes |
|---------|---------|----------|-------|
| `level` | integer | ✅       | Fact compression level. 0 = raw document text, 1 = atomic facts, higher = more compressed. |

**Response** `200 OK` — `AtomicFactResponse[]`
```json
[
  {
    "fact_id": "f1",
    "topic_id": "t1",
    "level": 1,
    "content": "A matrix is a rectangular array of numbers.",
    "parent_fact_id": "f2",
    "source_chunk_id": "c1",
    "source_start": 45,
    "source_end": 88,
    "created_at": "2026-02-28T07:05:00Z"
  }
]
```

---

#### `GET /api/v1/ingestion/{topic_id}/facts/{fact_id}`

Get a single fact with its full parent chain and source chunk.

**Path Parameters**

| Param      | Type   |
|------------|--------|
| `topic_id` | string |
| `fact_id`  | string |

**Response** `200 OK` — `FactWithParentsResponse`
```json
{
  "fact": {
    "fact_id": "f1",
    "topic_id": "t1",
    "level": 1,
    "content": "A matrix is a rectangular array of numbers.",
    "parent_fact_id": "f2",
    "source_chunk_id": "c1",
    "source_start": 45,
    "source_end": 88,
    "created_at": "2026-02-28T07:05:00Z"
  },
  "parents": [
    {
      "fact_id": "f2",
      "topic_id": "t1",
      "level": 2,
      "content": "Matrices are arrays of numbers.",
      "parent_fact_id": null,
      "source_chunk_id": null,
      "source_start": null,
      "source_end": null,
      "created_at": "2026-02-28T07:05:05Z"
    }
  ],
  "source_chunk": {
    "fact_id": "c1",
    "topic_id": "t1",
    "level": 0,
    "content": "In mathematics, a matrix is a rectangular array of numbers or expressions...",
    "parent_fact_id": null,
    "source_chunk_id": null,
    "source_start": null,
    "source_end": null,
    "created_at": "2026-02-28T07:04:00Z"
  }
}
```

**Errors**
- `404` — Fact not found

---

## Server-Sent Events (SSE)

Events are pushed over `GET /api/v1/chat/stream/{session_id}`.

Each SSE frame has the format:
```
event: <EventType>
data: <JSON payload>
```

### Event Types

| Event              | Payload Model             | Description                        |
|--------------------|---------------------------|------------------------------------|
| `Notif`            | `SseNotifData`            | Status notification (e.g. "Processing…") |
| `Replies`          | `SseRepliesData`          | Agent reply text (+ optional audio URL)  |
| `UpdateChecklist`  | `SseUpdateChecklistData`  | Checklist update _(future use)_    |
| `EditDocument`     | `SseEditDocumentData`     | Document edit _(future use)_       |
| `TTSResult`        | `SseTTSResultData`        | TTS audio result _(future use)_    |

### Payload Schemas

**`SseNotifData`**
```json
{ "message": "Processing your message…" }
```

**`SseRepliesData`**
```json
{
  "message_id": "m2",
  "text": "An eigenvalue is…",
  "audio_url": null
}
```

**`SseUpdateChecklistData`** _(future)_
```json
{
  "checklist_id": "cl1",
  "items": [{ "id": "i1", "text": "...", "done": true }]
}
```

**`SseEditDocumentData`** _(future)_
```json
{
  "document_id": "d1",
  "content": "Updated content…"
}
```

**`SseTTSResultData`** _(future)_
```json
{
  "text": "The spoken text",
  "audio_url": "/media/tts/response.mp3"
}
```

---

## Error Handling

All error responses follow FastAPI's default format:

```json
{
  "detail": "Human-readable error message"
}
```

| Status Code | Meaning                      |
|-------------|------------------------------|
| `400`       | Bad request (e.g. non-PDF)   |
| `404`       | Resource not found           |
| `422`       | Validation error (bad body)  |
| `500`       | Internal server error        |

---

## Static Files

Uploaded PDFs are served at `/uploads/{filename}` via FastAPI `StaticFiles`.

---

_Last updated: 2026-02-28 · Phase 1 POC_
