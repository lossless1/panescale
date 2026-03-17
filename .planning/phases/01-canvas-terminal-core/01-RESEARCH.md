# Phase 1: Canvas + Terminal Core - Research

**Researched:** 2026-03-17
**Domain:** Tauri v2 desktop app with infinite canvas (React Flow), terminal emulation (xterm.js), PTY management (portable-pty), and layout persistence
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire application foundation: a Tauri v2 + React + TypeScript shell with an infinite pan/zoom canvas powered by `@xyflow/react` v12, terminal tiles embedding xterm.js, Rust PTY management via portable-pty, two-mode focus management, dark/light theming with CSS variables, a custom title bar, canvas layout persistence to JSON files with atomic writes, and the sidebar layout shell (content deferred to Phase 2). This is a greenfield project -- no existing code.

The three highest-risk areas are: (1) terminal data streaming via Tauri's Channel API (NOT the event system) to avoid IPC throughput bottlenecks; (2) the two-mode focus system separating canvas mode from terminal typing mode to prevent event conflicts; and (3) atomic state persistence with debounced saves to prevent data loss on crash. All three must be designed correctly from the start -- retrofitting is painful.

**Primary recommendation:** Use `@xyflow/react` v12 for the canvas (built-in pan/zoom/drag/resize/background), `@xterm/xterm` v5.5.0 (NOT v6 -- see compatibility section), custom portable-pty Tauri commands with Channel streaming (NOT tauri-plugin-pty), Zustand v5 for frontend state, and CSS custom properties for theming.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Zoom range: 10% to 200% (wider than Collaborator's 33-100%)
- Dot grid background with minor + major dots (Excalidraw/Collaborator style)
- Pan via trackpad two-finger scroll (primary method), Space+drag, and middle-click+drag all supported
- Cmd+0 fits all tiles in view (zoom-to-fit)
- Rubber-band effect at zoom limits
- Default spawn size: 80x24 characters (classic terminal standard)
- Rich title bar: close button, minimize/collapse, working directory path, shell type indicator
- Minimum size enforced (~40x10 characters) -- prevent unusably small terminals
- Live resize: terminal cols/rows re-flow as user drags resize handles in real-time
- 8 resize handles (4 edges, 4 corners) per Collaborator reference
- Click terminal tile to enter typing mode, click empty canvas to exit back to canvas mode
- Escape key exits terminal focus and returns to canvas mode (single press)
- Scroll over terminal = scroll terminal output; Shift+scroll = pan canvas
- App shortcuts (Cmd+K, Cmd+=, Cmd+-, etc.) always override terminal -- terminal gets everything else
- Visual indicator: focused terminal gets visible border glow/highlight
- VS Code-like structured UI: activity bar concept, status bar, panel structure -- developer-familiar
- Deep dark theme default (#1a1a2e range) -- high contrast, good for terminal readability
- Light theme also available from launch
- Custom title bar on all platforms (not native) -- full theme control, consistent cross-platform appearance
- Left sidebar, resizable via drag edge (sidebar content comes in Phase 2, but layout established now)

### Claude's Discretion
- Exact grid dot spacing and sizing
- Zoom animation easing curves
- Terminal spawn animation (if any)
- Exact color palette within the deep dark range
- Sidebar minimum/maximum width
- Status bar content and layout

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CANV-01 | Pan via scroll wheel, Space+drag, middle-click+drag | React Flow `panOnScroll`, `panOnDrag` props + custom keyboard handler for Space+drag |
| CANV-02 | Zoom via Cmd+/-, Ctrl+scroll, pinch-to-zoom | React Flow `minZoom`/`maxZoom` props (0.1 to 2.0), `zoomOnScroll`, `zoomOnPinch` |
| CANV-03 | Dot grid background with minor/major dots | React Flow `<Background>` component with layered dots variant (two `<Background>` with different gap/size) |
| TERM-01 | Double-click empty canvas spawns terminal at position | React Flow `onPaneClick`/double-click handler + `screenToFlowPosition` coordinate conversion |
| TERM-02 | Terminal opens in active project working directory | Pass `cwd` to portable-pty `CommandBuilder::new()` |
| TERM-03 | Drag terminal tiles by title bar | React Flow built-in node dragging + `dragHandle` selector targeting title bar |
| TERM-04 | Resize with 8 handles (4 edges, 4 corners) | React Flow `<NodeResizer>` provides all 8 handles out of the box |
| TERM-05 | Select text and copy/paste | xterm.js built-in selection + Cmd+C/V handling |
| TERM-07 | Click brings to front (z-index) | Zustand z-index counter, update on node click via `onNodeClick` |
| TERM-08 | Close via title bar | Kill PTY command + remove node from React Flow state |
| TERM-14 | Configurable terminal font, size, color scheme | xterm.js `ITerminalOptions` (fontFamily, fontSize, theme) + CSS variable sync |
| TERM-15 | Support user's default shell (bash, zsh, fish, PowerShell) | Detect shell via `$SHELL` env (Unix) / registry (Windows) in Rust |
| PERS-01 | Canvas layout persists to disk and restores | Zustand + JSON file in app data dir, atomic write (temp file + rename) |
| PERS-03 | Auto-save with 500ms debounce + immediate on create/close | Zustand `subscribe` + debounce utility + forced flush on tile create/close |
| PLAT-01 | Runs on macOS, Linux, Windows | Tauri v2 cross-platform + portable-pty (Unix PTY + ConPTY) |
| PLAT-02 | Platform-appropriate keyboard shortcuts | Detect platform via Tauri API, map Cmd (macOS) to Ctrl (Win/Linux) |
| PLAT-03 | Native window chrome per platform | Custom title bar with `decorations: false` in tauri.conf.json + `data-tauri-drag-region` |
| THEM-01 | Switch between dark and light themes | CSS custom properties on `:root`, Zustand theme store, sync to xterm.js theme object |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tauri | ^2.9 | Desktop shell + Rust backend | Project requirement. Cross-platform, small bundle, Rust backend for PTY/git/SSH |
| React | ^19 | Frontend UI | Project requirement. React Flow and xterm.js both integrate naturally |
| TypeScript | ^5.7 | Type safety | Catches IPC contract mismatches at compile time |
| Vite | ^6 | Build + HMR | Official Tauri recommendation, fast HMR |
| @xyflow/react | ^12.10 | Infinite canvas | MIT licensed. Built-in pan/zoom/drag/resize/background/minimap. Custom nodes = any React component. 30k+ GitHub stars |
| @xterm/xterm | 5.5.0 | Terminal rendering | Industry standard (VS Code uses it). Pin to v5.5.0 -- see xterm v5 vs v6 section |
| @xterm/addon-fit | ^0.10 | Auto-resize terminal to container | Essential for responsive terminal nodes |
| @xterm/addon-webgl | ^0.18 | GPU-accelerated rendering | Up to 900% faster than DOM renderer. Required for smooth multi-terminal performance |
| portable-pty | ^0.9.0 | Cross-platform PTY | From WezTerm project. Unix PTY + Windows ConPTY. Battle-tested |
| Zustand | ^5 | Frontend state management | Lightweight, no boilerplate, persist middleware, TypeScript-first |
| Tailwind CSS | ^4 | Utility-first CSS | Fast UI development, CSS-first config in v4, dark mode support |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/api | ^2 | Tauri IPC from frontend | All Rust backend communication, Channel API |
| @tauri-apps/plugin-fs | ^2 | File system access | State persistence, project directory operations |
| @tauri-apps/plugin-store | ^2 | Key-value settings | Simple preferences (theme, window size) |
| serde / serde_json | ^1 | Rust serialization | All IPC data structures |
| tokio | ^1 | Async runtime (Rust) | PTY management, async commands |
| anyhow | ^1 | Error handling (Rust) | Simplify error propagation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @xterm/xterm 5.5.0 | @xterm/xterm 6.0.0 | v6 removed canvas addon, changed scrollbar internals. tauri-plugin-pty examples use v5 API. v5 is safer for Phase 1 |
| Custom portable-pty commands | tauri-plugin-pty 0.1.1 | Plugin is v0.1, early-stage, no Channel API support (uses callbacks). Custom commands give full control over streaming via Channel |
| Zustand | Redux Toolkit | Zustand is simpler, less boilerplate, sufficient for this use case |
| CSS custom properties | styled-components | CSS vars work across xterm.js theme + Tailwind. No JS runtime overhead |

**Installation:**

```bash
# Frontend
npm install @xyflow/react @xterm/xterm@5.5.0 @xterm/addon-fit @xterm/addon-webgl
npm install zustand tailwindcss @tailwindcss/vite
npm install @tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-store

# Dev
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

```toml
# Cargo.toml (src-tauri/)
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
portable-pty = "0.9"
tauri-plugin-fs = "2"
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
uuid = { version = "1", features = ["v4"] }
```

## Critical Decision: xterm.js v5 vs v6

**Recommendation: Pin to `@xterm/xterm@5.5.0` for Phase 1.**

| Aspect | v5.5.0 | v6.0.0 |
|--------|--------|--------|
| Release date | April 2024 | December 2024 |
| DOM renderer | Built-in default | Built-in default |
| Canvas addon | Available (`@xterm/addon-canvas`) | **Removed/deprecated** |
| WebGL addon | Available (`@xterm/addon-webgl`) | Available |
| `onData` API | Works | Works (unchanged) |
| `write` API | Works | Works (unchanged) |
| Scrollbar | Classic | **Redesigned** (breaking change -- VS Code internals adopted) |
| tauri-plugin-pty compat | Tested in examples | **Untested** |
| Risk level | LOW | MEDIUM-HIGH |

**Rationale:** v6 has breaking scrollbar changes and removed the canvas addon fallback. The core `onData`/`write` API is the same, but the internal changes create risk. Pin to v5.5.0 for stability in Phase 1. Upgrade to v6 can happen in a later phase after validation.

**Confidence:** MEDIUM -- The onData/write APIs are confirmed stable across versions. The risk is in rendering addon changes and scrollbar behavior.

## Critical Decision: Custom PTY Commands vs tauri-plugin-pty

**Recommendation: Write custom Tauri commands wrapping portable-pty directly. Do NOT use tauri-plugin-pty.**

**Why:**
1. `tauri-plugin-pty` is v0.1.1 -- early stage, "Developing! Welcome to contribute!" per its README
2. The plugin uses a callback-based API (`pty.onData()`), NOT Tauri's Channel API
3. Tauri's event system is "not designed for low latency or high throughput" (Tauri docs). Terminal output is exactly a high-throughput scenario
4. Custom commands + `tauri::ipc::Channel<T>` give ordered, fast, typed streaming -- purpose-built for this
5. Full control over PTY lifecycle, environment variables, resize, and cleanup

**Architecture:**

```rust
use tauri::ipc::Channel;
use portable_pty::{native_pty_system, PtySize, CommandBuilder};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum PtyEvent {
    Data { bytes: Vec<u8> },
    Exit { code: Option<u32> },
}

#[tauri::command]
async fn pty_spawn(
    cwd: String,
    cols: u16,
    rows: u16,
    on_event: Channel<PtyEvent>,
    state: tauri::State<'_, PtyManager>,
) -> Result<String, String> {
    // 1. Create PTY pair via portable-pty
    // 2. Spawn shell with TERM=xterm-256color
    // 3. Start reader thread that sends data via on_event.send()
    // 4. Return pty_id
}

#[tauri::command]
async fn pty_write(pty_id: String, data: Vec<u8>, state: tauri::State<'_, PtyManager>) -> Result<(), String> {
    // Write bytes to PTY master
}

#[tauri::command]
async fn pty_resize(pty_id: String, cols: u16, rows: u16, state: tauri::State<'_, PtyManager>) -> Result<(), String> {
    // Resize PTY
}

#[tauri::command]
async fn pty_kill(pty_id: String, state: tauri::State<'_, PtyManager>) -> Result<(), String> {
    // Kill child process, close PTY, clean up
}
```

**Frontend usage:**

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const onEvent = new Channel<PtyEvent>();
onEvent.onmessage = (message) => {
  if (message.event === 'data') {
    xtermRef.current?.write(new Uint8Array(message.data.bytes));
  } else if (message.event === 'exit') {
    // Handle terminal exit
  }
};

const ptyId = await invoke('pty_spawn', {
  cwd: '/path/to/project',
  cols: 80,
  rows: 24,
  onEvent,
});
```

**Confidence:** HIGH -- Tauri Channel API is documented, purpose-built for streaming. portable-pty is battle-tested (powers WezTerm).

## Architecture Patterns

### Recommended Project Structure

```
excalicode/
  src/                          # React frontend
    App.tsx                     # Root component, theme provider, router
    main.tsx                    # Entry point
    components/
      canvas/
        Canvas.tsx              # ReactFlow wrapper with config
        CanvasBackground.tsx    # Layered dot grid
        TerminalNode.tsx        # Custom node: xterm.js terminal
        TerminalTitleBar.tsx    # Title bar with controls
      layout/
        AppShell.tsx            # Custom title bar + sidebar + canvas layout
        TitleBar.tsx            # Custom window title bar
        Sidebar.tsx             # Resizable sidebar shell (empty in Phase 1)
        StatusBar.tsx           # Bottom status bar
      theme/
        ThemeProvider.tsx       # CSS variable injection
        ThemeToggle.tsx         # Dark/light switch
    hooks/
      usePty.ts                # PTY lifecycle hook (spawn, write, resize, kill)
      useCanvasState.ts        # Canvas state + persistence hook
      useFocusMode.ts          # Two-mode focus management
      useKeyboardShortcuts.ts  # App-level shortcut handler
    stores/
      canvasStore.ts           # Zustand: nodes, edges, viewport
      themeStore.ts            # Zustand: theme preference
      settingsStore.ts         # Zustand: app settings
    lib/
      ipc.ts                   # Typed Tauri command wrappers
      platform.ts              # Platform detection utilities
      persistence.ts           # Debounced save logic
    styles/
      themes.ts                # Dark/light theme variable definitions
      globals.css              # Tailwind imports, CSS variable declarations
  src-tauri/                   # Rust backend
    src/
      main.rs                  # Tauri setup, register commands + state
      pty/
        mod.rs                 # PtyManager struct, commands
        manager.rs             # HashMap<PtyId, PtySession>, lifecycle
      state/
        mod.rs                 # State persistence commands
        persistence.rs         # Atomic JSON file writes
      platform/
        mod.rs                 # SessionBackend trait
        unix.rs                # Unix PTY specifics
        windows.rs             # ConPTY specifics
    Cargo.toml
    tauri.conf.json
```

### Pattern 1: React Flow Custom Terminal Node

**What:** Each terminal tile is a React Flow custom node containing an xterm.js instance
**When to use:** Every terminal on the canvas

```typescript
// Source: React Flow custom nodes docs + xterm.js integration
import { memo, useRef, useEffect } from 'react';
import { NodeResizer, type NodeProps } from '@xyflow/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

type TerminalNodeData = {
  ptyId: string;
  cwd: string;
  isFocused: boolean;
};

const TerminalNode = memo(({ data, selected }: NodeProps<TerminalNodeData>) => {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!termRef.current) return;
    const term = new Terminal({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      theme: { /* from CSS variables */ },
      cursorBlink: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    return () => term.dispose();
  }, []);

  return (
    <>
      <NodeResizer
        minWidth={320}   // ~40 cols
        minHeight={200}  // ~10 rows
        isVisible={selected}
        onResize={() => fitAddonRef.current?.fit()}
      />
      <div className="terminal-tile" data-focused={data.isFocused}>
        {/* Title bar is the drag handle */}
        <div className="terminal-title-bar drag-handle">
          <span>{data.cwd}</span>
          <button onClick={() => { /* close */ }}>x</button>
        </div>
        {/* Terminal container -- nodrag + nowheel to prevent canvas interference */}
        <div
          ref={termRef}
          className="terminal-container nodrag nowheel"
          style={{ width: '100%', height: 'calc(100% - 32px)' }}
        />
      </div>
    </>
  );
});
```

**Key classes:** `nodrag` on the terminal container prevents drag events from bubbling to React Flow. `nowheel` prevents scroll events from zooming the canvas when scrolling terminal output.

### Pattern 2: Two-Mode Focus System

**What:** Strict separation between "canvas mode" (pan/zoom active) and "terminal mode" (typing active)
**When to use:** From day one -- this is the core UX paradigm

```typescript
// Source: Collaborator bug #13 prevention pattern
type FocusMode = 'canvas' | 'terminal';

interface FocusState {
  mode: FocusMode;
  activeTerminalId: string | null;
  enterTerminalMode: (terminalId: string) => void;
  exitToCanvasMode: () => void;
}

const useFocusStore = create<FocusState>((set) => ({
  mode: 'canvas',
  activeTerminalId: null,
  enterTerminalMode: (terminalId) => set({
    mode: 'terminal',
    activeTerminalId: terminalId,
  }),
  exitToCanvasMode: () => set({
    mode: 'canvas',
    activeTerminalId: null,
  }),
}));

// In TerminalNode: click handler
const handleTerminalClick = () => {
  focusStore.enterTerminalMode(data.ptyId);
  xtermRef.current?.focus();
};

// Global keyboard handler
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && focusStore.mode === 'terminal') {
      focusStore.exitToCanvasMode();
      xtermRef.current?.blur();
    }
    // App shortcuts always win
    if ((e.metaKey || e.ctrlKey) && ['k', '=', '-', '0'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      handleAppShortcut(e);
    }
  };
  window.addEventListener('keydown', handler, true); // capture phase
  return () => window.removeEventListener('keydown', handler, true);
}, []);
```

### Pattern 3: Debounced Atomic State Persistence

**What:** Canvas state saved to JSON with debounce + atomic writes
**When to use:** Every state change triggers debounced save; create/close forces immediate save

```typescript
// Frontend: debounced save via Zustand subscribe
const DEBOUNCE_MS = 500;
let saveTimeout: ReturnType<typeof setTimeout>;

canvasStore.subscribe((state) => {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    invoke('state_save', { canvas: serializeCanvas(state) });
  }, DEBOUNCE_MS);
});

// Force immediate save on create/close
function createTerminalTile(position: { x: number; y: number }) {
  const newNode = { /* ... */ };
  canvasStore.getState().addNode(newNode);
  invoke('state_save', { canvas: serializeCanvas(canvasStore.getState()) }); // immediate
}
```

```rust
// Backend: atomic write
use std::fs;
use std::path::PathBuf;

pub fn save_atomic(path: &PathBuf, data: &str) -> Result<()> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, data)?;
    fs::rename(&tmp, path)?; // atomic on most filesystems
    Ok(())
}
```

### Pattern 4: React Flow Canvas Configuration

**What:** Configuring React Flow for the specific UX requirements (zoom range, pan modes, dot grid)
**When to use:** Canvas setup

```typescript
import { ReactFlow, Background, BackgroundVariant, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodeTypes = { terminal: TerminalNode };

function Canvas() {
  const { nodes, edges, onNodesChange } = useCanvasState();

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}  // No edges needed for terminal tiles
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      // Zoom: 10% to 200%
      minZoom={0.1}
      maxZoom={2.0}
      // Pan: scroll = pan (Figma style)
      panOnScroll={true}
      panOnDrag={true}  // Also allow drag on empty space
      zoomOnScroll={false}  // Scroll = pan, NOT zoom
      zoomOnPinch={true}
      // Zoom via Cmd+scroll (handled separately) and pinch
      selectionOnDrag={false}
      // Double-click to spawn terminal
      onPaneClick={handlePaneClick}
      fitView
      // Drag only by title bar
      // (configured per-node via dragHandle prop)
    >
      {/* Minor dots: small, frequent */}
      <Background
        id="minor-dots"
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--grid-minor)"
      />
      {/* Major dots: larger, less frequent */}
      <Background
        id="major-dots"
        variant={BackgroundVariant.Dots}
        gap={100}
        size={2}
        color="var(--grid-major)"
      />
    </ReactFlow>
  );
}
```

### Pattern 5: Custom Title Bar

**What:** Custom window title bar for consistent cross-platform appearance
**When to use:** App shell, replaces native decorations

```json
// tauri.conf.json
{
  "app": {
    "windows": [
      {
        "title": "Excalicode",
        "decorations": false,
        "width": 1400,
        "height": 900,
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  }
}
```

```tsx
function TitleBar() {
  return (
    <div className="h-8 flex items-center bg-[var(--bg-titlebar)] select-none"
         data-tauri-drag-region>
      <div className="flex gap-1 ml-2">
        {/* macOS-style traffic lights or cross-platform buttons */}
        <WindowControls />
      </div>
      <span className="flex-1 text-center text-sm text-[var(--text-secondary)]"
            data-tauri-drag-region>
        Excalicode
      </span>
    </div>
  );
}
```

**Known issue:** Setting `decorations: false` in Tauri v2 can interfere with window resizing on some platforms. Test this early. If resize breaks, consider `decorations: true` with a transparent/minimal native bar and overlay the custom bar.

### Anti-Patterns to Avoid

- **Using Tauri events for PTY data:** Events are fire-and-forget, unordered, not designed for throughput. Use `Channel<T>` instead.
- **Single Mutex for all backend state:** PTY manager, state store, and future git engine each need their own lock. A single `AppState` mutex causes git status to block terminal spawn.
- **Re-rendering entire canvas on tile move:** Use `React.memo` on all node components. Only the moved tile should re-render. Canvas transform is a CSS change on the wrapper.
- **Hardcoding tmux commands:** Phase 1 should use direct PTY (no tmux yet). When tmux is added later, it must be behind a `SessionBackend` trait so Windows works without it.
- **Mounting xterm.js before the container is sized:** The FitAddon needs a sized container. Use `useEffect` after mount and call `fitAddon.fit()` after the terminal is opened.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Infinite canvas pan/zoom | Custom CSS transform math | `@xyflow/react` | Handles viewport math, hit testing, virtualization, accessibility |
| Node resize handles | Custom drag handlers on 8 points | `<NodeResizer>` component | Provides all 8 handles, min/max constraints, resize callbacks |
| Dot grid background | Custom SVG/CSS pattern with viewport sync | `<Background variant="Dots">` | Automatically follows viewport transforms |
| Terminal rendering | Custom character grid renderer | xterm.js | Handles VT100/ANSI, Unicode, ligatures, selection, scrollback |
| PTY management | Raw `libc::forkpty` calls | portable-pty | Cross-platform (Unix PTY + Windows ConPTY), tested by WezTerm |
| Terminal auto-fit | Manual cols/rows calculation | `@xterm/addon-fit` | Handles font metrics, DPR, container measurement |
| Debounced writes | Custom timer logic | Lodash `debounce` or simple utility | Edge cases with leading/trailing, cancellation |

**Key insight:** React Flow provides ~80% of the canvas UX out of the box. The custom work is in: terminal node embedding, focus management, PTY wiring, and persistence.

## Common Pitfalls

### Pitfall 1: IPC Throughput Bottleneck (Terminal Data)
**What goes wrong:** Terminal output (megabytes/sec during builds) saturates the IPC bridge, causing lag across all terminals.
**Why it happens:** Using Tauri's event system instead of Channel API. Events are "not designed for low latency or high throughput" (Tauri docs).
**How to avoid:** Use `tauri::ipc::Channel<PtyEvent>` for all PTY output. Batch PTY reads on the Rust side (e.g., every 16ms or 4KB, whichever first). Implement xterm.js flow control.
**Warning signs:** Frame rate drops below 30fps with 5+ terminals running `yes`.

### Pitfall 2: Canvas/Terminal Event Conflicts
**What goes wrong:** Scrolling inside a terminal pans the canvas. Clicking terminal starts a canvas drag. Keyboard shortcuts get swallowed.
**Why it happens:** Both canvas and xterm.js need mouse/keyboard events on the same DOM.
**How to avoid:** Two-mode focus system from day one. Use `nodrag` and `nowheel` CSS classes on terminal containers. `stopPropagation()` on terminal mouse/key events when focused. Escape returns to canvas mode.
**Warning signs:** Can't type in terminal after panning, or can't pan after typing.

### Pitfall 3: State Persistence Race Conditions
**What goes wrong:** Close terminal + debounced save races = corrupted state. App crash mid-write = empty file on next load.
**Why it happens:** Multiple state changes + async persistence + no atomic writes.
**How to avoid:** Atomic file writes (write to .tmp, rename). Force save on tile create/close. On app quit, force final save from `on_window_event(CloseRequested)`. Single source of truth in Zustand store.
**Warning signs:** Blank canvas after force-quitting the app.

### Pitfall 4: PTY Resource Leaks
**What goes wrong:** After opening/closing many terminals, new ones fail to spawn. File descriptor count grows.
**Why it happens:** PTY file descriptors not properly closed. Child processes not killed/waited.
**How to avoid:** Implement proper Drop/cleanup: close master FD, SIGHUP child, wait for exit. Use dedicated OS threads for PTY I/O (not tokio blocking pool). Set max concurrent terminals (~100).
**Warning signs:** `lsof -p <pid> | wc -l` grows after open/close cycles.

### Pitfall 5: xterm.js Memory with Many Terminals
**What goes wrong:** 50 terminals at 34MB each = 1.7GB just for terminal buffers.
**Why it happens:** xterm.js allocates typed arrays for full scrollback upfront.
**How to avoid:** Reduce default scrollback to 1000 lines. Plan for virtualization in Phase 2 (unmount off-screen xterm instances). Use WebGL addon for GPU-accelerated rendering.
**Warning signs:** Memory exceeds 2GB with 20+ terminals.

### Pitfall 6: Custom Title Bar Resize Bug
**What goes wrong:** Window cannot be resized when `decorations: false` on some platforms.
**Why it happens:** Known Tauri v2 bug (issue #8519). Without native decorations, the resize hit zone may not work.
**How to avoid:** Test early on all platforms. Fallback: add CSS border with resize hit zones, or use `decorations: true` with minimal native bar.
**Warning signs:** Can't resize window by dragging edges on Windows/Linux.

## Code Examples

### Zustand Canvas Store with Persistence

```typescript
// Source: Zustand v5 docs + React Flow integration
import { create } from 'zustand';
import { type Node, type Viewport, applyNodeChanges, type NodeChange } from '@xyflow/react';
import { invoke } from '@tauri-apps/api/core';

interface CanvasState {
  nodes: Node[];
  viewport: Viewport;
  maxZIndex: number;
  onNodesChange: (changes: NodeChange[]) => void;
  addTerminalNode: (position: { x: number; y: number }, ptyId: string, cwd: string) => void;
  removeNode: (id: string) => void;
  bringToFront: (id: string) => void;
  setViewport: (viewport: Viewport) => void;
  loadFromDisk: () => Promise<void>;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  maxZIndex: 0,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  addTerminalNode: (position, ptyId, cwd) => {
    const newZ = get().maxZIndex + 1;
    const node: Node = {
      id: ptyId,
      type: 'terminal',
      position,
      data: { ptyId, cwd, isFocused: false },
      style: { width: 640, height: 480 }, // ~80x24
      zIndex: newZ,
      dragHandle: '.drag-handle',
    };
    set({ nodes: [...get().nodes, node], maxZIndex: newZ });
    // Immediate save on create
    invoke('state_save', { canvas: serializeState(get()) });
  },

  removeNode: (id) => {
    set({ nodes: get().nodes.filter((n) => n.id !== id) });
    invoke('state_save', { canvas: serializeState(get()) });
  },

  bringToFront: (id) => {
    const newZ = get().maxZIndex + 1;
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, zIndex: newZ } : n
      ),
      maxZIndex: newZ,
    });
  },

  setViewport: (viewport) => set({ viewport }),

  loadFromDisk: async () => {
    const saved = await invoke<SavedCanvas | null>('state_load');
    if (saved) {
      set({ nodes: saved.nodes, viewport: saved.viewport, maxZIndex: saved.maxZIndex });
    }
  },
}));
```

### Rust PtyManager Struct

```rust
// Source: portable-pty docs + Tauri state management
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use portable_pty::{native_pty_system, CommandBuilder, PtySize, MasterPty, Child};
use tauri::ipc::Channel;

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader_handle: Option<thread::JoinHandle<()>>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(
        &self,
        id: String,
        cwd: String,
        cols: u16,
        rows: u16,
        channel: Channel<PtyEvent>,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e| e.to_string())?;

        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&cwd);
        cmd.env("TERM", "xterm-256color");

        let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
        drop(pair.slave); // Close slave after spawn

        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
        let id_clone = id.clone();
        let reader_handle = thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                    Ok(n) => {
                        let _ = channel.send(PtyEvent::Data {
                            bytes: buf[..n].to_vec(),
                        });
                    }
                    Err(_) => {
                        let _ = channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            master: pair.master,
            child,
            reader_handle: Some(reader_handle),
        };
        self.sessions.lock().unwrap().insert(id, session);
        Ok(())
    }
}
```

### Theme System with CSS Variables

```typescript
// Source: CSS custom properties pattern
export const themes = {
  dark: {
    '--bg-primary': '#1a1a2e',
    '--bg-secondary': '#16213e',
    '--bg-titlebar': '#0f0f23',
    '--bg-sidebar': '#12122a',
    '--bg-terminal': '#0d0d1a',
    '--text-primary': '#e0e0e0',
    '--text-secondary': '#8888aa',
    '--border': '#2a2a4a',
    '--accent': '#6366f1',
    '--focus-glow': 'rgba(99, 102, 241, 0.4)',
    '--grid-minor': '#1f1f3a',
    '--grid-major': '#2a2a4a',
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f5f5f7',
    '--bg-titlebar': '#e8e8ec',
    '--bg-sidebar': '#f0f0f4',
    '--bg-terminal': '#1e1e2e', // Terminal stays dark even in light theme
    '--text-primary': '#1a1a2e',
    '--text-secondary': '#666688',
    '--border': '#d0d0e0',
    '--accent': '#4f46e5',
    '--focus-glow': 'rgba(79, 70, 229, 0.3)',
    '--grid-minor': '#e8e8ec',
    '--grid-major': '#d0d0e0',
  },
} as const;

// xterm.js theme synced from CSS variables
function getXtermTheme(): ITheme {
  const style = getComputedStyle(document.documentElement);
  return {
    background: style.getPropertyValue('--bg-terminal').trim(),
    foreground: style.getPropertyValue('--text-primary').trim(),
    cursor: style.getPropertyValue('--accent').trim(),
    // ... standard terminal colors
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri events for streaming | `tauri::ipc::Channel<T>` | Tauri v2 (Oct 2024) | 10x+ throughput for terminal data |
| xterm.js canvas addon (default) | WebGL addon (recommended) or DOM (default) | xterm v5+ / v6 | WebGL is 900% faster than canvas renderer |
| Single `AppState` Mutex | Per-domain state managers | Architecture pattern | Prevents cross-domain locking |
| `reactflow` package | `@xyflow/react` package | v12 (2024) | Renamed, scoped packages, server-side rendering |
| JSON event payloads for binary | Raw byte payloads via Channel | Tauri v2 | Eliminates base64 overhead for terminal data |

**Deprecated/outdated:**
- `tauri::event::emit()` for high-throughput data (use Channel instead)
- `xterm-addon-canvas` (deprecated in v6, WebGL or DOM renderer instead)
- `reactflow` npm package (renamed to `@xyflow/react`)
- `xterm` npm package (renamed to `@xterm/xterm`)

## Open Questions

1. **xterm.js WebGL addon + Tauri WebView compatibility**
   - What we know: WebGL addon exists for v5 and v6. Provides 900% speedup.
   - What's unclear: WebKitGTK (Linux) WebGL2 support varies by distro version. Multiple WebGL contexts may hit browser limits (8-16 typically).
   - Recommendation: Use WebGL addon as primary, implement fallback to DOM renderer. Test on Linux early. Limit to DOM renderer for >16 simultaneous visible terminals.

2. **Rubber-band effect at zoom limits**
   - What we know: User requested rubber-band effect. React Flow has `minZoom`/`maxZoom` but no built-in elastic overshoot.
   - What's unclear: How to implement elastic zoom beyond limits in React Flow.
   - Recommendation: Custom zoom handler that allows temporary overshoot and animates back to limit. Use `useOnViewportChange` hook to detect + correct.

3. **Terminal spawn position from double-click**
   - What we know: React Flow provides `screenToFlowPosition()` for coordinate conversion.
   - What's unclear: Whether `onPaneClick` fires on double-click or only single-click.
   - Recommendation: Use `onDoubleClick` on the ReactFlow component's parent div, or check React Flow's `onPaneClick` event for double-click detection via timestamp comparison.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + `cargo test` (Rust backend) |
| Config file | None -- needs Wave 0 setup |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CANV-01 | Pan via scroll, Space+drag, middle-click | integration | Manual (webview interaction) | -- Wave 0 |
| CANV-02 | Zoom via Cmd+/-, Ctrl+scroll, pinch | integration | Manual (webview interaction) | -- Wave 0 |
| CANV-03 | Dot grid background renders | unit | `npx vitest run src/__tests__/canvas.test.tsx` | -- Wave 0 |
| TERM-01 | Double-click spawns terminal | integration | Manual (needs PTY + webview) | -- Wave 0 |
| TERM-02 | Terminal opens in project CWD | unit (Rust) | `cargo test pty::tests::spawn_with_cwd` | -- Wave 0 |
| TERM-03 | Drag terminal by title bar | integration | Manual (webview interaction) | -- Wave 0 |
| TERM-04 | 8 resize handles work | unit | `npx vitest run src/__tests__/terminal-node.test.tsx` | -- Wave 0 |
| TERM-05 | Copy/paste in terminal | integration | Manual (needs running terminal) | -- Wave 0 |
| TERM-07 | Click brings to front | unit | `npx vitest run src/__tests__/canvas-store.test.ts` | -- Wave 0 |
| TERM-08 | Close via title bar kills PTY | unit (Rust) | `cargo test pty::tests::kill_session` | -- Wave 0 |
| TERM-14 | Configurable font/size/scheme | unit | `npx vitest run src/__tests__/theme.test.ts` | -- Wave 0 |
| TERM-15 | Detects user's default shell | unit (Rust) | `cargo test pty::tests::detect_shell` | -- Wave 0 |
| PERS-01 | Layout persists + restores | unit (Rust) | `cargo test state::tests::save_and_load` | -- Wave 0 |
| PERS-03 | Debounced auto-save | unit | `npx vitest run src/__tests__/persistence.test.ts` | -- Wave 0 |
| PLAT-01 | Cross-platform builds | smoke | CI: `cargo tauri build` on macOS/Linux/Windows | -- Wave 0 |
| PLAT-02 | Platform-appropriate shortcuts | unit | `npx vitest run src/__tests__/shortcuts.test.ts` | -- Wave 0 |
| PLAT-03 | Custom title bar works | integration | Manual (visual check per platform) | -- Wave 0 |
| THEM-01 | Dark/light theme switch | unit | `npx vitest run src/__tests__/theme.test.ts` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (frontend) + `cargo test` (backend)
- **Per wave merge:** Full suite: `npx vitest run && cd src-tauri && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration for React + TypeScript
- [ ] `src/__tests__/canvas-store.test.ts` -- Zustand store unit tests (add/remove/z-index)
- [ ] `src/__tests__/persistence.test.ts` -- Debounce + serialization tests
- [ ] `src/__tests__/theme.test.ts` -- Theme variable application tests
- [ ] `src/__tests__/shortcuts.test.ts` -- Platform shortcut mapping tests
- [ ] `src-tauri/src/pty/tests.rs` -- PTY spawn, write, resize, kill, shell detection
- [ ] `src-tauri/src/state/tests.rs` -- Atomic save/load, corruption recovery
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

## Sources

### Primary (HIGH confidence)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes) -- custom node pattern, `nodrag` class
- [React Flow NodeResizer API](https://reactflow.dev/api-reference/components/node-resizer) -- 8 resize handles, min/max constraints
- [React Flow Background API](https://reactflow.dev/api-reference/components/background) -- dot variant, layered backgrounds
- [React Flow Viewport/Pan/Zoom](https://reactflow.dev/learn/concepts/the-viewport) -- panOnScroll, minZoom, maxZoom, fitView
- [React Flow ReactFlow Component Props](https://reactflow.dev/api-reference/react-flow) -- all interaction props
- [Tauri v2 Calling Frontend (Channel API)](https://v2.tauri.app/develop/calling-frontend/) -- Channel<T> streaming
- [Tauri v2 IPC Documentation](https://v2.tauri.app/concept/inter-process-communication/) -- events vs channels warning
- [Tauri v2 Window Customization](https://v2.tauri.app/learn/window-customization/) -- custom title bar, decorations: false
- [xterm.js Official Docs](https://xtermjs.org/docs/api/terminal/classes/terminal/) -- Terminal API, onData, write
- [xterm.js GitHub Releases](https://github.com/xtermjs/xterm.js/releases) -- v5.5.0 and v6.0.0 changelogs
- [portable-pty Docs](https://docs.rs/portable-pty) -- PTY spawn, resize, read/write
- [tauri-plugin-pty GitHub](https://github.com/Tnze/tauri-plugin-pty) -- API review, maturity assessment

### Secondary (MEDIUM confidence)
- [Tauri custom titlebar resize bug #8519](https://github.com/tauri-apps/tauri/issues/8519) -- known issue with decorations: false
- [xterm.js canvas addon deprecated in v6](https://github.com/cockpit-project/cockpit/issues/22509) -- confirms canvas removal
- [Zustand v5 persist middleware](https://github.com/pmndrs/zustand) -- persist, TypeScript patterns

### Tertiary (LOW confidence)
- [Tauri IPC binary data feature #7127](https://github.com/tauri-apps/tauri/issues/7127) -- raw binary in Channel (needs testing)
- WebGL context limits per platform (8-16 typically) -- needs per-platform verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- React Flow, xterm.js, portable-pty all verified via official docs
- Architecture: HIGH -- Tauri Channel API, custom nodes, focus system patterns are well-documented
- xterm.js version choice: MEDIUM -- v5 is safer, but v6 migration path is clear
- PTY streaming via Channel: HIGH -- Tauri docs explicitly recommend Channel for streaming
- Custom title bar: MEDIUM -- known Tauri bug may affect resize behavior
- Pitfalls: HIGH -- corroborated by Collaborator project bugs and Tauri/xterm docs

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable ecosystem, 30-day validity)
