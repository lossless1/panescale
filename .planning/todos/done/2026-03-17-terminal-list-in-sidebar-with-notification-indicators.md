---
created: 2026-03-17T14:32:32.718Z
title: Terminal list in sidebar with notification indicators
area: ui
files:
  - src/components/layout/Sidebar.tsx
  - src/components/canvas/TerminalNode.tsx
  - src/stores/canvasStore.ts
---

## Problem

Currently terminals only exist as tiles on the canvas. There's no quick way to see all open terminals at a glance or navigate to a specific one, especially when terminals are spread across a large canvas. When a terminal has a notification (long-running process completed), there's no sidebar indication — the user must visually scan the canvas to find it.

## Solution

Add a "Terminals" section to the left sidebar that lists all open terminal tiles. Each entry shows the terminal name/title and working directory. When a terminal triggers a notification (TERM-16, Phase 3), the corresponding sidebar entry should:
- Blink or pulse briefly to attract attention
- Change its tab/entry color (e.g., accent highlight) until the user clicks it
- Clicking a sidebar terminal entry should pan the canvas to that terminal and focus it

This pairs with TERM-16 (notification sound) and TERM-12 (rename/badges) from Phase 3.
