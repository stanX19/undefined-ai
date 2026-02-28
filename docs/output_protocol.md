# UI Output Data Protocol Specification

## 1. Introduction

This document defines the **UI Output Data Protocol**: the structure of data returned by the AI agent inside the `data` field of the API response. It applies only to UI payloads; session or envelope protocols are defined elsewhere.

The AI is responsible solely for returning **structured data** conforming to the schemas below. The frontend is responsible for:

- Rendering the data into the appropriate UI (graph, table, or text + image).
- All interaction logic (e.g. node/row clicks, navigation, image loading).
- Sending follow-up requests (e.g. `topic_id`, `node_id`, `difficulty_level`) when the user triggers drill-down or format changes.

---

## 2. Graph UI Output Structure

The graph UI type represents knowledge as nodes and edges. The AI returns a single graph payload; the frontend computes node positions (x, y) and handles layout, zoom, and click behavior.

### 2.1 Top-level fields

| Field        | Type   | Required | Description                          |
|-------------|--------|----------|--------------------------------------|
| `graph_type`| string | Yes      | Must be `"graph"`.                   |
| `nodes`     | array  | Yes      | List of node objects.               |
| `edges`     | array  | Yes      | List of edge objects.               |

### 2.2 Node structure

| Field        | Type    | Required | Description                                                                 |
|--------------|---------|----------|-----------------------------------------------------------------------------|
| `id`         | string  | Yes      | Unique identifier for the node.                                            |
| `label`      | string  | Yes      | Display text for the node.                                                 |
| `description`| string  | Yes      | Description of this particular node (concept, definition, or summary).    |
| `type`       | string  | Yes      | One of: `main`, `sub`, `detail`. Indicates conceptual level.               |
| `clickable`  | boolean | Yes      | Whether the node can trigger a drill-down request.                         |

The AI does not supply `position` (x, y). The frontend is responsible for computing layout and node coordinates.

### 2.3 Edge structure

| Field         | Type   | Required | Description                                      |
|---------------|--------|----------|--------------------------------------------------|
| `id`          | string | Yes      | Unique identifier for the edge.                 |
| `source`      | string | Yes      | `id` of the source node.                         |
| `target`      | string | Yes      | `id` of the target node.                         |
| `relationship`| string | Yes      | One of: `parent`, `child`. Direction of relation.|

### 2.4 Example

```json
{
  "graph_type": "graph",
  "nodes": [
    {
      "id": "n1",
      "label": "Photosynthesis",
      "description": "Process by which plants convert light energy into chemical energy, producing glucose and oxygen from CO2 and water.",
      "type": "main",
      "clickable": true
    },
    {
      "id": "n2",
      "label": "Chlorophyll",
      "description": "Green pigment in chloroplasts that absorbs light for photosynthesis.",
      "type": "sub",
      "clickable": true
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "relationship": "child"
    }
  ]
}
```

### 2.5 Interaction

- The AI **does not** define or implement `onClick` or any other event logic.
- When the user clicks a node with `clickable: true`, the **frontend** sends a drill-down request including:
  - `topic_id`
  - `node_id` (the node’s `id`)
  - `difficulty_level`

The backend uses these to generate the next graph or response.

---

## 3. Table UI Output Structure

The table UI type presents knowledge as rows and columns. The AI returns column definitions and row data; the frontend renders the table and handles row clicks.

### 3.1 Top-level fields

| Field     | Type  | Required | Description                    |
|----------|-------|----------|--------------------------------|
| `columns`| array | Yes      | Column definitions.            |
| `rows`   | array | Yes      | Row data objects.              |

### 3.2 Column structure

| Field  | Type   | Required | Description                |
|--------|--------|----------|----------------------------|
| `id`   | string | Yes      | Unique column key.         |
| `label`| string | Yes      | Column header text.        |

### 3.3 Row structure

| Field       | Type    | Required | Description                                                                 |
|------------|---------|----------|-----------------------------------------------------------------------------|
| `id`       | string  | Yes      | Unique identifier for the row.                                             |
| `cells`    | object  | Yes      | Key-value map: keys are column `id`s, values are cell content (string).    |
| `clickable`| boolean | Yes      | Whether clicking the row triggers a drill-down request.                    |

### 3.4 Example

```json
{
  "columns": [
    { "id": "concept", "label": "Concept" },
    { "id": "definition", "label": "Definition" }
  ],
  "rows": [
    {
      "id": "r1",
      "cells": {
        "concept": "Mitochondria",
        "definition": "Organelles that produce ATP."
      },
      "clickable": true
    },
    {
      "id": "r2",
      "cells": {
        "concept": "Ribosome",
        "definition": "Site of protein synthesis."
      },
      "clickable": true
    }
  ]
}
```

### 3.5 Interaction

- A row with `clickable: true` is eligible for drill-down.
- When the user clicks such a row, the **frontend** sends a drill-down request (e.g. including `topic_id`, row identifier, and `difficulty_level`) as defined by the session/API contract.

---

## 4. Text + Image UI Output Structure

The text + image UI type presents content as a title, description, and ordered sections. Each section can include an `image_prompt` for the frontend to use with an image generation service.

### 4.1 Top-level fields

| Field         | Type   | Required | Description                              |
|---------------|--------|----------|------------------------------------------|
| `title`       | string | Yes      | Main title of the content.               |
| `description` | string | No       | Short summary or introduction.           |
| `sections`    | array  | Yes      | Ordered section objects.                 |

### 4.2 Section structure

| Field          | Type   | Required | Description                                                                 |
|----------------|--------|----------|-----------------------------------------------------------------------------|
| `heading`      | string | Yes      | Section heading.                                                           |
| `text`         | string | Yes      | Body text for the section.                                                 |
| `image_prompt` | string | No       | Prompt for image generation; not an image URL.                             |

### 4.3 Image handling

- The AI **does not** return image URLs or binary image data.
- When present, `image_prompt` is a text prompt to be sent to a separate **image generation service** by the frontend or backend.
- The frontend is responsible for requesting images, caching, and rendering the text + image layout.

### 4.4 Example

```json
{
  "title": "Cell Structure",
  "description": "Overview of key organelles in eukaryotic cells.",
  "sections": [
    {
      "heading": "Nucleus",
      "text": "The nucleus contains the cell's genetic material and controls gene expression.",
      "image_prompt": "Diagram of a cell nucleus with nuclear envelope and nucleolus, educational style"
    },
    {
      "heading": "Endoplasmic Reticulum",
      "text": "The ER is involved in protein and lipid synthesis. Rough ER has ribosomes; smooth ER does not.",
      "image_prompt": "Cross-section of rough and smooth endoplasmic reticulum in a cell"
    }
  ]
}
```

### 4.5 Field reference

| Field          | Location   | Description                                                                 |
|----------------|------------|-----------------------------------------------------------------------------|
| `title`        | Root       | Main title of the content.                                                 |
| `description`  | Root       | Optional summary or introduction.                                         |
| `sections`     | Root       | Array of section objects.                                                  |
| `heading`      | Section    | Section heading.                                                           |
| `text`         | Section    | Section body text.                                                         |
| `image_prompt` | Section    | Optional prompt for image generation; not a URL.                           |
