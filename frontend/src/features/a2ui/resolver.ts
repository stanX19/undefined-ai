import type { DynamicString, DynamicNumber, DynamicBoolean } from "./types.ts";

/**
 * Resolve a JSON Pointer (RFC 6901) against a data model object.
 * Supports both absolute ("/foo/bar") and relative ("bar") paths.
 * A relative path is resolved by prepending the current scope prefix.
 */
export function resolvePointer(
  dataModel: Record<string, unknown>,
  pointer: string,
  scopePrefix = "",
): unknown {
  const absolute = pointer.startsWith("/")
    ? pointer
    : `${scopePrefix}/${pointer}`;

  const segments = absolute.split("/").filter(Boolean);
  let current: unknown = dataModel;

  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Set a value in the data model at a given JSON Pointer path.
 * Creates intermediate objects as needed.
 */
export function setPointer(
  dataModel: Record<string, unknown>,
  pointer: string,
  value: unknown,
): Record<string, unknown> {
  if (!pointer || pointer === "/") {
    return (value ?? {}) as Record<string, unknown>;
  }

  const segments = pointer.split("/").filter(Boolean);
  const result = structuredClone(dataModel);
  let current: Record<string, unknown> = result;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (
      current[seg] == null ||
      typeof current[seg] !== "object" ||
      Array.isArray(current[seg])
    ) {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }

  const lastSeg = segments[segments.length - 1];
  if (value === undefined) {
    delete current[lastSeg];
  } else {
    current[lastSeg] = value;
  }

  return result;
}

/**
 * Resolve a DynamicString / DynamicNumber / DynamicBoolean to its
 * concrete value against the current data model and scope.
 */
export function resolveDynamic<T extends string | number | boolean>(
  binding: DynamicString | DynamicNumber | DynamicBoolean | undefined,
  dataModel: Record<string, unknown>,
  scopePrefix = "",
): T | undefined {
  if (binding == null) return undefined;

  if (typeof binding === "string" || typeof binding === "number" || typeof binding === "boolean") {
    return binding as T;
  }

  if ("literalString" in binding) {
    return binding.literalString as T;
  }

  if ("path" in binding) {
    return resolvePointer(dataModel, binding.path, scopePrefix) as T;
  }

  // Function calls are not yet implemented -- return undefined
  return undefined;
}

/**
 * Resolve a child list to an array of component IDs.
 */
export function resolveChildList(
  children: unknown,
  dataModel: Record<string, unknown>,
  scopePrefix = "",
): string[] {
  if (!children) return [];

  if (Array.isArray(children)) return children as string[];

  if (typeof children === "object" && children !== null) {
    if ("explicitList" in children) {
      return (children as { explicitList: string[] }).explicitList;
    }

    if ("path" in children && "componentId" in children) {
      const list = resolvePointer(
        dataModel,
        (children as { path: string }).path,
        scopePrefix,
      );
      if (Array.isArray(list)) {
        return list.map((_, i) => `${(children as { componentId: string }).componentId}__${i}`);
      }
    }
  }

  return [];
}
