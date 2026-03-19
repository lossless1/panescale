---
phase: quick
plan: 260319-mjb
subsystem: ui
tags: [codemirror, syntax-highlighting, code-editor, react]

provides:
  - "CodeMirror 6 editor component for inline code editing with syntax highlighting"
  - "Theme-aware code editing in FilePreviewNode (light/dark)"
affects: [FilePreviewNode, code-editing]

tech-stack:
  added: [codemirror, "@codemirror/lang-*", "@codemirror/theme-one-dark"]
  patterns: [compartment-based dynamic reconfiguration for CM6]

key-files:
  created:
    - src/components/canvas/CodeEditor.tsx
    - src/styles/codemirror.css
  modified:
    - src/components/canvas/FilePreviewNode.tsx
    - package.json

key-decisions:
  - "Used Compartment-based reconfiguration for dynamic language/theme switching"
  - "Light theme uses transparent background to inherit from parent container"
  - "Individual CM6 extension imports instead of basicSetup for fine-grained control"

requirements-completed: []

duration: 2min
completed: 2026-03-19
---

# Quick Task 260319-mjb: Replace Plain Textarea with Syntax Highlighting Summary

**CodeMirror 6 editor replaces plain textarea in FilePreviewNode edit mode with live syntax highlighting, theme-aware coloring, and Cmd+S save**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T15:15:46Z
- **Completed:** 2026-03-19T15:17:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created CodeEditor.tsx wrapper around CodeMirror 6 with language detection for 14+ languages
- Replaced plain textarea in FilePreviewNode with syntax-highlighted editor
- Theme switching between light and dark mode via Compartment reconfiguration
- Cmd/Ctrl+S keyboard save shortcut integrated via CM6 keymap

## Task Commits

Each task was committed atomically:

1. **Task 1: Install CodeMirror 6 and create CodeEditor component** - `31bc3f7` (feat)
2. **Task 2: Integrate CodeEditor into FilePreviewNode edit mode** - `3e8a4a9` (feat)

## Files Created/Modified
- `src/components/canvas/CodeEditor.tsx` - CodeMirror 6 wrapper with language detection, theme switching, save keymap
- `src/styles/codemirror.css` - Font, layout, and background overrides for CM6
- `src/components/canvas/FilePreviewNode.tsx` - Replaced textarea with CodeEditor component
- `package.json` - Added codemirror and language/theme extension packages

## Decisions Made
- Used Compartment-based reconfiguration for dynamic language and theme switching (avoids full editor recreation)
- Light theme uses transparent background to inherit from FilePreviewNode container
- Individual CM6 extension imports (lineNumbers, foldGutter, bracketMatching, etc.) instead of basicSetup for fine-grained control over editor features
- Wheel event stopPropagation on container to prevent canvas zoom while scrolling in editor

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260319-mjb*
*Completed: 2026-03-19*
