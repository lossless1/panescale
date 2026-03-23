# Project Research Summary

**Project:** Excalicode
**Domain:** Desktop terminal canvas app (Tauri v2 + React)
**Researched:** 2026-03-17
**Confidence:** HIGH

## Executive Summary

Excalicode occupies a unique intersection that no existing tool covers end-to-end: spatial infinite canvas + terminal emulator + git GUI + SSH manager, all in one cross-platform desktop app. Research confirms the technical approach is sound and well-precedented. The closest competitor is Mesa (2025), but no product combines all four dimensions. The Collaborator project (reference implementation using the same Tauri + React stack) provides a live test bed of what works and what breaks — its bug tracker is among the highest-value research inputs available, with seven specific bugs mapped directly to Excalicode pitfalls.

The recommended architecture is a strict two-process split: a Rust backend (Tauri) that owns all system resources (PTY, git, SSH, filesystem, state persistence), and a React + React Flow frontend that handles all rendering. The Tauri IPC bridge is the only communication path. React Flow (MIT, @xyflow/react v12) is the clear choice for the canvas layer — tldraw requires a $6,000/year commercial license and is whiteboard-focused rather than workspace-focused. For terminals, xterm.js + portable-pty over Tauri IPC is the industry pattern. git2 (libgit2 Rust bindings) handles git operations; russh (pure Rust, Tokio-native) handles SSH.

The central risks are all known and preventable. IPC throughput saturation when multiple terminals produce fast output must be solved with Tauri Channels (not events) and flow control, designed in Phase 1. Canvas/terminal input conflicts require a two-mode focus system before any other UX work. State persistence race conditions require a single source of truth in Zustand, atomic writes, and force-save on close. The Windows/tmux gap requires abstracting the session manager as a trait with platform implementations. All four of these are "design correctly in Phase 1 or rewrite later" decisions — the highest-leverage choices in the entire project.

## Key Findings

### Recommended Stack

The stack is well-settled with versions verified on 2026-03-17. Tauri v2.9 (CLI 2.10.1) provides the native desktop shell and Rust backend. React 19 + TypeScript 5.7 + Vite 6 are the frontend foundation, scaffolded via `create-tauri-app`. React Flow 12.10.1 (MIT, forever commitment from xyflow) is the canvas layer, chosen over tldraw (commercial license, whiteboard-focused) and Pixi.js (too low-level). For persistence, official Tauri plugins cover structured data (tauri-plugin-sql with SQLite) and key-value settings (tauri-plugin-store). Zustand v5 manages frontend state; Tailwind CSS v4 handles styling.

One version risk exists: xterm.js v6 removed the WebGL addon and changed its event system. The tauri-plugin-pty examples target v5 APIs. Either pin to `@xterm/xterm@5.5.0` or verify plugin compatibility with v6 before finalizing the terminal stack. This is flagged as the highest-priority gap for Phase 1 research.

**Core technologies:**

- Tauri v2.9: Desktop shell, Rust backend — smaller bundle and lower memory than Electron; native PTY/SSH/git without Node.js
- @xyflow/react 12.10.1 (MIT): Infinite canvas with drag/resize/pan/zoom nodes — custom nodes accept any React component, maps directly to "floating windows on canvas"
- @xterm/xterm (v5.5.0 or v6, needs verification): Terminal rendering — industry standard (used by VS Code)
- portable-pty / tauri-plugin-pty 0.1.1: Rust PTY bridge over Tauri IPC — purpose-built for this use case
- git2 0.20: libgit2 Rust bindings — stable, maintained by rust-lang org; gitoxide rejected (pre-1.0, incomplete)
- russh 0.54: Pure Rust async SSH client — Tokio-native, no C deps, maintained by Tabby/Eugeny team; ssh2-rs rejected (C deps, sync API, OpenSSL)
- tauri-plugin-sql (SQLite): Structured persistence for canvas layout, projects, SSH configs, with migrations
- tauri-plugin-store: Key-value settings (theme, window state, preferences)
- zustand v5: Lightweight frontend state — no Redux boilerplate

### Expected Features

Research identifies a four-phase MVP progression based on feature dependencies. The canvas + terminal combination is the core value proposition and must ship first. Git UI is the second major differentiator (large scope, warrants its own phase). SSH is the third pillar.

**Must have (table stakes):**

- Infinite pan and zoom with smooth scroll/drag/pinch — the defining UX paradigm
- Terminal tiles: double-click to spawn, drag/resize freely (8 handles), z-index layering — core value
- Terminal text selection, copy/paste, scrollback buffer, URL detection — every terminal app has these
- Canvas layout persistence (tile positions survive restart) — app feels broken without it
- Shell integration across bash, zsh, fish, PowerShell — cross-platform requirement
- Sidebar file tree with expand/collapse and fuzzy file search (Cmd+K)
- Dark and light themes with system preference detection
- Minimap for large canvases — navigation breaks down past 10+ tiles without it
- tmux-backed session persistence transparent to the user — core differentiator promise

**Should have (competitive differentiators):**

- Git status panel with staged/unstaged/untracked, file-level stage/unstage, diff preview
- Git diff viewer (inline or side-by-side with hunk-level controls)
- Branch management: create, switch, delete, visual indicator
- Commit log/graph
- SSH connection manager: save connections, spawn remote terminal tiles on canvas
- Terminal search within output (@xterm/addon-search)
- URL/filepath detection in terminal output (clickable links and paths)
- Canvas regions/groups for organizing related terminals visually
- Markdown note tiles and image tiles on canvas
- Stash management

**Defer (v2+):**

- Split panes within a single terminal tile (complex interaction with canvas resize)
- Merge conflict resolution UI
- CLI tool (`excalicode open .`)
- Keyboard shortcut customization
- Web browser tiles
- Plugin/extension system
- Cloud sync or collaboration

**Anti-features (explicitly out of scope):**

- Code editor / IDE — competes with VS Code, massive complexity, PROJECT.md excludes it
- AI chat integration — dilutes the product; users run AI CLI tools in terminal tiles
- Cloud sync — auth, conflict resolution, servers not in scope
- SFTP file manager, serial/Telnet connections, recording/playback

### Architecture Approach

The architecture is a clean two-process split dictated by Tauri: Rust backend owns all system resources; React frontend owns all rendering and user interaction; Tauri IPC bridge (Commands for request/response, Channels for high-throughput streaming) is the only communication channel. The frontend never touches system resources directly. CSS transforms on a container div (not HTML Canvas) power the canvas engine, which allows xterm.js and other live DOM elements to be embedded as tiles. Platform differences (tmux on Unix vs. direct ConPTY on Windows) are abstracted behind a `SessionBackend` trait.

**Major components:**

1. Canvas Engine (Frontend) — pan/zoom/grid via CSS transform on a wrapper div; tile layout and coordinate transforms; GPU-accelerated via `will-change: transform`
2. Tile System (Frontend) — renders terminal, note, image, file-preview tiles; drag/resize/z-index/focus management; memoized with `React.memo`
3. Sidebar (Frontend) — three panels (file browser, Git UI, SSH manager); all data fetched via Tauri IPC commands, rendered in React
4. PTY Manager (Rust Backend) — owns all terminal processes via portable-pty; one dedicated OS thread per PTY for blocking I/O; data multiplexed to frontend via namespaced Tauri Channels
5. Git Engine (Rust Backend) — git2 (libgit2) for all git operations; lazily opens Repository per workspace; file watcher (notify crate) triggers sidebar refresh
6. SSH Client (Rust Backend) — russh for SSH connections; remote terminal tiles use identical IPC interface as local terminals (frontend is agnostic)
7. Platform Layer (Rust Backend) — `#[cfg(unix)]` tmux bridge vs. `#[cfg(windows)]` direct ConPTY; `SessionBackend` trait abstracts the difference
8. State Store (Rust Backend) — JSON files in `~/.excalicode/`; debounced 500ms saves; atomic writes (temp file + rename); force-save on `CloseRequested` window event

**Critical IPC decisions:**

- Use `tauri::ipc::Channel` (not the event system) for PTY output streaming — Channels are optimized for ordered, high-throughput delivery
- Use raw byte payloads for terminal data — avoid base64 JSON encoding (33% overhead, CPU cost)
- Separate state managers per domain (PTY, git, SSH, state) each with their own lock — never one giant `Mutex<AppState>`

### Critical Pitfalls

1. **IPC throughput saturation under fast terminal output** — Use `tauri::ipc::Channel` for PTY data, not the event system. Implement flow control: buffer output in Rust, batch-send chunks every 16ms or 4KB. Must be designed in Phase 1; retrofitting is painful. (Tauri docs explicitly warn about this.)

2. **Canvas/terminal input event conflicts** — Implement a strict two-mode focus system from day one: "canvas mode" (pan/zoom active) and "terminal mode" (clicked terminal captures all input). Use `stopPropagation()` on terminal containers, explicit `term.focus()`/`term.blur()`, scroll-target detection. This is Collaborator bug #13 replicated exactly — every infinite-canvas-with-embedded-widgets project hits this.

3. **State persistence race conditions causing data loss** — Single source of truth: canvas layout lives only in Zustand and is the only thing persisted. Atomic file writes (write to temp file, rename). Force-save on `CloseRequested`. On restore, gracefully recreate missing tmux sessions rather than showing blank tiles. Direct evidence: Collaborator bugs #22 and #18.

4. **Windows has no tmux** — Abstract session management as a `SessionBackend` trait from day one. `TmuxSessionManager` for macOS/Linux, `WindowsSessionManager` using ConPTY + app-managed state (save CWD + scrollback, respawn on restore). Do not hardcode tmux calls outside the platform module.

5. **Startup initialization deadlock** — Show UI immediately with empty canvas. Initialize terminals and restore sessions asynchronously after UI is visible. Every restore step needs a timeout (5s for tmux attach, 10s for SSH). Fail per-tile with retry UI rather than blocking the whole app. Direct evidence: Collaborator bug #9.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation, Canvas, and Terminal Core

**Rationale:** You cannot build the product without these pieces. Canvas must exist before tiles; tiles must exist before terminals. Four architectural commitments that cannot be cheaply changed later must be made here: IPC Channel pattern for terminal data, two-mode focus system, atomic state persistence, and `SessionBackend` trait abstraction. Getting any of these wrong means a rewrite.
**Delivers:** Working infinite canvas with live terminal tiles, canvas layout persistence, basic sidebar file browser, dark/light theming, cross-platform CI setup.
**Addresses:** All table-stakes canvas features, terminal tile spawning/drag/resize, direct PTY (no tmux yet), cross-platform CI from day one.
**Avoids:** Pitfalls 1 (IPC throughput), 2 (event conflicts), 3 (state races), 4 (Windows/tmux abstraction), 6 (startup deadlock), 7 (navigation loss), 10 (PTY resource leaks), 13 (tmux config isolation), 14 (Windows cmd flash), 15 (TERM env var).

### Phase 2: Session Persistence, Terminal Polish, and File System

**Rationale:** Once raw terminals work, layer the persistence that makes them survive restarts. The file tree sidebar is a prerequisite for drag-to-canvas and git UI. Terminal power features (search, URL detection) are quick wins on top of the working terminal foundation.
**Delivers:** tmux-backed session restore on Unix, file tree sidebar with file operations and Cmd+K fuzzy search, terminal search addon, URL/filepath detection, tile snapping and alignment guides.
**Uses:** tauri-plugin-shell (tmux lifecycle), @xterm/addon-search, @tauri-apps/plugin-fs, notify crate for fs watching.
**Implements:** Platform Layer (tmux bridge on Unix, finalized Windows ConPTY path), fs_watch for real-time file tree updates.
**Avoids:** Pitfall 5 (xterm.js memory explosion — implement viewport culling and off-screen terminal virtualization), Pitfall 11 (cross-platform webview differences), Pitfall 12 (symlinks and special paths in file tree).

### Phase 3: Git UI

**Rationale:** Git is the second major differentiator, large in scope (status, diff, stage/unstage, commit, branch management, log, stash), and warrants its own dedicated phase. It depends on the file tree sidebar and file watching infrastructure from Phase 2. The unresolved tension between git2 (STACK recommendation) and git CLI (PITFALLS recommendation for performance) must be resolved here based on target repo sizes.
**Delivers:** Git status panel with stage/unstage, diff viewer (hunk-level controls), commit workflow, branch management (create/switch/delete), commit log, stash management.
**Uses:** git2 crate (or git CLI sidecar — resolve during planning), notify crate for fs-watcher-triggered refresh.
**Implements:** Git Engine (Rust backend with per-workspace Repository caching), Git UI panels (React sidebar components with lazy loading).
**Avoids:** Pitfall 8 (libgit2 performance — background threads, caching, pagination for log, stream large diffs).

### Phase 4: SSH and Content Tiles

**Rationale:** SSH reuses the terminal tile IPC interface already built. Remote terminal tiles are identical to local ones from the frontend's perspective. Content tiles (markdown notes, images, file preview) are lower-complexity canvas additions that fill out the full workspace concept.
**Delivers:** SSH connection manager (save connections, connect button spawns remote terminal tile), remote terminal tiles on canvas, markdown note tiles, image tiles, file-preview tiles (drag from sidebar to canvas).
**Uses:** russh, OS keychain for SSH credential storage, TipTap v2 (markdown notes), react-syntax-highlighter (file preview).
**Implements:** SSH Client (Rust backend with keepalive and reconnection), SSH Manager sidebar panel.
**Avoids:** Pitfall 9 (SSH connection lifecycle — keepalive detection, reconnection overlay on disconnect, OS keychain for credentials, never plaintext key storage).

### Phase 5: Polish, Performance, and Cross-Platform Release

**Rationale:** Performance optimization before having 50 real terminals in a real workflow is premature. Cross-platform packaging and Windows-specific fixes belong at the end once the full feature set is stable and tested.
**Delivers:** Viewport culling and xterm.js virtualization for 50+ terminals, Windows packaging and ConPTY testing, macOS .dmg, Linux .AppImage/.deb, Windows .msi, performance profiling.
**Uses:** Platform-specific Tauri build pipeline, intersection-based tile visibility detection.
**Implements:** Off-screen terminal unmounting (keep PTY/tmux alive, unmount xterm.js DOM, remount on scroll into view), WebGL context management within browser limits.
**Avoids:** Pitfall 5 (memory explosion at scale — 50 terminals at default scrollback is ~1.7GB without virtualization), Pitfall 11 (cross-platform webview inconsistencies surfaced via full platform testing).

### Phase Ordering Rationale

- **Canvas before terminals:** React Flow nodes need to exist before xterm.js can be embedded in them. Simpler tiles (note, image) validate the canvas system before adding PTY complexity.
- **Architectural decisions in Phase 1, not later:** IPC Channel pattern, `SessionBackend` trait, atomic state writes, and two-mode focus system are all "rewrite-required if wrong" commitments. All four must land in Phase 1.
- **Direct PTY before tmux bridge:** Get raw terminal I/O working first. The tmux persistence layer adds significant complexity — layer it on top once the foundation is solid.
- **Git after file system:** The git UI sidebar depends on file tree infrastructure and filesystem watching built in Phase 2.
- **SSH after local terminals:** The IPC interface for remote terminals is identical to local ones. Build and stabilize the local interface first; SSH reuses it.
- **Performance optimization last:** Viewport culling and xterm.js virtualization are only needed at scale. Implementing them before reaching that scale wastes time and risks premature complexity.
- **Cross-platform CI from day one:** While release packaging is Phase 5, running CI tests on macOS + Linux + Windows from Phase 1 prevents "works on my machine" syndrome (Pitfall 11).

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 — xterm.js v5 vs. v6 with tauri-plugin-pty:** Plugin examples target v5 APIs; v6 changed the event system and removed WebGL. Needs a concrete compatibility test before finalizing the terminal stack. Determine whether to pin to v5.5.0 or patch for v6. Highest-priority gap.
- **Phase 1 — Tauri Channel API for PTY streaming:** Channels are the correct solution for high-throughput terminal data, but examples are sparse relative to the older event system. Validate the Channel + raw payload approach with tauri-plugin-pty before committing.
- **Phase 2 — Windows ConPTY persistence strategy:** The design decision (app-managed state: save CWD + scrollback, respawn on restore) is made, but implementation details need fleshing out. Flag for Windows-specific research during planning.
- **Phase 3 — git2 vs. git CLI for large repos:** STACK.md recommends git2; PITFALLS.md documents its 6x performance gap on large repos. Resolve explicitly during Phase 3 planning: if target repos include monorepos (50K+ files), lean toward git CLI sidecar with structured output parsing.

Phases with standard patterns (skip deeper research):

- **Phase 1 — Canvas engine:** CSS transforms for infinite canvas is a well-documented pattern used by Panescale, tldraw, and Collaborator.
- **Phase 1 — React Flow integration:** Extensive official documentation and examples. Standard integration patterns apply.
- **Phase 4 — Markdown note tiles:** TipTap v2 integration is well-documented with clear examples.
- **Phase 5 — Packaging:** Tauri v2 packaging is thoroughly documented with official guides for all three platforms.

## Confidence Assessment

| Area         | Confidence | Notes                                                                                                                                                                                         |
| ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | HIGH       | All versions verified against npm registry, crates.io, and docs.rs on 2026-03-17. One open question: xterm.js v5 vs. v6 with tauri-plugin-pty.                                                |
| Features     | HIGH       | Derived from direct competitive analysis (Warp, WezTerm, iTerm2, Termius, GitKraken, Mesa) plus Collaborator feature requests. Feature scope is clear.                                        |
| Architecture | HIGH       | Two-process Tauri architecture is well-documented. IPC patterns verified against Tauri v2 official docs. CSS transform canvas pattern confirmed in multiple reference implementations.        |
| Pitfalls     | HIGH       | Majority are corroborated by Collaborator's live bug tracker (7 bugs directly mapped) or official library documentation (xterm.js flow control guide, Tauri IPC docs, libgit2 issue tracker). |

**Overall confidence:** HIGH

### Gaps to Address

- **xterm.js version compatibility** — Pin to v5.5.0 or verify v6 compatibility with tauri-plugin-pty before Phase 1 terminal work begins. Highest-priority gap; blocking for architecture.
- **git2 vs. git CLI** — STACK.md recommends git2; PITFALLS.md documents its performance ceiling. Resolve during Phase 3 planning based on target repo size expectations.
- **russh API complexity** — Described as having a "steeper API than ssh2." Phase 4 planning should include a spike to validate connection lifecycle, keepalive, and remote PTY channel implementation before committing to full SSH scope.
- **Windows ConPTY persistence details** — The strategy is decided in principle (app-managed state) but exact implementation (what state is serializable, process exit detection) is not researched. Flag for Phase 2 Windows milestone.
- **tauri-plugin-pty maturity** — Version 0.1.1 is early-stage. Verify it handles the full PTY lifecycle (spawn, resize, kill, reconnect across app restarts) before depending on it exclusively. Have a fallback plan: write custom Rust PTY commands using portable-pty directly.
- **React Flow performance with 50+ live xterm.js nodes** — Tile memoization and viewport culling are planned, but the interaction between React Flow's rendering and 50 live DOM terminal instances needs validation. Flag for Phase 2 performance spike.

## Sources

### Primary (HIGH confidence)

- [Tauri v2 Official Docs](https://v2.tauri.app/) — architecture, IPC, state management, plugins, webview versions
- [Tauri IPC Documentation](https://v2.tauri.app/concept/inter-process-communication/) — Channel vs. event patterns
- [Tauri Calling Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — Channel API for streaming
- [React Flow (xyflow)](https://reactflow.dev) — canvas API, MIT license confirmation, NodeResizer component
- [xyflow Open Source / MIT License](https://xyflow.com/open-source) — license commitment
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js) — terminal rendering, flow control guide, memory characteristics
- [xterm.js Flow Control Guide](https://xtermjs.org/docs/guides/flowcontrol/) — batch write pattern
- [git2-rs GitHub](https://github.com/rust-lang/git2-rs) — libgit2 API coverage and stability
- [russh GitHub](https://github.com/Eugeny/russh) — SSH client API, cross-platform support
- [portable-pty docs.rs](https://docs.rs/portable-pty) — PTY blocking I/O patterns, ConPTY support
- [tauri-plugin-pty crates.io](https://crates.io/crates/tauri-plugin-pty) — version, API
- [tauri-plugin-sql docs](https://v2.tauri.app/plugin/sql/) — SQLite support, migrations
- [tauri-plugin-store docs](https://v2.tauri.app/plugin/store/) — key-value persistence
- Collaborator project bug tracker — direct evidence for Pitfalls 2, 3, 4, 6, 7, 12, 13

### Secondary (MEDIUM confidence)

- [Mesa - Canvas for Code](https://www.getmesa.dev/) — competitive context, nearest direct competitor
- [Warp Features](https://www.warp.dev/all-features) — terminal feature table stakes
- [WezTerm Features](https://wezterm.org/features.html) — multiplexing patterns
- [iTerm2 Features](https://iterm2.com/features.html) — terminal power features
- [Termius](https://termius.com/) — SSH manager UX patterns
- [GitKraken Desktop](https://www.gitkraken.com/git-client) — git UI feature scope and complexity
- [Tauri IPC high-rate streaming discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146) — throughput limits
- [libgit2 status performance #4230](https://github.com/libgit2/libgit2/issues/4230) — performance characteristics
- [tldraw SDK pricing](https://tldraw.dev/pricing) — $6k/yr commercial license confirmed

### Tertiary (LOW confidence / needs validation)

- [psmux](https://psmux.pages.dev/) — Windows tmux alternative; rejected as too immature for v1
- [tauri-plugin-pty examples](https://github.com/Tnze/tauri-plugin-pty) — v5 API examples; v6 compatibility unverified

---

_Research completed: 2026-03-17_
_Ready for roadmap: yes_
