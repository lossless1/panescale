/**
 * Tmux Terminal Integration Tests (Tier 2)
 *
 * These tests verify real tmux behavior against the running Tauri app.
 * They interact with the Panescale-dedicated tmux socket, NOT the user's
 * default tmux server.
 *
 * Prerequisites:
 *   1. Start the app: `cargo tauri dev`
 *   2. Run tests:     `npm run test:e2e:integration`
 *
 * The tests assume `cargo tauri dev` is already running on localhost:1420.
 * There is no webServer auto-start in the integration config.
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
  waitForSession,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  // Clean orphan sessions from previous runs
  killServer();

  // Navigate to the running Tauri app
  await page.goto("/");

  // Wait for React Flow canvas to render
  await page.waitForSelector(".react-flow", { timeout: 15_000 });
});

test.afterEach(() => {
  killServer();
});

test("terminal spawns with working shell", async ({ page }) => {
  // Double-click the canvas to spawn a terminal node
  await page.dblclick(".react-flow__pane");

  // Wait for xterm to appear inside a node
  await page.waitForSelector(".react-flow__node .xterm", { timeout: 10_000 });

  // Wait for the tmux session to be created
  await waitForSession(() => sessionCount() >= 1, 10_000);

  // Get the session name
  const sessions = listSessions();
  expect(sessions.length).toBeGreaterThanOrEqual(1);
  const session = sessions[0];

  // Send a command and verify output via tmux capture-pane
  sendKeys(session, "echo e2e-test-marker");
  await new Promise((r) => setTimeout(r, 500));

  const output = capturePane(session);
  expect(output).toContain("e2e-test-marker");
});

test("only 1 tmux session per terminal tile (no double-spawn)", async ({
  page,
}) => {
  // Spawn a terminal
  await page.dblclick(".react-flow__pane");
  await page.waitForSelector(".react-flow__node .xterm", { timeout: 10_000 });

  // Wait for session to appear
  await waitForSession(() => sessionCount() >= 1, 10_000);

  // Wait additional 3 seconds to let React StrictMode double-mount settle
  await new Promise((r) => setTimeout(r, 3_000));

  // Assert exactly one session, not two
  expect(sessionCount()).toBe(1);
});

test("no tmux status bar visible", async ({ page }) => {
  // Spawn a terminal
  await page.dblclick(".react-flow__pane");
  await page.waitForSelector(".react-flow__node .xterm", { timeout: 10_000 });

  // Wait for session to appear
  await waitForSession(() => sessionCount() >= 1, 10_000);

  // Verify the tmux status option is off
  const statusOption = getOption("status");
  expect(statusOption).toContain("off");
});

test("terminal session persists after app close", async ({ page }) => {
  // Spawn a terminal
  await page.dblclick(".react-flow__pane");
  await page.waitForSelector(".react-flow__node .xterm", { timeout: 10_000 });

  // Wait for session and capture the session name
  await waitForSession(() => sessionCount() >= 1, 10_000);
  const sessionName = listSessions()[0];
  expect(sessionName).toBeTruthy();

  // Close the page (simulates app close from frontend side)
  await page.close();

  // Verify the tmux session survives -- tmux server is independent of the app
  expect(hasSession(sessionName)).toBe(true);

  // NOTE: Full app restart test (verifying reattach after `cargo tauri dev`
  // restart) requires stopping/starting the Tauri process, which is beyond
  // Playwright's scope for this initial setup. A future shell script wrapper
  // could: (1) kill the Tauri process, (2) verify session persists,
  // (3) relaunch `cargo tauri dev`, (4) verify reattach in the UI.
});
