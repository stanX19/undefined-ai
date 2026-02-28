import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

const VARIANT_CLASSES: Record<string, string> = {
  h1: "text-3xl font-bold",
  h2: "text-2xl font-semibold",
  h3: "text-xl font-semibold",
  h4: "text-lg font-medium",
  h5: "text-base font-medium",
  caption: "text-xs text-[var(--color-text-muted)]",
  body: "text-base",
};

export function A2UIText({ definition, dataModel, scopePrefix }: A2UIComponentProps) {
  const text = resolveDynamic<string>(
    definition.text as string | { literalString: string } | { path: string },
    dataModel,
    scopePrefix,
  ) ?? "";

  const variant = (definition.variant as string) ??
    (definition.usageHint as string) ?? "body";

  const className = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.body;

  return <span className={className}>{text}</span>;
}
