# Dashboard 2-Column Layout Design

## Overview

Redesign the dashboard's collapsible sections into a 2-column grid layout with content always visible, improving space utilization and reducing clicks.

## Goals

1. Sections open by default (no clicking to expand)
2. Better space utilization with 2-column layout
3. Cleaner look by removing collapse UI

## What Stays the Same

The top portion of the dashboard remains unchanged:
- Hero Net Worth card (purple gradient)
- Quick Actions bar (Refresh, Add Account, YNAB, Time Period)
- Period Summary + Top Categories (2-column grid)
- Assets, Liabilities, Runway cards (3-column grid with breakdowns)

## New Section Layout

Replace 4 `CollapsibleSection` components with regular `Card` components in a 2-column grid:

```
┌─────────────────────────────┬─────────────────────────────┐
│   Net Worth Over Time       │     Portfolio Breakdown     │
│   (Line chart)              │   (Pie chart + list)        │
└─────────────────────────────┴─────────────────────────────┘
┌─────────────────────────────┬─────────────────────────────┐
│   Income vs Expenses        │    Recent Transactions      │
│   (Bar chart)               │   (Table)                   │
└─────────────────────────────┴─────────────────────────────┘
```

### Pairing Rationale

- **Row 1:** Net worth trend paired with portfolio composition (wealth overview)
- **Row 2:** Cash flow chart paired with transaction details (spending overview)

## Card Structure

Each card will have:
- Simple header with icon + title (no collapse button/chevron)
- Subtitle showing time period where applicable
- Content area with chart or table

## Responsive Behavior

- **Desktop (lg+):** 2-column grid
- **Tablet/Mobile (<lg):** Single column stack

Uses existing pattern: `grid-cols-1 lg:grid-cols-2`

## Implementation Changes

1. Remove `CollapsibleSection` component usage (can keep component for other pages)
2. Create simple `SectionCard` wrapper or use `Card` directly with consistent header styling
3. Arrange 4 sections in 2x2 grid
4. Maintain existing chart heights (`h-72` for charts)
5. CSS grid handles equal row heights automatically

## Files to Modify

- `frontend/src/components/pages/Dashboard.jsx` - Main changes
