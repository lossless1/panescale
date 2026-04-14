export interface ChangelogEntry {
  version: string;
  date: string;
  items: { type: "feature" | "fix" | "improvement"; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.0",
    date: "2026-04-10",
    items: [
      { type: "feature", text: "Workspaces — create multiple independent canvases and switch between them" },
      { type: "feature", text: "Projects scoped per workspace with drag-and-drop reordering" },
      { type: "feature", text: "Keyboard shortcut Cmd/Ctrl+Alt+Up/Down to cycle through terminal piles" },
      { type: "feature", text: "Selectable terminal bell and completion chime sounds" },
      { type: "improvement", text: "Collapse/expand all projects with a single click" },
      { type: "improvement", text: "Inline workspace rename (no more blocked prompts)" },
      { type: "fix", text: "Fixed workspace rename broken by double-click and nested button conflicts" },
    ],
  },
];

const STORAGE_KEY = "panescale-last-seen-version";

/**
 * Returns unseen changelog entries, or null if nothing new.
 * On first install (no stored version), sets the key and returns null
 * so the modal doesn't appear for brand-new users.
 */
export function getUnseenChangelog(): ChangelogEntry[] | null {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored === null) {
    // First install — mark current version as seen, don't show modal
    localStorage.setItem(STORAGE_KEY, CHANGELOG[0].version);
    return null;
  }

  if (stored === CHANGELOG[0].version) {
    return null;
  }

  // Return entries newer than the stored version
  const idx = CHANGELOG.findIndex((e) => e.version === stored);
  if (idx === -1) {
    // Stored version not found in changelog — show all entries
    return CHANGELOG;
  }
  const unseen = CHANGELOG.slice(0, idx);
  return unseen.length > 0 ? unseen : null;
}

/**
 * Marks the latest changelog version as seen so the modal won't reappear.
 */
export function markChangelogSeen(): void {
  localStorage.setItem(STORAGE_KEY, CHANGELOG[0].version);
}
