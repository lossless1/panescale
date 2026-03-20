---
phase: 08-enhanced-ssh-connection-integration
plan: 01
subsystem: ssh
tags: [ssh2-config, russh, exec-channel, remote-browsing, ipc]

# Dependency graph
requires:
  - phase: 05-ssh-remote-connections
    provides: "SshManager with connect/write/resize/disconnect, SshSession struct, russh 0.58"
provides:
  - "ssh_list_config_hosts IPC command parsing ~/.ssh/config"
  - "ssh_read_remote_dir IPC command for remote directory listing via exec channel"
  - "ssh_connect_for_browsing IPC command for PTY-less SSH sessions"
  - "ssh_open_config_in_editor IPC command to open SSH config in system editor"
  - "exec_command method on SshManager for running remote commands"
  - "connect_browsing method on SshManager for auth-only sessions"
  - "SshConfigHost struct for parsed SSH config entries"
  - "Frontend IPC wrappers: sshListConfigHosts, sshReadRemoteDir, sshConnectForBrowsing, sshOpenConfigInEditor"
affects: [08-02, 08-03]

# Tech tracking
tech-stack:
  added: [ssh2-config 0.7, open 5]
  patterns: [exec-channel-for-remote-ops, lock-scoped-channel-open, browsing-only-sessions]

key-files:
  created: []
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/ssh/config.rs
    - src-tauri/src/ssh/manager.rs
    - src-tauri/src/ssh/commands.rs
    - src-tauri/src/lib.rs
    - src/lib/ipc.ts

key-decisions:
  - "Channel open within lock scope instead of Handle clone (russh 0.58 Handle is not Clone)"
  - "ls -1pA for remote dir listing (cross-platform, slash-suffix for directories)"
  - "open crate v5 for editor launch (simpler than tauri-plugin-shell opener API)"

patterns-established:
  - "Exec channel pattern: lock sessions, open channel via handle, drop lock, read output"
  - "Browsing session pattern: authenticate without PTY, store handle for later exec commands"

requirements-completed: [SSH-ENH-02, SSH-ENH-03, SSH-ENH-05]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 8 Plan 01: SSH Backend Infrastructure Summary

**ssh2-config parsing, exec_command via scoped channel open, browsing-only connections, and four new IPC commands with frontend wrappers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T22:22:43Z
- **Completed:** 2026-03-20T22:27:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Four new Rust IPC commands registered: ssh_list_config_hosts, ssh_read_remote_dir, ssh_connect_for_browsing, ssh_open_config_in_editor
- Two new SshManager methods: exec_command (lock-scoped channel open pattern) and connect_browsing (PTY-less session)
- SshConfigHost struct for parsed SSH config entries with serialization
- Four frontend IPC wrapper functions with TypeScript types (SshConfigHost, RemoteFileEntry)
- 12 SSH tests passing including 5 new test stubs

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ssh2-config dependency and implement Rust backend** - `d190c08` (feat)
2. **Task 2: Add frontend IPC wrapper functions and types to ipc.ts** - `4a682a1` (feat)

## Files Created/Modified
- `src-tauri/Cargo.toml` - Added ssh2-config 0.7 and open 5 dependencies
- `src-tauri/src/ssh/config.rs` - Added SshConfigHost struct and serialization test
- `src-tauri/src/ssh/manager.rs` - Added exec_command and connect_browsing methods
- `src-tauri/src/ssh/commands.rs` - Added 4 new commands, RemoteFileEntry, shell_escape, and test stubs
- `src-tauri/src/lib.rs` - Registered 4 new commands in generate_handler
- `src/lib/ipc.ts` - Added SshConfigHost, RemoteFileEntry types and 4 IPC wrapper functions

## Decisions Made
- Used channel open within lock scope instead of Handle clone (russh 0.58 Handle is not Clone, plan assumed it was)
- Used open crate v5 for editor launch as specified in plan
- Used ls -1pA for remote directory listing (POSIX-compatible, slash suffix for directories)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Handle not Clone in russh 0.58**
- **Found during:** Task 1 (exec_command implementation)
- **Issue:** Plan specified cloning the Handle to drop the lock before async operations, but russh 0.58 Handle is not Clone (contains Sender, UnboundedReceiver, JoinHandle)
- **Fix:** Open the channel via handle.channel_open_session() while still holding the lock (channel_open_session takes &self), then drop the lock and read output from the independent Channel
- **Files modified:** src-tauri/src/ssh/manager.rs
- **Verification:** cargo test ssh passes, cargo build succeeds
- **Committed in:** d190c08 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix was necessary for compilation. The scoped channel open pattern achieves the same deadlock-avoidance goal as Handle clone -- the lock is released before blocking on exec output.

## Issues Encountered
None beyond the Handle clone deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four backend IPC commands are ready for Plans 02 (sidebar restructure, SSH quick-connect dropdown) and 03 (remote file browsing UI)
- Frontend IPC wrappers are exported and ready for import by UI components

---
*Phase: 08-enhanced-ssh-connection-integration*
*Completed: 2026-03-20*
