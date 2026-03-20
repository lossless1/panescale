import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Tier 2 integration tests.
 *
 * These tests verify tmux socket state against the running Tauri app.
 * They do NOT open a browser — Tauri apps require the native IPC bridge
 * which isn't available in standalone Chromium.
 *
 * How to run:
 *   1. Start the app: `cargo tauri dev`
 *   2. Open at least one terminal tile
 *   3. npm run test:e2e:integration
 */
export default defineConfig({
  testDir: "./e2e/tmux",
  timeout: 30_000,
  retries: 0,
  use: {
    // No browser needed — tests use shell commands against tmux socket
    launchOptions: {
      // Still launches browser but tests don't navigate anywhere
    },
  },
});
