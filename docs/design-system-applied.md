# Undefined AI — Design System (Applied)

This document describes the theme and design system **currently applied** in the Undefined AI webapp. It reflects the implementation in `frontend/src/index.css`, `frontend/src/constants/`, and component styles.

---

## 1. Design Philosophy

- **Neutral-first:** Primary palette uses near-black and grays for a clean, professional look.
- **Soft surfaces:** Off-white backgrounds and light borders reduce visual noise.
- **Semantic color:** Status colors (success, warning, error, in-progress) for clear feedback.
- **Whitespace:** Generous spacing for legibility; "whitespace is a tool, not a gap."

---

## 2. Color Tokens

### Source of truth

Defined in `frontend/src/index.css` as CSS custom properties (`--ds-*`) and mapped to Tailwind `@theme` (`--color-*`).

### Brand & Neutrals

| Token | Hex | Usage |
|-------|-----|-------|
| `--ds-primary` | `#111827` | Buttons, active states, focus rings (near black) |
| `--ds-primary-hover` | `#374151` | Hover state for primary actions (Gray 700) |
| `--ds-sidebar` | `#FFFFFF` | Sidebar / nav background (white) |
| `--ds-subtle-blue` | `#F3F4F6` | Ghost hover, disabled backgrounds |
| `--ds-bg` | `#F8F9FA` | App background (off-white) |
| `--ds-surface` | `#FFFFFF` | Cards, containers, inputs (white) |
| `--ds-border` | `#E5E7EB` | Borders, dividers (light gray) |
| `--ds-hover` | `#F9FAFB` | Hover backgrounds |
| `--ds-ghost-hover` | `#F3F4F6` | Ghost button / icon hover |

### Typography

| Token | Hex | Usage |
|-------|-----|-------|
| `--ds-text-primary` | `#111827` | Headings, primary text |
| `--ds-text-body` | `#374151` | Body copy (medium gray) |
| `--ds-text-secondary` | `#6B7280` | Secondary, captions, placeholders |
| `--ds-text-inverse` | `#FFFFFF` | Text on primary/dark backgrounds |
| `--ds-text-link` | `#111827` | Link color |

### Status

| Token | Background | Text |
|-------|------------|------|
| Success | `#DCFCE7` | `#16A34A` |
| In Progress | `#F3E8FF` | `#9333EA` |
| Warning | `#FEF3C7` | `#F97316` |
| Error | `#FEE2E2` | `#DC2626` |

### Shadows

| Token | Value |
|-------|-------|
| `--ds-shadow-level1` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)` |
| `--ds-shadow-level2` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` |
| `--ds-shadow-level3` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` |

---

## 3. Tailwind Class Mapping

Use these semantic classes in components (from `@theme`):

| Class | Maps to |
|-------|---------|
| `text-primary` | `--ds-primary` |
| `text-text-primary` | `--ds-text-primary` |
| `text-text-body` | `--ds-text-body` |
| `text-text-muted` | `--ds-text-secondary` |
| `text-text-secondary` | secondary caption style |
| `bg-bg` | `--ds-bg` |
| `bg-surface` | `--ds-surface` |
| `bg-surface/50` | surface at 50% opacity |
| `bg-hover` | `--ds-hover` |
| `bg-primary` | `--ds-primary` |
| `border-border` | `--ds-border` |
| `shadow-level1` | `--ds-shadow-level1` |
| `shadow-level2` | `--ds-shadow-level2` |
| `shadow-level3` | `--ds-shadow-level3` |

---

## 4. Typography

### Font

- **Primary:** Inter (Google Fonts), weights 400, 500, 600, 700
- **Fallback:** `system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
- Loaded in `frontend/index.html`

### Scale

| Variant | Size | Weight | Line height | Use case |
|---------|------|--------|-------------|----------|
| h1 | 32px | 600 (semibold) | 1.2 | Hero / scene headings |
| h2 | 16px | 600 | 1.4 | Card titles, section headings |
| h3 | 16px | 500 | 1.4 | Subsections |
| h4, h5 | 14px | 500 | 1.5 | Minor headings |
| body | 14px | 400 | 1.5 | Body text |
| caption | 12px | 400 | 1.5 | Captions, secondary text |
| button | 14px | 500 | — | Button labels |

### Tailwind typography

- `text-text-primary` — primary text
- `text-text-body` — body text
- `text-text-muted` — muted/secondary

---

## 5. Components

### Buttons

| Variant | Styles | Use |
|---------|--------|-----|
| **Primary** | `bg-primary text-white rounded-[24px]` or `rounded-3xl`, shadow, `hover:opacity-90` | Main CTA |
| **Secondary** | `border border-border bg-surface text-text-primary rounded-xl hover:bg-hover` | Secondary actions |
| **Ghost** | `bg-transparent text-text-primary hover:bg-ghost-hover rounded-xl` | Low emphasis |
| **Icon** | `rounded-full p-2 text-text-secondary hover:bg-ghost-hover` | Icon-only |
| **Send** | `rounded-full bg-primary p-2.5` | Chat send button |
| **Disabled** | `disabled:opacity-50 disabled:bg-hover disabled:text-text-muted` |

### Cards & Containers

- **Radius:** `rounded-3xl` (24px) for cards; `rounded-xl` (12px) for smaller widgets
- **Border:** `border border-border`
- **Background:** `bg-surface`
- **Shadow:** `shadow-level1` or custom `shadow-[0_4px_6px_-1px_rgb(0_0_0_/_0.1)]`
- **Interactive card:** add `hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]`

### Inputs

- **Chat input:** `rounded-[32px]` pill, `border-border`, `focus:ring-1 focus:ring-primary`
- **Standard:** `rounded-xl`, `px-4 py-2.5`, `text-sm`
- **Placeholder:** `placeholder:text-text-muted` (maps to `--ds-text-secondary`)

### Badges

- **Success:** `bg-[#DCFCE7] text-[#16A34A]`
- **In Progress:** `bg-[#F3E8FF] text-[#9333EA]`
- **Warning:** `bg-[#FEF3C7] text-[#F97316]`
- **Error:** `bg-[#FEE2E2] text-[#DC2626]`
- **Neutral:** `bg-bg text-text-secondary`
- **Radius:** `rounded-[6px]`, `px-2 py-1`, `text-xs`

### Sidebar

- **Width:** 260px
- **Background:** `bg-sidebar` (white)
- **Item:** `rounded-xl px-3 py-2 text-sm text-text-secondary`
- **Hover:** `hover:bg-hover hover:text-text-primary`
- **Active:** `border-l-2 border-primary bg-hover text-text-primary`

---

## 6. Layout & Spacing

- **Grid:** Implicit 8px base (Tailwind defaults)
- **Card padding:** `p-4 sm:p-6` (16–24px)
- **Gap (sections):** `gap-4` (16px) or `gap-5` (20px)
- **Gap (related):** `gap-2`, `gap-3`

### Breakpoints

| Breakpoint | Tailwind | Typical use |
|------------|----------|-------------|
| Mobile | default | Full width, stacked |
| sm | 640px | Slightly wider padding |
| md | 768px | 2-column, sidebar behavior |
| lg | 1024px | Full layout |

---

## 7. Interaction & Motion

- **Hover:** `transition-colors` or `transition-all duration-200`
- **Active (button):** `active:scale-[0.98]` or `active:scale-95`
- **Focus:** `focus:ring-2 focus:ring-primary/50 focus:ring-offset-2`
- **Duration:** ~150–200ms for color; ~300ms for layout/modal

---

## 8. Special Effects

### Text shimmer

- **Class:** `.text-shimmer`
- **Use:** Branded accent text (e.g. "undefined ai")
- **Colors:** Green gradient (`#3d6b00` → `#a8e070` → `#3d6b00`)
- **Animation:** `shimmer` 2.5–3s linear infinite

### Scrollbar

- **Workspace:** `.workspace-scrollbar` — thin scrollbar, `var(--ds-border)` thumb
- **Hide:** `.hide-scrollbar` — no scrollbar (scroll still works)

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `frontend/src/index.css` | CSS variables, theme, global styles |
| `frontend/src/constants/components.ts` | `COMPONENT_STYLES` presets |
| `frontend/src/constants/typography.ts` | Typography scale |
| `frontend/index.html` | Inter font load |

---

## 10. Usage Guidelines

- Prefer semantic classes (`text-text-primary`, `bg-surface`) over raw hex in components.
- Use `COMPONENT_STYLES` from `constants/components.ts` for consistency.
- Status colors use raw hex in badges; semantic `text-success-text`, `bg-error`, etc. where mapped.
- New components should follow the 8px spacing rhythm and existing radius scale (6px, 12px, 24px, 32px).
