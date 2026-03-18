# Phase 6: File Tile Interactions + App Icon - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add double-click interaction on content tiles (note, image, file preview) to open a terminal in that file's parent directory. Design and set a gradient abstract app icon for Panescale. No new tile types or features.

</domain>

<decisions>
## Implementation Decisions

### File Tile → Terminal Interaction
- Double-click a content tile (NoteNode, ImageNode, FilePreviewNode) opens a terminal tile at that position
- Terminal opens in the parent directory of the file associated with the tile
- For NoteNode tiles created on canvas (no file path): terminal opens in the active project directory (fallback)
- Terminal spawns adjacent to the clicked tile (offset by tile width + padding)

### App Icon
- Style: gradient abstract (like Arc browser, Discord) — colorful, modern, eye-catching
- Generate as SVG, export to required sizes: 32x32, 128x128, 128x128@2x, icon.icns (macOS), icon.ico (Windows)
- Place in `src-tauri/icons/` (Tauri standard location)
- Update tauri.conf.json icon paths if needed

### Claude's Discretion
- Exact gradient colors (suggest something that works with both dark and light themes)
- Terminal spawn position relative to the clicked tile
- Icon shape and composition
- Whether to add a visual hint (tooltip or cursor change) on hover to indicate double-click action

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing Codebase
- `src/components/canvas/NoteNode.tsx` — Add double-click handler
- `src/components/canvas/ImageNode.tsx` — Add double-click handler
- `src/components/canvas/FilePreviewNode.tsx` — Add double-click handler
- `src/stores/canvasStore.ts` — addTerminalNode for spawning
- `src-tauri/icons/` — Icon files location

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `canvasStore.addTerminalNode()` — already spawns terminal tiles at a position
- Content tile data includes `filePath` field — use for directory extraction
- `projectStore.activeProject()` — fallback directory for tiles without file paths

### Established Patterns
- Double-click on canvas spawns terminal (existing behavior in Canvas.tsx)
- Content tiles already have click handlers for focus mode

### Integration Points
- Each content node component needs an `onDoubleClick` handler
- Handler extracts directory from `data.filePath`, calls `addTerminalNode`

</code_context>

<specifics>
## Specific Ideas

- Gradient abstract icon — think Arc browser's colorful gradient but with a shape that suggests panels/panes
- Double-click should feel instant — no delay or confirmation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-file-tile-interactions-and-app-icon*
*Context gathered: 2026-03-18*
