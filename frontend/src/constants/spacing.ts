/**
 * Spacing, border radius, and shadow tokens.
 * Based on an 8px grid system (docs/design_system.md section 4).
 */

export const GRID = 8;

export const SPACING = {
  /** Related items gap (12px = 1.5 grid units) */
  gap: "3",
  /** Card internal padding (16-24px) */
  cardPadding: "4",
  cardPaddingLg: "6",
  /** Distinct section gap (24px = 3 grid units) */
  sectionGap: "6",
  /** Outer page margin (32px = 4 grid units) */
  pageMargin: "8",
} as const;

export const LAYOUT = {
  sidebarWidth: 260,
  pageMargin: 32,
  cardPadding: { sm: 16, lg: 24 },
  gapRelated: 12,
  gapSection: 24,
} as const;

export const RADIUS = {
  /** Small widgets, badges (6px) */
  badge: "rounded-[6px]",
  /** Secondary buttons, small widgets (12px) */
  sm: "rounded-xl",
  /** Main UI containers, cards (24px) */
  lg: "rounded-3xl",
  /** Pill shape — chat input (32px) */
  pill: "rounded-[32px]",
  /** Full circle — send button, avatars */
  full: "rounded-full",
} as const;

export const SHADOW = {
  /** Cards — soft depth */
  card: "shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1)]",
  /** Floating elements */
  float: "shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
  /** Elevated modals */
  modal: "shadow-[0_16px_48px_rgba(0,0,0,0.12)]",
  none: "shadow-none",
} as const;
