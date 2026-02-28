/**
 * Typography scale derived from the design system.
 * Font: Inter or Plus Jakarta Sans (with system-ui fallback).
 */

export const FONT_FAMILY = '"Inter", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

export const TYPOGRAPHY = {
  h1: { size: "text-[32px]", weight: "font-semibold", tracking: "tracking-tight", leading: "leading-tight", color: "text-(--ds-text-primary)" },
  h2: { size: "text-base", weight: "font-semibold", tracking: "", leading: "leading-snug", color: "text-(--ds-text-primary)" },
  body: { size: "text-sm", weight: "font-normal", tracking: "", leading: "leading-relaxed", color: "text-(--ds-text-body)" },
  caption: { size: "text-xs", weight: "font-normal", tracking: "", leading: "leading-normal", color: "text-(--ds-text-secondary)" },
  button: { size: "text-sm", weight: "font-medium", tracking: "", leading: "leading-normal", color: "" },
} as const;

export type TypographyVariant = keyof typeof TYPOGRAPHY;

/**
 * Returns a Tailwind class string for a given typography variant.
 */
export function textStyle(variant: TypographyVariant): string {
  const t = TYPOGRAPHY[variant];
  return [t.size, t.weight, t.tracking, t.leading, t.color].filter(Boolean).join(" ");
}
