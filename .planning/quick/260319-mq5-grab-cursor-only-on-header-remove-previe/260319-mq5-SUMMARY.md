---
phase: quick
plan: 260319-mq5
subsystem: canvas-ux
tags: [cursor, file-preview, codemirror]
dependency-graph:
  requires: []
  provides: [grab-cursor-header-only, always-edit-file-tiles]
  affects: [FilePreviewNode, Canvas]
tech-stack:
  added: []
  patterns: [css-cursor-override, simplified-component-state]
key-files:
  created: []
  modified:
    - src/components/canvas/Canvas.tsx
    - src/components/canvas/FilePreviewNode.tsx
decisions:
  - CSS !important override on .react-flow__node for cursor reset (React Flow sets cursor:grab by default on nodes)
  - Removed all shiki preview infrastructure from FilePreviewNode since CodeMirror provides syntax highlighting in edit mode
metrics:
  duration: 3 min
  completed: "2026-03-19T15:28:32Z"
---

# Quick Task 260319-mq5: Grab Cursor Only on Header, Remove Preview Mode Summary

Restricted grab cursor to .drag-handle title bar headers via CSS override on .react-flow__node, and stripped shiki preview mode from FilePreviewNode to always render the CodeMirror editor.

## What Was Done

### Task 1: Override node cursor and remove preview mode from FilePreviewNode

**Canvas.tsx:**
- Added `.react-flow__node { cursor: default !important; }` CSS rule to the existing style block
- This overrides React Flow's default `cursor: grab` on all nodes, so only `.drag-handle` elements (with inline `cursor: grab`) show the grab cursor

**FilePreviewNode.tsx:**
- Removed `getHighlighter` and `loadedLangs` imports from shikiHighlighter (kept `detectLanguage`)
- Removed `isEditing`, `highlightedHtml`, and `loading` state variables
- Replaced with simple `loaded` boolean state
- Removed the entire shiki highlight `useEffect` (30+ lines)
- Removed the Preview/Edit toggle button from the header
- Simplified the body from a 4-branch ternary (error/loading/editing/preview) to a clean 3-branch render (error/loading/CodeEditor)

**Commit:** a3346ba

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles with zero errors (`npx tsc --noEmit`)
- FilePreviewNode.tsx has no references to `isEditing`, `highlightedHtml`, `loading`, `getHighlighter`, or `loadedLangs`
- FilePreviewNode.tsx still imports and renders `CodeEditor`
- Canvas.tsx contains `.react-flow__node { cursor: default !important; }`
- NoteNode.tsx was not modified by this task

## Self-Check: PASSED
