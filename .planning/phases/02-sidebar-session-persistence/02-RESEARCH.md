# Phase 2: Sidebar + Session Persistence - Research

**Researched:** 2026-03-18
**Domain:** File tree sidebar, tmux session persistence, terminal theming, grid snapping, system theme detection
**Confidence:** HIGH

## Summary

Phase 2 adds substantial frontend and backend features to the Phase 1 foundation: a file tree sidebar with dual view modes (hierarchical + chronological), tmux-backed terminal session persistence (transparent to user), terminal color schemes (One Dark + Dracula), system theme auto-detection, and magnetic grid snapping for tile positioning.

The existing codebase provides solid integration points: `Sidebar.tsx` is an empty shell ready for content, `canvasStore.ts` has node management that needs extension for new tile types, `themeStore.ts` needs a third "system" mode, and `PtyManager` in Rust needs a tmux wrapping layer for session persistence on Unix.

**Primary recommendation:** Build the file tree and grid snapping first (frontend-heavy, lower risk), then tackle tmux integration (backend-heavy, higher complexity), then terminal color schemes and system theme detection (incremental additions to existing infrastructure).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- Two view modes: hierarchical tree + chronological feed sorted by date (toggle between them, like Collaborator)
- Full sort cycle: name (A-Z/Z-A), created (newest/oldest), modified (newest/oldest)
- Right-click context menu for file operations (create, rename, delete, move) -- no inline hover buttons
- Drag file from sidebar to canvas creates tile auto-typed by extension: .md -> note tile, images -> image tile, code files -> syntax-highlighted preview
- Folders first in tree view, then files
- Tmux fully hidden from user -- no tmux status bar, no prefix key, no tmux commands visible. User never knows tmux exists.
- If tmux not installed: auto-install via brew (macOS), apt/pacman (Linux). Show progress indicator during install.
- Restore UX: instant -- tiles appear immediately with terminal content visible, feels like app never closed
- Tmux session naming: managed by app, deterministic from tile ID for reliable reconnection
- Ship with One Dark (default) and Dracula presets
- Global scheme only -- one scheme applies to all terminals, changed in settings
- No per-terminal scheme override in v1
- Auto-follow system dark/light mode by default
- User can override to lock dark or light (3 options: System, Dark, Light)
- Magnetic snap: tiles snap to grid when within ~10px of a grid line. Firm feel like Panescale.
- Cmd/Ctrl key held disables snapping for free positioning
- Visual feedback: show accent-colored snap lines on the grid points tile is snapping to while dragging
- Snap applies to both position and size (tile edges align to grid)
- Sidebar terminal list with name/cwd, click pans canvas to terminal
- Rounded window corners on macOS (transparent webview + border-radius)

### Claude's Discretion

- Exact grid spacing (16px, 20px, 24px -- whatever feels right)
- Chronological view date formatting and grouping (by day, week, month)
- Tmux session cleanup strategy (orphaned sessions)
- File tree icon set (VS Code-like file icons or simpler)
- Fuzzy search ranking algorithm

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                           | Research Support                                                                                        |
| ------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| SIDE-01 | Left sidebar shows a file tree for the active project folder                          | Tauri plugin-fs readDir + watchImmediate for real-time tree; custom Rust commands for directory listing |
| SIDE-02 | User can expand/collapse folders in the file tree                                     | Frontend tree component with lazy-loaded directory expansion                                            |
| SIDE-03 | User can open a folder to set it as the active project                                | Tauri dialog plugin for native folder picker; project store for active workspace                        |
| SIDE-04 | User can switch between multiple open projects/workspaces                             | Project store with array of open projects + active project index                                        |
| SIDE-05 | User can create, rename, and delete files/folders from the sidebar                    | Tauri plugin-fs write/rename/remove + right-click context menu                                          |
| SIDE-06 | User can search/filter files with a fuzzy finder (Cmd+K)                              | Frontend fuzzy matching on cached file list; no external library needed                                 |
| SIDE-07 | User can drag files from sidebar onto canvas to create content tiles                  | HTML5 DnD from sidebar to React Flow canvas; auto-type by extension                                     |
| SIDE-08 | Sidebar shows a list of all open terminal tiles with name and working directory       | Read terminal nodes from canvasStore, render in sidebar panel                                           |
| SIDE-09 | Clicking a terminal entry in sidebar pans canvas to that terminal and focuses it      | React Flow fitView/setCenter on node position                                                           |
| PERS-02 | Terminal sessions persist via tmux (transparent to user) and reconnect on app restart | Rust tmux bridge wrapping PtyManager; deterministic session naming                                      |
| THEM-02 | App detects system theme preference and applies it by default                         | matchMedia('prefers-color-scheme') listener + 3-mode ThemePreference                                    |
| THEM-03 | Terminal color schemes are available (One Dark, Dracula)                              | xterm.js ITheme presets with full ANSI color palettes                                                   |
| THEM-04 | App window has rounded corners on macOS (transparent webview + border-radius)         | Tauri transparent window + CSS border-radius on root container                                          |
| CANV-04 | All tile positions and sizes snap to grid (with modifier key to override)             | React Flow snapToGrid + snapGrid props with custom magnetic behavior                                    |

</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library                  | Version  | Purpose                      | Why Standard                                                      |
| ------------------------ | -------- | ---------------------------- | ----------------------------------------------------------------- |
| @xyflow/react            | ^12.10.1 | Canvas with snap-to-grid     | Already used. Built-in `snapToGrid` and `snapGrid` props.         |
| @tauri-apps/plugin-fs    | ^2.4.5   | File system read/write/watch | Already installed. Has `readDir`, `watch`, `watchImmediate` APIs. |
| @tauri-apps/plugin-store | ^2.4.2   | Settings persistence         | Already installed. For theme preference, color scheme selection.  |
| zustand                  | ^5.0.12  | Frontend state management    | Already used. Add projectStore, extend themeStore/settingsStore.  |

### New Dependencies Needed

| Library                                 | Version | Purpose                             | When to Use                                                  |
| --------------------------------------- | ------- | ----------------------------------- | ------------------------------------------------------------ |
| @tauri-apps/plugin-dialog               | ^2      | Native folder picker (open project) | SIDE-03: "Open Folder" to set active project                 |
| @tauri-apps/plugin-shell                | ^2      | Execute tmux commands from Rust     | PERS-02: tmux lifecycle (spawn, attach, list, kill sessions) |
| tauri-plugin-fs (Rust, `watch` feature) | ^2      | Backend file watching               | Enable with `features = ["watch"]` in Cargo.toml             |
| tauri-plugin-dialog (Rust)              | ^2      | Folder selection dialog backend     | Backend registration for dialog plugin                       |
| tauri-plugin-shell (Rust)               | ^2      | Shell command execution backend     | Backend registration for shell plugin                        |

### Not Needed (Don't Add)

| Instead of              | Don't Use                      | Reason                                                                    |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| Custom fuzzy search lib | fuse.js, fzf-for-js            | Simple substring/prefix matching on cached file list is sufficient for v1 |
| Custom file icon lib    | vscode-icons, file-icons       | Use simple extension-based mapping with emoji or basic SVG icons          |
| Tree component library  | react-arborist, react-treeview | Custom tree is straightforward with recursive React components            |
| Custom context menu lib | react-contexify                | Use native-feeling custom menu with simple React portal                   |

### Installation

```bash
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-shell
```

```toml
# Add to src-tauri/Cargo.toml [dependencies]
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-fs = { version = "2", features = ["watch"] }
```

## Architecture Patterns

### Recommended Project Structure (New Files)

```
src/
  stores/
    projectStore.ts        # Active project, recent projects, workspace management
  components/
    sidebar/
      FileTree.tsx          # Hierarchical tree view
      ChronologicalFeed.tsx # Date-sorted file feed
      FileTreeItem.tsx      # Individual file/folder row
      TerminalList.tsx      # Open terminals panel
      FuzzySearch.tsx       # Cmd+K file search overlay
      ContextMenu.tsx       # Right-click file operations menu
      SidebarTabs.tsx       # View mode toggle (Tree/Feed/Terminals)
    canvas/
      NoteNode.tsx          # Markdown note tile (drag from sidebar)
      ImageNode.tsx         # Image tile (drag from sidebar)
      FilePreviewNode.tsx   # Code preview tile (drag from sidebar)
      SnapLines.tsx         # Visual snap guide lines during drag
  lib/
    fileIcons.ts            # Extension -> icon mapping
    terminalSchemes.ts      # One Dark + Dracula ITheme presets
    fuzzyMatch.ts           # Simple fuzzy matching algorithm
  styles/
    themes.ts               # Extended with terminal color scheme variables

src-tauri/src/
  platform/
    tmux.rs                 # Tmux bridge: spawn, attach, list, kill sessions
    mod.rs                  # Extended with tmux module
  fs/
    mod.rs                  # File system commands (readDir, watch, CRUD)
    commands.rs             # Tauri command handlers for fs operations
```

### Pattern 1: Tmux Session Bridge (Unix Only)

**What:** Wrap each terminal's PTY in a tmux session so shells survive app restart
**When to use:** On macOS and Linux for PERS-02

The tmux bridge sits between PtyManager and the actual shell. Instead of spawning a shell directly in a PTY, we spawn `tmux new-session -d -s {session_name} {shell}` and then attach to it via the PTY.

```rust
// src-tauri/src/platform/tmux.rs
use std::process::Command;

pub struct TmuxBridge;

impl TmuxBridge {
    /// Check if tmux is installed
    pub fn is_available() -> bool {
        Command::new("tmux").arg("-V").output().is_ok()
    }

    /// Create a new detached tmux session
    pub fn create_session(session_name: &str, shell: &str, cwd: &str) -> Result<()> {
        Command::new("tmux")
            .args(["new-session", "-d", "-s", session_name, "-c", cwd, shell])
            .env("TMUX", "") // Unset TMUX to avoid nested session errors
            .output()?;
        Ok(())
    }

    /// Attach to existing session via control mode for programmatic I/O
    /// Returns the tmux command that the PTY should spawn
    pub fn attach_command(session_name: &str) -> Vec<String> {
        vec![
            "tmux".into(),
            "attach-session".into(),
            "-t".into(),
            session_name.into(),
        ]
    }

    /// List all excalicode-managed tmux sessions
    pub fn list_sessions(prefix: &str) -> Result<Vec<String>> {
        let output = Command::new("tmux")
            .args(["list-sessions", "-F", "#{session_name}"])
            .output()?;
        let sessions = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|s| s.starts_with(prefix))
            .map(|s| s.to_string())
            .collect();
        Ok(sessions)
    }

    /// Kill a tmux session
    pub fn kill_session(session_name: &str) -> Result<()> {
        Command::new("tmux")
            .args(["kill-session", "-t", session_name])
            .output()?;
        Ok(())
    }

    /// Capture pane content for instant restore
    pub fn capture_pane(session_name: &str) -> Result<String> {
        let output = Command::new("tmux")
            .args(["capture-pane", "-t", session_name, "-p", "-S", "-"])
            .output()?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }
}
```

**Session naming convention:** Use `exc-{tile_id}` prefix so sessions are deterministic and identifiable. On app restart, enumerate sessions with `tmux list-sessions`, match against persisted tile IDs, and reattach.

**Spawn flow change:**

1. Phase 1 (current): `PtyManager.spawn()` -> `portable-pty` -> shell directly
2. Phase 2 (new): `PtyManager.spawn()` -> `TmuxBridge.create_session()` -> `portable-pty` spawns `tmux attach -t {session}` instead of shell directly

### Pattern 2: File Tree with Lazy Directory Loading

**What:** Load directory contents on-demand as user expands folders
**When to use:** SIDE-01, SIDE-02

```typescript
// Custom Rust command for directory listing (better than plugin-fs for custom metadata)
interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: number; // Unix timestamp ms
  created: number; // Unix timestamp ms
}

// Rust command returns sorted entries (folders first, then files)
// Frontend caches expanded directories and refreshes on fs watch events
```

Use Tauri plugin-fs `watchImmediate` with `recursive: true` on the project root to detect changes, then refresh only affected directory nodes.

### Pattern 3: Magnetic Grid Snap with Visual Feedback

**What:** Custom snap behavior that magnetically attracts tiles within a threshold
**When to use:** CANV-04

React Flow has built-in `snapToGrid` + `snapGrid` props, but they do hard snapping (always on grid). The user wants magnetic behavior (snap only when within ~10px). This requires custom `onNodeDrag` handling:

```typescript
const GRID_SIZE = 20; // Claude's discretion: 20px feels right
const SNAP_THRESHOLD = 10; // Magnetic range in px

function magneticSnap(
  value: number,
  gridSize: number,
  threshold: number,
): number {
  const nearest = Math.round(value / gridSize) * gridSize;
  const distance = Math.abs(value - nearest);
  if (distance <= threshold) {
    return nearest; // Snap!
  }
  return value; // Free position
}

// In onNodeDrag handler:
// 1. Check if Cmd/Ctrl is held -> skip snapping
// 2. Apply magneticSnap to both x and y
// 3. Apply magneticSnap to right and bottom edges (position + size)
// 4. Update snap line overlay positions for visual feedback
```

**Do NOT use React Flow's built-in snapToGrid** -- it always snaps rigidly. Instead, use `onNodeDrag` + `onNodeDragStop` callbacks to implement magnetic behavior, and render custom SnapLines component as an overlay.

### Pattern 4: Three-Mode Theme Preference

**What:** Extend themeStore to support System/Dark/Light preference with media query listener
**When to use:** THEM-02

```typescript
type ThemePreference = "system" | "dark" | "light";
type ResolvedTheme = "dark" | "light";

// Listen for system changes
const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
mediaQuery.addEventListener("change", ({ matches }) => {
  if (preference === "system") {
    applyTheme(matches ? "dark" : "light");
  }
});
```

### Pattern 5: Sidebar-to-Canvas Drag and Drop

**What:** Drag file from sidebar onto canvas to create auto-typed tile
**When to use:** SIDE-07

Use HTML5 Drag and Drop API. Set `draggable="true"` on file tree items, pass file metadata in `dataTransfer`. Listen for `drop` on the React Flow pane.

```typescript
// File tree item
onDragStart={(e) => {
  e.dataTransfer.setData('application/excalicode-file', JSON.stringify({
    path: file.path,
    name: file.name,
    ext: file.ext,
  }));
}}

// Canvas drop handler (ReactFlow onDrop prop)
onDrop={(e) => {
  const data = JSON.parse(e.dataTransfer.getData('application/excalicode-file'));
  const position = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
  const tileType = extensionToTileType(data.ext); // .md->note, .png->image, .ts->preview
  addContentNode(position, tileType, data);
}}
```

### Anti-Patterns to Avoid

- **Loading entire file tree at once:** Large projects (node_modules) will freeze the UI. Always lazy-load on expand.
- **Polling for file changes:** Use `watchImmediate` with events, never `setInterval` + `readDir`.
- **Running tmux in the PTY's shell:** Don't start tmux inside the user's terminal. The PTY should spawn `tmux attach`, not run tmux as a command inside bash.
- **Storing tmux session names in frontend:** Session names should be derived deterministically from tile ID. Never let them drift.
- **Hard-coding color scheme values in CSS:** Terminal color schemes must go through xterm.js ITheme, not CSS variables. CSS variables are for app UI only.

## Don't Hand-Roll

| Problem                 | Don't Build                    | Use Instead                                      | Why                                                                |
| ----------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------ |
| File system watching    | Custom notify/fsevents wrapper | `@tauri-apps/plugin-fs` watchImmediate           | Already installed, cross-platform, debounce built-in               |
| Folder picker dialog    | Custom file browser            | `@tauri-apps/plugin-dialog` open()               | Native OS dialog, already handles permissions                      |
| Grid snap math          | Custom spatial indexing        | Simple modulo math (see Pattern 3)               | The math is trivial; no library needed                             |
| Terminal color presets  | User-configurable color picker | Hardcoded ITheme objects for One Dark/Dracula    | v1 ships with 2 presets only, no customization                     |
| tmux session management | Full tmux client library       | `std::process::Command` calling tmux CLI         | tmux CLI is stable, well-documented, and we only need 5 operations |
| Context menu            | Custom React portal menu       | Simple positioned div with click-outside handler | Lightweight, no library needed for a simple menu                   |

**Key insight:** This phase has many small features. Resist the urge to over-engineer any single one. Simple implementations that work are better than elegant abstractions that add complexity.

## Common Pitfalls

### Pitfall 1: Tmux Nested Session Error

**What goes wrong:** If the user already has TMUX env var set (they're inside tmux), spawning `tmux new-session` fails with "sessions should be nested with care"
**Why it happens:** tmux refuses to create sessions inside another tmux session by default
**How to avoid:** Always unset the `TMUX` environment variable when spawning tmux commands: `cmd.env("TMUX", "")`
**Warning signs:** "sessions should be nested with care, unset $TMUX to force" error message

### Pitfall 2: Tmux Not Installed on Clean System

**What goes wrong:** App crashes or terminals don't persist on fresh macOS/Linux installs
**Why it happens:** tmux is not installed by default on macOS or many Linux distros
**How to avoid:** Check `TmuxBridge::is_available()` on startup. If not found, show install dialog. On macOS: `brew install tmux`. On Linux: `apt install tmux` or `pacman -S tmux`. Fall back to direct PTY (no persistence) if install fails or user declines.
**Warning signs:** `command not found: tmux` in error logs

### Pitfall 3: File Watcher Floods on node_modules

**What goes wrong:** Recursive file watching on a project root triggers thousands of events when `npm install` runs
**Why it happens:** `watchImmediate` with `recursive: true` reports every single file change
**How to avoid:** Filter watch events by path -- ignore `node_modules`, `.git`, `target`, `dist` directories. Apply debouncing on the directory refresh (500ms after last event).
**Warning signs:** UI freezing during npm install or git operations

### Pitfall 4: React Flow onNodeDrag Performance

**What goes wrong:** Magnetic snap logic runs on every mouse move during drag, causing jank
**Why it happens:** Snap calculation + snap line overlay re-render on every drag event
**How to avoid:** Keep snap calculation cheap (simple modulo, no loops). Use refs for snap line positions, not state. Only update snap lines when snap targets change, not on every pixel of movement.
**Warning signs:** Choppy drag behavior, especially with many tiles visible

### Pitfall 5: Transparent Window Loses Shadow on macOS

**What goes wrong:** Setting `transparent: true` in tauri.conf.json removes the native window shadow
**Why it happens:** macOS disables shadows for transparent windows by default
**How to avoid:** Use CSS box-shadow on the root container element instead of relying on native shadow. Accept the tradeoff -- rounded corners require transparency.
**Warning signs:** Window looks "flat" compared to native apps

### Pitfall 6: Theme Flicker on Startup

**What goes wrong:** App briefly shows wrong theme before system preference is read
**Why it happens:** Theme preference loads from localStorage synchronously but system detection is async
**How to avoid:** Read `prefers-color-scheme` synchronously via `window.matchMedia` during store initialization (this IS synchronous). Apply correct theme before first render.
**Warning signs:** Brief flash of dark/light theme before settling

### Pitfall 7: Tmux Session Cleanup on Tile Close

**What goes wrong:** Tmux sessions accumulate over time, consuming system resources
**Why it happens:** Closing a terminal tile doesn't kill the tmux session, only detaches
**How to avoid:** When user explicitly closes a tile (not just app restart), kill the tmux session. On app startup, compare persisted tile IDs to tmux sessions -- kill orphans (sessions with no matching tile).
**Warning signs:** `tmux list-sessions` shows dozens of old sessions

## Code Examples

### Terminal Color Scheme Presets (ITheme)

```typescript
// src/lib/terminalSchemes.ts
import type { ITheme } from "@xterm/xterm";

export type TerminalSchemeName = "one-dark" | "dracula";

export const terminalSchemes: Record<TerminalSchemeName, ITheme> = {
  "one-dark": {
    background: "#282C34",
    foreground: "#ABB2BF",
    cursor: "#528BFF",
    cursorAccent: "#282C34",
    selectionBackground: "rgba(82, 139, 255, 0.3)",
    selectionForeground: undefined,
    black: "#1E2127",
    red: "#E06C75",
    green: "#98C379",
    yellow: "#E5C07B",
    blue: "#61AFEF",
    magenta: "#C678DD",
    cyan: "#56B6C2",
    white: "#ABB2BF",
    brightBlack: "#5C6370",
    brightRed: "#E06C75",
    brightGreen: "#98C379",
    brightYellow: "#E5C07B",
    brightBlue: "#61AFEF",
    brightMagenta: "#C678DD",
    brightCyan: "#56B6C2",
    brightWhite: "#FFFFFF",
  },
  dracula: {
    background: "#282A36",
    foreground: "#F8F8F2",
    cursor: "#F8F8F2",
    cursorAccent: "#282A36",
    selectionBackground: "#44475A",
    selectionForeground: undefined,
    black: "#21222C",
    red: "#FF5555",
    green: "#50FA7B",
    yellow: "#F1FA8C",
    blue: "#BD93F9",
    magenta: "#FF79C6",
    cyan: "#8BE9FD",
    white: "#F8F8F2",
    brightBlack: "#6272A4",
    brightRed: "#FF6E6E",
    brightGreen: "#69FF94",
    brightYellow: "#FFFFA5",
    brightBlue: "#D6ACFF",
    brightMagenta: "#FF92DF",
    brightCyan: "#A4FFFF",
    brightWhite: "#FFFFFF",
  },
};
```

_Source: Dracula spec from [draculatheme.com/spec](https://draculatheme.com/spec), One Dark from [atom-one-dark-terminal](https://github.com/nathanbuchar/atom-one-dark-terminal)_

### System Theme Detection

```typescript
// Extend themeStore.ts
type ThemePreference = "system" | "dark" | "light";
type ResolvedTheme = "dark" | "light";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? getSystemTheme() : pref;
}

// In store initialization, add media query listener:
const mq = window.matchMedia("(prefers-color-scheme: dark)");
mq.addEventListener("change", () => {
  const { preference, setResolvedTheme } = useThemeStore.getState();
  if (preference === "system") {
    setResolvedTheme(getSystemTheme());
  }
});
```

_Source: [MDN prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)_

### React Flow Magnetic Snap

```typescript
// In Canvas.tsx, add to ReactFlow component:
<ReactFlow
  // ... existing props
  onNodeDrag={(event, node) => {
    if (event.ctrlKey || event.metaKey) return; // Override: free positioning

    const snappedX = magneticSnap(node.position.x, GRID_SIZE, SNAP_THRESHOLD);
    const snappedY = magneticSnap(node.position.y, GRID_SIZE, SNAP_THRESHOLD);

    if (snappedX !== node.position.x || snappedY !== node.position.y) {
      // Update node position to snapped position
      // Update snap line overlay positions
      setSnapLines({ x: snappedX, y: snappedY });
    } else {
      setSnapLines(null);
    }
  }}
  onNodeDragStop={() => setSnapLines(null)}
/>
```

_Source: [React Flow SnapGrid API](https://reactflow.dev/api-reference/types/snap-grid)_

### Rounded Corners on macOS

```json
// tauri.conf.json - add transparent: true to window
{
  "app": {
    "windows": [
      {
        "transparent": true,
        "decorations": false
      }
    ]
  }
}
```

```css
/* Root container CSS */
#app-root {
  border-radius: 10px;
  overflow: hidden;
  /* CSS shadow to replace lost native shadow */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}
```

_Source: [Tauri Window Customization](https://v2.tauri.app/learn/window-customization/)_

### File Tree Rust Command

```rust
// src-tauri/src/fs/commands.rs
#[derive(serde::Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
    modified_ms: u64,
    created_ms: u64,
}

#[tauri::command]
pub fn fs_read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let modified_ms = metadata.modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let created_ms = metadata.created()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        entries.push(FileEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            modified_ms,
            created_ms,
        });
    }
    // Sort: folders first, then files, alphabetically within each group
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}
```

## State of the Art

| Old Approach                               | Current Approach                                | When Changed     | Impact                                           |
| ------------------------------------------ | ----------------------------------------------- | ---------------- | ------------------------------------------------ |
| tauri-plugin-fs-watch (v1 separate plugin) | `@tauri-apps/plugin-fs` has watch built-in (v2) | Tauri v2         | Use plugin-fs directly, no separate watch plugin |
| xterm.js v5 WebGL addon                    | xterm.js v5 DOM renderer (project uses v5.5.0)  | Already using v5 | No change needed for Phase 2                     |
| Manual theme CSS toggle                    | CSS custom properties + matchMedia              | Standard         | Already partially implemented                    |

**Note:** The project uses `@xterm/xterm` v5.5.0 (not v6). The WebGL addon is available and used. This is stable and correct for Phase 2.

## Open Questions

1. **Tmux auto-install UX on Linux**
   - What we know: brew handles macOS, apt handles Debian/Ubuntu
   - What's unclear: How to detect package manager on Linux (apt vs pacman vs dnf)
   - Recommendation: Check for each package manager in order: `apt-get`, `pacman`, `dnf`, `zypper`. Use the first one found. If none, show manual install instructions.

2. **Content tile rendering (drag-to-canvas)**
   - What we know: User wants .md->note, images->image, code->preview
   - What's unclear: These are new node types that aren't fully scoped in Phase 2 requirements (CONT-01/02/03 are Phase 5)
   - Recommendation: Implement minimal stub tiles for Phase 2. Note tile = render markdown as HTML (no editing). Image tile = `<img>` tag. Code preview = `<pre>` with file content. Full editing (TipTap) is Phase 5.

3. **Windows tmux strategy**
   - What we know: User marked this as Claude's discretion. No tmux on Windows natively.
   - What's unclear: Whether to attempt WSL detection
   - Recommendation: On Windows, skip tmux entirely. Terminals work but don't persist across restart. Document this limitation. This matches the architecture research recommendation.

## Validation Architecture

### Test Framework

| Property           | Value                |
| ------------------ | -------------------- |
| Framework          | Vitest 4.1.0 + jsdom |
| Config file        | `vitest.config.ts`   |
| Quick run command  | `npm run test`       |
| Full suite command | `npm run test`       |

### Phase Requirements -> Test Map

| Req ID  | Behavior                                     | Test Type   | Automated Command                                     | File Exists?             |
| ------- | -------------------------------------------- | ----------- | ----------------------------------------------------- | ------------------------ |
| SIDE-01 | File tree renders directory entries          | unit        | `npx vitest run src/test/fileTree.test.ts -x`         | No - Wave 0              |
| SIDE-02 | Folder expand/collapse toggles children      | unit        | `npx vitest run src/test/fileTree.test.ts -x`         | No - Wave 0              |
| SIDE-03 | Open folder sets active project              | unit        | `npx vitest run src/test/projectStore.test.ts -x`     | No - Wave 0              |
| SIDE-04 | Switch between projects updates state        | unit        | `npx vitest run src/test/projectStore.test.ts -x`     | No - Wave 0              |
| SIDE-05 | Create/rename/delete operations              | unit        | `npx vitest run src/test/fileOps.test.ts -x`          | No - Wave 0              |
| SIDE-06 | Fuzzy search filters file list               | unit        | `npx vitest run src/test/fuzzyMatch.test.ts -x`       | No - Wave 0              |
| SIDE-07 | Drag file creates correct tile type          | unit        | `npx vitest run src/test/dragToCanvas.test.ts -x`     | No - Wave 0              |
| SIDE-08 | Terminal list shows open terminals           | unit        | `npx vitest run src/test/terminalList.test.ts -x`     | No - Wave 0              |
| SIDE-09 | Click terminal entry pans canvas             | unit        | `npx vitest run src/test/terminalList.test.ts -x`     | No - Wave 0              |
| PERS-02 | Tmux session lifecycle                       | manual-only | Manual: restart app, verify terminal content restored | N/A - requires real tmux |
| THEM-02 | System theme detection applies correct theme | unit        | `npx vitest run src/test/themeStore.test.ts -x`       | No - Wave 0              |
| THEM-03 | Color scheme presets have correct values     | unit        | `npx vitest run src/test/terminalSchemes.test.ts -x`  | No - Wave 0              |
| THEM-04 | Rounded corners on macOS                     | manual-only | Manual: verify border-radius renders on macOS         | N/A - visual             |
| CANV-04 | Grid snap with magnetic threshold            | unit        | `npx vitest run src/test/gridSnap.test.ts -x`         | No - Wave 0              |

### Sampling Rate

- **Per task commit:** `npm run test`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/test/fileTree.test.ts` -- covers SIDE-01, SIDE-02
- [ ] `src/test/projectStore.test.ts` -- covers SIDE-03, SIDE-04
- [ ] `src/test/fileOps.test.ts` -- covers SIDE-05 (mock IPC)
- [ ] `src/test/fuzzyMatch.test.ts` -- covers SIDE-06
- [ ] `src/test/dragToCanvas.test.ts` -- covers SIDE-07
- [ ] `src/test/terminalList.test.ts` -- covers SIDE-08, SIDE-09
- [ ] `src/test/themeStore.test.ts` -- covers THEM-02
- [ ] `src/test/terminalSchemes.test.ts` -- covers THEM-03
- [ ] `src/test/gridSnap.test.ts` -- covers CANV-04

## Sources

### Primary (HIGH confidence)

- [React Flow SnapGrid API](https://reactflow.dev/api-reference/types/snap-grid) -- grid snapping props and type
- [React Flow Component API](https://reactflow.dev/api-reference/react-flow) -- snapToGrid, onNodeDrag props
- [Tauri v2 File System Plugin](https://v2.tauri.app/plugin/file-system/) -- readDir, watch, watchImmediate API
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- transparent windows, rounded corners
- [Tauri v2 Shell Plugin](https://v2.tauri.app/plugin/shell/) -- execute/spawn commands
- [xterm.js ITheme Interface](https://xtermjs.org/docs/api/terminal/interfaces/itheme/) -- all terminal color properties
- [Dracula Theme Spec](https://draculatheme.com/spec) -- official Dracula hex color values
- [MDN prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) -- system theme detection

### Secondary (MEDIUM confidence)

- [tmux man page](https://man7.org/linux/man-pages/man1/tmux.1.html) -- tmux CLI commands for programmatic control
- [tmux Advanced Use Wiki](https://github.com/tmux/tmux/wiki/Advanced-Use) -- control mode, programmatic usage
- [atom-one-dark-terminal](https://github.com/nathanbuchar/atom-one-dark-terminal) -- One Dark ANSI color reference
- [Detect System Theme Preference Change](https://davidwalsh.name/detect-system-theme-preference-change-using-javascript) -- matchMedia listener pattern
- [tmux_interface Rust crate](https://docs.rs/tmux_interface/latest/tmux_interface/) -- alternative to raw Command, but raw Command is simpler for our 5 operations

### Tertiary (LOW confidence)

- [Tauri macOS transparent window DMG build issue](https://github.com/tauri-apps/tauri/issues/13415) -- transparency may need `macOSPrivateApi: true` for production builds

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - all libraries already in use or well-documented Tauri plugins
- Architecture: HIGH - patterns follow established codebase conventions (Zustand stores, Tauri commands, Rust modules)
- File tree: HIGH - straightforward recursive component with lazy loading
- Tmux integration: MEDIUM - CLI interaction is well-documented, but attach-via-PTY pattern needs validation
- Grid snapping: HIGH - React Flow props are documented, magnetic behavior is simple math
- Terminal color schemes: HIGH - xterm.js ITheme is stable API, color values from official specs
- Rounded corners: MEDIUM - transparent window has known macOS shadow issue, CSS workaround needed
- Pitfalls: HIGH - common issues well-documented in GitHub issues and community discussions

**Research date:** 2026-03-18
**Valid until:** 2026-04-17 (30 days -- stable technologies)
