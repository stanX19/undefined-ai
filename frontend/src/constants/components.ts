/**
 * Reusable component style presets.
 * Composed from design system tokens (docs/design_system.md section 3).
 *
 * Usage: <div className={COMPONENT_STYLES.card.base}>
 */

export const COMPONENT_STYLES = {
  card: {
    base: "bg-(--ds-surface) rounded-3xl border border-(--ds-border) shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1)] p-4 sm:p-6",
    interactive:
      "bg-(--ds-surface) rounded-3xl border border-(--ds-border) shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1)] p-4 sm:p-6 transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]",
  },

  button: {
    primary:
      "inline-flex items-center justify-center gap-2 rounded-3xl bg-(--ds-sidebar) px-5 py-2.5 text-sm font-medium text-(--ds-text-inverse) transition-colors hover:opacity-90 cursor-pointer",
    secondary:
      "inline-flex items-center justify-center gap-2 rounded-xl border border-(--ds-border) bg-(--ds-surface) px-5 py-2.5 text-sm font-medium text-(--ds-text-primary) transition-colors hover:bg-(--ds-hover) cursor-pointer",
    ghost:
      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-(--ds-text-secondary) transition-colors hover:bg-(--ds-ghost-hover) cursor-pointer",
    icon: "inline-flex items-center justify-center rounded-full p-2 text-(--ds-text-secondary) transition-colors hover:bg-(--ds-ghost-hover) cursor-pointer",
    send: "inline-flex items-center justify-center rounded-full bg-(--ds-sidebar) p-2.5 text-(--ds-text-inverse) transition-opacity hover:opacity-90 cursor-pointer",
  },

  badge: {
    lowPriority: "inline-flex items-center rounded-[6px] bg-[#DCFCE7] px-2 py-1 text-xs font-normal text-[#16A34A]",
    success: "inline-flex items-center rounded-[6px] bg-[#DCFCE7] px-2 py-1 text-xs font-normal text-[#16A34A]",
    inProgress: "inline-flex items-center rounded-[6px] bg-[#F3E8FF] px-2 py-1 text-xs font-normal text-[#9333EA]",
    warning: "inline-flex items-center rounded-[6px] bg-[#FEF3C7] px-2 py-1 text-xs font-normal text-[#F97316]",
    error: "inline-flex items-center rounded-[6px] bg-[#FEE2E2] px-2 py-1 text-xs font-normal text-[#DC2626]",
    neutral: "inline-flex items-center rounded-[6px] bg-(--ds-bg) px-2 py-1 text-xs font-normal text-(--ds-text-secondary)",
  },

  input: {
    chat: "w-full rounded-[32px] border border-(--ds-border) bg-(--ds-surface) px-6 py-3 text-sm shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1)] placeholder:text-(--ds-text-secondary) focus:border-(--ds-primary) focus:outline-none focus:ring-1 focus:ring-(--ds-primary)",
    standard:
      "w-full rounded-xl border border-(--ds-border) bg-(--ds-surface) px-4 py-2.5 text-sm placeholder:text-(--ds-text-secondary) focus:border-(--ds-primary) focus:outline-none focus:ring-1 focus:ring-(--ds-primary)",
  },

  modal: {
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm",
    content: "mx-4 w-full max-w-lg rounded-3xl bg-(--ds-surface) p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)]",
  },

  sidebar: {
    base: "flex h-dvh w-[260px] flex-col bg-(--ds-sidebar) text-(--ds-text-inverse)",
    item: "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
    itemHover: "hover:bg-white/5",
    itemActive: "border-l-2 border-(--ds-primary) bg-white/10",
  },
} as const;
