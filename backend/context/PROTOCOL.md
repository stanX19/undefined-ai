{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Agent2UI v3.0 - Lean Learning Runtime",
  "type": "object",
  "required": ["version", "root_id", "elements"],
  "properties": {
    "version": {
      "type": "string",
      "description": "Schema version for backward compatibility."
    },
    "root_id": {
      "type": "string",
      "description": "The entry element ID to render first.",
      "pattern": "^[a-zA-Z0-9_]+$"
    },
    "meta": {
      "type": "object",
      "description": "Optional global rendering metadata.",
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "theme": {
          "type": "string",
          "enum": ["light", "dark", "system"]
        }
      },
      "additionalProperties": false
    },
    "global_state": {
      "type": "object",
      "description": "Centralized runtime state container for cross-component variables.",
      "additionalProperties": true
    },
    "patches": {
      "type": "array",
      "description": "Array of partial update operations for surgical UI mutations.",
      "items": {
        "type": "object",
        "properties": {
          "op": {
            "type": "string",
            "enum": ["add", "remove", "update"]
          },
          "target_id": { "type": "string" },
          "patch_data": { "type": "object" }
        },
        "required": ["op", "target_id"],
        "additionalProperties": false
      }
    },
    "elements": {
      "type": "object",
      "description": "Flat dictionary of all UI elements. The key acts as the element ID.",
      "patternProperties": {
        "^[a-zA-Z0-9_]+$": {
          "oneOf": [
            { "$ref": "#/definitions/linear_layout" },
            { "$ref": "#/definitions/text" },
            { "$ref": "#/definitions/table" },
            { "$ref": "#/definitions/graph" },
            { "$ref": "#/definitions/node" },
            { "$ref": "#/definitions/edge" },
            { "$ref": "#/definitions/quiz" },
            { "$ref": "#/definitions/button" },
            { "$ref": "#/definitions/progress" },
            { "$ref": "#/definitions/code_block" },
            { "$ref": "#/definitions/modal" }
          ]
        }
      },
      "additionalProperties": false
    }
  },
  "definitions": {
    "safe_style": {
      "type": "object",
      "description": "Restricted design tokens to prevent AI CSS hallucinations. Perfect for Tailwind mapping.",
      "properties": {
        "color": { 
          "type": "string", 
          "pattern": "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" 
        },
        "background_color": { 
          "type": "string", 
          "pattern": "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" 
        },
        "padding": { 
          "type": "string",
          "enum": ["none", "sm", "md", "lg", "xl"] 
        },
        "margin": { 
          "type": "string",
          "enum": ["none", "sm", "md", "lg", "xl", "auto"] 
        },
        "width": { 
          "type": "string",
          "enum": ["auto", "full", "half", "third"] 
        },
        "height": { 
          "type": "string",
          "enum": ["auto", "full", "screen"] 
        },
        "flex_grow": { 
          "type": "number", 
          "enum": [0, 1] 
        }
      },
      "additionalProperties": false
    },
    "action": {
      "description": "The exact action to trigger. You MUST choose one of these exact templates.",
      "oneOf": [
        {
          "type": "object",
          "properties": {
            "type": { "const": "navigate" },
            "payload": {
              "type": "object",
              "required": ["target_node_id"],
              "properties": { "target_node_id": { "type": "string" } }
            }
          },
          "required": ["type", "payload"],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": { "const": "fetch" },
            "payload": {
              "type": "object",
              "required": ["endpoint", "method"],
              "properties": {
                "endpoint": { "type": "string", "pattern": "^/api/" },
                "method": { "type": "string", "enum": ["GET", "POST"] }
              }
            }
          },
          "required": ["type", "payload"],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": { "const": "mutate" },
            "payload": {
              "type": "object",
              "required": ["target_id", "update_path", "new_value"],
              "properties": {
                "target_id": { "type": "string" },
                "update_path": { "type": "string" },
                "new_value": {} 
              }
            }
          },
          "required": ["type", "payload"],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": { "const": "generate_graph" },
            "payload": {
              "type": "object",
              "required": ["topic"],
              "properties": { "topic": { "type": "string" } }
            }
          },
          "required": ["type", "payload"],
          "additionalProperties": false
        },
        {
          "type": "object",
          "properties": {
            "type": { "const": "open_modal" },
            "payload": {
              "type": "object",
              "required": ["target_modal_id"],
              "properties": { "target_modal_id": { "type": "string" } }
            }
          },
          "required": ["type", "payload"],
          "additionalProperties": false
        }
      ]
    },
    "events": {
      "type": "object",
      "properties": {
        "onClick": { "$ref": "#/definitions/action" },
        "onChange": { "$ref": "#/definitions/action" },
        "onMount": { "$ref": "#/definitions/action" }
      },
      "additionalProperties": false
    },
    "base_element": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "type": "string" },
        "style": { "$ref": "#/definitions/safe_style" },
        "state": {
          "type": "string",
          "enum": ["ready", "loading", "error", "disabled"]
        },
        "accessibility": {
          "type": "object",
          "properties": {
            "aria_label": { "type": "string" },
            "alt_text": { "type": "string" }
          },
          "additionalProperties": false
        },
        "events": { "$ref": "#/definitions/events" },
        "metadata": {
          "type": "object",
          "description": "Application-level metadata (e.g. source_fact_id). Not rendered by the frontend.",
          "additionalProperties": true
        }
      }
    },
    "linear_layout": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "linear_layout" },
            "orientation": { "type": "string", "enum": ["horizontal", "vertical"] },
            "children": {
              "type": "array",
              "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" }
            }
          },
          "required": ["type", "orientation", "children"],
          "additionalProperties": false
        }
      ]
    },
    "text": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "text" },
            "content": { "type": "string" },
            "media_url": { "type": "string", "format": "uri" },
            "media_type": { "type": "string", "enum": ["image", "video", "audio"] }
          },
          "required": ["type", "content"],
          "additionalProperties": false
        }
      ]
    },
    "table": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "table" },
            "total_rows": { "type": "integer", "minimum": 1 },
            "total_columns": { "type": "integer", "minimum": 1 },
            "headers": {
              "type": "array",
              "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" }
            },
            "cells": {
              "type": "object",
              "patternProperties": {
                "^[0-9]+_[0-9]+$": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" }
              },
              "additionalProperties": false
            }
          },
          "required": ["type", "total_rows", "total_columns", "cells"],
          "additionalProperties": false
        }
      ]
    },
    "graph": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "graph" },
            "layout_type": { "type": "string", "enum": ["force", "tree", "grid"] },
            "interactive": { "type": "boolean" },
            "selected_node_id": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" },
            "children": {
              "type": "array",
              "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" }
            }
          },
          "required": ["type", "children"],
          "additionalProperties": false
        }
      ]
    },
    "node": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "node" },
            "title": { "type": "string" },
            "description": { "type": "string" },
            "difficulty": { "type": "number", "minimum": 0, "maximum": 1 },
            "status": { "type": "string", "enum": ["locked", "available", "completed"] }
          },
          "required": ["type", "title", "description"],
          "additionalProperties": false
        }
      ]
    },
    "edge": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "edge" },
            "left": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" },
            "right": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" },
            "direction": { "type": "string", "enum": ["left_to_right", "right_to_left", "bidirectional"] }
          },
          "required": ["type", "left", "right", "direction"],
          "additionalProperties": false
        }
      ]
    },
    "quiz": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "quiz" },
            "question": { "type": "string" },
            "options": {
              "type": "array",
              "items": { "type": "string" }
            },
            "answer": { "type": "string" },
            "explanation": { "type": "string" },
            "difficulty": { "type": "number", "minimum": 0, "maximum": 1 },
            "max_attempts": { "type": "integer", "minimum": 1 },
            "context_ids": {
              "type": "array",
              "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" }
            }
          },
          "required": ["type", "question", "options", "answer"],
          "additionalProperties": false
        }
      ]
    },
    "button": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "button" },
            "label": { "type": "string" }
          },
          "required": ["type", "label"],
          "additionalProperties": false
        }
      ]
    },
    "progress": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "progress" },
            "value": { "type": "number", "minimum": 0 },
            "max": { "type": "number", "minimum": 1 }
          },
          "required": ["type", "value", "max"],
          "additionalProperties": false
        }
      ]
    },
    "code_block": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "code_block" },
            "language": { "type": "string" },
            "content": { "type": "string" }
          },
          "required": ["type", "language", "content"],
          "additionalProperties": false
        }
      ]
    },
    "modal": {
      "allOf": [
        { "$ref": "#/definitions/base_element" },
        {
          "properties": {
            "type": { "const": "modal" },
            "children": {
              "type": "array",
              "items": { "type": "string", "pattern": "^[a-zA-Z0-9_]+$" }
            }
          },
          "required": ["type", "children"],
          "additionalProperties": false
        }
      ]
    }
  }
}