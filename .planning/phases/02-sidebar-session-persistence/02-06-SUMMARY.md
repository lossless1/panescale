---
phase: 02-sidebar-session-persistence
plan: 06
subsystem: pty
tags: [tmux, session-persistence, auto-install, pty, tauri-commands]

# Dependency graph
requires:
  - phase: 01-canvas-terminal-core
    provides: PtyManager, portable-pty spawn/kill, usePty hook, IPC layer
provides:
  - TmuxBridge for tmux session lifecycle (create/attach/list/kill/capture)
  - PtyManager tmux integration (spawn-in-tmux, reattach, kill-with-cleanup)
  - Tmux auto-install via brew (macOS) or apt/pacman (Linux) with streamed progress
  - Frontend reattach flow for restored terminal nodes
  - Orphan tmux session cleanup on app startup
affects: [terminal-restore, session-management, app-startup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tmux bridge pattern: shell runs inside detached tmux session, PTY attaches to it"
    - "Deterministic session naming: exc-{tile_id} for reliable reconnection"
    - "Module-level availability cache for tmux status"
    - "Streamed progress events via Tauri Channel for long-running operations"

key-files:
  created:
    - src-tauri/src/platform/tmux.rs
  modified:
    - src-tauri/src/platform/mod.rs
    - src-tauri/src/pty/manager.rs
    - src-tauri/src/pty/commands.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts
    - src/hooks/usePty.ts
    - src/App.tsx

key-decisions:
  - "env_remove(TMUX) on all tmux commands to prevent nested session errors"
  - "Reattach verifies session_exists before attempting to attach"
  - "ensureTmuxOnce runs once per session before first fresh spawn, not on reattach"
  - "Install failures log warnings and proceed with non-persistent terminals (graceful degradation)"

patterns-established:
  - "TmuxBridge: stateless struct with static methods wrapping tmux CLI"
  - "Tmux session naming: exc-{tile_id} prefix for deterministic reconnection"
  - "Module-level tmuxAvailableCache in usePty for single-check-per-session"

requirements-completed: [PERS-02]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 2 Plan 6: Tmux Session Persistence Summary

**Tmux-backed terminal persistence with auto-install, reattach on restore, and orphan cleanup**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T08:39:25Z
- **Completed:** 2026-03-18T08:45:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- TmuxBridge handles full tmux lifecycle: create, attach, list, kill, capture, cleanup
- PtyManager spawns shells inside tmux sessions (Unix) with transparent reattach on restore
- Auto-install tmux via brew (macOS) or apt/pacman (Linux) with streamed progress events
- Frontend reattach flow in usePty hook detects restored nodes and reconnects to tmux sessions
- Orphan tmux session cleanup runs on app startup after canvas state loads

## Task Commits

Each task was committed atomically:

1. **Task 1: TmuxBridge + PtyManager tmux integration** - `328be61` (feat)
2. **Task 2: Frontend reattach flow + orphan cleanup** - `fdd2c25` (feat)
3. **Task 3: Auto-install tmux with progress indicator** - `b3ae799` (feat)

## Files Created/Modified
- `src-tauri/src/platform/tmux.rs` - TmuxBridge struct with session lifecycle, auto-install, and unit tests
- `src-tauri/src/platform/mod.rs` - Added tmux module export
- `src-tauri/src/pty/manager.rs` - PtyManager with tmux_available, tmux_sessions map, spawn-in-tmux, reattach, kill-with-cleanup
- `src-tauri/src/pty/commands.rs` - Added pty_reattach, pty_tmux_available, pty_tmux_list_sessions, pty_tmux_cleanup, pty_ensure_tmux commands
- `src-tauri/src/lib.rs` - Registered 5 new Tauri commands in generate_handler
- `src/lib/ipc.ts` - Added ptyReattach, ptyTmuxAvailable, ptyTmuxListSessions, ptyTmuxCleanup, ptyEnsureTmux IPC wrappers
- `src/hooks/usePty.ts` - Added reattach method, tmux availability cache, ensureTmuxOnce before first spawn
- `src/App.tsx` - Added ptyTmuxCleanup call after loadFromDisk for orphan cleanup

## Decisions Made
- env_remove("TMUX") on all tmux commands prevents nested session errors when user is already inside tmux
- Reattach verifies session_exists before attempting attach to avoid confusing error states
- ensureTmuxOnce runs only before first fresh spawn (not on reattach) to avoid blocking restored terminals
- Install failures gracefully degrade to non-persistent terminals (log warning, continue)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Terminal session persistence infrastructure is complete
- Terminals spawn inside tmux when available, reattach on restore
- Orphan cleanup prevents session accumulation
- Auto-install ensures tmux is available on first use

## Self-Check: PASSED

All files verified present. All 3 task commits verified in git log.

---
*Phase: 02-sidebar-session-persistence*
*Completed: 2026-03-18*
