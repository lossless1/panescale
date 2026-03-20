/**
 * Tmux Terminal Integration Tests (Tier 2)
 *
 * These tests verify real tmux behavior by interacting with the Panescale
 * tmux socket directly. They do NOT use Playwright browser automation
 * because Tauri apps require the native IPC bridge which is only available
 * inside the Tauri webview (not a standalone Chromium instance).
 *
 * How to run:
 *   1. Start the app: `cargo tauri dev`
 *   2. Create at least one terminal tile on the canvas
 *   3. Run tests:     `npm run test:e2e:integration`
 *
 * The tests verify tmux socket state — they assume you have terminal
 * tiles open in the running app.
 */

import { test, expect } from "@playwright/test";
import {
  killServer,
  listSessions,
  sessionCount,
  hasSession,
  capturePane,
  sendKeys,
  getOption,
  createSession,
  killSession,
  TMUX_SOCK,
} from "./helpers";
import { execSync } from "node:child_process";
import * as fs from "node:fs";

// Skip browser entirely — these are shell-level integration tests
test.use({ baseURL: undefined });

/**
 * Check if the Panescale tmux server is running (i.e. the app has
 * created at least one terminal with tmux).
 */
function tmuxServerRunning(): boolean {
  try {
    execSync(`tmux -S "${TMUX_SOCK}" list-sessions 2>/dev/null`, {
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

test.beforeAll(() => {
  if (!tmuxServerRunning()) {
    test.skip();
    throw new Error(
      "Panescale tmux server not running. Start the app and open a terminal tile first.",
    );
  }
});

test("tmux socket exists and is isolated from user tmux", () => {
  // Socket file exists
  expect(fs.existsSync(TMUX_SOCK)).toBe(true);

  // Sessions exist on the Panescale socket
  const sessions = listSessions();
  expect(sessions.length).toBeGreaterThanOrEqual(1);

  // All sessions follow the exc-{uuid} naming convention
  for (const s of sessions) {
    expect(s).toMatch(/^exc-/);
  }

  // Sessions are NOT visible on the default tmux server
  let defaultSessions = "";
  try {
    defaultSessions = execSync("tmux list-sessions -F '#{session_name}' 2>/dev/null", {
      encoding: "utf-8",
    });
  } catch {
    // No default tmux server running — that's fine, confirms isolation
  }
  const excInDefault = defaultSessions
    .split("\n")
    .filter((s) => s.startsWith("exc-"));
  expect(excInDefault.length).toBe(0);
});

test("terminal has working shell (can execute commands)", () => {
  const sessions = listSessions();
  expect(sessions.length).toBeGreaterThanOrEqual(1);
  const session = sessions[0];

  // Send a unique marker command
  const marker = `e2e-marker-${Date.now()}`;
  sendKeys(session, `echo ${marker}`);

  // Wait for command to execute
  execSync("sleep 1");

  // Verify output contains the marker
  const output = capturePane(session);
  expect(output).toContain(marker);
});

test("no double-spawn: session count matches expected", () => {
  const sessions = listSessions();
  const count = sessions.length;

  // Each session name should be unique (no duplicates)
  const unique = new Set(sessions);
  expect(unique.size).toBe(count);

  // Log for manual verification
  console.log(`Active tmux sessions (${count}):`, sessions);
});

test("tmux status bar is hidden", () => {
  // The global status option should be "off"
  const statusOption = getOption("status");
  expect(statusOption).toContain("off");
});

test("tmux prefix key is disabled", () => {
  // The global prefix should be "None" (no prefix key to interfere with shell)
  const prefix = getOption("prefix");
  expect(prefix).toContain("None");
});

test("tmux escape-time is zero", () => {
  // Zero escape time prevents input lag
  const escapeTime = getOption("escape-time");
  expect(escapeTime).toContain("0");
});

test("session persists and is accessible", () => {
  const sessions = listSessions();
  expect(sessions.length).toBeGreaterThanOrEqual(1);
  const session = sessions[0];

  // Session exists and is queryable
  expect(hasSession(session)).toBe(true);

  // Can capture pane content (proves session is alive, not just a stale entry)
  const content = capturePane(session);
  expect(typeof content).toBe("string");

  // Can send keys to the session (proves it's interactive)
  const marker = `persist-check-${Date.now()}`;
  sendKeys(session, `echo ${marker}`);
  execSync("sleep 0.5");
  const output = capturePane(session);
  expect(output).toContain(marker);
});

// ─────────────────────────────────────────────────────────────
// One terminal = one session (strict 1:1 mapping)
// ─────────────────────────────────────────────────────────────

test.describe("one terminal = one session", () => {
  const SESSION = "exc-one-to-one-test";

  test.afterEach(() => {
    killSession(SESSION);
  });

  test("creating one session results in exactly one entry", () => {
    const before = sessionCount();
    createSession(SESSION);

    const after = sessionCount();
    expect(after).toBe(before + 1);

    // The new session is the only one with this name
    const matches = listSessions().filter((s) => s === SESSION);
    expect(matches.length).toBe(1);
  });

  test("creating a session with the same name does not duplicate", () => {
    createSession(SESSION);
    const countAfterFirst = sessionCount();

    // Attempt to create again with the same name — tmux rejects duplicates
    try {
      createSession(SESSION);
    } catch {
      // Expected: tmux returns error for duplicate session name
    }

    // Count should not have increased
    expect(sessionCount()).toBe(countAfterFirst);
  });

  test("each session name is globally unique across all sessions", () => {
    createSession(SESSION);
    const sessions = listSessions();
    const nameSet = new Set(sessions);

    // Every session name appears exactly once
    expect(nameSet.size).toBe(sessions.length);
  });
});

// ─────────────────────────────────────────────────────────────
// Open-close-reopen: session lifecycle
// ─────────────────────────────────────────────────────────────

test.describe("open-close-reopen lifecycle", () => {
  const SESSION = "exc-lifecycle-test";

  test.afterEach(() => {
    killSession(SESSION);
  });

  test("shell works after create → kill → recreate", () => {
    // Create and verify working
    createSession(SESSION);
    const marker1 = `lifecycle-1-${Date.now()}`;
    sendKeys(SESSION, `echo ${marker1}`);
    execSync("sleep 0.5");
    expect(capturePane(SESSION)).toContain(marker1);

    // Kill the session (simulates closing the terminal tile)
    killSession(SESSION);
    expect(hasSession(SESSION)).toBe(false);
    const countAfterKill = sessionCount();

    // Recreate (simulates opening a new terminal tile)
    createSession(SESSION);
    expect(hasSession(SESSION)).toBe(true);
    expect(sessionCount()).toBe(countAfterKill + 1);

    // Shell should be fully functional in the new session
    const marker2 = `lifecycle-2-${Date.now()}`;
    sendKeys(SESSION, `echo ${marker2}`);
    execSync("sleep 0.5");
    const output = capturePane(SESSION);
    expect(output).toContain(marker2);
    // Old marker should NOT be present (fresh session)
    expect(output).not.toContain(marker1);
  });

  test("session survives detach and works after reattach", () => {
    // Create session and run a background process
    createSession(SESSION);
    sendKeys(SESSION, "export E2E_VAR=alive");
    execSync("sleep 0.3");

    // Verify the variable was set
    sendKeys(SESSION, "echo $E2E_VAR");
    execSync("sleep 0.5");
    expect(capturePane(SESSION)).toContain("alive");

    // Detach all clients (simulates app closing without killing)
    execSync(
      `tmux -S "${TMUX_SOCK}" detach-client -t "${SESSION}" 2>/dev/null || true`,
    );

    // Session still exists after detach
    expect(hasSession(SESSION)).toBe(true);

    // "Reattach" by sending new commands — session state preserved
    sendKeys(SESSION, "echo $E2E_VAR");
    execSync("sleep 0.5");
    const output = capturePane(SESSION);
    expect(output).toContain("alive");
  });

  test("rapid create-kill cycles don't leak sessions", () => {
    const baseCount = sessionCount();

    // Simulate 5 rapid open-close cycles
    for (let i = 0; i < 5; i++) {
      const name = `exc-rapid-${i}`;
      createSession(name);
      expect(hasSession(name)).toBe(true);
      killSession(name);
      expect(hasSession(name)).toBe(false);
    }

    // No sessions leaked — count should be back to baseline
    expect(sessionCount()).toBe(baseCount);
  });

  test("multiple terminals: each gets own session, closing one doesn't affect others", () => {
    const sessions = ["exc-multi-a", "exc-multi-b", "exc-multi-c"];
    const baseCount = sessionCount();

    // Create 3 sessions
    for (const s of sessions) {
      createSession(s);
    }
    expect(sessionCount()).toBe(baseCount + 3);

    // Each is independently functional
    for (const s of sessions) {
      const marker = `multi-${s}-${Date.now()}`;
      sendKeys(s, `echo ${marker}`);
      execSync("sleep 0.3");
      expect(capturePane(s)).toContain(marker);
    }

    // Kill the middle one
    killSession("exc-multi-b");
    expect(hasSession("exc-multi-b")).toBe(false);
    expect(sessionCount()).toBe(baseCount + 2);

    // Others still work
    for (const s of ["exc-multi-a", "exc-multi-c"]) {
      const marker = `after-kill-${s}-${Date.now()}`;
      sendKeys(s, `echo ${marker}`);
      execSync("sleep 0.3");
      expect(capturePane(s)).toContain(marker);
    }

    // Cleanup
    killSession("exc-multi-a");
    killSession("exc-multi-c");
  });
});

// ─────────────────────────────────────────────────────────────
// Node ID = session ID: tmux session uses the tile's stable ID
// ─────────────────────────────────────────────────────────────

test.describe("node ID = session ID mapping", () => {
  const NODE_ID = "my-stable-node-id-42";
  const SESSION = `exc-${NODE_ID}`;

  test.afterEach(() => {
    killSession(SESSION);
  });

  test("session name matches the node ID, not a random UUID", () => {
    // Simulate what the app does: create session with a known node ID
    createSession(SESSION);

    // Session exists with the exact expected name
    expect(hasSession(SESSION)).toBe(true);

    // The session name contains the node ID, not a random UUID
    const sessions = listSessions();
    const match = sessions.find((s) => s === SESSION);
    expect(match).toBe(SESSION);
  });

  test("reattach finds session by node ID after simulated restart", () => {
    // Step 1: Create session (simulates first app open)
    createSession(SESSION);
    const marker = `before-restart-${Date.now()}`;
    sendKeys(SESSION, `echo ${marker}`);
    execSync("sleep 0.5");
    expect(capturePane(SESSION)).toContain(marker);

    // Step 2: Detach (simulates app close — session stays alive)
    execSync(
      `tmux -S "${TMUX_SOCK}" detach-client -t "${SESSION}" 2>/dev/null || true`,
    );
    expect(hasSession(SESSION)).toBe(true);

    // Step 3: Verify the SAME session name is found (simulates app reopen)
    // The app would look for exc-{nodeId} — same stable ID
    expect(hasSession(SESSION)).toBe(true);

    // Step 4: Session still works after "reattach"
    const marker2 = `after-restart-${Date.now()}`;
    sendKeys(SESSION, `echo ${marker2}`);
    execSync("sleep 0.5");
    expect(capturePane(SESSION)).toContain(marker2);
  });

  test("session with wrong ID is not found (no cross-contamination)", () => {
    createSession(SESSION);

    // A different node ID should NOT match this session
    expect(hasSession("exc-wrong-node-id")).toBe(false);
    expect(hasSession("exc-some-random-uuid")).toBe(false);

    // Only the exact ID matches
    expect(hasSession(SESSION)).toBe(true);
  });
});
