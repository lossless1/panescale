---
phase: quick
plan: 260318-gro
subsystem: canvas, layout, identity
tags: [visual-polish, rename, canvas-dots, window-border]
dependency_graph:
  requires: []
  provides: [zoom-responsive-dots, transparent-background-chain, panescale-identity]
  affects: [CanvasBackground, AppShell, all-stores, tauri-config]
tech_stack:
  added: []
  patterns: [inverse-zoom-scaling]
key_files:
  created: []
  modified:
    - src/components/canvas/CanvasBackground.tsx
    - src/components/layout/AppShell.tsx
    - src/styles/globals.css
    - src-tauri/tauri.conf.json
    - src-tauri/Cargo.toml
    - package.json
    - index.html
    - src/components/layout/TitleBar.tsx
    - src/styles/themes.ts
    - src/components/canvas/Canvas.tsx
    - src/components/sidebar/FileTreeItem.tsx
    - src/stores/projectStore.ts
    - src/stores/themeStore.ts
    - src/stores/settingsStore.ts
    - src-tauri/capabilities/default.json
    - src-tauri/gen/schemas/capabilities.json
decisions:
  - "Inverse zoom scaling for dot sizes: Math.max(floor, factor/zoom)"
  - "Removed boxShadow from AppShell (OS handles shadow for transparent windows)"
  - "Updated auto-generated capabilities.json alongside source for consistency"
metrics:
  duration_seconds: 90
  completed: "2026-03-18T11:08:15Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260318-gro: Fix Canvas Dots, Window Border, and Rename to Panescale

Zoom-responsive canvas dot sizing, transparent background chain for window corners, and full Excalicode-to-Panescale rename across all source files.

## Task Results

### Task 1: Fix canvas dot visibility at zoom-out and window border rendering

**Commit:** d09111c

**Changes:**
- **CanvasBackground.tsx:** Added `useViewport` hook to read current zoom level. Dot sizes now scale inversely with zoom: minor dots use `Math.max(1, 1.2 / zoom)` and major dots use `Math.max(2, 2.5 / zoom)`. Dots remain visible even at 0.1x minimum zoom.
- **AppShell.tsx:** Removed `boxShadow` property (OS handles window shadow for transparent Tauri windows). Kept `borderRadius: 10` and `backgroundColor: var(--bg-primary)`.
- **globals.css:** Added `background: transparent` to `html, body, #root` rule, completing the transparent chain from Tauri window through to AppShell.

### Task 2: Rename project from Excalicode to Panescale

**Commit:** b4a71f7

**Changes across 13 files:**
- **tauri.conf.json:** productName, identifier (com.panescale.app), window title
- **Cargo.toml:** package name
- **package.json:** name field
- **index.html:** page title
- **TitleBar.tsx:** displayed app name
- **themes.ts:** JSDoc comment
- **Canvas.tsx + FileTreeItem.tsx:** MIME type `application/panescale-file` (consistent across drag source and drop target)
- **projectStore.ts:** persist key `panescale-projects`
- **themeStore.ts:** localStorage key `panescale-theme-pref`
- **settingsStore.ts:** persist key `panescale-settings`
- **capabilities/default.json + gen/schemas/capabilities.json:** description text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Fixed excalicode references in capabilities files**
- **Found during:** Task 2 verification
- **Issue:** `src-tauri/capabilities/default.json` and `src-tauri/gen/schemas/capabilities.json` contained "Excalicode" but were not listed in the plan
- **Fix:** Updated both files to say "Panescale"
- **Files modified:** src-tauri/capabilities/default.json, src-tauri/gen/schemas/capabilities.json
- **Commit:** b4a71f7

## Verification

- Build (`npm run build`): PASSED
- Grep for "excalicode" across all source files: ZERO matches
- Canvas dots use zoom-responsive sizing via useViewport hook
- AppShell has 10px border-radius with transparent background chain (no boxShadow)

## Self-Check: PASSED

All 15 modified files verified on disk. Both commit hashes (d09111c, b4a71f7) confirmed in git log.
