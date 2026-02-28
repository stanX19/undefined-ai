/**
 * A2UI Protocol v0.9 TypeScript definitions.
 *
 * Covers the four server-to-client message types, component model,
 * dynamic value bindings, and surface state.
 */

// ---------------------------------------------------------------------------
// Dynamic value types (data binding)
// ---------------------------------------------------------------------------

export type DynamicString =
  | string
  | { literalString: string }
  | { path: string }
  | { call: string; args: Record<string, unknown> };

export type DynamicNumber =
  | number
  | { path: string }
  | { call: string; args: Record<string, unknown> };

export type DynamicBoolean =
  | boolean
  | { path: string }
  | { call: string; args: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Child list (static array or template)
// ---------------------------------------------------------------------------

export type ChildList =
  | { explicitList: string[] }
  | string[]
  | { path: string; componentId: string };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface ActionEvent {
  name: string;
  context?: Record<string, unknown>;
}

export interface A2UIAction {
  event?: ActionEvent;
  functionCall?: { call: string; args?: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Component definition (flat adjacency list node)
// ---------------------------------------------------------------------------

export interface A2UIComponent {
  id: string;
  component: string;
  weight?: number;
  children?: ChildList;
  child?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export interface A2UITheme {
  primaryColor?: string;
  iconUrl?: string;
  agentDisplayName?: string;
}

// ---------------------------------------------------------------------------
// Server-to-client messages
// ---------------------------------------------------------------------------

export interface CreateSurfaceMessage {
  version?: string;
  createSurface: {
    surfaceId: string;
    catalogId: string;
    theme?: A2UITheme;
    sendDataModel?: boolean;
  };
}

export interface UpdateComponentsMessage {
  version?: string;
  updateComponents: {
    surfaceId: string;
    components: A2UIComponent[];
  };
}

export interface UpdateDataModelMessage {
  version?: string;
  updateDataModel: {
    surfaceId: string;
    path?: string;
    value?: unknown;
  };
}

export interface DeleteSurfaceMessage {
  version?: string;
  deleteSurface: {
    surfaceId: string;
  };
}

export type A2UIMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

// ---------------------------------------------------------------------------
// Client-side surface state
// ---------------------------------------------------------------------------

export interface Surface {
  surfaceId: string;
  catalogId: string;
  theme: A2UITheme;
  sendDataModel: boolean;
  components: Map<string, A2UIComponent>;
  dataModel: Record<string, unknown>;
}
