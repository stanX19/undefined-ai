/**
 * Color tokens derived from the design system (docs/design_system.md).
 * All UI components should reference these tokens instead of raw hex values.
 *
 * CSS custom properties (--ds-*) are set in index.css and used via Tailwind.
 * These JS constants are for cases where colors are needed in JS (e.g. React Flow nodes, Recharts).
 */

export const COLORS = {
  brand: {
    primary: "#111827", // Dark Gray / Near Black
    primaryHover: "#374151", // Gray 700
    sidebarDeep: "#FFFFFF", // White
    subtleBlue: "#F3F4F6", // Light Gray
  },

  semantic: {
    success: "#22C55E",
    warning: "#F97316",
    progress: "#D8B4FE",
  },

  status: {
    lowPriority: { bg: "#DCFCE7", text: "#16A34A" },
    inProgress: { bg: "#F3E8FF", text: "#9333EA" },
    success: { bg: "#DCFCE7", text: "#16A34A" },
    warning: { bg: "#FEF3C7", text: "#F97316" },
    error: { bg: "#FEE2E2", text: "#DC2626" },
  },

  neutral: {
    background: "#F8F9FA",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    hoverBg: "#F9FAFB",
    ghostHover: "#F3F4F6",
  },

  text: {
    primary: "#111827",
    body: "#374151",
    secondary: "#6B7280",
    inverse: "#FFFFFF",
    link: "#111827",
  },

  dark: {
    sidebar: "#111827", // Dark Gray
    surface: "#1F2937", // Gray 800
    border: "#374151",  // Gray 700
    textPrimary: "#F9FAFB",
    textSecondary: "#9CA3AF",
  },
} as const;

export type StatusVariant = keyof typeof COLORS.status;
