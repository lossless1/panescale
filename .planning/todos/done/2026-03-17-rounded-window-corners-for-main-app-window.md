---
created: 2026-03-17T15:01:15.399Z
title: Rounded window corners for main app window
area: ui
files:
  - src-tauri/tauri.conf.json
  - src/components/layout/AppShell.tsx
  - src/styles/globals.css
---

## Problem

The main application window has sharp corners. Since `decorations: false` is set (custom title bar), the OS doesn't apply its native rounded corners. The window appears boxy compared to modern macOS apps that have rounded corners.

## Solution

On macOS, Tauri windows with `decorations: false` can get rounded corners via:
1. Setting `transparent: true` in tauri.conf.json window config
2. Applying `border-radius` to the root HTML/body element
3. Using `background: transparent` on the webview and applying the background to the inner app shell

On Windows/Linux, native rounded corners depend on the compositor. May need platform-specific handling or accept sharp corners on those platforms.

Note: This is a visual polish item — could be addressed in any phase or as a quick fix.
