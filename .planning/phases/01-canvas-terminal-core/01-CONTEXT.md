# Phase 1: Canvas + Terminal Core - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the foundational Tauri v2 + React application with an infinite pan/zoom canvas, live terminal tiles spawned by double-clicking, drag/resize/layer/close tile management, basic dark/light theming, canvas layout persistence to disk, and cross-platform builds (macOS, Linux, Windows). Sidebar, git, SSH, tmux persistence, and content tiles are out of scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Canvas Feel
- Zoom range: 10% to 200% (wider than Collaborator's 33-100%)
- Dot grid background with minor + major dots (Excalidraw/Collaborator style)
- Pan via trackpad two-finger scroll (primary method), Space+drag, and middle-click+drag all supported
- Cmd+0 fits all tiles in view (zoom-to-fit)
- Rubber-band effect at zoom limits

### Terminal Tiles
- Default spawn size: 80x24 characters (classic terminal standard)
- Rich title bar: close button, minimize/collapse, working directory path, shell type indicator
- Minimum size enforced (~40x10 characters) — prevent unusably small terminals
- Live resize: terminal cols/rows re-flow as user drags resize handles in real-time
- 8 resize handles (4 edges, 4 corners) per Collaborator reference

### Focus & Input
- Click terminal tile to enter typing mode, click empty canvas to exit back to canvas mode
- Escape key exits terminal focus and returns to canvas mode (single press)
- Scroll over terminal = scroll terminal output; Shift+scroll = pan canvas
- App shortcuts (Cmd+K, Cmd+=, Cmd+-, etc.) always override terminal — terminal gets everything else
- Visual indicator: focused terminal gets visible border glow/highlight

### Theme & Visual Style
- VS Code-like structured UI: activity bar concept, status bar, panel structure — developer-familiar
- Deep dark theme default (#1a1a2e range) — high contrast, good for terminal readability
- Light theme also available from launch
- Custom title bar on all platforms (not native) — full theme control, consistent cross-platform appearance
- Left sidebar, resizable via drag edge (sidebar content comes in Phase 2, but layout established now)

### Claude's Discretion
- Exact grid dot spacing and sizing
- Zoom animation easing curves
- Terminal spawn animation (if any)
- Exact color palette within the deep dark range
- Sidebar minimum/maximum width
- Status bar content and layout

</decisions>

<specifics>
## Specific Ideas

- "Like Collaborator" for the canvas + terminal spatial metaphor — see https://github.com/collaborator-ai/collab-public for reference spec
- VS Code visual language for the chrome/panels, not Collaborator's minimal style
- The canvas should feel responsive like Excalidraw — smooth pan/zoom is critical to the UX
- Terminals are the primary content type — they must feel first-class, not embedded widgets

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes all foundational patterns:
  - Tauri IPC pattern (Commands + Channels)
  - React state management approach
  - Canvas engine setup (React Flow or custom)
  - PTY management in Rust backend
  - Theme system architecture (CSS variables / Tailwind)

### Integration Points
- Tauri v2 scaffolding: `src-tauri/` (Rust) + `src/` (React)
- IPC bridge: Rust commands ↔ React frontend
- Terminal data: Rust PTY → Tauri Channel → xterm.js

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-canvas-terminal-core*
*Context gathered: 2026-03-17*
