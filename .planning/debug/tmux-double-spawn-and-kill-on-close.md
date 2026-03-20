---
status: awaiting_human_verify
trigger: "Two tmux sessions spawning per terminal tile; closing tile detaches instead of killing session"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes identified. See Resolution.
test: N/A - root causes confirmed by code reading
expecting: N/A
next_action: Apply fixes to usePty.ts and TerminalNode.tsx

## Symptoms

expected: One tmux session per terminal tile. Closing the tile kills the session. Only app quit detaches.
actual: Two sessions per terminal. Closing detaches instead of killing.
errors: None in console for this specific issue.
reproduction: Open a terminal on canvas. Check `tmux -S ~/Library/Application\ Support/panescale/tmux.sock ls` — shows 2 sessions. Close the terminal tile — sessions persist as detached.
started: Since tmux was re-enabled in quick task 260320-lch.

## Eliminated

## Evidence

- timestamp: 2026-03-20T00:01:00Z
  checked: src/main.tsx
  found: React.StrictMode is enabled, causing double mount/unmount in dev mode
  implication: The useEffect in TerminalNode.tsx runs twice - first mount spawns, cleanup detaches, second mount spawns again. This creates TWO tmux sessions.

- timestamp: 2026-03-20T00:02:00Z
  checked: src/hooks/usePty.ts line 31
  found: spawnLock ref exists to prevent double-spawn, BUT it gets reset to false in the cleanup (detach/kill callbacks and the unmount effect)
  implication: StrictMode flow is: mount1 -> spawn (lock=true) -> unmount1 (detach, lock=false) -> mount2 -> spawn (lock=false, so spawns AGAIN). The spawnLock is defeated by the cleanup resetting it.

- timestamp: 2026-03-20T00:03:00Z
  checked: src/components/canvas/TerminalNode.tsx lines 205-212 and 277-279
  found: handleClose calls removeNode(id) which removes the React node. The useEffect cleanup (line 211) calls pty.detach() not pty.kill(). There is no mechanism to distinguish "user closed tile" from "component unmounting for other reasons".
  implication: Close always detaches, never kills. The kill() function exists in usePty but is never called from TerminalNode.

- timestamp: 2026-03-20T00:04:00Z
  checked: src-tauri/src/pty/manager.rs kill() vs detach()
  found: kill() properly calls TmuxBridge::kill_session. detach() does NOT kill the tmux session (by design).
  implication: Backend has the right primitives. The frontend just needs to call kill instead of detach when the user closes the tile.

## Resolution

root_cause: |
  TWO bugs:
  1. DOUBLE-SPAWN: React StrictMode causes mount-unmount-mount cycle. The usePty spawnLock is defeated because the unmount cleanup resets spawnLock.current = false (via the detach callback), so the second mount can spawn again. Each spawn creates a new tmux session.
  2. CLOSE DETACHES INSTEAD OF KILLS: TerminalNode handleClose calls removeNode which triggers the useEffect cleanup, which always calls pty.detach(). There is no path that calls pty.kill(). The kill function exists but is unused.

fix: |
  1. DOUBLE-SPAWN FIX: Don't reset spawnLock in the useEffect cleanup. The spawnLock should persist across StrictMode remounts. Only reset it in kill() (explicit user action). The detach callback should NOT reset spawnLock since it's used during StrictMode cleanup.
  2. CLOSE-KILLS FIX: Add a "pendingKill" ref to track when handleClose is called. In the useEffect cleanup, check if pendingKill is set - if yes, call pty.kill() instead of pty.detach(). This way, user-initiated close kills the session, while other unmounts (StrictMode, app quit) detach.

verification:
files_changed: [src/hooks/usePty.ts, src/components/canvas/TerminalNode.tsx]
