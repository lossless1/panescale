---
phase: 02-sidebar-session-persistence
plan: 05
subsystem: ui
tags: [drag-and-drop, react-flow, canvas, sidebar, html5-dnd, tauri-fs]

requires:
  - phase: 02-01
    provides: FileTreeItem component and FileEntry interface for sidebar file tree
provides:
  - Drag-to-canvas creates note, image, and file-preview tiles auto-typed by extension
  - extensionToTileType helper for mapping file extensions to tile types
  - addContentNode method on canvasStore for creating content tiles
  - NoteNode, ImageNode, FilePreviewNode stub components
affects: [05-content-editing, canvas-persistence]

tech-stack:
  added: []
  patterns: [HTML5 DnD dataTransfer with custom MIME type, convertFileSrc for image assets, readTextFile for file content]

key-files:
  created:
    - src/components/canvas/NoteNode.tsx
    - src/components/canvas/ImageNode.tsx
    - src/components/canvas/FilePreviewNode.tsx
  modified:
    - src/lib/ipc.ts
    - src/components/sidebar/FileTreeItem.tsx
    - src/stores/canvasStore.ts
    - src/components/canvas/Canvas.tsx

key-decisions:
  - "HTML5 DnD with application/excalicode-file custom MIME type for sidebar-to-canvas drag"
  - "Stub tiles are read-only with plain text rendering (full editing deferred to Phase 5)"
  - "convertFileSrc for image tile asset URLs instead of base64 encoding"

patterns-established:
  - "Content tile pattern: title bar with drag-handle class + scrollable content area"
  - "extensionToTileType mapping for file-type-aware tile creation"

requirements-completed: [SIDE-07]

duration: 3min
completed: 2026-03-18
---

# Phase 2 Plan 5: Drag File to Canvas Summary

**HTML5 drag-and-drop from sidebar file tree to canvas creating auto-typed content tiles (note/image/file-preview) via custom MIME dataTransfer**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T08:48:11Z
- **Completed:** 2026-03-18T08:50:46Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments
- Files can be dragged from sidebar FileTreeItem onto the canvas via HTML5 DnD
- .md files create NoteNode tiles that read and display file content as plain text
- Image files (.png, .jpg, etc.) create ImageNode tiles using Tauri convertFileSrc
- All other files create FilePreviewNode tiles with monospace code display
- Tiles appear at exact drop position on canvas with title bar and drag handle

## Task Commits

Each task was committed atomically:

1. **Task 1: Drag source on file tree + drop handler on canvas + content node types** - `f8778ec` (feat)

## Files Created/Modified
- `src/lib/ipc.ts` - Added ContentTileType type and extensionToTileType helper
- `src/components/sidebar/FileTreeItem.tsx` - Added draggable and onDragStart with excalicode-file dataTransfer
- `src/stores/canvasStore.ts` - Added addContentNode method for creating content tiles
- `src/components/canvas/Canvas.tsx` - Added onDragOver/onDrop handlers and registered 3 new node types
- `src/components/canvas/NoteNode.tsx` - Read-only markdown note tile using readTextFile
- `src/components/canvas/ImageNode.tsx` - Image display tile using convertFileSrc
- `src/components/canvas/FilePreviewNode.tsx` - Code preview tile with monospace pre/code rendering

## Decisions Made
- Used `application/excalicode-file` custom MIME type for drag data to avoid conflicts with other drag sources
- Stub tiles are read-only with plain text rendering; full TipTap editing deferred to Phase 5
- ImageNode uses `convertFileSrc` from Tauri API for asset URLs rather than base64-encoding files
- Content tiles follow same visual pattern as TerminalNode: title bar with drag-handle + content area

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Content tile types registered and functional for drag-to-canvas workflow
- Phase 5 can enhance these stub tiles with full editing capabilities (TipTap for notes, etc.)
- Persistence of content tiles depends on extending the canvas serialization format

---
*Phase: 02-sidebar-session-persistence*
*Completed: 2026-03-18*
