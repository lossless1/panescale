---
quick_id: 260410-f0f
slug: add-cmd-alt-up-down-keyboard-shortcut-to
date: 2026-04-10
status: complete
---

# Terminal Pile Navigation Shortcut

## What was built

Global keyboard shortcut to cycle through terminal piles in the sidebar:

- **macOS:** `Cmd + Option + ↑ / ↓`
- **Linux / Windows:** `Ctrl + Alt + ↑ / ↓`

Pressing it selects the previous/next terminal in the pile list, pans the canvas to it, brings it to front, and enters terminal focus mode — identical to clicking the row in the sidebar. Wraps around at both ends.

## Files modified

- `src/components/sidebar/TerminalList.tsx`
  - Extracted `selectTerminal(nodeId)` callback from the inline `onSelect` handler (shared by click + keyboard)
  - Added a global `keydown` listener (capture phase) that matches the shortcut, computes the next index from `activeTerminalId || selectedNodeId`, and calls `selectTerminal`
  - Platform detection via `navigator.platform` (Cmd on macOS, Ctrl elsewhere)
  - `renderNode.onSelect` now just calls `selectTerminal(node.id)` — no duplication

## Key decisions

- **Capture phase** on the `keydown` listener so we intercept before xterm's own input handling when a terminal is focused.
- **Wrap-around** navigation (last → first, first → last) — no hard stops.
- **Fallback start position**: if no terminal is currently selected, `ArrowDown` jumps to the first, `ArrowUp` to the last.

## Verification

- `npx tsc --noEmit` passes
