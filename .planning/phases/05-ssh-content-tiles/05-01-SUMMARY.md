---
phase: 05-ssh-content-tiles
plan: 01
subsystem: ssh
tags: [russh, ssh, tauri-commands, zustand, ipc]

# Dependency graph
requires:
  - phase: 01-canvas-terminal-core
    provides: PtyManager pattern, Tauri Channel IPC, ipc.ts wrappers
provides:
  - Rust SSH module with SshManager (connect/write/resize/disconnect)
  - SshConnection/SshGroup config structs with JSON persistence
  - 6 Tauri SSH commands registered in lib.rs
  - Frontend SSH IPC wrappers in ipc.ts
  - sshStore Zustand store with connection/group CRUD
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: [russh 0.58, bytes 1, async-trait 0.1]
  patterns: [channel-split for concurrent SSH read/write, SshManager mirrors PtyManager]

key-files:
  created:
    - src-tauri/src/ssh/mod.rs
    - src-tauri/src/ssh/config.rs
    - src-tauri/src/ssh/manager.rs
    - src-tauri/src/ssh/commands.rs
    - src/stores/sshStore.ts
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts

key-decisions:
  - "Channel split pattern: split russh Channel into read/write halves for concurrent data streaming and resize"
  - "Handle.data() for writing: use session Handle for write operations (takes Bytes), ChannelWriteHalf for resize (window_change)"
  - "TOFU host key policy: accept all server keys (suitable for personal/dev tool)"
  - "10s connection timeout via tokio::time::timeout around russh::client::connect"
  - "sshStore uses zustand persist with localStorage, saves to backend on mutation"

patterns-established:
  - "SSH channel split: split() into ChannelReadHalf (reader task) + ChannelWriteHalf (stored for resize)"
  - "SSH auth cascade: try key auth first, fall back to password if key fails"

requirements-completed: [SSH-01, SSH-02, SSH-03, SSH-04]

# Metrics
duration: 9min
completed: 2026-03-18
---

# Phase 5 Plan 01: SSH Backend Infrastructure Summary

**Rust SSH module with russh 0.58 (channel-split pattern), 6 Tauri commands, typed IPC wrappers, and Zustand sshStore with connection/group CRUD**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-18T15:08:09Z
- **Completed:** 2026-03-18T15:17:23Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Rust SSH module compiles with russh 0.58 and exposes connect/write/resize/disconnect via Tauri commands
- SSH connections can be saved/loaded from JSON in app data directory with serde
- Frontend has typed IPC wrappers matching all 6 Rust commands
- sshStore provides connection CRUD, group management, and active session tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Rust SSH module -- config, manager, commands** - `e501951` (feat)
2. **Task 2: Frontend SSH IPC wrappers and sshStore** - `5ee885e` (feat)

## Files Created/Modified
- `src-tauri/src/ssh/mod.rs` - SSH module entry point
- `src-tauri/src/ssh/config.rs` - SshConnection, SshGroup, SshConnectionStore with JSON persistence
- `src-tauri/src/ssh/manager.rs` - SshManager with connect/write/resize/disconnect, SshEvent enum
- `src-tauri/src/ssh/commands.rs` - 6 Tauri IPC commands for SSH
- `src-tauri/Cargo.toml` - Added russh 0.58, async-trait, bytes dependencies
- `src-tauri/src/lib.rs` - Registered ssh module and 6 commands in generate_handler
- `src/lib/ipc.ts` - Added SSH types and IPC wrapper functions
- `src/stores/sshStore.ts` - Zustand store with persist middleware for SSH connections

## Decisions Made
- Used channel split pattern instead of storing channel_id on Handle (russh 0.58 has no window_change on Handle)
- Handle.data() used for writing (accepts Bytes), ChannelWriteHalf.window_change() for resize
- TOFU (trust on first use) host key policy -- accept all keys, suitable for personal tool
- 10-second connection timeout wrapping russh::client::connect
- Auth cascade: key auth first, password fallback
- sshStore persists to localStorage via zustand middleware, syncs to Rust backend on mutations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed russh 0.58 API differences from plan**
- **Found during:** Task 1 (Rust SSH module)
- **Issue:** Plan assumed window_change on Handle, PrivateKeyWithHashAlg::new returns Result, authenticate returns bool -- all incorrect for russh 0.58
- **Fix:** Used channel split pattern (ChannelReadHalf for reader, ChannelWriteHalf for resize), infallible PrivateKeyWithHashAlg::new, AuthResult.success() check, explicit bytes::Bytes type for data()
- **Files modified:** src-tauri/src/ssh/manager.rs
- **Verification:** cargo check passes cleanly
- **Committed in:** e501951

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** API adaptation required for russh 0.58 actual signatures vs research assumptions. No scope creep.

## Issues Encountered
- russh 0.58 uses a forked ssh-key crate (internal-russh-forked-ssh-key) -- used russh::keys::PublicKey re-export instead of direct ssh-key dependency
- bytes::Bytes type ambiguity with Vec<u8>.into() (multiple From impls in scope) -- resolved with explicit bytes::Bytes::from()

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SSH backend infrastructure complete, ready for Plan 03 (SSH UI wiring)
- SshManager, IPC wrappers, and sshStore available for the SSH sidebar panel and terminal tile integration

---
*Phase: 05-ssh-content-tiles*
*Completed: 2026-03-18*

## Self-Check: PASSED
- All 5 created files exist on disk
- Both task commits (e501951, 5ee885e) verified in git log
