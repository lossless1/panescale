---
phase: quick
plan: 260319-hbw
subsystem: ui
tags: [tauri, macos, window-decorations, settings-modal, cursor]

provides:
  - Native macOS window buttons via overlay title bar style
  - Settings modal with theme, color scheme, font, size, scrollback controls
  - Default arrow cursor on canvas pane

tech-stack:
  added: []
  patterns:
    - "Overlay title bar style for native macOS traffic lights"
    - "Fixed overlay modal with click-outside and Escape to close"

key-files:
  created:
    - src/components/layout/SettingsModal.tsx
  modified:
    - src-tauri/tauri.conf.json
    - src-tauri/src/lib.rs
    - src-tauri/Cargo.toml
    - src/components/layout/TitleBar.tsx
    - src/components/layout/StatusBar.tsx
    - src/components/canvas/Canvas.tsx
    - src/styles/globals.css

key-decisions:
  - "Overlay titleBarStyle replaces custom cocoa/objc window styling"
  - "78px left padding in TitleBar for native traffic light buttons spacing"

duration: 3min
completed: 2026-03-19
---

# Quick Task 260319-hbw: Native macOS Window Buttons, Settings Modal, Canvas Cursor Fix Summary

**Native macOS traffic lights via overlay title bar, settings gear/modal in status bar, and default arrow cursor on canvas**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T11:31:29Z
- **Completed:** 2026-03-19T11:34:23Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Switched to native macOS window decorations with overlay title bar style, removing custom WindowControls and cocoa/objc dependencies
- Created SettingsModal component with Appearance (theme preference, terminal color scheme) and Terminal (font family, font size, scrollback) sections wired to existing stores
- Fixed canvas pane cursor from hand/grab to default arrow, preserving Space-held grab mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Native macOS window buttons + rounded corners** - `13ca6d5` (feat)
2. **Task 2: Settings gear button + modal** - `a8fd8ef` (feat)
3. **Task 3: Fix canvas cursor to default arrow** - `97df580` (fix)

## Files Created/Modified
- `src-tauri/tauri.conf.json` - decorations:true, titleBarStyle:overlay, removed transparent
- `src-tauri/src/lib.rs` - Removed apply_macos_window_styling and cocoa/objc imports
- `src-tauri/Cargo.toml` - Removed cocoa and objc macOS dependencies
- `src/components/layout/TitleBar.tsx` - Removed WindowControls, added paddingLeft:78 for native buttons
- `src/components/layout/SettingsModal.tsx` - New settings modal with Appearance and Terminal sections
- `src/components/layout/StatusBar.tsx` - Added gear button and SettingsModal rendering
- `src/components/canvas/Canvas.tsx` - Added cursor:default rule for .react-flow__pane
- `src/styles/globals.css` - Removed border-radius:10px from html/body

## Decisions Made
- Overlay titleBarStyle replaces all custom cocoa/objc window styling -- simpler, native, no Rust dependencies
- 78px left padding in TitleBar provides spacing for native traffic light buttons (70px buttons + 8px gap)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260319-hbw*
*Completed: 2026-03-19*
