---
created: 2026-03-18T09:30:00.000Z
title: Fix canvas dots visibility at zoom-out and window border rendering
area: ui
files:
  - src/components/canvas/Canvas.tsx
  - src/components/layout/AppShell.tsx
  - src/styles/globals.css
---

## Problem

Two visual issues noticed when running the app:

1. **Canvas dot grid disappears at zoom-out**: When zooming out, the dot grid becomes nearly invisible. The dots don't scale to remain visible at lower zoom levels. They should feel infinite — always visible regardless of zoom level, like Panescale's grid that adjusts dot size/density based on zoom.

2. **Window border has white background with excessive rounding**: The `transparent: true` + `border-radius` approach for rounded corners is showing a white background bleed at the edges and the border-radius appears too large. The desired effect is subtle rounded corners on the window (like native macOS windows), not a heavily rounded border with visible white background.

## Solution

### Dot grid fix:

- Scale dot size inversely with zoom level so dots remain visible at all zoom levels
- Or use React Flow's `<Background>` component with `gap` that adjusts based on viewport zoom
- Consider multi-level grid: show larger dots at lower zoom, finer dots at higher zoom

### Window border fix:

- Reduce `border-radius` to match native macOS window corners (~10px, not the current excessive value)
- Ensure `html`, `body`, and `#root` all have `background: transparent` so no white bleeds through
- The AppShell should have the theme background color with the border-radius, and nothing else should have a background that could show at the corners
- May need `overflow: hidden` on the rounded container to clip content at corners
