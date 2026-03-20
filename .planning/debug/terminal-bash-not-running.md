---
status: awaiting_human_verify
trigger: "Terminal bash is not running in the tmux session after recent tmux isolation changes"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - uncommitted change removed spawnLock reset from detach(), blocking second mount spawn
test: Traced StrictMode mount/unmount/remount flow through usePty
expecting: Restoring spawnLock.current = false in detach() will fix it
next_action: Apply fix and verify

## Symptoms

expected: Terminal tiles should show a working bash/zsh shell inside a tmux session via the isolated socket.
actual: Terminal bash is not running in the tmux session. Terminals are non-functional.
errors: Unknown — need to investigate Rust backend and tmux command construction.
reproduction: Open the app, create a terminal tile. The shell doesn't work properly.
started: Since tmux isolation changes in quick task 260320-lch (separate socket, re-enabling tmux, detach/kill behavior changes).

## Eliminated

## Evidence

- timestamp: 2026-03-20T00:10:00Z
  checked: git diff HEAD -- src/hooks/usePty.ts
  found: Uncommitted change removed `spawnLock.current = false` from detach() callback (line ~127)
  implication: After StrictMode unmount calls detach(), spawnLock stays true and second mount's spawn() returns early with empty string

- timestamp: 2026-03-20T00:12:00Z
  checked: Traced full StrictMode lifecycle in usePty
  found: 1) First mount: spawn sets spawnLock=true, creates PTY. 2) Unmount: detach() nulls ptyIdRef, does NOT reset spawnLock. 3) Second mount: spawn() sees spawnLock=true, returns ptyIdRef.current ?? "" = "", no PTY created.
  implication: Terminal has no backend connection on the actual mounted instance

- timestamp: 2026-03-20T00:13:00Z
  checked: tmux sessions on isolated socket
  found: tmux -S ~/Library/Application Support/panescale/tmux.sock list-sessions shows sessions existing and some attached
  implication: Backend tmux infrastructure is working fine; issue is purely frontend spawnLock logic

## Resolution

root_cause: Uncommitted change in usePty.ts removed `spawnLock.current = false` from detach() callback. In React StrictMode, the mount-unmount-remount cycle causes detach() to run during cleanup, which nulls ptyIdRef but leaves spawnLock=true. On the second mount, spawn() sees the lock and returns early with an empty string, never creating a PTY connection.
fix: Restored `spawnLock.current = false` at the end of the detach() callback. This allows the second StrictMode mount to spawn a fresh PTY. The orphaned tmux session from the first mount is handled by the existing cleanup mechanism.
verification: Awaiting human verification - open app, create terminal tile, confirm bash/zsh shell is functional.
files_changed: [src/hooks/usePty.ts]
