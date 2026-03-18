---
phase: 02-sidebar-session-persistence
plan: 02
subsystem: ui
tags: [xterm, theming, zustand, matchMedia, terminal-colors, macos]

# Dependency graph
requires:
  - phase: 01-canvas-terminal-core
    provides: "themeStore, settingsStore, TerminalNode with xterm.js"
provides:
  - "Three-mode ThemePreference (system/dark/light) with matchMedia listener"
  - "One Dark and Dracula terminal color scheme presets (ITheme)"
  - "colorScheme selection in settingsStore with zustand persist"
  - "Transparent window with rounded corners on macOS"
affects: [sidebar-settings-panel, terminal-preferences-ui]

# Tech tracking
tech-stack:
  added: [zustand/middleware persist]
  patterns: [system-theme-detection, terminal-color-scheme-presets]

key-files:
  created:
    - src/lib/terminalSchemes.ts
  modified:
    - src/stores/themeStore.ts
    - src/stores/settingsStore.ts
    - src/styles/themes.ts
    - src/components/canvas/TerminalNode.tsx
    - src/components/layout/AppShell.tsx
    - src-tauri/tauri.conf.json

key-decisions:
  - "Backward-compat: kept .theme alias on themeStore for existing consumers"
  - "toggleTheme cycles System->Dark->Light->System instead of binary toggle"
  - "Rounded corners on AppShell (outermost layout div) not App.tsx"
  - "Removed CSS-derived buildXtermTheme in favor of preset ITheme objects"

patterns-established:
  - "System theme detection: synchronous matchMedia read at store init, async listener for changes"
  - "Terminal color presets: hardcoded ITheme objects, no CSS variable derivation"
  - "Settings persistence: zustand persist middleware with localStorage"

requirements-completed: [THEM-02, THEM-03, THEM-04]

# Metrics
duration: 4min
completed: 2026-03-18
---

# Phase 2 Plan 02: Theme System + Terminal Colors Summary

**Three-mode theme preference (system/dark/light) with One Dark and Dracula terminal color schemes, and rounded macOS window corners**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T08:39:20Z
- **Completed:** 2026-03-18T08:43:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ThemeStore supports System/Dark/Light preference with matchMedia listener for auto-detection
- Created One Dark and Dracula ITheme presets with full ANSI color palettes
- SettingsStore persists colorScheme selection via zustand persist middleware
- Terminal tiles render with selected color scheme and update live on change
- macOS window has rounded corners via transparent webview + CSS border-radius

## Task Commits

Each task was committed atomically:

1. **Task 1: Three-mode theme + terminal color schemes** - `df00a0d` (feat)
2. **Task 2: Apply color scheme to terminals + rounded corners** - `fcf5d52` (feat)

## Files Created/Modified
- `src/lib/terminalSchemes.ts` - One Dark and Dracula ITheme presets with full ANSI palettes
- `src/stores/themeStore.ts` - ThemePreference (system/dark/light) with matchMedia listener and backward-compat aliases
- `src/stores/settingsStore.ts` - Added colorScheme field with zustand persist middleware
- `src/styles/themes.ts` - Added ResolvedTheme type, kept ThemeName as alias
- `src/components/canvas/TerminalNode.tsx` - Uses terminalSchemes[colorScheme] instead of CSS-derived theme
- `src/components/layout/AppShell.tsx` - Added borderRadius: 10 and box-shadow for rounded corners
- `src-tauri/tauri.conf.json` - Added transparent: true for macOS rounded corners

## Decisions Made
- Kept `.theme` as backward-compat alias for `.resolvedTheme` so ThemeProvider, ThemeToggle, StatusBar, etc. continue working
- toggleTheme now cycles through three modes (System->Dark->Light) instead of binary dark/light
- Rounded corners applied on AppShell rather than App.tsx since AppShell is the actual outermost layout div
- Replaced CSS-derived buildXtermTheme() with preset ITheme objects from terminalSchemes -- cleaner and more accurate

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Theme system ready for settings panel UI (System/Dark/Light selector)
- Color scheme selection ready for settings panel UI (One Dark/Dracula dropdown)
- All existing theme consumers continue working via backward-compat aliases

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 02-sidebar-session-persistence*
*Completed: 2026-03-18*
