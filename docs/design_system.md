# Design System

## 1. Color Palette
The color strategy uses a "Soft Tech" approach, combining deep neutrals with vibrant accent colors for clarity and state management.

### Primary Neutrals
- **Surface White:** `#FFFFFF` (Main cards, background containers)
- **App Background:** `#F8F9FA` (Subtle off-white for the main workspace)
- **Sidebar Deep:** `#0A0E1A` (Primary navigation background)
- **Border/Stroke:** `#E5E7EB` (Light gray for thin dividers and card outlines)

### Accent & Semantic Colors
- **Orbita Blue:** `#4F46E5` (Primary brand color for buttons and active states)
- **Success Green:** `#22C55E` (Completed tasks, positive indicators)
- **Warning Orange:** `#F97316` (In-progress indicators)
- **Error Red:** `#EF4444` (Destructive actions, validation errors)
- **Progress Purple:** `#D8B4FE` (Used for "In Progress" badges)
- **Subtle Blue/Gray:** `#EFF6FF` (Hover states for menu items)
- **Disabled State:** `#9CA3AF` (Text/Icons) / `#F3F4F6` (Backgrounds)

## 2. Typography
A sans-serif typeface (like Inter or Plus Jakarta Sans) is prioritized for legibility and a modern "SaaS" feel.

| Element | Size | Weight | Line Height | Color |
|---|---|---|---|---|
| H1 (Hero Greeting) | 32px | 600 (Semi-Bold) | 1.2 | `#111827` (Dark Gray) |
| H2 (Card Titles) | 16px | 600 (Semi-Bold) | 1.4 | `#111827` |
| Primary Body | 14px | 400 (Regular) | 1.5 | `#374151` (Medium Gray) |
| Secondary/Caption | 12px | 400 (Regular) | 1.5 | `#6B7280` (Light Gray) |
| Button Text | 14px | 500 (Medium) | 1.0 | White or Primary |

## 3. UI Components

### Buttons
- **Primary (New Chat):** Deep navy background (`#0A0E1A`), high rounded corners (24px), white text, often accompanied by a small sparkle icon.
- **Secondary/Action:** White background, 1px `#E5E7EB` border, 12px border radius.
- **Ghost/Icon:** No background, subtle hover effect (`#F3F4F6`), used for sidebar icons.
- **Disabled:** `#F3F4F6` background, `#9CA3AF` text, cursor-not-allowed.

### Cards & Containers
- **Border Radius:**
  - Main UI Containers: 24px
  - Small Widgets/Badges: 12px
- **Shadows (Elevation):**
  - Level 1 (Cards/Inputs): Low-opacity soft shadows (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`).
  - Level 2 (Dropdowns/Tooltips): Medium shadows (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`).
  - Level 3 (Modals/Dialogs): Large, diffuse shadows (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`).
- **Stroke:** 1px solid `#E5E7EB`.

### Inputs & Text Areas
- **Chat Input:** Large pill-shaped container (32px radius), background `#FFFFFF`, light border. Contains floating actions for "Attach," "Voice," and "Send."
- **Send Button:** Circular, navy background, white icon.
- **Focus State:** 2px solid `#4F46E5` outline (with 2px offset for accessibility) or a soft `#EFF6FF` glow.

### Badges & Status Indicators
- **Status Badges:** Small rectangles with 6px radius.
- **Low Priority:** Light green background, dark green text.
- **In Progress:** Light purple background, dark purple text.
- **Progress Rings:** Circular icons with partial strokes to indicate task completion percentage.

## 4. Layout & Spacing
The system follows an 8px grid system for consistent spacing.
- **Sidebar Width:** 260px (collapsed to 64px on smaller screens).
- **Outer Page Margin:** 32px (Desktop), 16px (Mobile).
- **Card Internal Padding:** 16px to 24px.
- **Gap between elements:** 12px for related items; 24px for distinct sections.

### Breakpoints
- **Mobile:** `< 768px` (Sidebar hidden behind hamburger menu, 100% width cards).
- **Tablet:** `768px - 1024px` (Collapsed sidebar, 2-column grids max).
- **Desktop:** `> 1024px` (Full layout, expanded sidebar).

## 5. Iconography & Imagery
- **Style:** Minimalist, thin-line icons (1.5px to 2px stroke width).
- **Avatar:** Circular with a subtle outer glow or border.
- **Visual Elements:** Use of soft gradients (e.g., the blue/purple orb) to add depth without cluttering the interface.

## 6. Interaction States & Motion
All interactive elements should feel responsive and fluid.
- **Hover:** Background transitions to a lighter shade (`#F9FAFB`) or 5% opacity of the brand color.
- **Active/Selected:** 2px left-border accent in the sidebar or a subtle background fill.
- **Loading:** Skeleton screens mimicking the card layout.
- **Transitions:** `150ms ease-in-out` for color/background changes; `300ms cubic-bezier(0.4, 0, 0.2, 1)` for layout/modal animations.

## 7. Design Principle
**"Whitespace is a tool, not a gap."** The interface maintains high legibility by ensuring no two functional groups are cramped, allowing the user to focus on the AI conversation or task list.