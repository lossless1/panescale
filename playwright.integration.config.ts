import { defineConfig } from "@playwright/test";

/**
 * Playwright config for Tier 2 integration tests.
 *
 * These tests run against the real Tauri app (not mocked IPC).
 * Start the app with `cargo tauri dev` before running:
 *   npm run test:e2e:integration
 *
 * No webServer block -- the real Tauri app must be started manually
 * since `cargo tauri dev` is needed for real PTY/tmux.
 */
export default defineConfig({
  testDir: "./e2e/tmux",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:1420",
    screenshot: "only-on-failure",
  },
});
