import type { A2UIComponentProps } from "../../a2ui/registry.ts";
import { resolveDynamic } from "../../a2ui/resolver.ts";

const VARIANT_CLASSES: Record<string, string> = {
  h1: "text-[32px] font-semibold leading-[1.2] text-text-primary",
  h2: "text-base font-semibold leading-[1.4] text-text-primary",
  h3: "text-base font-medium leading-[1.4] text-text-primary",
  h4: "text-base font-medium leading-[1.4] text-text-primary",
  h5: "text-sm font-medium leading-[1.5] text-text-primary",
  caption: "text-xs font-normal leading-[1.5] text-text-muted",
  body: "text-sm font-normal leading-[1.5] text-text-body",
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
