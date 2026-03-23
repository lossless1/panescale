# Feature Landscape

**Domain:** Terminal canvas desktop app (spatial terminal multiplexer with git integration)
**Researched:** 2026-03-17

## Competitive Context

Excalicode occupies a unique intersection: spatial canvas (Panescale, tldraw, Miro) meets terminal emulator (Warp, iTerm2, WezTerm, Tabby) meets git GUI (GitKraken, VS Code SCM) meets SSH manager (Termius, Tabby). The closest direct competitor is **Mesa** ("the canvas for code"), which launched in 2025 with a similar spatial canvas + terminal + agent concept. The Collaborator app (reference implementation) proves the canvas-with-terminals UX works.

**Key insight:** No existing app combines all four dimensions (canvas + terminal + git + SSH) in one cross-platform package. This is the core value proposition.

---

## Table Stakes

Features users expect. Missing any of these and the product feels broken or incomplete.

### Canvas

| Feature                                               | Why Expected                                                  | Complexity | Notes                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| Infinite pan and zoom                                 | Core UX paradigm; Panescale/tldraw/Mesa all have it           | Medium     | Collaborator uses 33-100% range. Consider wider range (10-200%). |
| Smooth pan via scroll wheel, Space+drag, middle-click | Standard canvas navigation; all canvas apps support these     | Low        | Three input methods covers mouse, trackpad, and keyboard users   |
| Zoom via Cmd+/-, pinch-to-zoom on trackpad            | Expected by every macOS/desktop user                          | Low        | Must feel native on each platform                                |
| Dot grid background                                   | Visual anchor for spatial orientation; Collaborator has this  | Low        | Minor + major dot pattern. Optional: let users toggle off.       |
| Grid snapping for tiles                               | Alignment without manual pixel-hunting; Collaborator has this | Low        | Snap-to-grid with hold-modifier to override                      |
| Minimap / overview                                    | Navigation aid for large canvases; Panescale has this         | Medium     | Essential once users have 10+ tiles spread across canvas         |

### Terminal Tiles

| Feature                                         | Why Expected                                                  | Complexity | Notes                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Double-click to spawn terminal                  | Primary creation gesture; Collaborator defines this           | Low        | Opens in active project working directory                                   |
| Drag and resize terminals freely                | Core spatial metaphor; Collaborator has 8 resize handles      | Medium     | 8-handle resize + title bar drag                                            |
| Terminal text selection and copy/paste          | Every terminal app supports this; broken without it           | Low        | xterm.js handles natively                                                   |
| Search within terminal output                   | iTerm2, Warp, WezTerm all have this; power users expect it    | Medium     | xterm.js has search addon (@xterm/addon-search)                             |
| URL/link detection in terminal output           | iTerm2, Warp, Tabby, WezTerm all detect URLs                  | Low        | xterm.js addon-web-links handles this. Collaborator issue #15 requested it. |
| Scrollback buffer                               | Every terminal has scrollback; unusable without it            | Low        | xterm.js supports configurable scrollback                                   |
| Z-index layering (click brings to front)        | Standard window management; Collaborator has this             | Low        | Click-to-focus with z-index reordering                                      |
| Close terminal via title bar                    | Basic window management                                       | Low        | With confirmation if process is running                                     |
| Shell integration (bash, zsh, fish, PowerShell) | Cross-platform requirement                                    | Medium     | Platform-detected default shell                                             |
| Configurable font, font size, colors            | Every terminal app offers this; personal preference is strong | Low        | Ship with sensible defaults + settings panel                                |

### Terminal Session Persistence

| Feature                         | Why Expected                                                    | Complexity | Notes                                                    |
| ------------------------------- | --------------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| tmux-backed session persistence | Core differentiator promise; sessions survive restart           | High       | User never sees tmux. Complex lifecycle management.      |
| Canvas layout persistence       | Tile positions must survive restart; Collaborator saves to JSON | Medium     | Debounced save (500ms) as Collaborator does              |
| Restore terminals on reopen     | Users expect to pick up where they left off                     | High       | Requires both canvas state AND tmux session reconnection |

### Sidebar / File Navigation

| Feature                                  | Why Expected                                             | Complexity | Notes                                  |
| ---------------------------------------- | -------------------------------------------------------- | ---------- | -------------------------------------- |
| File tree browser                        | VS Code, GitKraken, every IDE has one                    | Medium     | Hierarchical view with expand/collapse |
| Open folder / switch projects            | Basic project management                                 | Low        | Workspace concept                      |
| File operations (create, rename, delete) | Expected in any file tree                                | Medium     | With confirmation for destructive ops  |
| Search / filter files (Cmd+K)            | VS Code Cmd+P, Collaborator Cmd+K; power users demand it | Medium     | Fuzzy file finder                      |

### Cross-Platform

| Feature                                | Why Expected                           | Complexity | Notes                                                    |
| -------------------------------------- | -------------------------------------- | ---------- | -------------------------------------------------------- |
| macOS, Linux, Windows support          | Stated requirement; Tauri enables this | High       | Windows tmux story is the hard part (WSL or alternative) |
| Native keyboard shortcuts per platform | Cmd on Mac, Ctrl on Win/Linux          | Low        | Platform detection + shortcut mapping                    |
| Native window chrome / behavior        | Feels wrong if non-native              | Low        | Tauri provides native window management                  |

### Theming

| Feature                       | Why Expected                           | Complexity | Notes                                                     |
| ----------------------------- | -------------------------------------- | ---------- | --------------------------------------------------------- |
| Dark and light themes         | Every modern dev tool has this         | Medium     | System preference detection + manual toggle               |
| Terminal color scheme support | Terminal users have strong preferences | Low        | Ship popular schemes (Dracula, Solarized, One Dark, etc.) |

---

## Differentiators

Features that set Excalicode apart. Not expected by default, but create competitive advantage.

### Canvas-Specific Differentiators

| Feature                          | Value Proposition                                                                                         | Complexity | Notes                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| Tile snapping / alignment guides | Panescale-style smart snapping when dragging tiles near each other. Collaborator issue #23.               | Medium     | Show alignment lines when edges/centers align with neighbors |
| Canvas regions / groups          | Group related terminals visually (e.g., "frontend", "backend", "database"). No competitor does this well. | Medium     | Named groups with optional background color                  |
| Pan/zoom while focused on tile   | Collaborator issue #13. Shift+scroll passes through to canvas. Essential for power users.                 | Medium     | Modifier key to redirect scroll from terminal to canvas      |
| Multiple canvases / workspaces   | Switch between project layouts. Mesa has this with nodes.                                                 | Medium     | Tab bar or switcher for canvas workspaces                    |

### Git UI (Primary Differentiator)

| Feature                                    | Value Proposition                                                                    | Complexity | Notes                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ---------- | -------------------------------------------------------- |
| Status panel (staged/unstaged/untracked)   | GitKraken-level visibility without leaving the app. No terminal canvas app has this. | High       | File-level stage/unstage with diff preview               |
| Branch management (create, switch, delete) | Visual branch operations without memorizing git commands                             | Medium     | Branch list with current branch indicator                |
| Commit with message                        | Stage + commit without terminal                                                      | Medium     | Text input + commit button                               |
| Diff viewer (inline or side-by-side)       | GitKraken's best feature; see what changed                                           | High       | Hunk-level view with add/discard per hunk                |
| Commit log / graph                         | Visual git history; GitKraken's signature feature                                    | High       | Scrollable log with branch topology                      |
| Merge conflict resolution                  | GitKraken offers this; massive DX improvement                                        | Very High  | Defer to later phase; start with "open in external tool" |
| Stash management                           | Save/restore work in progress                                                        | Medium     | List stashes, apply/pop/drop                             |

### SSH Connection Manager (Primary Differentiator)

| Feature                                      | Value Proposition                                            | Complexity | Notes                                         |
| -------------------------------------------- | ------------------------------------------------------------ | ---------- | --------------------------------------------- |
| Save SSH connections (host, user, key, port) | Termius-level connection management in a canvas app          | Medium     | Encrypted storage for credentials             |
| Spawn remote terminal on canvas              | Click connection, get terminal tile connected to remote host | High       | SSH tunnel through Tauri backend              |
| Connection groups / folders                  | Organize many servers                                        | Low        | Tree structure in sidebar                     |
| SSH key management                           | Generate, import, manage keys in-app                         | Medium     | Termius has this; essential for the SSH story |

### Terminal Power Features

| Feature                                | Value Proposition                                                    | Complexity | Notes                                                           |
| -------------------------------------- | -------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| Terminal title showing running process | Collaborator issue #16. Shows what's happening at a glance.          | Medium     | Parse terminal escape sequences for title                       |
| Startup commands per terminal          | Collaborator issue #12. Auto-run commands on restore.                | Low        | Store command per tile in canvas state                          |
| Split panes within a tile              | iTerm2/WezTerm users expect this; nested splits inside a canvas tile | High       | Defer: complex interaction with canvas resize. Consider for v2. |
| Filepath detection in terminal output  | Collaborator issue #15. Click a path to open file preview.           | Medium     | Regex-based path detection + click handler                      |
| Terminal badges / labels               | Color-code or label terminals for quick identification               | Low        | User-assigned colors and names                                  |

### Developer Experience Differentiators

| Feature                          | Value Proposition                                              | Complexity | Notes                                         |
| -------------------------------- | -------------------------------------------------------------- | ---------- | --------------------------------------------- |
| CLI for workspace operations     | Collaborator issue #14. `excalicode open .` from any terminal. | Medium     | CLI binary that communicates with running app |
| Drag file from sidebar to canvas | Creates file preview card. Collaborator core feature.          | Medium     | Different tile types based on file extension  |
| Image tiles on canvas            | Drag images for reference material                             | Low        | Read-only display, basic zoom                 |
| Markdown note tiles              | Quick notes alongside terminals                                | Medium     | Rich markdown editor with preview             |
| Keyboard shortcut customization  | Power users remap everything; iTerm2/WezTerm support this      | Medium     | JSON/config file for keybindings              |

---

## Anti-Features

Features to explicitly NOT build. These are scope traps.

| Anti-Feature                                | Why Avoid                                                                                                                                                 | What to Do Instead                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Code editor / IDE                           | PROJECT.md explicitly excludes this. Monaco/CodeMirror adds massive complexity and competes with VS Code. Collaborator made this mistake with code tiles. | File preview cards (read-only, syntax highlighted). Users have VS Code/Cursor already.             |
| AI chat / copilot integration               | Warp pivoted to this and it diluted their terminal. It is a separate product concern.                                                                     | Let users run AI CLI tools (Claude Code, aider) in terminal tiles. The canvas IS the AI workspace. |
| Cloud sync / collaboration                  | Massively increases complexity (auth, conflict resolution, servers). Miro/Panescale territory.                                                            | Local-only persistence. Export/import canvas state for sharing.                                    |
| Mobile support                              | Desktop-only app; mobile terminal UX is poor                                                                                                              | Cross-platform desktop only (macOS, Linux, Windows)                                                |
| Built-in text editor for code files         | Competes with VS Code; maintenance burden of editor features                                                                                              | Read-only file preview with syntax highlighting                                                    |
| Plugin / extension system                   | Premature; adds API surface before core is stable                                                                                                         | Ship opinionated defaults. Consider plugins in v2+.                                                |
| Web-based version                           | Undermines Tauri's native performance advantage                                                                                                           | Desktop-only. Tauri's value is being native.                                                       |
| SFTP file manager                           | Termius does this; tangential to canvas+terminal value                                                                                                    | SSH terminals can use scp/rsync. File management is secondary.                                     |
| Integrated web browser tile                 | Collaborator issue #17 requested this; massive security and complexity surface                                                                            | Open URLs in system browser. Consider in v2 if demand is high.                                     |
| Terminal multiplexer UI (tmux-style splits) | tmux is an implementation detail, not a UI paradigm. The canvas IS the multiplexer.                                                                       | The canvas replaces traditional pane splits. Each terminal is a free-form tile.                    |
| Recording / playback of terminal sessions   | Niche feature; asciinema does this better                                                                                                                 | Out of scope                                                                                       |
| Serial port / Telnet connections            | Tabby supports these; very niche audience                                                                                                                 | Focus on local shell + SSH only                                                                    |

---

## Feature Dependencies

```
Canvas (pan/zoom/grid) --> Tile system (drag/resize/z-index)
    |
    +--> Terminal tiles (xterm.js + shell)
    |       |
    |       +--> tmux session management (persistence)
    |       |       |
    |       |       +--> Session restore on app reopen
    |       |
    |       +--> SSH connection manager
    |       |       |
    |       |       +--> Remote terminal tiles
    |       |
    |       +--> URL/path detection (addon-web-links)
    |       |
    |       +--> Terminal search (addon-search)
    |
    +--> Note tiles (markdown editor)
    |
    +--> Image tiles (read-only display)
    |
    +--> File preview tiles (syntax highlighting)

Sidebar file tree --> Drag to canvas (creates tiles)
    |
    +--> File operations (create/rename/delete)
    |
    +--> Fuzzy file search (Cmd+K)

Git UI (sidebar) --> Repository detection
    |
    +--> Status panel (stage/unstage)
    |       |
    |       +--> Diff viewer
    |       |
    |       +--> Commit
    |
    +--> Branch management
    |
    +--> Commit log/graph
    |
    +--> Stash management

Canvas state persistence --> All tile types must serialize
    |
    +--> tmux session IDs mapped to terminal tiles
    |
    +--> Viewport position/zoom saved

Theming --> Applies to canvas + sidebar + terminal color schemes
```

---

## MVP Recommendation

### Phase 1: Canvas + Terminal Foundation

Prioritize (in order):

1. **Infinite canvas** with pan, zoom, dot grid -- the defining UX
2. **Terminal tiles** with xterm.js -- the core value
3. **Tile management** -- drag, resize, close, z-index
4. **Canvas persistence** -- save/restore tile layout to JSON
5. **Basic sidebar** -- folder browser, project switching

### Phase 2: Session Persistence + Terminal Features

6. **tmux integration** -- transparent session persistence
7. **Session restore** -- terminals reconnect on reopen
8. **Terminal search** and URL detection (xterm.js addons)
9. **Dark/light theming**

### Phase 3: Git UI

10. **Git status panel** -- staged/unstaged/untracked
11. **Stage/unstage + commit**
12. **Diff viewer**
13. **Branch management**
14. **Commit log**

### Phase 4: SSH + Polish

15. **SSH connection manager** -- save connections, spawn remote terminals
16. **Note tiles and image tiles** on canvas
17. **File preview tiles** from sidebar drag
18. **Stash management** in git UI

### Defer to v2+

- Split panes within tiles
- Merge conflict resolution UI
- Canvas regions/groups
- CLI tool
- Web tiles
- Keyboard shortcut customization

**Rationale:** The canvas + terminal combination is what makes this product unique. Ship that first and validate. Git UI is the second differentiator but is large in scope -- it should be a dedicated phase. SSH is the third pillar and can come after git since it requires secure credential storage and remote connection handling.

---

## Sources

- [Warp Features](https://www.warp.dev/all-features)
- [WezTerm Multiplexing](https://wezterm.org/multiplexing.html)
- [WezTerm Features](https://wezterm.org/features.html)
- [iTerm2 Features](https://iterm2.com/features.html)
- [Tabby Terminal](https://tabby.sh/)
- [Termius SSH Client](https://termius.com/index.html)
- [GitKraken Desktop](https://www.gitkraken.com/git-client)
- [tldraw SDK](https://tldraw.dev/)
- [Panescale GitHub](https://github.com/panescale/panescale)
- [Mesa - Canvas for Code](https://www.getmesa.dev/)
- [Canopy - Terminal Workspace Manager](https://github.com/The-Banana-Standard/canopy)
- [xterm.js Web Links Addon](https://www.npmjs.com/package/@xterm/addon-web-links)
- [xterm.js Link Handling Docs](https://xtermjs.org/docs/guides/link-handling/)
