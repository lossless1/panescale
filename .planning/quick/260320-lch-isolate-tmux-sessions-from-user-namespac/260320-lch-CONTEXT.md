# Quick Task 260320-lch: Isolate tmux sessions and hide UI artifacts - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Task Boundary

Improve terminal session persistence so sessions survive app close/reopen. Panescale's tmux sessions must be invisible to the user's regular tmux. No tmux visual artifacts in terminals.

</domain>

<decisions>
## Implementation Decisions

### Session Isolation
- Use a **separate tmux socket** (`tmux -S /path/to/panescale-tmux.sock`) for all Panescale tmux operations
- Sessions will be completely invisible to `tmux ls` (which uses the default server)
- Panescale gets its own tmux server process, isolated from the user's

### What Survives Restart
- **Full process persistence**: running processes (npm run dev, vim, etc.) continue in tmux and are reattached on app reopen
- Terminal shows exactly where user left off — same scrollback, same running process
- This requires tmux to stay alive between app sessions

### Tmux UI Visibility
- No tmux status bar visible
- No tmux prefix key behavior (Ctrl+B should pass through to the shell)
- Terminal should look identical to a regular non-tmux terminal

### Claude's Discretion
- Socket file location (e.g. `/tmp/panescale-tmux-{uid}.sock` or app data dir)
- Tmux config options to hide all UI (set -g status off, set -g prefix None, etc.)
- Session naming convention for matching tiles to tmux sessions

</decisions>

<specifics>
## Specific Ideas

- The project already uses tmux (Phase 02-06 decisions: env_remove(TMUX), ensureTmuxOnce)
- Current implementation leaks sessions into user's tmux namespace
- Need to audit all existing tmux commands and switch to `-S socket` pattern

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
