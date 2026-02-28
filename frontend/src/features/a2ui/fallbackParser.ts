import type {
  A2UIMessage,
  CreateSurfaceMessage,
  UpdateComponentsMessage,
  UpdateDataModelMessage,
} from "./types.ts";

const FALLBACK_SURFACE_ID = "fallback_surface";
const FALLBACK_CATALOG_ID = "undefined-ai/fallback";

/**
 * Attempt to convert a non-compliant JSON object into synthetic A2UI messages.
 *
 * Expects shapes like:
 *   { ui_type: "mindmap", title: "...", data: {...} }
 *   { type: "markdown", content: "..." }
 *
 * Returns an array of A2UI messages that can be fed into the store,
 * or null if the raw input is unrecoverable.
 */
export function fallbackParse(raw: unknown): A2UIMessage[] | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const obj = raw as Record<string, unknown>;
  const uiType =
    (obj.ui_type as string) ??
    (obj.type as string) ??
    (obj.component as string);

  if (typeof uiType !== "string") return null;

  const title = (obj.title as string) ?? "";
  const data = (obj.data as Record<string, unknown>) ?? obj;

  const create: CreateSurfaceMessage = {
    version: "v0.9",
    createSurface: {
      surfaceId: FALLBACK_SURFACE_ID,
      catalogId: FALLBACK_CATALOG_ID,
    },
  };

  const update: UpdateComponentsMessage = {
    version: "v0.9",
    updateComponents: {
      surfaceId: FALLBACK_SURFACE_ID,
      components: [
        {
          id: "root",
          component: "Column",
          children: title ? ["title", "content"] : ["content"],
        },
        ...(title
          ? [
              {
                id: "title",
                component: "Text",
                text: title,
                variant: "h1" as const,
              },
            ]
          : []),
        {
          id: "content",
          component: uiType,
          data: { path: "/content" },
        },
      ],
    },
  };

  const dataMsg: UpdateDataModelMessage = {
    version: "v0.9",
    updateDataModel: {
      surfaceId: FALLBACK_SURFACE_ID,
      path: "/content",
      value: data,
    },
  };

  return [create, update, dataMsg];
}
