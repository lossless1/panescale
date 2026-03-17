---
phase: 01-canvas-terminal-core
plan: 03
subsystem: pty
tags: [portable-pty, tauri-channel, shell-detection, rust, ipc-streaming]

requires:
  - phase: 01-canvas-terminal-core/01
    provides: Tauri v2 project scaffold with Cargo.toml and base app structure
provides:
  - PtyManager with spawn/write/resize/kill for PTY session lifecycle
  - Four Tauri IPC commands (pty_spawn, pty_write, pty_resize, pty_kill)
  - PtyEvent enum for Channel-based output streaming (Data/Exit)
  - Platform shell detection (Unix $SHELL, Windows pwsh/powershell/cmd)
affects: [01-canvas-terminal-core/04, 02-sidebar-session-persistence]

tech-stack:
  added: [portable-pty 0.8, uuid 1.x]
  patterns: [tauri-channel-streaming, blocking-reader-thread, managed-state-singleton]

key-files:
  created:
    - src-tauri/src/pty/manager.rs
    - src-tauri/src/pty/commands.rs
    - src-tauri/src/pty/mod.rs
    - src-tauri/src/platform/shell.rs
    - src-tauri/src/platform/mod.rs
  modified:
    - src-tauri/src/lib.rs

key-decisions:
  - "Use take_writer() instead of try_clone_writer() for portable-pty 0.8 API"
  - "Reader thread uses std::thread::spawn (not tokio) to avoid blocking async runtime"
  - "Drop slave end immediately after spawn for proper EOF detection"

patterns-established:
  - "PTY reader pattern: dedicated OS thread with 4KB buffer loop, Channel<PtyEvent> streaming"
  - "Tauri command pattern: async fn with State<PtyManager>, Result<T, String> return"
  - "Session lifecycle: HashMap<String, PtySession> behind Arc<Mutex<>> for thread safety"

requirements-completed: [TERM-02, TERM-15]

duration: 10min
completed: 2026-03-17
---

# Phase 1 Plan 3: Rust PTY Backend Summary

**PtyManager with portable-pty spawning, Channel-based output streaming, 4 Tauri IPC commands, and cross-platform shell detection**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-17T13:53:43Z
- **Completed:** 2026-03-17T14:04:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- PtyManager struct with spawn/write/resize/kill methods using portable-pty native PTY system
- Four Tauri async commands registered and callable from frontend (pty_spawn, pty_write, pty_resize, pty_kill)
- PtyEvent enum with serde tagged serialization for Channel streaming (Data with bytes, Exit with optional code)
- Platform shell detection: Unix reads $SHELL with path validation, Windows checks pwsh/powershell/cmd cascade
- 6 passing Rust tests covering shell detection, PtyEvent serialization, and PtyManager initialization

## Task Commits

Each task was committed atomically:

1. **Task 1: PtyManager, shell detection, and Rust test stubs** - `9cef163` (feat)
2. **Task 2: Tauri commands and registration** - `b394b05` (feat)

## Files Created/Modified
- `src-tauri/src/pty/manager.rs` - PtyManager with session HashMap, spawn/write/resize/kill, PtyEvent enum
- `src-tauri/src/pty/commands.rs` - Four async Tauri commands wrapping PtyManager methods
- `src-tauri/src/pty/mod.rs` - PTY module exports
- `src-tauri/src/platform/shell.rs` - Cross-platform default shell detection with path validation
- `src-tauri/src/platform/mod.rs` - Platform module exports
- `src-tauri/src/lib.rs` - Added mod declarations, PtyManager state, invoke handler registration

## Decisions Made
- Used `take_writer()` instead of `try_clone_writer()` -- portable-pty 0.8 API uses take semantics for the writer handle
- Reader thread uses `std::thread::spawn` (not tokio::spawn) to avoid starving the async runtime with blocking PTY I/O
- Slave end dropped immediately after spawn_command() for proper EOF detection
- Commands reference `pty::commands::pty_spawn` (full path) in generate_handler! macro since re-exports don't carry proc-macro generated items

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scaffolded missing Tauri project structure**
- **Found during:** Pre-task setup
- **Issue:** Plans 01-01 had been executed but icons and some generated files were untracked; the base project compiled but needed RGBA icons
- **Fix:** Created RGBA placeholder icons for Tauri build system
- **Files modified:** src-tauri/icons/*.png
- **Verification:** `cargo check` succeeds
- **Committed in:** Not separately committed (scaffold infrastructure)

**2. [Rule 1 - Bug] Fixed portable-pty API: take_writer vs try_clone_writer**
- **Found during:** Task 1 (PtyManager implementation)
- **Issue:** Plan specified `try_clone_writer()` but portable-pty 0.8 uses `take_writer()`
- **Fix:** Changed to `pair.master.take_writer()?`
- **Files modified:** src-tauri/src/pty/manager.rs
- **Verification:** `cargo check` compiles cleanly
- **Committed in:** 9cef163 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed generate_handler! macro path resolution**
- **Found during:** Task 2 (Command registration)
- **Issue:** `pty::pty_spawn` re-exports don't carry `__cmd__` proc-macro items needed by generate_handler!
- **Fix:** Used full module path `pty::commands::pty_spawn` in generate_handler! macro
- **Files modified:** src-tauri/src/lib.rs
- **Verification:** `cargo check` compiles cleanly
- **Committed in:** b394b05 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correct compilation. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PTY backend ready for integration with xterm.js terminal tiles (Plan 01-04)
- Frontend can call `invoke('pty_spawn', { cwd, cols, rows, onEvent })` to spawn shells
- Channel streaming pattern established for high-throughput terminal output
- Shell detection works on current platform (macOS/Linux); Windows paths implemented but untested

---
*Phase: 01-canvas-terminal-core*
*Completed: 2026-03-17*
