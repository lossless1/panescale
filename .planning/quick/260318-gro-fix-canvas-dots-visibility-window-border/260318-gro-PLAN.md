---
phase: quick
plan: 260318-gro
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
must_haves:
  truths:
    - "Canvas dots remain visible when zoomed out to minimum (0.1x)"
    - "Window has subtle ~10px border-radius with no white background bleed"
    - "All user-visible references say Panescale instead of Excalicode"
  artifacts:
    - path: "src/components/canvas/CanvasBackground.tsx"
      provides: "Zoom-responsive dot sizing"
    - path: "src/components/layout/AppShell.tsx"
      provides: "Transparent background chain with subtle border-radius"
    - path: "src-tauri/tauri.conf.json"
      provides: "Panescale product name and identifier"
  key_links:
    - from: "CanvasBackground.tsx"
      to: "ReactFlow viewport zoom"
      via: "useViewport hook reading current zoom level"
      pattern: "useViewport.*zoom"
---

<objective>
Fix three issues: (1) canvas dots disappearing at low zoom levels by making dot size zoom-responsive, (2) window border white background bleed and excessive border-radius by ensuring transparent background chain with subtle radius, (3) rename project from Excalicode to Panescale everywhere.

Purpose: Visual polish fixes and project identity update.
Output: All three fixes applied across relevant files.
</objective>

<execution_context>
@/Users/volodymyrsaakian/.claude/get-shit-done/workflows/execute-plan.md
@/Users/volodymyrsaakian/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/canvas/CanvasBackground.tsx
@src/components/canvas/Canvas.tsx
@src/components/layout/AppShell.tsx
@src/styles/globals.css
@src/styles/themes.ts
@src-tauri/tauri.conf.json
@src-tauri/Cargo.toml
@package.json
@index.html
@src/components/layout/TitleBar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix canvas dot visibility at zoom-out and window border rendering</name>
  <files>src/components/canvas/CanvasBackground.tsx, src/components/layout/AppShell.tsx, src/styles/globals.css</files>
  <action>
**Canvas dots (CanvasBackground.tsx):**
The current dots use fixed `size={1}` and `size={2}` which become invisible when zoomed out. Make dot sizes zoom-responsive:

1. Import `useViewport` from `@xyflow/react`
2. Read `viewport.zoom` inside the component
3. Scale dot sizes inversely with zoom so they remain visible:
   - Minor dots: `size={Math.max(1, 1.2 / zoom)}` (floor at 1, grow as zoom decreases)
   - Major dots: `size={Math.max(2, 2.5 / zoom)}` (floor at 2, grow as zoom decreases)
4. Keep gap values unchanged (20 and 100) -- React Flow already handles gap scaling with zoom

**Window border (AppShell.tsx):**
The AppShell has `borderRadius: 10` and `backgroundColor: "var(--bg-primary)"` which causes white bleed at corners because the Tauri window has `transparent: true` but the HTML/body background is not transparent.

1. In AppShell.tsx: Keep `borderRadius: 10` (already subtle). Remove the `boxShadow` property (the OS handles window shadow for transparent windows). Keep `backgroundColor: "var(--bg-primary)"`.
2. In globals.css: Add `background: transparent;` to the `html, body, #root` rule. This ensures no white background bleeds through the rounded corners of the AppShell. The `#root` element should also get `height: 100%` (already has it).

The transparent chain: Tauri window (transparent: true) -> html/body/#root (background: transparent) -> AppShell div (borderRadius: 10 with bg-primary) = no bleed.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && npm run build 2>&1 | tail -5</automated>
  </verify>
  <done>Canvas dots scale up when zoomed out (visible at 0.1x). Window corners show no white bleed with subtle 10px radius.</done>
</task>

<task type="auto">
  <name>Task 2: Rename project from Excalicode to Panescale</name>
  <files>src-tauri/tauri.conf.json, src-tauri/Cargo.toml, package.json, index.html, src/components/layout/TitleBar.tsx, src/styles/themes.ts, src/components/canvas/Canvas.tsx, src/components/sidebar/FileTreeItem.tsx, src/stores/projectStore.ts, src/stores/themeStore.ts, src/stores/settingsStore.ts</files>
  <action>
Rename all occurrences of "Excalicode"/"excalicode" to "Panescale"/"panescale":

1. **src-tauri/tauri.conf.json**: `"productName": "Panescale"`, `"identifier": "com.panescale.app"`, window title `"Panescale"`
2. **src-tauri/Cargo.toml**: `name = "panescale"`, `description = "Spatial terminal workspace"` (desc unchanged)
3. **package.json**: `"name": "panescale"`
4. **index.html**: `<title>Panescale</title>`
5. **src/components/layout/TitleBar.tsx**: Replace "Excalicode" text with "Panescale"
6. **src/styles/themes.ts**: Update comment from "Excalicode" to "Panescale"
7. **src/components/canvas/Canvas.tsx**: Change MIME type strings from `application/excalicode-file` to `application/panescale-file`
8. **src/components/sidebar/FileTreeItem.tsx**: Change MIME type from `application/excalicode-file` to `application/panescale-file`
9. **src/stores/projectStore.ts**: Change persist name from `"excalicode-projects"` to `"panescale-projects"`
10. **src/stores/themeStore.ts**: Change localStorage key from `"excalicode-theme-pref"` to `"panescale-theme-pref"`
11. **src/stores/settingsStore.ts**: Change persist name from `"excalicode-settings"` to `"panescale-settings"`

IMPORTANT: The MIME type rename (excalicode-file -> panescale-file) must be consistent across Canvas.tsx and FileTreeItem.tsx or drag-and-drop will break.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && grep -ri "excalicode" src/ src-tauri/ package.json index.html --include="*.ts" --include="*.tsx" --include="*.json" --include="*.toml" --include="*.html" | grep -v node_modules | grep -v "target/" ; echo "EXIT:$?"</automated>
  </verify>
  <done>Zero grep hits for "excalicode" across all source files. All user-visible names and internal identifiers say "Panescale"/"panescale".</done>
</task>

</tasks>

<verification>
1. `npm run build` succeeds with no errors
2. `grep -ri "excalicode" src/ src-tauri/ package.json index.html` returns zero matches
3. Visual: canvas dots visible at all zoom levels, window corners have no white bleed
</verification>

<success_criteria>
- Build passes cleanly
- No remaining "excalicode" references in source
- CanvasBackground uses zoom-responsive dot sizing
- AppShell has 10px border-radius with transparent background chain
</success_criteria>

<output>
After completion, create `.planning/quick/260318-gro-fix-canvas-dots-visibility-window-border/260318-gro-SUMMARY.md`
</output>
