import type { A2UIMessage } from "./types.ts";

export type ParseResult =
  | { ok: true; message: A2UIMessage }
  | { ok: false; raw: unknown; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Validate and classify a parsed JSON object as an A2UI v0.9 message.
 * Returns a discriminated result so the caller can fall back gracefully.
 */
export function parseA2UIMessage(json: unknown): ParseResult {
  if (!isObject(json)) {
    return { ok: false, raw: json, error: "Message is not a JSON object" };
  }

  if ("createSurface" in json && isObject(json.createSurface)) {
    const cs = json.createSurface as Record<string, unknown>;
    if (typeof cs.surfaceId !== "string" || typeof cs.catalogId !== "string") {
      return {
        ok: false,
        raw: json,
        error: "createSurface missing surfaceId or catalogId",
      };
    }
    return { ok: true, message: json as unknown as A2UIMessage };
  }

  if ("updateComponents" in json && isObject(json.updateComponents)) {
    const uc = json.updateComponents as Record<string, unknown>;
    if (typeof uc.surfaceId !== "string" || !Array.isArray(uc.components)) {
      return {
        ok: false,
        raw: json,
        error: "updateComponents missing surfaceId or components array",
      };
    }
    return { ok: true, message: json as unknown as A2UIMessage };
  }

  if ("updateDataModel" in json && isObject(json.updateDataModel)) {
    const udm = json.updateDataModel as Record<string, unknown>;
    if (typeof udm.surfaceId !== "string") {
      return {
        ok: false,
        raw: json,
        error: "updateDataModel missing surfaceId",
      };
    }
    return { ok: true, message: json as unknown as A2UIMessage };
  }

  if ("deleteSurface" in json && isObject(json.deleteSurface)) {
    const ds = json.deleteSurface as Record<string, unknown>;
    if (typeof ds.surfaceId !== "string") {
      return {
        ok: false,
        raw: json,
        error: "deleteSurface missing surfaceId",
      };
    }
    return { ok: true, message: json as unknown as A2UIMessage };
  }

  return {
    ok: false,
    raw: json,
    error: "Unknown message type — no recognized top-level key",
  };
}

/**
 * Parse a single line of JSONL into an A2UI message.
 */
export function parseJsonLine(line: string): ParseResult {
  const trimmed = line.trim();
  if (!trimmed) return { ok: false, raw: null, error: "Empty line" };

  try {
    const json: unknown = JSON.parse(trimmed);
    return parseA2UIMessage(json);
  } catch {
    return { ok: false, raw: trimmed, error: "Invalid JSON" };
  }
}
