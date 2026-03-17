# Technology Stack

**Project:** Excalicode
**Researched:** 2026-03-17
**Overall Confidence:** MEDIUM-HIGH

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tauri | ^2.9 | Desktop shell, Rust backend | Project requirement. Stable since Oct 2024, active development (CLI at 2.10.1). Smaller bundle, lower memory than Electron. Rust backend enables native PTY, SSH, and git without Node.js. | HIGH |
| React | ^19 | Frontend UI framework | Project requirement. Mature ecosystem, strong canvas library support (React Flow, tldraw both React-native). Collaborator uses React 19 successfully. | HIGH |
| TypeScript | ^5.7 | Type safety | Non-negotiable for a project this complex. Catch IPC contract mismatches at compile time. | HIGH |
| Vite | ^6 | Build tooling, HMR | Official Tauri recommendation. `create-tauri-app` scaffolds with Vite. Fast HMR for canvas development. | HIGH |

### Infinite Canvas

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @xyflow/react (React Flow) | ^12.10 | Infinite canvas with draggable, resizable nodes | **MIT licensed** (forever commitment from xyflow). Built-in node drag, resize (NodeResizer component), pan/zoom, selection. Custom nodes accept any React component -- embed xterm.js terminals, markdown editors, images directly as nodes. Node-based paradigm maps perfectly to Excalicode's "floating windows on canvas" concept. 30k+ GitHub stars, actively maintained. | HIGH |

**Why NOT tldraw:** tldraw SDK 4.x requires a $6,000/year commercial license for production use. It is a whiteboard SDK (drawing, shapes) rather than a node-based workspace. Custom shapes use HTMLContainer which adds overhead vs React Flow's direct React component rendering. Overkill for Excalicode's use case -- we need draggable windows, not a drawing tool.

**Why NOT Pixi.js:** Too low-level. Would require building drag/drop, selection, resize, pan/zoom from scratch. React Flow provides all of this out of the box. Pixi.js is for games and graphics, not application workspaces.

**Why NOT custom canvas:** Months of work to replicate what React Flow provides. Pan/zoom math, hit testing, virtualization, accessibility -- all solved problems in React Flow.

### Terminal Emulation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @xterm/xterm | ^6.0 | Terminal rendering in webview | Industry standard (VS Code uses it). v6.0.0 is the current major, migrated to @xterm scoped packages. WebGL renderer removed in v6 -- use DOM renderer (sufficient for desktop app) or canvas addon. | MEDIUM |
| @xterm/addon-fit | ^0.10 | Auto-resize terminal to container | Essential for responsive terminal nodes on canvas. | MEDIUM |
| @xterm/addon-web-links | ^0.11 | Clickable URLs in terminal | Table stakes UX feature. | MEDIUM |
| tauri-plugin-pty | ^0.1.1 | Rust PTY bridge for Tauri IPC | Purpose-built Tauri v2 plugin wrapping portable-pty. Provides spawn/read/write/resize over Tauri's IPC. Simple API: `spawn()` returns a pty handle, `onData()`/`write()` for bidirectional data. Eliminates need for custom Rust commands. | MEDIUM |
| portable-pty | ^0.9.0 | Cross-platform PTY (used by tauri-plugin-pty) | From wezterm project. Handles Unix PTY and Windows ConPTY. Transitive dependency via tauri-plugin-pty. | HIGH |

**Key architecture difference from Collaborator:** Collaborator uses Node.js `node-pty` in Electron's main process. In Tauri, there is no Node.js -- PTY management happens in Rust via portable-pty. The `tauri-plugin-pty` crate bridges this to the webview over Tauri's IPC channel. Data flow: xterm.js (webview) <-> Tauri IPC <-> portable-pty (Rust) <-> shell process.

**xterm.js v6 note:** v6 removed the WebGL addon and changed the event system (EventEmitter -> vs/base Emitter). The tauri-plugin-pty examples use v5 APIs. Verify compatibility or pin to @xterm/xterm@5.5.0 if the plugin's `onData` pattern breaks with v6. Flag for phase-specific research.

### Git Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| git2 (Rust crate) | ^0.20 | Git operations from Rust backend | libgit2 bindings for Rust. Stable, mature (maintained by rust-lang org). Covers: status, staging, commits, branches, log, diff, merge, stash -- everything in the requirements. Bundles libgit2 source so no system dependency. Thread-safe. | HIGH |

**Why NOT gitoxide (gix):** Pre-1.0 (v0.51), API stability is tiered with breaking changes every 4 weeks on most crates. `gix status` only recently completed (Jan 2025). Too risky for a full git UI that needs status, diff, merge, stash, branches. Revisit when gix reaches 1.0.

**Why NOT isomorphic-git:** JavaScript library, would run in the webview. Defeats Tauri's architecture -- git operations should be in Rust for performance and access to the filesystem without webview sandboxing constraints.

**Why NOT shelling out to `git` CLI:** Requires git installed on user's system. Parsing CLI output is fragile. git2 provides structured APIs. However, for edge cases (interactive rebase, complex merge), consider falling back to CLI as escape hatch.

### SSH Client

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| russh | ^0.54 | SSH client for remote terminals | Pure Rust, async (Tokio-native -- matches Tauri's async runtime). Maintained by Eugeny (creator of Tabby terminal). Supports SSH2 protocol, key auth, password auth, agent forwarding. ~500k recent downloads. No C dependencies (unlike ssh2 crate which wraps libssh2 + OpenSSL). | HIGH |

**Why NOT ssh2 crate:** Wraps libssh2 (C library) + requires OpenSSL. Cross-compilation pain on Windows. Synchronous API requires spawning threads. russh is pure Rust + async.

**Architecture:** Rust backend establishes SSH connection via russh, opens a remote PTY channel, bridges data to xterm.js via same IPC pattern as local terminals. The SSH connection manager UI stores connection configs; the Rust backend handles connection lifecycle.

### Terminal Persistence

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tmux (system) | system | Session persistence for local terminals | Project requirement. Attach to named tmux sessions so terminal state survives app restarts. | MEDIUM |

**Cross-platform concern:** tmux is not available on Windows natively. Options:
1. **Recommended:** On Windows, use direct PTY without tmux persistence. Document that terminal persistence requires WSL or tmux-compatible environment. Most Windows developer users will have WSL.
2. **Alternative:** Investigate psmux (Rust-based Windows tmux clone using ConPTY) -- but it's very new and unproven.
3. **Fallback:** On Windows, persist terminal working directory and command history only (not full scrollback state).

Flag this as a phase-specific research item for the Windows milestone.

### State Persistence

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tauri-plugin-sql (SQLite) | ^2.3 | Structured data persistence | Official Tauri plugin. SQLite for canvas layout, node positions/sizes, project configs, SSH connections, git preferences. Supports migrations for schema evolution. Accessible from both Rust and JS. | HIGH |
| tauri-plugin-store | ^2.4 | Key-value settings | Official Tauri plugin. For simple preferences: theme, window size, last opened project. JSON-backed file store. | HIGH |

**Why SQLite over JSON files:** Canvas state is relational (nodes have positions, connections to projects, terminal configs). SQLite handles concurrent reads, atomic writes, and schema migrations. JSON files require manual merge logic and are fragile under crashes.

**Data model sketch:**
- `canvas_nodes` table: id, type (terminal/note/image/preview), x, y, width, height, project_id, config_json
- `projects` table: id, path, name, last_opened
- `ssh_connections` table: id, name, host, port, user, auth_method, key_path
- `settings` key-value store for preferences

### Styling & Theming

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | ^4 | Utility-first CSS | Collaborator uses it successfully. v4 has CSS-first config, faster builds. Excellent for rapid UI development. Dark/light themes via CSS custom properties + Tailwind's dark mode. | HIGH |
| CSS Custom Properties | native | Theme variables | Define color palette as CSS variables. Toggle dark/light by swapping variable values on `:root`. xterm.js theme object reads from same variables for consistent terminal colors. | HIGH |

### Rich Text / Markdown Notes

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TipTap | ^2 | Markdown note cards on canvas | Collaborator uses BlockNote/TipTap. TipTap is the underlying engine, highly extensible. Supports markdown input/output, rich text editing, code blocks with syntax highlighting. MIT licensed. | MEDIUM |

**Why NOT BlockNote:** BlockNote wraps TipTap with opinionated Block-based UI. For simple note cards on a canvas, TipTap gives more control with less overhead.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | ^2 | Tauri IPC from frontend | All Rust backend communication |
| @tauri-apps/plugin-fs | ^2 | File system access | File preview cards, project browsing |
| @tauri-apps/plugin-dialog | ^2 | Native file/folder dialogs | Open project folder |
| @tauri-apps/plugin-shell | ^2 | Shell command execution | tmux lifecycle management |
| zustand | ^5 | Frontend state management | Canvas state, UI state, active project. Lightweight, no boilerplate. |
| react-syntax-highlighter | ^15 | Code in file preview cards | Read-only file preview rendering |
| serde / serde_json | ^1 | Rust serialization | All IPC data structures |
| tokio | ^1 | Async runtime (Rust) | SSH connections, concurrent PTY management |
| anyhow | ^1 | Error handling (Rust) | Simplify error propagation in commands |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Canvas | React Flow (MIT) | tldraw ($6k/yr license) | Commercial license cost, whiteboard-focused not workspace-focused |
| Canvas | React Flow | Pixi.js | Too low-level, rebuild everything from scratch |
| Git | git2 (libgit2) | gitoxide (gix) | Pre-1.0, unstable API, incomplete features |
| Git | git2 (libgit2) | isomorphic-git | JS-only, wrong side of Tauri architecture |
| SSH | russh | ssh2-rs | C dependency (libssh2), sync API, OpenSSL required |
| State | SQLite | JSON files | No migrations, no concurrent access, crash-fragile |
| State mgmt | zustand | Redux | Overkill boilerplate for this use case |
| Editor | TipTap | Monaco | Out of scope (no code editor requirement) |
| Styling | Tailwind CSS 4 | CSS Modules | Less productive, no design system velocity |

## Installation

```bash
# Create project
npm create tauri-app@latest excalicode -- --template react-ts

# Frontend dependencies
npm install @xyflow/react @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-markdown
npm install zustand tailwindcss @tailwindcss/vite
npm install @tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
npm install @tauri-apps/plugin-shell @tauri-apps/plugin-sql @tauri-apps/plugin-store
npm install tauri-pty

# Dev dependencies
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

```toml
# Cargo.toml (src-tauri/)
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-pty = "0.1"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-store = "2"
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
git2 = "0.20"
russh = { version = "0.54", features = ["aws-lc-rs"] }
russh-keys = "0.46"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
```

## Architecture Summary

```
+------------------+     Tauri IPC      +-------------------+
|   React WebView  | <================> |   Rust Backend     |
|                  |                    |                    |
|  React Flow      |   spawn/write/    |  portable-pty      |
|  (canvas)        |   read/resize     |  (local terminals) |
|                  |                    |                    |
|  xterm.js        |   ssh_connect/    |  russh             |
|  (terminals)     |   ssh_data        |  (remote terminals)|
|                  |                    |                    |
|  TipTap          |   git_status/     |  git2              |
|  (notes)         |   git_commit/etc  |  (git operations)  |
|                  |                    |                    |
|  zustand         |   db queries      |  SQLite            |
|  (state)         |                   |  (persistence)     |
|                  |                    |                    |
|  Tailwind CSS    |   shell commands  |  tmux lifecycle    |
|  (styling)       |                   |  (session mgmt)    |
+------------------+                    +-------------------+
```

## Version Verification Status

| Technology | Version | Verified Via | Date |
|------------|---------|-------------|------|
| Tauri | ^2.9 (CLI 2.10.1) | npm registry, crates.io | 2026-03-17 |
| React Flow | 12.10.1 | npm registry | 2026-03-17 |
| @xterm/xterm | 6.0.0 | npm registry | 2026-03-17 |
| tldraw | 4.4.1 (rejected) | npm registry | 2026-03-17 |
| tauri-plugin-pty | 0.1.1 | crates.io | 2026-03-17 |
| portable-pty | 0.9.0 | crates.io | 2026-03-17 |
| git2 | 0.20.4 | docs.rs | 2026-03-17 |
| russh | 0.54.6 | docs.rs | 2026-03-17 |
| tauri-plugin-sql | 2.3.2 | docs.rs | 2026-03-17 |
| tauri-plugin-store | 2.4.2 | docs.rs | 2026-03-17 |
| Tailwind CSS | 4 | Collaborator reference | 2026-03-17 |

## Sources

- [Tauri v2 Official Site](https://v2.tauri.app/)
- [Tauri v2 Releases](https://v2.tauri.app/release/)
- [Tauri Create Project Guide](https://v2.tauri.app/start/create-project/)
- [Tauri Vite Frontend Guide](https://v2.tauri.app/start/frontend/vite/)
- [Tauri SQL Plugin](https://v2.tauri.app/plugin/sql/)
- [Tauri Store Plugin](https://v2.tauri.app/plugin/store/)
- [React Flow (xyflow)](https://reactflow.dev)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [React Flow NodeResizer](https://reactflow.dev/api-reference/components/node-resizer)
- [xyflow Open Source / MIT License](https://xyflow.com/open-source)
- [tldraw SDK](https://tldraw.dev/) -- rejected due to licensing
- [tldraw License / Pricing](https://tldraw.dev/pricing)
- [xterm.js GitHub](https://github.com/xtermjs/xterm.js)
- [@xterm/xterm npm](https://www.npmjs.com/package/@xterm/xterm)
- [tauri-plugin-pty (Tnze)](https://github.com/Tnze/tauri-plugin-pty)
- [tauri-plugin-pty crates.io](https://crates.io/crates/tauri-plugin-pty)
- [portable-pty crate](https://lib.rs/crates/portable-pty)
- [git2-rs GitHub](https://github.com/rust-lang/git2-rs)
- [gitoxide GitHub](https://github.com/GitoxideLabs/gitoxide)
- [gitoxide Stability](https://github.com/GitoxideLabs/gitoxide/blob/main/STABILITY.md)
- [russh GitHub](https://github.com/Eugeny/russh)
- [russh crates.io](https://crates.io/crates/russh)
- [psmux (Windows tmux alternative)](https://github.com/marlocarlo/psmux)
- [Persistent State in Tauri Apps](https://aptabase.com/blog/persistent-state-tauri-apps)
