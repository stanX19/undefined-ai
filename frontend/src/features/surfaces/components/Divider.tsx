import type { A2UIComponentProps } from "../../a2ui/registry.ts";

export function A2UIDivider({ definition }: A2UIComponentProps) {
  const isVertical = (definition.axis as string) === "vertical";

  return isVertical ? (
    <div className="mx-2 h-auto w-px self-stretch bg-[var(--color-border)]" />
  ) : (
    <hr className="border-[var(--color-border)]" />
  );
}
