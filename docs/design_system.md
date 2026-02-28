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
- **Progress Purple:** `#D8B4FE` (Used for "In Progress" badges)
- **Subtle Blue/Gray:** `#EFF6FF` (Hover states for menu items)

## 2. Typography
A sans-serif typeface (like Inter or Plus Jakarta Sans) is prioritized for legibility and a modern "SaaS" feel.

| Element | Size | Weight | Color |
|---|---|---|---|
| H1 (Hero Greeting) | 32px | 600 (Semi-Bold) | `#111827` (Dark Gray) |
| H2 (Card Titles) | 16px | 600 (Semi-Bold) | `#111827` |
| Primary Body | 14px | 400 (Regular) | `#374151` (Medium Gray) |
| Secondary/Caption | 12px | 400 (Regular) | `#6B7280` (Light Gray) |
| Button Text | 14px | 500 (Medium) | White or Primary |

## 3. UI Components

### Buttons
- **Primary (New Chat):** Deep navy background (`#0A0E1A`), high rounded corners (24px), white text, often accompanied by a small sparkle icon.
- **Secondary/Action:** White background, 1px `#E5E7EB` border, 12px border radius.
- **Ghost/Icon:** No background, subtle hover effect (`#F3F4F6`), used for sidebar icons.

### Cards & Containers
- **Border Radius:**
  - Main UI Containers: 24px
  - Small Widgets/Badges: 12px
- **Shadows:** Low-opacity soft shadows (`0 4px 6px -1px rgb(0 0 0 / 0.1)`).
- **Stroke:** 1px solid `#E5E7EB`.

### Inputs & Text Areas
- **Chat Input:** Large pill-shaped container (32px radius), background `#FFFFFF`, light border. Contains floating actions for "Attach," "Voice," and "Send."
- **Send Button:** Circular, navy background, white icon.

### Badges & Status Indicators
- **Status Badges:** Small rectangles with 6px radius.
- **Low Priority:** Light green background, dark green text.
- **In Progress:** Light purple background, dark purple text.
- **Progress Rings:** Circular icons with partial strokes to indicate task completion percentage.

## 4. Layout & Spacing
The system follows an 8px grid system for consistent spacing.
- **Sidebar Width:** 260px.
- **Outer Page Margin:** 32px.
- **Card Internal Padding:** 16px to 24px.
- **Gap between elements:** 12px for related items; 24px for distinct sections.

## 5. Iconography & Imagery
- **Style:** Minimalist, thin-line icons (2px stroke width).
- **Avatar:** Circular with a subtle outer glow or border.
- **Visual Elements:** Use of soft gradients (e.g., the blue/purple orb) to add depth without cluttering the interface.

## 6. Interaction States
- **Hover:** Background transitions to a lighter shade (`#F9FAFB`) or 5% opacity of the brand color.
- **Active/Selected:** 2px left-border accent in the sidebar or a subtle background fill.
- **Loading:** Skeleton screens mimicking the card layout.

## 7. Design Principle
**"Whitespace is a tool, not a gap."** The interface maintains high legibility by ensuring no two functional groups are cramped, allowing the user to focus on the AI conversation or task list.