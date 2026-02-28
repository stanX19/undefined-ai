import { useState, useEffect } from "react";
import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";
import { useSurfaceStore } from "../../a2ui/store.ts";

export function A2UITextField({
  definition,
  dataModel,
  scopePrefix,
}: A2UIComponentProps) {
  const label = resolveDynamic<string>(
    definition.label as string | { literalString: string } | { path: string },
    dataModel,
    scopePrefix,
  );

  const boundPath =
    typeof definition.text === "object" &&
      definition.text !== null &&
      "path" in (definition.text as Record<string, unknown>)
      ? ((definition.text as { path: string }).path)
      : typeof definition.value === "object" &&
        definition.value !== null &&
        "path" in (definition.value as Record<string, unknown>)
        ? ((definition.value as { path: string }).path)
        : undefined;

  const initialValue = resolveDynamic<string>(
    definition.text as string | { path: string } | undefined ??
    definition.value as string | { path: string } | undefined,
    dataModel,
    scopePrefix,
  ) ?? "";

  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const fieldType = (definition.textFieldType as string) ?? "shortText";
  const isLongText = fieldType === "longText";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const next = e.target.value;
    setValue(next);

    if (boundPath) {
      const surfaces = useSurfaceStore.getState().surfaces;
      for (const [surfaceId, surface] of surfaces) {
        if (surface.components.has(definition.id)) {
          useSurfaceStore.getState().updateDataModel(surfaceId, boundPath, next);
          break;
        }
      }
    }
  };

  const className =
    "w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary shadow-level1 transition-shadow hover:shadow-level2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-text-primary leading-[1.5]">
          {label}
        </label>
      )}
      {isLongText ? (
        <textarea
          className={`${className} min-h-24 resize-y`}
          value={value}
          onChange={handleChange}
          placeholder={label ?? ""}
        />
      ) : (
        <input
          type={fieldType === "obscured" ? "password" : fieldType === "number" ? "number" : "text"}
          className={className}
          value={value}
          onChange={handleChange}
          placeholder={label ?? ""}
        />
      )}
    </div>
  );
}
