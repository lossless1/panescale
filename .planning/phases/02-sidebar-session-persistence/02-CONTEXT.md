# Phase 2: Sidebar + Session Persistence - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add file tree browser to the left sidebar, workspace/project management (open folder, switch projects), file operations (create, rename, delete), fuzzy file search (Cmd+K), drag-to-canvas for content tiles, tmux-backed terminal session persistence (transparent to user), system theme auto-detection, terminal color schemes, and grid snapping for tile positioning. Git UI, SSH, and terminal polish features are out of scope.

</domain>

<decisions>
## Implementation Decisions

### File Tree Behavior
- Two view modes: hierarchical tree + chronological feed sorted by date (toggle between them, like Collaborator)
- Full sort cycle: name (A-Z/Z-A), created (newest/oldest), modified (newest/oldest)
- Right-click context menu for file operations (create, rename, delete, move) — no inline hover buttons
- Drag file from sidebar to canvas creates tile auto-typed by extension: .md → note tile, images → image tile, code files → syntax-highlighted preview
- Folders first in tree view, then files

### Tmux Persistence
- Fully hidden from user — no tmux status bar, no prefix key, no tmux commands visible. User never knows tmux exists.
- If tmux not installed: auto-install via brew (macOS), apt/pacman (Linux). Show progress indicator during install.
- Windows strategy: Claude's discretion during research — investigate WSL tmux, ConPTY alternatives, or accept no session persistence on Windows
- Restore UX: instant — tiles appear immediately with terminal content visible, feels like app never closed
- Tmux session naming: managed by app, deterministic from tile ID for reliable reconnection

### Terminal Color Schemes
- Ship with One Dark (default) and Dracula presets
- Global scheme only — one scheme applies to all terminals, changed in settings
- No per-terminal scheme override in v1

### System Theme Detection
- Auto-follow system dark/light mode by default
- User can override to lock dark or light (3 options: System, Dark, Light)
- Theme toggle in settings and/or status bar (already established in Phase 1)

### Grid Snapping
- Magnetic snap: tiles snap to grid when within ~10px of a grid line. Firm feel like Excalidraw.
- Cmd/Ctrl key held disables snapping for free positioning
- Visual feedback: show accent-colored snap lines on the grid points tile is snapping to while dragging
- Snap applies to both position and size (tile edges align to grid)

### Claude's Discretion
- Exact grid spacing (16px, 20px, 24px — whatever feels right)
- Chronological view date formatting and grouping (by day, week, month)
- Tmux session cleanup strategy (orphaned sessions)
- File tree icon set (VS Code-like file icons or simpler)
- Fuzzy search ranking algorithm

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above. Reference existing codebase for integration patterns.

### Existing Codebase (from Phase 1)
- `src/components/layout/Sidebar.tsx` — Sidebar shell component to be populated with file tree
- `src/components/layout/AppShell.tsx` — App layout container
- `src/stores/canvasStore.ts` — Canvas state store with persistence hooks
- `src/lib/persistence.ts` — Persistence layer with debounced save/forceSave
- `src/stores/themeStore.ts` — Theme preference store (dark/light toggle)
- `src/styles/themes.ts` — CSS variable definitions for dark/light themes
- `src-tauri/src/pty/manager.rs` — PtyManager for terminal session management
- `src-tauri/src/state/persistence.rs` — Rust atomic file persistence

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Sidebar.tsx`: Empty shell component with resizable drag edge — ready to be populated with file tree
- `canvasStore.ts`: Has `addTerminalNode()`, `removeNode()`, node management — extend for drag-to-canvas tiles
- `persistence.ts`: Debounced auto-save + forceSave pattern — reuse for tmux session mapping
- `themeStore.ts`: Theme preference with localStorage — extend for system detection + 3-mode toggle
- `themes.ts`: CSS variable system — extend with terminal color scheme variables
- `settingsStore.ts`: Terminal settings store — extend with color scheme selection

### Established Patterns
- Zustand stores with `persist` middleware for settings
- Tauri IPC via typed wrappers in `src/lib/ipc.ts`
- Rust commands registered in `src-tauri/src/lib.rs`
- Atomic file persistence via tmp+rename in Rust backend

### Integration Points
- Sidebar component needs file tree content + file operations
- Canvas store needs new tile types (note, image, file preview) for drag-to-canvas
- PTY manager needs tmux session wrapping layer
- Theme store needs system preference media query listener
- Canvas component needs grid snap logic in node drag handler

</code_context>

<specifics>
## Specific Ideas

- "Like Collaborator" for the two-view-mode file tree (hierarchical + chronological)
- Instant tmux restore — terminal content should appear as if the app never closed
- Magnetic grid snap like Excalidraw — firm but not rigid
- Accent-colored snap lines as visual feedback during drag

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-sidebar-session-persistence*
*Context gathered: 2026-03-17*
