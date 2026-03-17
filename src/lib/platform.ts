/**
 * Platform detection utilities for cross-platform keyboard shortcuts.
 */

let cachedIsMac: boolean | null = null;

export function isMac(): boolean {
  if (cachedIsMac === null) {
    cachedIsMac = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }
  return cachedIsMac;
}

/** Returns display label for the platform modifier key */
export function modKey(): string {
  return isMac() ? "Cmd" : "Ctrl";
}

/** Returns the KeyboardEvent property name for the platform modifier key */
export function modKeyCode(): "metaKey" | "ctrlKey" {
  return isMac() ? "metaKey" : "ctrlKey";
}
