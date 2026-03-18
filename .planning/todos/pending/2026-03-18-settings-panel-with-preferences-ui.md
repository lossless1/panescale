---
created: 2026-03-18T16:00:00.000Z
title: Settings panel with preferences UI
area: ui
files:
  - src/stores/settingsStore.ts
  - src/stores/themeStore.ts
  - src/components/layout/TitleBar.tsx
  - src/components/layout/StatusBar.tsx
---

## Problem

Currently settings are scattered across stores (settingsStore for terminal font/size/scrollback, themeStore for theme preference, sshStore for connections) with no unified settings panel. Users can toggle themes and some settings via keyboard shortcuts or inline controls, but there's no centralized preferences UI accessible via a gear icon or menu.

## Solution

Add a Settings panel accessible via:
1. Gear icon in the title bar or status bar
2. Cmd+, keyboard shortcut (standard macOS preferences shortcut)
3. Window menu → Preferences (if native menu is added)

Settings panel should include sections for:
- **Appearance**: Theme (System/Dark/Light), terminal color scheme (One Dark/Dracula)
- **Terminal**: Default font, font size, scrollback buffer size, default shell
- **Editor**: (future) markdown editor preferences
- **SSH**: Connection management (could link to SSH panel)
- **Language**: UI language selection (if i18n is added)
- **About**: App version, update check

Implementation: Modal overlay or slide-out panel. Could be a React component using the existing settingsStore + themeStore.
