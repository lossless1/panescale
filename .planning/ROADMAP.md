# Roadmap: Excalicode

## Overview

Excalicode delivers a spatial terminal workspace in five phases. Phase 1 proves the core value: an infinite canvas with live terminal tiles that persist across restarts. Phase 2 adds the sidebar file browser and tmux-backed session persistence. Phase 3 layers terminal power features and canvas refinements. Phase 4 delivers the full git UI. Phase 5 completes the product with SSH remote terminals and content tiles (notes, images, file previews).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Canvas + Terminal Core** - Infinite canvas with live terminal tiles, layout persistence, cross-platform foundation
- [ ] **Phase 2: Sidebar + Session Persistence** - File tree browser, tmux session restore, theming polish, grid snapping
- [ ] **Phase 3: Terminal Polish + Canvas Refinement** - Terminal power features (search, URLs, badges), minimap, alignment guides, canvas regions
- [ ] **Phase 4: Git UI** - Full git workflow in sidebar: status, staging, commits, branches, diffs, log, stash, merge conflicts
- [ ] **Phase 5: SSH + Content Tiles** - SSH connection manager with remote terminals, markdown notes, images, file previews on canvas

## Phase Details

### Phase 1: Canvas + Terminal Core
**Goal**: Users can pan/zoom an infinite canvas, spawn terminal tiles by double-clicking, drag and resize them freely, and have the entire layout survive app restarts
**Depends on**: Nothing (first phase)
**Requirements**: CANV-01, CANV-02, CANV-03, TERM-01, TERM-02, TERM-03, TERM-04, TERM-05, TERM-07, TERM-08, TERM-14, TERM-15, PERS-01, PERS-03, PLAT-01, PLAT-02, PLAT-03, THEM-01
**Success Criteria** (what must be TRUE):
  1. User can pan the canvas (scroll wheel, Space+drag, middle-click) and zoom (Cmd/Ctrl+/-, Ctrl+scroll, pinch) with a visible dot grid background
  2. User can double-click empty canvas space to spawn a terminal tile that opens in the active directory, type commands, and see output
  3. User can drag terminal tiles by title bar, resize via edge/corner handles, click to bring to front, and close via title bar
  4. User can copy/paste text in terminal tiles and configure font, font size, and color scheme
  5. Canvas layout (tile positions, sizes, viewport) persists to disk and restores identically on app relaunch, with auto-save on changes
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Scaffold Tauri v2 project, install all dependencies, configure Vitest with test stubs
- [ ] 01-02-PLAN.md — App shell layout, theme system, infinite canvas with dot grid, pan/zoom, rubber-band effect
- [x] 01-03-PLAN.md — Rust PTY backend with portable-pty, Channel streaming, shell detection, Rust tests
- [ ] 01-04-PLAN.md — Terminal tiles on canvas with xterm.js, focus system, drag/resize/z-index, copy/paste
- [ ] 01-05-PLAN.md — Canvas state persistence with atomic writes, debounced auto-save, restore on launch

### Phase 2: Sidebar + Session Persistence
**Goal**: Users can browse project files in a sidebar, manage multiple projects, and have terminal sessions (not just layout) survive restarts via transparent tmux integration
**Depends on**: Phase 1
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08, SIDE-09, PERS-02, THEM-02, THEM-03, THEM-04, CANV-04
**Success Criteria** (what must be TRUE):
  1. User can open a folder, see its file tree in the left sidebar, expand/collapse folders, and switch between multiple open projects
  2. User can create, rename, and delete files/folders from the sidebar, search files with Cmd+K fuzzy finder, and drag files onto the canvas
  3. Terminal sessions persist across app restarts -- closing and reopening the app reconnects to running terminal sessions with scrollback intact
  4. App detects system theme preference on launch, and user has access to terminal color schemes (Dracula, Solarized, One Dark, etc.)
  5. Tile positions and sizes snap to the grid, with a modifier key to override snapping
**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md — Install plugins, Rust fs commands, project store, file tree sidebar with expand/collapse
- [ ] 02-02-PLAN.md — Three-mode theme (System/Dark/Light), terminal color schemes (One Dark + Dracula), rounded corners
- [x] 02-03-PLAN.md — Magnetic grid snapping with visual snap line feedback
- [ ] 02-04-PLAN.md — File operations context menu, Cmd+K fuzzy search, terminal list sidebar panel
- [ ] 02-05-PLAN.md — Drag files from sidebar to canvas, auto-typed content tiles (note/image/preview)
- [ ] 02-06-PLAN.md — Tmux session persistence backend, reattach on restore, orphan cleanup

### Phase 3: Terminal Polish + Canvas Refinement
**Goal**: Terminal tiles gain power-user features (search, clickable URLs, process indicators, labels) and the canvas gains navigation and organizational tools
**Depends on**: Phase 2
**Requirements**: TERM-06, TERM-09, TERM-10, TERM-11, TERM-12, TERM-13, TERM-16, CANV-05, CANV-06, CANV-07
**Success Criteria** (what must be TRUE):
  1. User can search within terminal output to find text, see clickable URLs that open in system browser, and see the running process name in the title bar
  2. User can rename terminals, configure scrollback buffer size, assign color badges/labels, set startup commands, and receive notification sounds when processes complete
  3. User can see a minimap overview for navigating large canvases, and sees alignment guides when dragging tiles near other tiles
  4. User can create named canvas regions with optional background color to visually group related tiles
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Terminal search (SearchAddon), clickable URLs (WebLinksAddon), process title in title bar, scrollback config
- [ ] 03-02-PLAN.md — Terminal rename, color badges, startup commands, bell notification with chime and sidebar pulse
- [ ] 03-03-PLAN.md — Minimap toggle, alignment guides on drag, canvas regions with group drag and persistence

### Phase 4: Git UI
**Goal**: Users can perform their full daily git workflow without leaving the app -- status, staging, committing, branching, diffing, log browsing, stashing, and conflict resolution
**Depends on**: Phase 2
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, GIT-06, GIT-07, GIT-08, GIT-09
**Success Criteria** (what must be TRUE):
  1. User can see staged, unstaged, and untracked files in a git status panel, and stage/unstage individual files
  2. User can write a commit message and commit staged changes, and view inline or side-by-side diffs for changed files
  3. User can see all branches with current branch indicated, create/switch/delete branches, and view commit log with branch topology graph
  4. User can stash changes and manage stashes (apply, pop, drop), and resolve merge conflicts through a dedicated UI
**Plans**: 4 plans

Plans:
- [ ] 04-01-PLAN.md — Rust git backend (git2), all IPC wrappers, gitStore, Git sidebar tab
- [ ] 04-02-PLAN.md — Status panel, file staging/unstaging, inline diff viewer with hunk staging, commit section
- [ ] 04-03-PLAN.md — Branch management (create/switch/delete), commit log with SVG topology graph
- [ ] 04-04-PLAN.md — Stash management, merge conflict resolution UI, final GitPanel wiring

### Phase 5: SSH + Content Tiles
**Goal**: Users can manage SSH connections and spawn remote terminal tiles on the canvas, and enrich their workspace with markdown notes, images, and file preview cards
**Depends on**: Phase 1 (terminal IPC), Phase 2 (sidebar drag-to-canvas)
**Requirements**: SSH-01, SSH-02, SSH-03, SSH-04, CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. User can save SSH connections (host, user, key, port), organize them into groups, and connect to spawn a remote terminal tile on the canvas
  2. Remote terminal tiles behave identically to local terminals (drag, resize, z-index, close)
  3. User can create markdown note tiles with rich text editing, place images on the canvas, and open files from the sidebar as syntax-highlighted read-only preview tiles
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — SSH Rust backend (russh), IPC wrappers, sshStore with connection/group CRUD
- [ ] 05-02-PLAN.md — Content tile upgrades: NoteNode markdown editor, ImageNode filesystem DnD, FilePreviewNode shiki highlighting, persistence
- [ ] 05-03-PLAN.md — SSH sidebar panel, useSsh hook, TerminalNode SSH extension, SSH terminal persistence

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Canvas + Terminal Core | 2/5 | In progress | - |
| 2. Sidebar + Session Persistence | 3/6 | In Progress|  |
| 3. Terminal Polish + Canvas Refinement | 1/3 | In Progress|  |
| 4. Git UI | 3/4 | In Progress|  |
| 5. SSH + Content Tiles | 0/3 | Not started | - |

### Phase 6: File tile interactions and app icon

**Goal:** Double-click content tiles to open a terminal in the file's parent directory, and design a gradient abstract app icon for Panescale
**Requirements**: TILE-DBLCLICK, APP-ICON
**Depends on:** Phase 5
**Plans:** 1/2 plans executed

Plans:
- [ ] 06-01-PLAN.md — Double-click content tile title bars to spawn terminal in file's directory
- [ ] 06-02-PLAN.md — Gradient abstract app icon design and export to all Tauri-required sizes

### Phase 7: Release process with GitHub CI/CD

**Goal:** GitHub Actions CI/CD for building Panescale on all three platforms (macOS universal, Linux, Windows), publishing GitHub Releases with auto-generated notes, and Tauri updater for version detection
**Requirements**: UPDATER-CONFIG, UPDATER-UI, CI-WORKFLOW, GITHUB-RELEASE, PLATFORM-BUILDS
**Depends on:** Phase 6
**Plans:** 2/2 plans complete

Plans:
- [ ] 07-01-PLAN.md — Tauri updater plugin setup (Rust, config, capabilities, frontend update check UI)
- [ ] 07-02-PLAN.md — GitHub Actions release workflow for tag-triggered multi-platform builds and GitHub Releases
