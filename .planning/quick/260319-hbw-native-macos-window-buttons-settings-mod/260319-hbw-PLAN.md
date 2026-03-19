---
phase: quick
plan: 260319-hbw
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/tauri.conf.json
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src/components/layout/TitleBar.tsx
  - src/components/layout/StatusBar.tsx
  - src/components/layout/SettingsModal.tsx
  - src/styles/globals.css
  - src/components/canvas/Canvas.tsx
autonomous: true
requirements: [quick-fix]

must_haves:
  truths:
    - "Window has native macOS traffic light buttons (close/minimize/maximize)"
    - "Window has native rounded corners from OS decorations"
    - "TitleBar content does not overlap with native traffic lights"
    - "Settings gear in status bar opens a modal with theme, font, scrollback controls"
    - "Settings modal closes on Escape and clicking outside"
    - "Canvas pane shows default arrow cursor, not hand/grab"
    - "Drag handles on tile title bars show grab cursor"
  artifacts:
    - path: "src-tauri/tauri.conf.json"
      provides: "Native decorations with overlay title bar"
      contains: "titleBarStyle"
    - path: "src/components/layout/SettingsModal.tsx"
      provides: "Settings modal with appearance and terminal sections"
      min_lines: 50
    - path: "src/components/layout/StatusBar.tsx"
      provides: "Gear button wired to settings modal"
  key_links:
    - from: "src/components/layout/StatusBar.tsx"
      to: "src/components/layout/SettingsModal.tsx"
      via: "state toggle and render"
      pattern: "SettingsModal"
    - from: "src/components/layout/SettingsModal.tsx"
      to: "src/stores/settingsStore.ts"
      via: "zustand store"
      pattern: "useSettingsStore"
---

<objective>
Bundle of 3 fixes: (1) Switch to native macOS window buttons with overlay title bar style and rounded corners, (2) Add settings gear button + modal to StatusBar, (3) Fix canvas cursor to default arrow instead of hand/grab.

Purpose: Polish native feel, centralize settings UI, fix cursor UX.
Output: Updated window config, new SettingsModal component, fixed canvas cursor styles.
</objective>

<execution_context>
@/Users/volodymyrsaakian/.claude/get-shit-done/workflows/execute-plan.md
@/Users/volodymyrsaakian/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src-tauri/tauri.conf.json
@src-tauri/src/lib.rs
@src-tauri/Cargo.toml
@src/components/layout/TitleBar.tsx
@src/components/layout/StatusBar.tsx
@src/components/layout/AppShell.tsx
@src/components/canvas/Canvas.tsx
@src/styles/globals.css
@src/stores/settingsStore.ts
@src/stores/themeStore.ts
@src/lib/terminalSchemes.ts

<interfaces>
From src/stores/settingsStore.ts:
```typescript
interface SettingsState {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  colorScheme: TerminalSchemeName;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setScrollback: (scrollback: number) => void;
  setColorScheme: (scheme: TerminalSchemeName) => void;
}
```

From src/stores/themeStore.ts:
```typescript
type ThemePreference = "system" | "dark" | "light";
interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}
```

From src/lib/terminalSchemes.ts:
```typescript
type TerminalSchemeName = "one-dark" | "dracula";
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Native macOS window buttons + rounded corners</name>
  <files>src-tauri/tauri.conf.json, src-tauri/src/lib.rs, src-tauri/Cargo.toml, src/components/layout/TitleBar.tsx, src/styles/globals.css</files>
  <action>
1. **tauri.conf.json** — In `app.windows[0]`:
   - Change `"decorations": false` to `"decorations": true`
   - Remove `"transparent": true` (native decorations handle transparency)
   - Add `"titleBarStyle": "overlay"` — this gives native traffic lights overlaid on the webview content

2. **TitleBar.tsx** — Remove the entire `WindowControls` component and its usage:
   - Delete the `WindowControls` function component (lines 10-62)
   - Delete the `getAppWindow` helper function (lines 5-8)
   - Delete the `useCallback` import (no longer needed) and the `isMac` import
   - In the `TitleBar` component, remove `<WindowControls position={controlsPosition} />` and the `controlsPosition` variable
   - Add `paddingLeft: 78` to the outer div style (space for native traffic lights on macOS — 70px for buttons + 8px gap)
   - Keep the ThemeToggle on the right side. Simplify the layout: title centered, ThemeToggle at `marginRight: 8`
   - Keep `data-tauri-drag-region` on the outer div

3. **lib.rs** — Remove the entire `apply_macos_window_styling` function (lines 8-34) and the `#[cfg(target_os = "macos")] apply_macos_window_styling(app);` call in setup (line 47). The overlay titleBarStyle handles everything natively. Keep the rest of setup intact (just `Ok(())`).

4. **Cargo.toml** — Remove the `[target.'cfg(target_os = "macos")'.dependencies]` section (lines 30-32) that pulls in `cocoa` and `objc` crates. These are no longer needed.

5. **globals.css** — Remove `border-radius: 10px;` from the `html, body, #root` rule (line 11). Native decorations handle window rounding. Keep the AppShell's inline `borderRadius: 10` for inner content area rounding.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && npx tsc --noEmit 2>&1 | head -20 && grep -q '"titleBarStyle"' src-tauri/tauri.conf.json && echo "titleBarStyle OK" && ! grep -q 'WindowControls' src/components/layout/TitleBar.tsx && echo "WindowControls removed OK" && ! grep -q 'cocoa' src-tauri/Cargo.toml && echo "cocoa removed OK"</automated>
  </verify>
  <done>Window uses native macOS traffic lights via overlay title bar style. Custom window control buttons removed. Cocoa/objc dependencies removed. No border-radius on html/body. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Settings gear button + modal</name>
  <files>src/components/layout/SettingsModal.tsx, src/components/layout/StatusBar.tsx</files>
  <action>
1. **Create SettingsModal.tsx** at `src/components/layout/SettingsModal.tsx`:
   - Props: `{ open: boolean; onClose: () => void }`
   - If `!open`, return `null`
   - Render a fixed overlay (inset 0, bg rgba(0,0,0,0.5), z-index 9999, display flex center)
   - Overlay div onClick calls `onClose` (click outside to close)
   - Inner modal div: `onClick={e => e.stopPropagation()}` to prevent close, max-width 480px, width 90%, bg `var(--bg-secondary)`, border `1px solid var(--border)`, borderRadius 12, padding 24, boxShadow
   - Title: "Settings" in h2, fontSize 18, marginBottom 20, color `var(--text-primary)`
   - **Appearance section** (h3 "Appearance", fontSize 14, color `var(--text-secondary)`, marginBottom 12):
     - Theme: three buttons (System / Dark / Light) styled as segmented control. Wire to `useThemeStore.setPreference()`. Highlight active button with `var(--accent)` background.
     - Terminal color scheme: two buttons (One Dark / Dracula). Wire to `useSettingsStore.setColorScheme()`. Highlight active.
   - **Terminal section** (h3 "Terminal", marginTop 20):
     - Font family: text input, value from `useSettingsStore.fontFamily`, onChange calls `setFontFamily`. Style: width 100%, bg `var(--bg-primary)`, color `var(--text-primary)`, border, borderRadius 6, padding 8px.
     - Font size: range input, min 10, max 24, step 1, value from `fontSize`, onChange calls `setFontSize`. Show current value label.
     - Scrollback: number input, min 500, max 50000, step 500, value from `scrollback`, onChange calls `setScrollback`.
   - Each setting row: label on top (fontSize 13, color `var(--text-secondary)`, marginBottom 4), control below, marginBottom 16 between rows.
   - Escape key handler via useEffect: if open, listen keydown Escape -> onClose. Cleanup on unmount.

2. **Update StatusBar.tsx**:
   - Add `useState` import from react
   - Add state: `const [settingsOpen, setSettingsOpen] = useState(false)`
   - Import `SettingsModal` from `./SettingsModal`
   - Before the existing `<span>` showing theme, add a gear button:
     ```
     <button onClick={() => setSettingsOpen(true)} title="Settings" style={{
       background: "none", border: "none", color: "var(--text-secondary)",
       cursor: "pointer", padding: "0 6px", fontSize: 14, lineHeight: 1,
       display: "flex", alignItems: "center"
     }}>
       &#x2699;
     </button>
     ```
   - After the closing `</div>` of the status bar container, render `<SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />`
   - Wrap both in a fragment `<>...</>`
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && npx tsc --noEmit 2>&1 | head -20 && test -f src/components/layout/SettingsModal.tsx && echo "SettingsModal exists"</automated>
  </verify>
  <done>Gear icon in status bar opens settings modal. Modal has Appearance (theme preference, color scheme) and Terminal (font, size, scrollback) sections. Closes on Escape or click outside. All wired to existing stores.</done>
</task>

<task type="auto">
  <name>Task 3: Fix canvas cursor to default arrow</name>
  <files>src/components/canvas/Canvas.tsx</files>
  <action>
1. In Canvas.tsx, find the inline `<style>` block (around line 401-408). Add a new CSS rule BEFORE the `.canvas-grab` rules:

```css
.react-flow__pane {
  cursor: default !important;
}
```

This overrides React Flow's default hand/grab cursor on the canvas pane. The existing `.canvas-grab .react-flow__pane { cursor: grab !important; }` rule will still take precedence when Space is held (more specific selector), which is correct behavior.

The drag handles on terminal title bars already have their own cursor styles via the `drag-handle` class in TerminalTitleBar. The `nodrag` class on terminal body prevents unwanted drag behavior. No changes needed to TerminalNode or useFocusMode — the two-mode focus system already works correctly (click terminal = focus, Escape = canvas mode, Shift+scroll = pan).
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && grep -q 'react-flow__pane.*cursor.*default' src/components/canvas/Canvas.tsx && echo "default cursor rule OK"</automated>
  </verify>
  <done>Canvas pane shows default arrow cursor. Hand/grab only appears when Space is held (for pan mode) or on drag handles. No regression to focus mode behavior.</done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- `tauri.conf.json` has `decorations: true` and `titleBarStyle: "overlay"`
- No cocoa/objc imports in lib.rs, no cocoa/objc in Cargo.toml
- TitleBar has no custom window control buttons, has left padding for native buttons
- StatusBar has gear button that toggles SettingsModal
- SettingsModal wires to settingsStore and themeStore
- Canvas pane has `cursor: default` CSS rule
</verification>

<success_criteria>
- Native macOS traffic lights visible in overlay mode
- Window has native rounded corners
- Settings modal opens from gear button, all controls functional
- Canvas cursor is arrow by default, grab only on Space hold
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/260319-hbw-native-macos-window-buttons-settings-mod/260319-hbw-SUMMARY.md`
</output>
