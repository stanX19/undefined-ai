import type { ComponentType } from "react";
import type { A2UIComponent } from "./types.ts";

/**
 * Props passed to every registered A2UI component.
 */
export interface A2UIComponentProps {
  definition: A2UIComponent;
  dataModel: Record<string, unknown>;
  components: Map<string, A2UIComponent>;
  scopePrefix?: string;
}

type A2UIReactComponent = ComponentType<A2UIComponentProps>;

const registry = new Map<string, A2UIReactComponent>();

export function registerComponent(
  name: string,
  component: A2UIReactComponent,
): void {
  registry.set(name, component);
}

export function getComponent(name: string): A2UIReactComponent | undefined {
  return registry.get(name);
}

export function hasComponent(name: string): boolean {
  return registry.has(name);
}
