# Quick Task: E2E Testing Infrastructure - Research

**Researched:** 2026-03-20
**Domain:** E2E testing for Tauri v2 desktop app with tmux terminals
**Confidence:** MEDIUM

## Summary

The Panescale project already has Playwright installed (`@playwright/test ^1.58.2`) with a working config, existing E2E tests in `e2e/`, and Tauri mock helpers. The existing tests run against the Vite dev server (port 1420) with mocked Tauri IPC -- they test the **web layer only**. For the 4 tmux-specific test scenarios (working shell, no double-spawn, no status bar, session persistence), we need tests that interact with the **real Tauri app** since mocked PTY/tmux commands cannot verify actual tmux behavior.

**Primary recommendation:** Keep the existing Playwright + mock setup for UI tests. Add a **separate test script** that launches the real Tauri dev app (`cargo tauri dev`) and uses shell commands (`tmux -S <socket> list-sessions`) to verify tmux behavior. The simplest approach is a shell script or Node script that: (1) starts the app, (2) waits for terminals to spawn, (3) shells out to verify tmux state, (4) kills and restarts the app for persistence tests.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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
</user_constraints>

## Existing Infrastructure

| What | Status | Location |
|------|--------|----------|
| Playwright | Installed v1.58.2 | `playwright.config.ts` |
| Vitest | Installed v4.1.0 | `vitest.config.ts` |
| Tauri IPC mocks | Working | `e2e/tauri-mocks.ts` |
| Existing E2E tests | 3 spec files (UI-only) | `e2e/canvas-interactions.spec.ts`, `e2e/drag-and-drop.spec.ts` |
| Unit test stubs | Todo stubs only | `src/test/*.test.ts` |
| npm scripts | `test:e2e`, `test:e2e:ui` | `package.json` |

## Framework Decision: Playwright (extend existing)

### Why NOT WebdriverIO + tauri-driver
- **macOS not supported** by official `tauri-driver` (no WKWebView driver). This project develops on macOS. [Source: Tauri v2 WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/)
- CrabNebula offers a paid macOS driver but requires subscription and `tauri-plugin-automation`
- Would require adding an entirely new test framework alongside existing Playwright

### Why NOT cargo-tauri test
- No official `cargo-tauri test` subcommand exists in Tauri v2
- Rust-side tests exist for TmuxBridge unit tests already (`src-tauri/src/platform/tmux.rs` has 5 unit tests)

### Why Playwright (extended approach)
- Already installed and configured
- Existing test patterns and Tauri mocks in place
- For tmux-specific tests: run against the **real Tauri app** (not mocked dev server)
- Two test tiers: (A) mocked UI tests (existing), (B) integration tests against real app

## Architecture: Two-Tier Testing

### Tier 1: Web UI Tests (existing)
- Playwright against Vite dev server (localhost:1420)
- Tauri IPC mocked via `e2e/tauri-mocks.ts`
- Tests canvas, sidebar, theme, keyboard shortcuts
- Command: `npm run test:e2e`

### Tier 2: Integration Tests (new -- tmux scenarios)
- **Approach:** Script-driven tests that launch `cargo tauri dev`, then use the Panescale-dedicated tmux socket to verify backend state
- **Tmux socket:** `~/Library/Application Support/panescale/tmux.sock`
- **Session prefix:** `exc-{uuid}`
- **Key verification commands:**
  ```bash
  # List sessions on the Panescale socket
  tmux -S "$HOME/Library/Application Support/panescale/tmux.sock" list-sessions -F "#{session_name}"

  # Check session count
  tmux -S "$SOCK" list-sessions | grep "^exc-" | wc -l

  # Check if status bar is off
  tmux -S "$SOCK" show-options -g status
  # Expected: "status off"

  # Check if session persists (after app restart)
  tmux -S "$SOCK" has-session -t "exc-<id>"
  ```

### Recommended File Structure
```
e2e/
  tauri-mocks.ts          # existing
  canvas-interactions.spec.ts  # existing (Tier 1)
  drag-and-drop.spec.ts        # existing (Tier 1)
  tmux/
    tmux-integration.spec.ts   # Tier 2: real app tests
    helpers.ts                 # tmux shell command helpers
```

## Test Scenarios: Implementation Approach

### Scenario 1: Terminal spawns with working shell
**Method:** Playwright connects to running Tauri app, double-clicks canvas to spawn terminal, then check:
- xterm.js container appears (`.xterm` selector inside `.react-flow__node`)
- Verify via tmux socket that a new `exc-*` session was created
- Optionally: use `tmux send-keys` + `tmux capture-pane` to verify shell responds

```typescript
// Verify terminal output via tmux capture-pane
const output = execSync(
  `tmux -S "${TMUX_SOCK}" send-keys -t "${sessionName}" "echo hello-test" Enter`
);
await sleep(500);
const captured = execSync(
  `tmux -S "${TMUX_SOCK}" capture-pane -t "${sessionName}" -p`
).toString();
expect(captured).toContain('hello-test');
```

### Scenario 2: No double-spawn (1 tmux session per tile)
**Method:** After spawning a terminal, count `exc-*` sessions on the socket. Should be exactly 1 per tile.
```typescript
const sessions = execSync(
  `tmux -S "${TMUX_SOCK}" list-sessions -F "#{session_name}" 2>/dev/null || true`
).toString().trim().split('\n').filter(s => s.startsWith('exc-'));
expect(sessions.length).toBe(expectedTileCount);
```

### Scenario 3: No tmux status bar visible
**Method:** Check tmux global option:
```typescript
const statusOpt = execSync(
  `tmux -S "${TMUX_SOCK}" show-options -g status`
).toString().trim();
expect(statusOpt).toContain('off');
```
Additionally verify visually: the xterm container should not have a green bar at the bottom. Check pixel color or element height.

### Scenario 4: Session persistence across app restart
**Method:**
1. Spawn terminal, note the session name
2. Close the Tauri app (kill the process)
3. Verify tmux session still exists on socket (tmux server persists independently)
4. Relaunch app, verify the terminal tile reappears and reattaches
```typescript
// After app close
const exists = execSync(
  `tmux -S "${TMUX_SOCK}" has-session -t "${sessionName}" 2>&1 && echo "yes" || echo "no"`
).toString().trim();
expect(exists).toBe('yes');
```

## Interacting with xterm.js in Playwright

xterm.js renders to a canvas element (CanvasAddon is loaded). DOM text selectors will NOT work for reading terminal output. Options:

1. **Use tmux capture-pane** (recommended for Tier 2) -- bypasses the rendering layer entirely
2. **Use page.evaluate with xterm API** -- access the Terminal instance via the buffer registry:
   ```typescript
   const text = await page.evaluate(() => {
     // Access registered terminals from the global registry
     const term = (window as any).__terminalRegistry?.get(nodeId);
     if (!term) return '';
     const buffer = term.buffer.active;
     let text = '';
     for (let i = 0; i < buffer.length; i++) {
       text += buffer.getLine(i)?.translateToString(true) + '\n';
     }
     return text;
   });
   ```
3. **Type into terminal** -- click on xterm container, then use `page.keyboard.type()`. xterm captures keyboard events from its textarea element.

## Common Pitfalls

### Pitfall 1: React StrictMode double-mount
**What goes wrong:** In development, React mounts/unmounts/remounts components. This causes double PTY spawn if not handled.
**Status:** Already handled in `usePty.ts` via `spawnLock` ref and tmux reattach on remount.
**Test implication:** Tests may see brief session creation/destruction on initial mount.

### Pitfall 2: Timing -- tmux session creation is async
**What goes wrong:** Checking sessions immediately after double-click finds nothing.
**How to avoid:** Poll with retry (e.g., wait up to 5 seconds for session to appear). Use `waitForFunction` or retry loop.

### Pitfall 3: Orphan tmux sessions between test runs
**What goes wrong:** Previous test runs leave tmux sessions on the socket, polluting counts.
**How to avoid:** Clean up before each test:
```bash
tmux -S "$SOCK" kill-server 2>/dev/null || true
```

### Pitfall 4: Playwright cannot connect to Tauri webview directly
**What goes wrong:** Playwright's `browserType.launch()` opens Chromium, not the Tauri app.
**How to avoid:** For Tier 2 tests, use `cargo tauri dev` which starts both the Rust backend AND the Vite dev server. Playwright connects to `localhost:1420` -- the frontend is the same, but IPC calls go to the real Rust backend (not mocks). Do NOT inject `tauri-mocks.ts` for Tier 2 tests.

### Pitfall 5: Port 1420 conflict
**What goes wrong:** If Vite dev server is already running, `cargo tauri dev` reuses it. If mocked tests ran first, the mock state might persist.
**How to avoid:** Use separate Playwright config files for Tier 1 (mocked) and Tier 2 (real). Or use a `webServer` config that runs `cargo tauri dev` instead of `npm run dev`.

## Key Technical Details

| Property | Value |
|----------|-------|
| Tmux socket path | `~/Library/Application Support/panescale/tmux.sock` |
| Session name format | `exc-{tile_id}` (tile_id is a UUID) |
| Dev server URL | `http://localhost:1420` |
| Tauri dev command | `cargo tauri dev` |
| xterm.js renderer | CanvasAddon (canvas element, not DOM text) |
| Terminal node selector | `.react-flow__node` containing `.xterm` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.58.2 (already installed) |
| Config file | `playwright.config.ts` (extend or create second config) |
| Quick run command | `npx playwright test e2e/tmux/` |
| Full suite command | `npx playwright test` |

### Requirements to Test Map
| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| TMUX-01 | Terminal spawns with working shell | integration | `npx playwright test e2e/tmux/ -g "spawns with working shell"` |
| TMUX-02 | No double-spawn sessions | integration | `npx playwright test e2e/tmux/ -g "no double-spawn"` |
| TMUX-03 | No tmux status bar | integration | `npx playwright test e2e/tmux/ -g "no status bar"` |
| TMUX-04 | Session persistence | integration | `npx playwright test e2e/tmux/ -g "persistence"` |

### Wave 0 Gaps
- [ ] `e2e/tmux/helpers.ts` -- tmux shell command utilities
- [ ] `e2e/tmux/tmux-integration.spec.ts` -- test file for 4 scenarios
- [ ] Playwright config for Tier 2 (real app, not mocked)
- [ ] npm script for integration tests: `test:e2e:integration`

## Sources

### Primary (HIGH confidence)
- Project source code: `playwright.config.ts`, `e2e/tauri-mocks.ts`, `src-tauri/src/platform/tmux.rs`
- [Tauri v2 WebDriver docs](https://v2.tauri.app/develop/tests/webdriver/) -- macOS not supported

### Secondary (MEDIUM confidence)
- [CrabNebula E2E docs](https://docs.crabnebula.dev/plugins/tauri-e2e-tests/) -- paid macOS solution exists
- [Tauri v2 Testing overview](https://v2.tauri.app/develop/tests/) -- mock approach documented

### Tertiary (LOW confidence)
- [Tauri-WebDriver for macOS](https://danielraffel.me/2026/02/14/i-built-a-webdriver-for-wkwebview-tauri-apps-on-macos/) -- community project, maturity unknown (502 error fetching)

## Metadata

**Confidence breakdown:**
- Framework choice (Playwright): HIGH -- already in project, pragmatic for macOS
- Tmux verification via socket: HIGH -- shell commands are deterministic
- xterm.js interaction in Playwright: MEDIUM -- canvas rendering limits DOM inspection
- Real app test architecture: MEDIUM -- `cargo tauri dev` + Playwright against localhost works but timing can be tricky
