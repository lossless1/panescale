import { execSync } from "node:child_process";
import * as path from "node:path";
import * as os from "node:os";

/**
 * Tmux socket command utilities for Panescale integration tests.
 *
 * All commands target the dedicated Panescale socket, never the user's
 * default tmux server.
 */

/** Path to the Panescale-dedicated tmux socket. */
export const TMUX_SOCK = path.join(
  os.homedir(),
  "Library/Application Support/panescale/tmux.sock",
);

/**
 * List all Panescale tmux sessions (prefixed with `exc-`).
 */
export function listSessions(): string[] {
  const raw = execSync(
    `tmux -S "${TMUX_SOCK}" list-sessions -F "#{session_name}" 2>/dev/null || echo ""`,
    { encoding: "utf-8" },
  );
  return raw
    .trim()
    .split("\n")
    .filter((s) => s.startsWith("exc-"));
}

/**
 * Count of active Panescale tmux sessions.
 */
export function sessionCount(): number {
  return listSessions().length;
}

/**
 * Check whether a specific tmux session exists.
 */
export function hasSession(name: string): boolean {
  try {
    execSync(`tmux -S "${TMUX_SOCK}" has-session -t "${name}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Capture the visible pane content of a tmux session.
 */
export function capturePane(sessionName: string): string {
  return execSync(
    `tmux -S "${TMUX_SOCK}" capture-pane -t "${sessionName}" -p`,
    { encoding: "utf-8" },
  );
}

/**
 * Send keys to a tmux session (followed by Enter).
 */
export function sendKeys(sessionName: string, keys: string): void {
  execSync(
    `tmux -S "${TMUX_SOCK}" send-keys -t "${sessionName}" "${keys}" Enter`,
  );
}

/**
 * Get a tmux global option value.
 */
export function getOption(option: string): string {
  return execSync(
    `tmux -S "${TMUX_SOCK}" show-options -g ${option}`,
    { encoding: "utf-8" },
  ).trim();
}

/**
 * Kill the tmux server on the Panescale socket (cleanup).
 */
export function killServer(): void {
  execSync(`tmux -S "${TMUX_SOCK}" kill-server 2>/dev/null || true`);
}

/**
 * Poll until a predicate returns true or timeout is reached.
 * @param predicate - Function that returns true when the condition is met.
 * @param timeoutMs - Maximum wait time in milliseconds (default 10000).
 * @param intervalMs - Polling interval in milliseconds (default 500).
 */
export async function waitForSession(
  predicate: () => boolean,
  timeoutMs = 10_000,
  intervalMs = 500,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `waitForSession timed out after ${timeoutMs}ms`,
  );
}
