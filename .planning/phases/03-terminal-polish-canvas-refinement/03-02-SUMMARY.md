---
phase: 03-terminal-polish-canvas-refinement
plan: 02
subsystem: ui
tags: [xterm, web-audio, zustand, react, inline-edit, context-menu]

requires:
  - phase: 03-01
    provides: "Terminal search, URLs, title bar, scrollback settings"
  - phase: 01-04
    provides: "TerminalNode component, usePty hook, xterm integration"
provides:
  - "Inline terminal rename via double-click title bar"
  - "Badge color picker with 8 preset colors via right-click title bar"
  - "Bell notification with Web Audio chime and sidebar pulse indicator"
  - "Startup command per terminal that auto-runs on fresh spawn"
  - "updateNodeData store action for partial node data updates"
  - "bellActiveNodes transient state for cross-component bell tracking"
affects: [03-03, persistence, sidebar]

tech-stack:
  added: [Web Audio API]
  patterns: [updateNodeData partial update, transient Set state, programmatic audio]

key-files:
  created:
    - src/lib/audio.ts
  modified:
    - src/stores/canvasStore.ts
    - src/lib/ipc.ts
    - src/lib/persistence.ts
    - src/components/canvas/TerminalTitleBar.tsx
    - src/components/canvas/TerminalNode.tsx
    - src/components/sidebar/TerminalList.tsx

key-decisions:
  - "Web Audio API for bell chime instead of audio file (no asset dependency)"
  - "window.prompt for startup command input (rare action, simple UX)"
  - "bellActiveNodes as Set<string> transient state (not persisted)"
  - "Badge color picker as absolute-positioned dropdown on right-click"

patterns-established:
  - "updateNodeData: partial data update pattern for node customization"
  - "Transient Set state for ephemeral UI indicators (bell pulse)"

requirements-completed: [TERM-12, TERM-13, TERM-16]

duration: 4min
completed: 2026-03-18
---

# Phase 3 Plan 2: Terminal Rename, Badges, Bell, Startup Commands Summary

**Inline terminal rename, 8-color badge picker, Web Audio bell chime with sidebar pulse, and per-terminal startup commands**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T10:43:21Z
- **Completed:** 2026-03-18T10:47:05Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Terminal title bar supports inline rename on double-click and badge color picker on right-click
- Bell character triggers Web Audio chime (880Hz sine) when terminal is unfocused, with 5-second sidebar pulse animation
- Startup command can be set per terminal via right-click context menu and auto-executes on fresh spawn
- Badge colors and custom names persist through save/restore cycle via extended SerializedNode

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend canvas state and persistence** - `147a9b5` (feat)
2. **Task 2: Title bar rename, badge picker, bell, startup, sidebar indicators** - `16bcb40` (feat)

## Files Created/Modified

- `src/lib/audio.ts` - Web Audio API bell chime utility (playBellChime)
- `src/lib/ipc.ts` - Extended SerializedNode.data with customName, badgeColor, startupCommand
- `src/stores/canvasStore.ts` - Added updateNodeData, bellActiveNodes, setBellActive
- `src/lib/persistence.ts` - Serialize/deserialize new fields for persistence round-trip
- `src/components/canvas/TerminalTitleBar.tsx` - Inline rename, badge color picker dropdown
- `src/components/canvas/TerminalNode.tsx` - Bell handler, startup command, wired new props
- `src/components/sidebar/TerminalList.tsx` - Badge color dots, bell pulse animation, custom names

## Decisions Made

- Web Audio API for bell chime instead of audio file -- eliminates asset dependency, generates 880Hz A5 sine wave
- window.prompt for startup command input -- rare action that does not warrant custom UI component
- bellActiveNodes as transient Set (not persisted) -- bell state is ephemeral, cleared after 5 seconds or click
- Badge color picker as absolute-positioned dropdown on right-click -- avoids modal complexity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All terminal personalization features complete (rename, badge, startup command, bell notification)
- Ready for Plan 03-03 (remaining canvas refinement work)

---
*Phase: 03-terminal-polish-canvas-refinement*
*Completed: 2026-03-18*
