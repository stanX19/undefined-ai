import { useEffect, useRef, useCallback, useState } from "react";
import { parseJsonLine } from "../parser.ts";
import { fallbackParse } from "../fallbackParser.ts";
import { useSurfaceStore } from "../store.ts";
import type {
  CreateSurfaceMessage,
  UpdateComponentsMessage,
  UpdateDataModelMessage,
  DeleteSurfaceMessage,
} from "../types.ts";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface UseSseStreamOptions {
  url: string;
  enabled?: boolean;
}

function isCreateSurface(m: unknown): m is CreateSurfaceMessage {
  return (m as Record<string, unknown>).createSurface !== undefined;
}
function isUpdateComponents(m: unknown): m is UpdateComponentsMessage {
  return (m as Record<string, unknown>).updateComponents !== undefined;
}
function isUpdateDataModel(m: unknown): m is UpdateDataModelMessage {
  return (m as Record<string, unknown>).updateDataModel !== undefined;
}
function isDeleteSurface(m: unknown): m is DeleteSurfaceMessage {
  return (m as Record<string, unknown>).deleteSurface !== undefined;
}

/**
 * Dispatch a validated A2UI message (or array of fallback messages)
 * into the Zustand surface store.
 */
function dispatchMessage(msg: unknown): void {
  const store = useSurfaceStore.getState();

  if (isCreateSurface(msg)) {
    const cs = msg.createSurface;
    store.createSurface(cs.surfaceId, cs.catalogId, cs.theme, cs.sendDataModel);
  } else if (isUpdateComponents(msg)) {
    const uc = msg.updateComponents;
    store.updateComponents(uc.surfaceId, uc.components);
  } else if (isUpdateDataModel(msg)) {
    const udm = msg.updateDataModel;
    store.updateDataModel(udm.surfaceId, udm.path, udm.value);
  } else if (isDeleteSurface(msg)) {
    store.deleteSurface(msg.deleteSurface.surfaceId);
  }
}

/**
 * Hook that connects to an SSE endpoint and processes incoming
 * A2UI JSONL messages, dispatching them into the surface store.
 */
export function useSseStream({ url, enabled = true }: UseSseStreamOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const eventSourceRef = useRef<EventSource | null>(null);

  const processLine = useCallback((line: string) => {
    const result = parseJsonLine(line);

    if (result.ok) {
      dispatchMessage(result.message);
      return;
    }

    // Fallback path: try to extract a simpler payload
    const fallbackMessages = fallbackParse(result.raw);
    if (fallbackMessages) {
      for (const msg of fallbackMessages) {
        dispatchMessage(msg);
      }
      return;
    }

    console.warn("[A2UI] Unparseable message:", result.error, result.raw);
  }, []);

  useEffect(() => {
    if (!enabled) {
      eventSourceRef.current?.close();
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setStatus("connected");

    es.onmessage = (event) => {
      if (typeof event.data === "string") {
        processLine(event.data);
      }
    };

    es.onerror = () => {
      setStatus("error");
      es.close();
    };

    return () => {
      es.close();
      setStatus("idle");
    };
  }, [url, enabled, processLine]);

  return { status };
}
