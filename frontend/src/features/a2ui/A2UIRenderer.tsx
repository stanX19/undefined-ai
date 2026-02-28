import type { A2UIComponent } from "./types.ts";
import { getComponent } from "./registry.ts";

interface RendererProps {
  componentId: string;
  components: Map<string, A2UIComponent>;
  dataModel: Record<string, unknown>;
  scopePrefix?: string;
}

/**
 * Recursively renders an A2UI component tree starting from the given
 * componentId. Looks up each component in the registry, passes it the
 * definition, data model, and full component map so it can render children.
 */
export function A2UIRenderer({
  componentId,
  components,
  dataModel,
  scopePrefix = "",
}: RendererProps) {
  const definition = components.get(componentId);
  if (!definition) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700">
        Missing component: {componentId}
      </div>
    );
  }

  const Component = getComponent(definition.component);
  if (!Component) {
    return (
      <div className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">
        Unknown component type: {definition.component}
      </div>
    );
  }

  return (
    <Component
      definition={definition}
      dataModel={dataModel}
      components={components}
      scopePrefix={scopePrefix}
    />
  );
}
