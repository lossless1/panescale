---
status: awaiting_human_verify
trigger: "Double-spawn still happening + green tmux status bar visible"
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:00:00Z
---

## Current Focus

hypothesis: TWO root causes identified, proceeding to fix
test: apply fixes and verify
expecting: no double spawn, no green status bar
next_action: apply fixes to usePty.ts and tmux.rs

## Symptoms

expected: 2 tmux sessions for 2 terminals. No green status bar visible.
actual: 4 tmux sessions for 2 terminals. Green status bar visible at bottom of each terminal showing "26".
errors: None in console.
reproduction: Open app, create 2 terminals. Run `tmux -S ~/Library/Application\ Support/panescale/tmux.sock ls` — shows 4 sessions. Green bar visible at bottom.
started: Since tmux re-enable in quick task 260320-lch. Previous fix for double-spawn (not resetting spawnLock in detach) caused terminals to not start at all, so it was reverted.

## Eliminated

## Evidence

- timestamp: 2026-03-20T00:01:00Z
  checked: usePty.ts detach() callback vs useEffect cleanup
  found: TerminalNode cleanup (line 217) calls pty.detach() which resets spawnLock=false. usePty also has its own useEffect cleanup (line 131-138) that calls ptyDetach directly without resetting lock. Both run on StrictMode unmount. The TerminalNode cleanup resets spawnLock, allowing the remount to call spawn() again = double session.
  implication: ROOT CAUSE 1 - TerminalNode cleanup calls pty.detach() which resets spawnLock. Fix: remove spawnLock reset from detach(), only reset in kill(). Also remove redundant usePty internal cleanup since TerminalNode already handles detach.

- timestamp: 2026-03-20T00:02:00Z
  checked: tmux.rs configure_server() call order
  found: configure_server() is called AFTER create_session() on line 98. `set-option -g status off` sets the global DEFAULT but the session just created already has its own session-level status=on. The first session (and possibly all sessions created in the same call) won't inherit the global change.
  implication: ROOT CAUSE 2 - configure_server() must run BEFORE create_session(), or must also apply options to the specific session. Moving configure_server before new-session AND using set-option without -g (or with -t) for the session will fix the green bar.

## Resolution

root_cause: |
  TWO root causes:
  1) Double-spawn: TerminalNode cleanup calls pty.detach() which resets spawnLock=false and clears ptyIdRef. On StrictMode remount, spawn() sees no lock and creates a brand new tmux session. Additionally, usePty had its own useEffect cleanup that raced with TerminalNode's cleanup.
  2) Green status bar: configure_server() (which sets `status off`) ran AFTER create_session(). The first session was created before the global option was set. Since tmux sessions inherit global defaults at creation time, the first session kept status=on.
fix: |
  1) Double-spawn fix: detach() no longer resets spawnLock or clears ptyIdRef/sessionNameRef. spawn() detects spawnLock=true and reattaches to the existing tmux session instead of spawning new. Removed redundant usePty internal useEffect cleanup (TerminalNode handles lifecycle).
  2) Status bar fix: configure_server() now runs before create_session(). For the very first session (when no tmux server exists yet), it re-runs configure_server after the server is started by new-session, and also applies set-option -t {session} status off directly to that session.
verification: TypeScript and Rust compile clean. Needs manual verification in app.
files_changed:
  - src/hooks/usePty.ts
  - src-tauri/src/platform/tmux.rs
