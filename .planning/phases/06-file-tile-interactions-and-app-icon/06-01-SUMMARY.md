---
phase: 06-file-tile-interactions-and-app-icon
plan: 01
subsystem: ui
tags: [react, xyflow, hooks, terminal, canvas]

requires:
  - phase: 02-sidebar-content-tiles
    provides: Content tile components (FilePreviewNode, ImageNode, NoteNode)
  - phase: 01-canvas-terminal-core
    provides: Terminal node spawning via canvasStore.addTerminalNode
provides:
  - Shared useOpenTerminalFromTile hook for content tile -> terminal spawn
  - Double-click title bar interaction on all content tile types
affects: []

tech-stack:
  added: []
  patterns: [getState() pattern for non-reactive store access in callbacks]

key-files:
  created:
    - src/hooks/useOpenTerminalFromTile.ts
  modified:
    - src/components/canvas/FilePreviewNode.tsx
    - src/components/canvas/ImageNode.tsx
    - src/components/canvas/NoteNode.tsx

key-decisions:
  - "getState() inside useCallback to avoid reactive subscriptions and re-renders"
  - "Math.max of / and \\ separators for cross-platform path extraction"

patterns-established:
  - "Content tile interaction hook pattern: useOpenTerminalFromTile as reusable hook accepting nodeId"

requirements-completed: [TILE-DBLCLICK]

duration: 1min
completed: 2026-03-18
---

# Phase 6 Plan 01: Double-Click Content Tiles to Open Terminal Summary

**Shared useOpenTerminalFromTile hook with title bar double-click handlers on FilePreviewNode, ImageNode, and NoteNode spawning adjacent terminal tiles**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T16:21:14Z
- **Completed:** 2026-03-18T16:22:30Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Created reusable useOpenTerminalFromTile hook that spawns terminal adjacent to any content tile
- Wired onDoubleClick handlers into all three content tile title bars
- FilePreviewNode and ImageNode pass filePath for parent directory extraction
- NoteNode passes undefined, falling back to active project directory

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useOpenTerminalFromTile hook and wire into content tiles** - `65fcbad` (feat)

## Files Created/Modified
- `src/hooks/useOpenTerminalFromTile.ts` - Shared hook: resolves cwd from filePath, computes spawn position, calls addTerminalNode
- `src/components/canvas/FilePreviewNode.tsx` - Added id destructure, hook call, onDoubleClick on title bar
- `src/components/canvas/ImageNode.tsx` - Added hook call, onDoubleClick on title bar
- `src/components/canvas/NoteNode.tsx` - Added hook call, onDoubleClick with undefined (fallback to project dir)

## Decisions Made
- Used getState() pattern inside useCallback to avoid reactive subscriptions and unnecessary re-renders
- Cross-platform path extraction using Math.max of `/` and `\\` lastIndexOf for Windows compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Content tile double-click interaction complete
- Ready for remaining Phase 6 plans (app icon, etc.)

---
*Phase: 06-file-tile-interactions-and-app-icon*
*Completed: 2026-03-18*
