# Architecture Patterns

**Domain:** Desktop terminal canvas application (Tauri v2 + React)
**Researched:** 2026-03-17

## System Overview Diagram

```
+------------------------------------------------------------------+
|                        TAURI WINDOW                               |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                    REACT FRONTEND                           |  |
|  |                                                             |  |
|  |  +----------+  +---------------------------------------+   |  |
|  |  | Sidebar  |  |          Canvas Engine                 |   |  |
|  |  |          |  |                                        |   |  |
|  |  | - Files  |  |  +--------+ +--------+ +----------+   |   |  |
|  |  | - Git UI |  |  |Terminal| |Terminal| |  Note    |   |   |  |
|  |  | - SSH    |  |  | Tile   | | Tile   | |  Tile    |   |   |  |
|  |  |   Mgr    |  |  |xterm.js| |xterm.js| | Markdown |   |   |  |
|  |  |          |  |  +--------+ +--------+ +----------+   |   |  |
|  |  +----------+  |                                        |   |  |
|  |                 |  +--------+ +----------+              |   |  |
|  |  +-----------+  |  | Image  | |File Prev.|             |   |  |
|  |  |Theme Mgr  |  |  | Tile   | |  Tile    |             |   |  |
|  |  +-----------+  |  +--------+ +----------+              |   |  |
|  |                 +---------------------------------------+   |  |
|  +------------------------------------------------------------+  |
|                              |                                    |
|                     TAURI IPC BRIDGE                               |
|              (Commands = request/response)                        |
|              (Events   = fire-and-forget streams)                 |
|                              |                                    |
|  +------------------------------------------------------------+  |
|  |                    RUST BACKEND                              |  |
|  |                                                              |  |
|  |  +------------+  +----------+  +----------+  +-----------+  |  |
|  |  | PTY Manager|  |Git Engine|  |SSH Client|  |State Store|  |  |
|  |  |            |  |          |  |          |  |           |  |  |
|  |  |portable-pty|  |  git2    |  |  russh   |  | JSON file |  |  |
|  |  | + ConPTY   |  |          |  |          |  | debounced |  |  |
|  |  +------------+  +----------+  +----------+  +-----------+  |  |
|  |                                                              |  |
|  |  +----------------------------------------------------------+  |
|  |  | Platform Layer (conditional compilation)                  |  |
|  |  | - Unix: native PTY, tmux bridge                          |  |
|  |  | - Windows: ConPTY, direct PTY (no tmux)                  |  |
|  |  +----------------------------------------------------------+  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

## Recommended Architecture

Excalicode follows a clean two-process architecture dictated by Tauri: a Rust backend (Core) that owns all system resources (PTY, filesystem, git, SSH, network), and a React frontend (WebView) that owns all rendering and user interaction. The Tauri IPC bridge is the sole communication channel.

**Key principle:** The frontend never touches system resources directly. Every PTY byte, git operation, and SSH connection flows through Tauri commands/events.

### Component Boundaries

| Component      | Process  | Responsibility                                           | Communicates With                           |
| -------------- | -------- | -------------------------------------------------------- | ------------------------------------------- |
| Canvas Engine  | Frontend | Pan/zoom, tile layout, coordinate transforms             | Tile components, State Store (via IPC)      |
| Tile System    | Frontend | Render individual tiles (terminal, note, image, preview) | Canvas Engine, PTY Manager (via IPC)        |
| Sidebar        | Frontend | File browser, Git UI, SSH manager                        | Git Engine (via IPC), SSH Client (via IPC)  |
| Theme Manager  | Frontend | Dark/light theme, CSS variables                          | All frontend components                     |
| PTY Manager    | Backend  | Spawn/kill PTYs, route I/O, resize                       | Platform Layer, Frontend (via events)       |
| Git Engine     | Backend  | All git operations via libgit2                           | Filesystem, Frontend (via commands)         |
| SSH Client     | Backend  | SSH connections, remote PTY sessions                     | PTY Manager, Frontend (via commands/events) |
| State Store    | Backend  | Persist canvas layout, config, window state              | Filesystem, Frontend (via commands)         |
| Platform Layer | Backend  | Abstract OS differences (PTY, tmux, ConPTY)              | PTY Manager                                 |

## IPC Layer Design

This is the most critical architectural boundary. Getting this right determines the app's responsiveness and maintainability.

### Commands (Request/Response) -- Use for Operations

Commands are Tauri's primary IPC primitive. The frontend invokes a Rust function, passes JSON-serialized arguments, and receives a JSON-serialized response. They map to JavaScript Promises.

**Use commands for:**

| Command Group               | Examples                   | Returns                                      |
| --------------------------- | -------------------------- | -------------------------------------------- |
| `pty_spawn`                 | Create new terminal        | `{ pty_id: string }`                         |
| `pty_resize`                | Change terminal dimensions | `void`                                       |
| `pty_kill`                  | Destroy a terminal         | `void`                                       |
| `git_status`                | Get working tree status    | `{ files: FileStatus[] }`                    |
| `git_commit`                | Create a commit            | `{ oid: string }`                            |
| `git_branches`              | List branches              | `{ branches: Branch[] }`                     |
| `git_diff`                  | Get diff for file/commit   | `{ hunks: DiffHunk[] }`                      |
| `git_log`                   | Commit history             | `{ commits: Commit[] }`                      |
| `git_stage` / `git_unstage` | Stage/unstage files        | `void`                                       |
| `git_merge` / `git_stash`   | Merge, stash operations    | Result types                                 |
| `ssh_connect`               | Open SSH connection        | `{ session_id: string }`                     |
| `ssh_disconnect`            | Close SSH connection       | `void`                                       |
| `ssh_list_connections`      | Saved connections          | `{ connections: SshConfig[] }`               |
| `ssh_save_connection`       | Persist connection config  | `void`                                       |
| `state_save`                | Persist canvas/config      | `void`                                       |
| `state_load`                | Load canvas/config         | `{ canvas: CanvasState, config: AppConfig }` |
| `fs_read_dir`               | List directory contents    | `{ entries: DirEntry[] }`                    |
| `fs_watch`                  | Start watching a path      | `{ watcher_id: string }`                     |

### Events (Fire-and-Forget Streams) -- Use for Continuous Data

Events are one-way messages suitable for streaming data and state change notifications. Both frontend and backend can emit them.

**Use events for:**

| Event                   | Direction           | Payload               | Purpose                   |
| ----------------------- | ------------------- | --------------------- | ------------------------- |
| `pty:data:{pty_id}`     | Backend -> Frontend | `Vec<u8>` (raw bytes) | Terminal output stream    |
| `pty:exit:{pty_id}`     | Backend -> Frontend | `{ code: i32 }`       | Process exited            |
| `pty:input:{pty_id}`    | Frontend -> Backend | `Vec<u8>` (raw bytes) | User keystrokes           |
| `git:fs-changed`        | Backend -> Frontend | `{ path: string }`    | File watcher notification |
| `ssh:disconnected:{id}` | Backend -> Frontend | `{ reason: string }`  | Connection lost           |
| `state:auto-save`       | Internal (Backend)  | --                    | Trigger debounced save    |

**Critical performance note:** Terminal I/O (pty:data and pty:input) is the highest-throughput IPC path. Tauri v2 added raw payload support to avoid JSON serialization overhead for binary data. Use raw bytes for terminal data, not base64-encoded JSON strings.

### IPC Pattern: Terminal Tile Lifecycle

```
Frontend                         Backend
   |                                |
   |--- pty_spawn(cwd, cols, rows) -->
   |<-- { pty_id: "abc123" } ---------|
   |                                |
   |  listen("pty:data:abc123")     |  spawn shell in PTY
   |<====== raw bytes stream ========|  read loop -> emit events
   |                                |
   |  emit("pty:input:abc123", bytes)|  write to PTY stdin
   |======= raw bytes =============>|
   |                                |
   |--- pty_resize("abc123", c, r) -->
   |                                |  resize PTY
   |                                |
   |  (user closes tile)            |
   |--- pty_kill("abc123") -------->|
   |                                |  kill process, clean up
   |<== "pty:exit:abc123" =========|
```

## Component Deep Dives

### 1. Rust Backend: PTY Manager

**Crate:** `portable-pty` (from the WezTerm project)
**Confidence:** HIGH -- portable-pty is battle-tested (powers WezTerm), cross-platform, and has ConPTY support on Windows.

The PTY Manager owns all terminal processes. It maintains a `HashMap<PtyId, PtyHandle>` wrapped in `Arc<Mutex<>>` for thread-safe access from Tauri command handlers.

```rust
// Conceptual structure
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader_handle: JoinHandle<()>,  // background thread reading PTY output
}
```

**Data flow for PTY output:**

1. Background thread reads from `MasterPty` in a loop
2. Each chunk is emitted as a Tauri event (`pty:data:{id}`) with raw bytes
3. Frontend xterm.js instance receives and renders

**Data flow for PTY input:**

1. Frontend listens to xterm.js `onData` callback
2. Emits Tauri event (`pty:input:{id}`) with raw bytes
3. Backend listener writes bytes to `MasterPty`

### 2. Rust Backend: Platform Layer (tmux / Windows)

**This is the most architecturally complex piece.**

#### Unix (macOS, Linux): tmux Bridge

On Unix, tmux provides session persistence -- if the app crashes or restarts, terminal sessions survive because tmux owns the actual PTY.

Architecture:

- On `pty_spawn`: create a tmux session (`tmux new-session -d -s {id}`)
- The app's PTY connects to that tmux session (`tmux attach -t {id}`)
- On app restart: enumerate existing tmux sessions, reconnect
- The user never sees or interacts with tmux directly

The tmux bridge is a **wrapper around** the PTY Manager, not a replacement. The PTY Manager still owns the PTY that connects to tmux; tmux owns the real shell process.

```
App PTY (portable-pty) <---> tmux session <---> actual shell (bash/zsh)
```

#### Windows: Direct ConPTY (No tmux)

**Confidence:** HIGH -- portable-pty already supports Windows ConPTY natively.

tmux does not exist on Windows natively. The options considered:

| Option                                      | Verdict    | Reason                                                        |
| ------------------------------------------- | ---------- | ------------------------------------------------------------- |
| WSL tmux                                    | REJECTED   | Requires WSL installed, adds complexity, user may not have it |
| psmux (Rust tmux for Windows)               | REJECTED   | Too new (2025), not battle-tested, adds a dependency          |
| Cygwin/MSYS2 tmux                           | REJECTED   | Heavy dependency, fragile, poor UX                            |
| **Direct ConPTY + app-managed persistence** | **CHOSEN** | Native, no dependencies, portable-pty handles it              |

**Windows strategy:** On Windows, Excalicode manages terminal persistence itself:

- ConPTY (via portable-pty) spawns terminals directly
- Terminal sessions do NOT survive app crashes on Windows (acceptable tradeoff)
- Canvas layout and scroll history are persisted to disk, so on restart the user gets fresh terminals in the same positions
- The PTY Manager interface is identical; only the tmux bridge is absent

**Platform abstraction:**

```rust
#[cfg(unix)]
mod tmux_bridge;

#[cfg(windows)]
mod direct_pty;

pub trait SessionBackend: Send + Sync {
    fn spawn(&self, config: SpawnConfig) -> Result<SessionHandle>;
    fn attach(&self, session_id: &str) -> Result<SessionHandle>;
    fn list_sessions(&self) -> Result<Vec<String>>;
    fn kill(&self, session_id: &str) -> Result<()>;
}
```

### 3. Rust Backend: Git Engine

**Crate:** `git2` (libgit2 bindings, maintained by the Rust project)
**Confidence:** HIGH -- git2 is the standard Rust git library, stable, well-documented.

The Git Engine wraps git2 behind a clean command interface. All operations are synchronous within the Rust side but exposed as async Tauri commands (which run on the thread pool automatically).

**Key design decisions:**

- Open `Repository` lazily and cache per-workspace (don't re-open on every command)
- File watching triggers `git:fs-changed` events so the sidebar can refresh status
- Diff computation happens in Rust and sends structured data (not raw diff text) -- the frontend renders it
- Branch operations, merge, and stash all go through git2, never shell out to `git` CLI

**Why git2 over shelling out to git CLI:**

- No dependency on system git installation
- Structured error handling
- No subprocess spawning overhead
- Thread-safe concurrent access

### 4. Rust Backend: SSH Client

**Crate:** `russh` (pure Rust, async, Tokio-native)
**Confidence:** MEDIUM -- russh is actively maintained (used by Eugeny/Tabby SSH client) but has a steeper API than ssh2.

**Why russh over ssh2:**

- `russh` is pure Rust (no C dependency on libssh2/OpenSSL)
- Async/Tokio-native (Tauri v2 uses Tokio internally)
- Cross-platform without OpenSSL build headaches on Windows
- Active maintenance by the Tabby/Eugeny team

**SSH terminal flow:**

1. User creates connection in SSH Manager (frontend)
2. `ssh_connect` command: russh establishes session, authenticates
3. `ssh_spawn_pty` command: opens a channel, requests PTY
4. Data flows through the same event pattern as local PTYs (`pty:data:{id}` / `pty:input:{id}`)
5. The frontend terminal tile doesn't know if it's local or remote -- the IPC interface is identical

**Connection persistence:**

- SSH configs (host, port, user, key path) stored in app state JSON
- Passwords/keys NOT stored in plain text -- use OS keychain (Tauri plugin: `tauri-plugin-os` or system keyring crate)
- Connections re-established on demand, not automatically on app restart

### 5. Rust Backend: State Store

**Pattern:** JSON files in `~/.excalicode/` (mirroring Collaborator's approach)

**Files:**

```
~/.excalicode/
  canvas-state.json    # tiles, positions, sizes, viewport
  config.json          # workspaces, window state, preferences
  ssh-connections.json # saved SSH configs (no secrets)
  theme.json           # active theme, custom overrides
```

**Persistence strategy:**

- Debounced save: 500ms after last change (same as Collaborator)
- Immediate save on: tile create, tile close, SSH connection save
- Load on startup, merge with defaults for missing fields
- File locking via `fs2` crate to prevent corruption if multiple instances

**State flows:**

- Frontend dispatches state changes via commands (`state_save_canvas`, `state_save_config`)
- Backend debounces and writes to disk
- On startup, frontend calls `state_load` to hydrate

### 6. React Frontend: Canvas Engine

**Approach:** CSS transforms on a container div (not HTML Canvas or WebGL)
**Confidence:** HIGH -- this is how Panescale, tldraw, and Collaborator implement their canvases.

**Why CSS transforms over Canvas/WebGL:**

- Terminal tiles contain live DOM elements (xterm.js, markdown renderers, images)
- You cannot embed interactive DOM content inside a `<canvas>` element
- CSS `transform: translate(x, y) scale(z)` on a wrapper div is simple, performant, and composable
- GPU-accelerated by default via `will-change: transform`

**Canvas coordinate system:**

```typescript
interface Viewport {
  panX: number; // world X offset
  panY: number; // world Y offset
  zoom: number; // scale factor (0.25 - 3.0)
}

// Screen coords -> World coords
function screenToWorld(screenX: number, screenY: number, viewport: Viewport) {
  return {
    x: (screenX - viewport.panX) / viewport.zoom,
    y: (screenY - viewport.panY) / viewport.zoom,
  };
}
```

**Rendering strategy:**

- Single `<div className="canvas-world">` with CSS transform
- All tiles are children of this div, positioned with `position: absolute; left: {x}px; top: {y}px`
- Pan: mouse drag on empty space updates `panX/panY`, applied via transform
- Zoom: wheel events update `zoom`, applied via transform scale
- Dot grid background: CSS repeating pattern, moves with the transform

**Performance for 50+ terminals:**

- Only render tiles visible in the viewport (intersection-based culling)
- xterm.js instances for off-screen tiles can be detached (pause rendering) and reattached on scroll
- Use `React.memo` aggressively on tile components
- Consider virtualization: unmount xterm.js DOM for tiles far from viewport, remount on approach

### 7. React Frontend: Tile System

Tiles are the fundamental UI unit. Every item on the canvas is a tile.

```typescript
interface Tile {
  id: string;
  type: "terminal" | "note" | "image" | "file-preview";
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  // Type-specific data
  meta: TerminalMeta | NoteMeta | ImageMeta | FilePreviewMeta;
}

interface TerminalMeta {
  ptyId: string; // links to backend PTY
  projectPath: string; // which project this terminal belongs to
  isRemote: boolean;
  sshConnectionId?: string;
}
```

**Tile interactions:**

- Drag: update x/y, debounce state save
- Resize: update width/height, send `pty_resize` for terminals
- Focus: bring to front (update zIndex), focus xterm.js
- Close: kill PTY (if terminal), remove from canvas state
- Double-click empty space: spawn new terminal at click position

### 8. React Frontend: Sidebar

Three panels, switchable via tabs or accordion:

**File Browser:**

- Tree view of active workspace directory
- Uses `fs_read_dir` command to load directories lazily
- `fs_watch` command to get real-time updates
- Drag file onto canvas to create a file preview tile

**Git UI:**

- Status panel: staged/unstaged files (from `git_status`)
- Diff viewer: inline diff rendering (from `git_diff`)
- Branch panel: list, create, switch, merge (from `git_branches`)
- Log panel: commit history with graph (from `git_log`)
- Stash panel: list, apply, drop (from `git_stash_*`)
- All data fetched via Tauri commands, rendered in React

**SSH Manager:**

- List saved connections
- Add/edit connection form (host, port, user, auth method)
- Connect button spawns remote terminal tile on canvas
- Connection status indicators

### 9. React Frontend: Theme System

**Approach:** CSS custom properties (variables) with a React context provider.

```typescript
// ThemeProvider wraps the app
// Reads theme from state store on mount
// Applies CSS variables to :root
// Toggle switches all variables at once

const themes = {
  dark: {
    "--bg-primary": "#1a1a2e",
    "--bg-secondary": "#16213e",
    "--text-primary": "#e0e0e0",
    "--border": "#2a2a4a",
    // ...
  },
  light: {
    "--bg-primary": "#ffffff",
    "--bg-secondary": "#f5f5f5",
    "--text-primary": "#1a1a1a",
    "--border": "#e0e0e0",
    // ...
  },
};
```

xterm.js has its own theme object -- sync it with the CSS variables.

## Data Flow Summary

```
USER ACTION          FRONTEND                    IPC              BACKEND
-----------          --------                    ---              -------
Double-click    -->  Create tile state     -->  pty_spawn    --> PTY Manager spawns shell
  on canvas          Add tile to canvas         (command)        Start read loop
                     Mount xterm.js

Type in         -->  xterm.js onData      -->  pty:input    --> Write to PTY stdin
  terminal           callback                   (event)

                     xterm.js.write()      <--  pty:data     <-- Read loop gets output
                     renders output              (event)

Resize tile     -->  Update tile dims     -->  pty_resize   --> Resize PTY
                     CSS resize                 (command)

Click git       -->  Sidebar renders      -->  git_status   --> git2 reads repo
  status             status list                (command)        Returns file list

Drag tile       -->  Update position      -->  state_save   --> Debounced write
                     in React state             (command)        to JSON file

App startup     -->  Call state_load      -->  state_load   --> Read JSON files
                     Hydrate canvas             (command)        Return state
                     Reconnect PTYs       -->  pty_spawn    --> Reattach tmux (Unix)
                                                (command)        or spawn new (Windows)
```

## Patterns to Follow

### Pattern 1: Command Grouping by Domain

Organize Tauri commands into Rust modules by domain. Each module owns its state.

```rust
// src-tauri/src/
//   main.rs          -- Tauri setup, register commands
//   pty/
//     mod.rs         -- PtyManager, commands
//   git/
//     mod.rs         -- GitEngine, commands
//   ssh/
//     mod.rs         -- SshClient, commands
//   state/
//     mod.rs         -- StateStore, commands
//   platform/
//     mod.rs         -- trait definitions
//     unix.rs        -- tmux bridge
//     windows.rs     -- direct ConPTY
```

Register all commands in main.rs:

```rust
tauri::Builder::default()
    .manage(PtyManager::new())
    .manage(GitEngine::new())
    .manage(SshClient::new())
    .manage(StateStore::new())
    .invoke_handler(tauri::generate_handler![
        pty::spawn, pty::resize, pty::kill,
        git::status, git::commit, git::diff, git::branches, git::log,
        ssh::connect, ssh::disconnect, ssh::list_connections,
        state::save_canvas, state::load,
        fs::read_dir, fs::watch,
    ])
    .run(tauri::generate_context!())
```

### Pattern 2: Event-Namespaced Streaming

Use namespaced events with IDs to multiplex many terminals over one event system.

```rust
// Backend emits to specific terminal
app.emit(&format!("pty:data:{}", pty_id), &raw_bytes)?;

// Frontend listens per-terminal
listen(`pty:data:${tile.meta.ptyId}`, (event) => {
    xtermRef.current.write(new Uint8Array(event.payload));
});
```

### Pattern 3: Optimistic Frontend State

Canvas state lives in React (Zustand or similar). Changes are applied immediately to the UI and then asynchronously persisted via debounced commands. The backend is the persistence layer, not the source of truth for UI state.

```
User drags tile -> React state updates immediately -> UI re-renders
                -> Debounce 500ms -> state_save command -> JSON on disk
```

### Pattern 4: Lazy Loading for Git

Git operations can be expensive on large repos. Load data on demand:

- `git_status` only when Git panel is visible
- `git_log` with pagination (first 50 commits, load more on scroll)
- `git_diff` only for the selected file
- File watcher triggers status refresh, not full reload

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling for Terminal Data

**What:** Using setInterval to repeatedly call a `pty_read` command.
**Why bad:** Adds latency (minimum = poll interval), wastes CPU, terrible UX for interactive terminals.
**Instead:** Use Tauri events. The backend pushes data as soon as it's available.

### Anti-Pattern 2: Storing PTY Bytes in JSON Events

**What:** Base64-encoding terminal output into JSON event payloads.
**Why bad:** ~33% size overhead, encoding/decoding CPU cost, especially painful at high throughput.
**Instead:** Use Tauri v2 raw payload support for binary terminal data.

### Anti-Pattern 3: One Giant State Object

**What:** A single Rust `AppState` struct behind one `Mutex<>` holding everything.
**Why bad:** Any operation locks all state. Git status blocks PTY spawn.
**Instead:** Separate state managers per domain, each with their own lock.

### Anti-Pattern 4: Shelling Out for Git

**What:** Using `std::process::Command` to run `git status`, `git diff`, etc.
**Why bad:** Depends on system git, parsing CLI output is fragile, no structured errors.
**Instead:** Use git2 crate for all git operations.

### Anti-Pattern 5: Re-rendering Entire Canvas on Tile Move

**What:** Canvas state change triggers re-render of all tiles.
**Why bad:** 50+ terminals re-rendering kills performance.
**Instead:** Individual tile components are memoized. Only the moved tile re-renders. Canvas transform is a CSS change on the wrapper, not a React re-render.

## Scalability Considerations

| Concern           | 10 terminals                   | 50 terminals                         | 100+ terminals                             |
| ----------------- | ------------------------------ | ------------------------------------ | ------------------------------------------ |
| PTY threads       | 10 read threads, fine          | 50 threads, consider thread pool     | Use async I/O with tokio, batch events     |
| Canvas rendering  | All visible, no culling needed | Cull off-screen, memo all tiles      | Virtualize: unmount far-away xterm.js      |
| Memory (xterm.js) | ~5MB each = 50MB total         | ~250MB, watch scrollback buffer size | Limit scrollback to 5000 lines, page older |
| IPC throughput    | No concern                     | Batch events if needed               | Consider shared memory or raw channel      |
| State persistence | Instant JSON write             | Debounce critical, ~50KB file        | Consider splitting state per-workspace     |

## Suggested Build Order

The build order is driven by dependency chains. You cannot test terminals without PTY; you cannot test the full app without canvas + tiles.

```
Phase 1: Foundation
  [Tauri v2 scaffold] --> [React shell with router] --> [Theme system]
  [Rust module structure] --> [State Store (load/save JSON)]

Phase 2: Canvas + Tiles (static)
  [Canvas engine: pan/zoom/grid] --> [Tile container: drag/resize]
  [Note tile] --> [Image tile]  (test canvas without PTY complexity)

Phase 3: Terminal Core
  [PTY Manager (portable-pty)] --> [xterm.js Terminal Tile]
  [IPC wiring: events for data, commands for lifecycle]
  [Platform layer: direct PTY first, tmux bridge later]

Phase 4: File System + Git
  [File browser sidebar] --> [fs_read_dir, fs_watch]
  [Git Engine (git2)] --> [Git UI sidebar panels]

Phase 5: SSH + Remote Terminals
  [SSH Client (russh)] --> [SSH Manager sidebar]
  [Remote PTY spawning] --> [Same tile interface as local]

Phase 6: Persistence + Polish
  [tmux bridge for Unix] --> [Session recovery on restart]
  [Canvas state persistence] --> [Window state persistence]
  [Viewport culling] --> [Performance optimization]

Phase 7: Cross-Platform + Release
  [Windows ConPTY testing] --> [Platform-specific fixes]
  [Packaging: macOS .dmg, Linux .AppImage/.deb, Windows .msi]
```

**Build order rationale:**

- Canvas before terminals: you need somewhere to put terminals before you build them
- Note/image tiles before terminal tiles: simpler tiles validate the canvas system without PTY complexity
- Direct PTY before tmux: get terminals working first, add persistence layer after
- Git after terminals: git is a sidebar feature, terminals are the core product
- SSH after local terminals: remote terminals reuse the same IPC interface
- Performance optimization last: premature optimization before you have 50 tiles is wasted effort

## Sources

- [Tauri v2 IPC Documentation](https://v2.tauri.app/concept/inter-process-communication/)
- [Tauri v2 State Management](https://v2.tauri.app/develop/state-management/)
- [Tauri v2 Store Plugin](https://v2.tauri.app/plugin/store/)
- [portable-pty crate (WezTerm)](https://docs.rs/portable-pty)
- [tauri-plugin-pty](https://github.com/Tnze/tauri-plugin-pty)
- [git2-rs (libgit2 bindings)](https://github.com/rust-lang/git2-rs)
- [russh SSH library](https://github.com/Eugeny/russh)
- [Windows ConPTY announcement](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/)
- [Terminon (Tauri + React terminal app)](https://github.com/Shabari-K-S/terminon)
- [Flowscape canvas-react](https://github.com/Flowscape-UI/canvas-react)
- [Tauri v2 Architecture](https://v2.tauri.app/concept/architecture/)
