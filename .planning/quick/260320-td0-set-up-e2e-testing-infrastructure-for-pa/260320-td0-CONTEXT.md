# Quick Task 260320-td0: E2E Testing Infrastructure - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Task Boundary

Set up E2E testing infrastructure for the Panescale Tauri v2 desktop app and write E2E tests that verify terminal/tmux behavior.

</domain>

<decisions>
## Implementation Decisions

### Test Scope
- Focus on **tmux terminal tests only** (4 scenarios):
  1. Terminal spawns with a working shell (can type and see output)
  2. Only 1 tmux session per terminal tile (no double-spawn)
  3. No tmux status bar visible (green bar)
  4. Terminal session persists after app close/reopen
- Can expand to other features later

### Claude's Discretion
- Test framework choice (Playwright, WebdriverIO + tauri-driver, cargo-tauri test)
- CI integration approach
- Test file organization and naming conventions

</decisions>

<specifics>
## Specific Ideas

- The app is built with Tauri v2 (Rust backend + React webview)
- Terminal rendering uses xterm.js
- Tmux sessions use an isolated socket at ~/Library/Application Support/panescale/tmux.sock
- Session names follow pattern: exc-{uuid}

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
