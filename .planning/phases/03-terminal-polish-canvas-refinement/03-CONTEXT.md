# Phase 3: Terminal Polish + Canvas Refinement - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add terminal power features: search within output, clickable URLs, process name in title bar, configurable scrollback, rename terminals + color badges, startup commands per terminal, and notification sound on terminal bell. Add canvas navigation/organization: minimap overview, alignment guides when dragging tiles, and named canvas regions with group drag. Git UI, SSH, and content tile editing are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Notification Sound (TERM-16)
- Trigger: terminal bell character (\a / BEL) — standard xterm.js bell event
- Sound: custom subtle chime audio file shipped with the app (not system sound)
- Sidebar indication: terminal entry pulses/blinks AND gets accent color highlight until user clicks it
- Volume: Claude's discretion (consider a volume setting or just a reasonable default)

### Canvas Regions (CANV-07)
- Creation: auto from selection — select multiple tiles, right-click "Group as region" (no manual drawing)
- Visual: colored header bar at top with region name, translucent fill below (~10% opacity)
- Group drag: dragging a region moves all tiles inside it (Figma-like group behavior)
- Region auto-sizes to fit contained tiles with padding

### Minimap (CANV-05)
- Position: bottom-right corner of the canvas area
- Visibility: toggle on/off via keyboard shortcut or button (not always visible)
- Interaction: click a spot on minimap to pan canvas there. Drag viewport rectangle to scrub around.
- Shows all tile positions as colored rectangles on a scaled-down canvas view

### Terminal Badges & Rename (TERM-12)
- Rename: double-click the title text in the title bar to edit inline
- Badge color visibility: color stripe/dot on title bar left edge + color dot in sidebar terminal list entry
- No tile border color (keep it clean)
- Color picker: preset palette of 6-8 colors, no custom color picker
- Custom name persists in canvas state and shows in sidebar terminal list

### Terminal Search (TERM-09)
- Already decided by xterm.js addon-search — Claude's discretion on UI (search bar overlay)

### Clickable URLs (TERM-10)
- Already decided by xterm.js addon-web-links — Claude's discretion on styling

### Process Title (TERM-11)
- Parse terminal escape sequences for title updates — show in title bar

### Scrollback (TERM-06)
- Configurable in settings store — Claude's discretion on default value and UI

### Startup Commands (TERM-13)
- Per-terminal startup command stored in canvas state — auto-runs on session restore
- Claude's discretion on where the user sets this (right-click menu or settings panel)

### Alignment Guides (CANV-06)
- Show when dragging tiles near other tiles — edge and center alignment lines
- Claude's discretion on styling (likely accent-colored like snap lines from Phase 2)

### Claude's Discretion
- Search bar UI design and keyboard shortcut (likely Cmd+F within focused terminal)
- URL hover style and click behavior
- Scrollback default value (1000? 5000? 10000?)
- Alignment guide thickness and color
- Minimap size and toggle shortcut
- Startup command UI location
- Notification chime audio characteristics

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Codebase
- `src/components/canvas/TerminalNode.tsx` — Terminal tile component to extend with search, URLs, badges, rename
- `src/components/canvas/TerminalTitleBar.tsx` — Title bar to add process name, badge color, inline rename
- `src/components/sidebar/TerminalList.tsx` — Terminal list to add badge colors and notification indicators
- `src/components/canvas/Canvas.tsx` — Canvas to add minimap, alignment guides, region nodes
- `src/components/canvas/SnapLines.tsx` — Snap line overlay pattern to reuse for alignment guides
- `src/stores/canvasStore.ts` — Canvas state to extend with regions, badge colors, custom names
- `src/stores/settingsStore.ts` — Settings to extend with scrollback config
- `src/hooks/usePty.ts` — PTY hook to extend with bell event handling
- `src/lib/gridSnap.ts` — Snap math to extend for alignment guides

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SnapLines.tsx`: Snap line overlay pattern — reuse for alignment guides (same accent-colored lines)
- `TerminalTitleBar.tsx`: Title bar component — extend with badge color dot, inline rename, process title
- `TerminalList.tsx`: Sidebar terminal list with pan-to-node — extend with badge color dots and notification pulse
- `settingsStore.ts`: Zustand persist store — extend with scrollback and startup command settings
- `canvasStore.ts`: Node management with add/remove/update — extend with region nodes and badge metadata

### Established Patterns
- xterm.js addons: FitAddon + WebglAddon already loaded — add SearchAddon + WebLinksAddon same way
- Zustand stores with persist middleware for settings
- Canvas node types registered in Canvas.tsx `nodeTypes` — add RegionNode type
- Tauri IPC via typed wrappers in `src/lib/ipc.ts`

### Integration Points
- xterm.js `term.onBell()` event for notification trigger
- xterm.js `SearchAddon` for terminal search
- xterm.js `WebLinksAddon` for clickable URLs
- xterm.js title escape sequence for process name
- React Flow `<MiniMap>` built-in component
- canvasStore node data for badge colors, custom names, startup commands

</code_context>

<specifics>
## Specific Ideas

- Notification pulse in sidebar should match the terminal's badge color (if set)
- Regions should feel like Figma's frames — header bar with name, group drag
- Minimap should show terminal tiles in their badge colors for quick identification
- Search overlay should appear inside the terminal tile, not a global dialog

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-terminal-polish-canvas-refinement*
*Context gathered: 2026-03-18*
