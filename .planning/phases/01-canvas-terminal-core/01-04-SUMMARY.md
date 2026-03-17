---
phase: 01-canvas-terminal-core
plan: 04
subsystem: ui
tags: [xterm.js, react-flow, pty, terminal, zustand, webgl, clipboard]

requires:
  - phase: 01-02
    provides: "Canvas component, canvasStore, themeStore, AppShell"
  - phase: 01-03
    provides: "Rust PTY backend with pty_spawn, pty_write, pty_resize, pty_kill commands"
provides:
  - "TerminalNode React Flow custom node with xterm.js rendering"
  - "TerminalTitleBar with drag handle, cwd display, close button"
  - "IPC typed wrappers for PTY Tauri commands"
  - "usePty hook for PTY lifecycle management"
  - "useFocusMode two-mode focus system (canvas/terminal)"
  - "settingsStore for terminal font, size, scrollback"
  - "Double-click canvas to spawn terminal"
  - "Copy/paste support via Cmd/Ctrl+C/V"
affects: [01-05, session-persistence, layout-management]

tech-stack:
  added: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-webgl"]
  patterns: ["Channel-based IPC for PTY events", "Two-mode focus system", "React.memo + nodrag/nowheel/nopan for custom nodes"]

key-files:
  created:
    - src/lib/ipc.ts
    - src/hooks/usePty.ts
    - src/hooks/useFocusMode.ts
    - src/stores/settingsStore.ts
    - src/components/canvas/TerminalNode.tsx
    - src/components/canvas/TerminalTitleBar.tsx
    - src/test/terminal.test.ts
  modified:
    - src/stores/canvasStore.ts
    - src/components/canvas/Canvas.tsx

key-decisions:
  - "canvasStore.addTerminalNode uses crypto.randomUUID instead of counter-based IDs"
  - "PTY ID managed by component (usePty hook), not stored in canvas store"
  - "WebGL addon loaded with try/catch fallback to DOM renderer"
  - "Escape key handler uses capture phase to intercept before other handlers"
  - "Shift+scroll passes through to canvas panning, regular scroll stays in terminal"

patterns-established:
  - "Channel-based IPC: Create Channel<PtyEvent>, wire onmessage to xterm.write"
  - "Two-mode focus: useFocusModeStore with enterTerminalMode/exitToCanvasMode"
  - "Custom node pattern: React.memo + nodrag/nowheel/nopan + NodeResizer"
  - "ResizeObserver for live terminal reflow on tile resize"

requirements-completed: [TERM-01, TERM-03, TERM-04, TERM-05, TERM-07, TERM-08, TERM-14]

duration: 4min
completed: 2026-03-17
---

# Phase 1 Plan 4: Terminal Tiles Summary

**Fully functional xterm.js terminal tiles on React Flow canvas with PTY IPC, two-mode focus, drag/resize/z-index/close, and copy/paste**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-17T14:15:24Z
- **Completed:** 2026-03-17T14:19:48Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Terminal tiles render real xterm.js instances connected to backend PTY via Channel-based IPC
- Two-mode focus system (canvas/terminal) prevents event conflicts; Escape returns to canvas mode
- Full tile management: drag by title bar, resize with live reflow, z-index on click, close kills PTY
- Copy/paste support via Cmd/Ctrl+C (with selection awareness) and Cmd/Ctrl+V
- WebGL renderer with automatic DOM fallback for compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: IPC wrappers, PTY hook, focus mode, and settings store** - `5c812ce` (feat)
2. **Task 2: TerminalNode with xterm.js, title bar, canvas integration** - `f178730` (feat)

## Files Created/Modified
- `src/lib/ipc.ts` - Typed Tauri command wrappers for pty_spawn, pty_write, pty_resize, pty_kill
- `src/hooks/usePty.ts` - React hook for PTY lifecycle (spawn, write, resize, kill, cleanup on unmount)
- `src/hooks/useFocusMode.ts` - Zustand store + hook for canvas/terminal two-mode focus switching
- `src/stores/settingsStore.ts` - Terminal settings: font family, font size, scrollback
- `src/components/canvas/TerminalNode.tsx` - React Flow custom node with xterm.js, resize, focus, copy/paste
- `src/components/canvas/TerminalTitleBar.tsx` - Title bar with shell type, cwd, close button
- `src/test/terminal.test.ts` - 8 test stubs for focus mode, settings, canvas store, and components
- `src/stores/canvasStore.ts` - Updated addTerminalNode to use crypto.randomUUID, removed ptyId param
- `src/components/canvas/Canvas.tsx` - Registered TerminalNode, wired double-click spawn and onNodeClick

## Decisions Made
- canvasStore.addTerminalNode uses crypto.randomUUID instead of counter-based IDs for better uniqueness
- PTY ID is managed by the component via usePty hook, not stored in the canvas store (avoids stale state)
- WebGL addon loaded with try/catch fallback to DOM renderer for broad platform support
- Escape key handler registered in capture phase to intercept before other handlers
- Shift+scroll passes through to canvas panning; regular scroll stays in terminal scrollback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed canvasStore.addTerminalNode signature**
- **Found during:** Task 2 (TerminalNode component)
- **Issue:** Existing addTerminalNode accepted (position, ptyId, cwd) but plan specifies PTY is managed by the component, not passed to the store
- **Fix:** Changed signature to (position, cwd), removed ptyId from node data, added shellType, switched to crypto.randomUUID for node IDs
- **Files modified:** src/stores/canvasStore.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** f178730 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correction to align store API with component architecture. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terminal tiles are fully functional, ready for session persistence (Plan 05)
- PTY lifecycle properly managed with cleanup on unmount
- Focus mode system ready for extension with additional keyboard shortcuts

---
*Phase: 01-canvas-terminal-core*
*Completed: 2026-03-17*
