# Requirements: Excalicode

**Defined:** 2026-03-17
**Core Value:** Users can visually organize and interact with multiple terminal sessions on an infinite canvas, with layout and session state persisting across restarts via tmux.

## v1 Requirements

### Canvas

- [x] **CANV-01**: User can pan the canvas via scroll wheel, Space+drag, and middle-click+drag
- [x] **CANV-02**: User can zoom in/out via Cmd+/-, Ctrl+scroll, and pinch-to-zoom on trackpad
- [x] **CANV-03**: Canvas displays a dot grid background with minor and major dots for spatial orientation
- [x] **CANV-04**: All tile positions and sizes snap to the grid (with modifier key to override)
- [x] **CANV-05**: User can see a minimap overview for navigating large canvases
- [x] **CANV-06**: User sees alignment guides when dragging tiles near other tiles (edge/center snapping)
- [x] **CANV-07**: User can create named canvas regions/groups with optional background color to organize tiles

### Terminal Tiles

- [x] **TERM-01**: User can double-click empty canvas space to spawn a terminal tile at that position
- [x] **TERM-02**: Terminal opens in the active project's working directory
- [x] **TERM-03**: User can drag terminal tiles by the title bar to reposition on canvas
- [x] **TERM-04**: User can resize terminal tiles using 8 resize handles (4 edges, 4 corners)
- [x] **TERM-05**: User can select text and copy/paste in terminal tiles
- [x] **TERM-06**: Terminal tiles have configurable scrollback buffer
- [x] **TERM-07**: Clicking a terminal tile brings it to front (z-index layering)
- [x] **TERM-08**: User can close a terminal tile via the title bar
- [x] **TERM-09**: User can search within terminal output (find text)
- [x] **TERM-10**: Terminal detects and makes URLs clickable (opens in system browser)
- [x] **TERM-11**: Terminal title bar shows the currently running process name
- [x] **TERM-12**: User can rename terminal tiles and assign color badges/labels for identification
- [x] **TERM-13**: User can configure startup commands per terminal that auto-run on restore
- [x] **TERM-14**: User can configure terminal font, font size, and color scheme
- [x] **TERM-15**: Terminal supports the user's default shell (bash, zsh, fish, PowerShell)
- [x] **TERM-16**: Terminal plays a notification sound when a long-running process completes and the terminal is waiting for user input

### Session Persistence

- [x] **PERS-01**: Canvas layout (tile positions, sizes, viewport) persists to disk and restores on reopen
- [x] **PERS-02**: Terminal sessions persist via tmux (transparent to user) and reconnect on app restart
- [x] **PERS-03**: Canvas state saves automatically with debounced writes (500ms) and immediately on tile create/close

### Sidebar / File Navigation

- [x] **SIDE-01**: Left sidebar shows a file tree for the active project folder
- [x] **SIDE-02**: User can expand/collapse folders in the file tree
- [x] **SIDE-03**: User can open a folder to set it as the active project
- [x] **SIDE-04**: User can switch between multiple open projects/workspaces
- [x] **SIDE-05**: User can create, rename, and delete files/folders from the sidebar
- [x] **SIDE-06**: User can search/filter files with a fuzzy finder (Cmd+K)
- [x] **SIDE-07**: User can drag files from the sidebar onto the canvas to create content tiles
- [x] **SIDE-08**: Sidebar shows a list of all open terminal tiles with name and working directory
- [x] **SIDE-09**: Clicking a terminal entry in the sidebar pans the canvas to that terminal and focuses it

### Git UI

- [x] **GIT-01**: Sidebar shows git status panel with staged, unstaged, and untracked files
- [x] **GIT-02**: User can stage and unstage individual files from the git panel
- [x] **GIT-03**: User can write a commit message and commit staged changes
- [x] **GIT-04**: User can view diffs for changed files (inline or side-by-side)
- [x] **GIT-05**: User can see a list of branches and the current branch indicator
- [x] **GIT-06**: User can create, switch, and delete branches
- [x] **GIT-07**: User can view commit log with branch topology graph
- [x] **GIT-08**: User can stash changes and manage stashes (apply, pop, drop)
- [x] **GIT-09**: User can resolve merge conflicts through a dedicated UI

### SSH Connection Manager

- [x] **SSH-01**: User can save SSH connections with host, user, key file, and port
- [x] **SSH-02**: User can organize SSH connections into groups/folders
- [x] **SSH-03**: User can spawn a remote terminal tile on the canvas connected via SSH
- [x] **SSH-04**: Remote terminal tiles function identically to local terminals (resize, drag, z-index)

### Content Tiles

- [x] **CONT-01**: User can create markdown note tiles on the canvas with rich text editing
- [x] **CONT-02**: User can place image tiles on the canvas (drag from sidebar or filesystem)
- [x] **CONT-03**: User can open files from the sidebar as read-only syntax-highlighted preview tiles on the canvas

### Theming

- [x] **THEM-01**: User can switch between dark and light themes
- [x] **THEM-02**: App detects system theme preference and applies it by default
- [x] **THEM-03**: Terminal color schemes are available (Dracula, Solarized, One Dark, etc.)
- [x] **THEM-04**: App window has rounded corners on macOS (transparent webview + border-radius)

### Cross-Platform

- [ ] **PLAT-01**: App runs on macOS, Linux, and Windows
- [ ] **PLAT-02**: Keyboard shortcuts are platform-appropriate (Cmd on macOS, Ctrl on Windows/Linux)
- [x] **PLAT-03**: App uses native window chrome and behavior per platform

## v2 Requirements

### Terminal Advanced

- **TERM-V2-01**: Split panes within a terminal tile (nested splits inside canvas tile)
- **TERM-V2-02**: Terminal session recording/playback

### Canvas Advanced

- **CANV-V2-01**: Multiple canvases with tab/switcher UI
- **CANV-V2-02**: Web browser tiles on canvas

### Git Advanced

- **GIT-V2-01**: Interactive rebase UI
- **GIT-V2-02**: Cherry-pick with visual selection
- **GIT-V2-03**: Blame view for files

### SSH Advanced

- **SSH-V2-01**: SSH key generation and management in-app
- **SSH-V2-02**: SFTP file browser for remote connections

### Developer Experience

- **DX-V2-01**: CLI tool (`excalicode open .`) to open projects from any terminal
- **DX-V2-02**: Keyboard shortcut customization via config file
- **DX-V2-03**: Plugin / extension system

## Out of Scope

| Feature | Reason |
|---------|--------|
| Code editor / IDE features | Desktop terminal + canvas tool, not a code editor. Users have VS Code/Cursor. |
| AI chat / copilot integration | Users run AI CLIs (Claude Code, aider) in terminal tiles. The canvas IS the AI workspace. |
| Cloud sync / collaboration | Local-only persistence. Massive complexity for auth, conflict resolution, servers. |
| Mobile support | Desktop-only; mobile terminal UX is poor. |
| Web-based version | Undermines Tauri's native performance advantage. |
| Serial port / Telnet connections | Very niche; focus on local shell + SSH only. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CANV-01 | Phase 1 | Complete |
| CANV-02 | Phase 1 | Complete |
| CANV-03 | Phase 1 | Complete |
| CANV-04 | Phase 2 | Complete |
| CANV-05 | Phase 3 | Complete |
| CANV-06 | Phase 3 | Complete |
| CANV-07 | Phase 3 | Complete |
| TERM-01 | Phase 1 | Complete |
| TERM-02 | Phase 1 | Complete |
| TERM-03 | Phase 1 | Complete |
| TERM-04 | Phase 1 | Complete |
| TERM-05 | Phase 1 | Complete |
| TERM-06 | Phase 3 | Complete |
| TERM-07 | Phase 1 | Complete |
| TERM-08 | Phase 1 | Complete |
| TERM-09 | Phase 3 | Complete |
| TERM-10 | Phase 3 | Complete |
| TERM-11 | Phase 3 | Complete |
| TERM-12 | Phase 3 | Complete |
| TERM-13 | Phase 3 | Complete |
| TERM-14 | Phase 1 | Complete |
| TERM-15 | Phase 1 | Complete |
| TERM-16 | Phase 3 | Complete |
| PERS-01 | Phase 1 | Complete |
| PERS-02 | Phase 2 | Complete |
| PERS-03 | Phase 1 | Complete |
| SIDE-01 | Phase 2 | Complete |
| SIDE-02 | Phase 2 | Complete |
| SIDE-03 | Phase 2 | Complete |
| SIDE-04 | Phase 2 | Complete |
| SIDE-05 | Phase 2 | Complete |
| SIDE-06 | Phase 2 | Complete |
| SIDE-07 | Phase 2 | Complete |
| SIDE-08 | Phase 2 | Complete |
| SIDE-09 | Phase 2 | Complete |
| GIT-01 | Phase 4 | Complete |
| GIT-02 | Phase 4 | Complete |
| GIT-03 | Phase 4 | Complete |
| GIT-04 | Phase 4 | Complete |
| GIT-05 | Phase 4 | Complete |
| GIT-06 | Phase 4 | Complete |
| GIT-07 | Phase 4 | Complete |
| GIT-08 | Phase 4 | Complete |
| GIT-09 | Phase 4 | Complete |
| SSH-01 | Phase 5 | Complete |
| SSH-02 | Phase 5 | Complete |
| SSH-03 | Phase 5 | Complete |
| SSH-04 | Phase 5 | Complete |
| CONT-01 | Phase 5 | Complete |
| CONT-02 | Phase 5 | Complete |
| CONT-03 | Phase 5 | Complete |
| THEM-01 | Phase 1 | Complete |
| THEM-02 | Phase 2 | Complete |
| THEM-03 | Phase 2 | Complete |
| THEM-04 | Phase 2 | Complete |
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 58 total
- Mapped to phases: 58
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after roadmap creation*
