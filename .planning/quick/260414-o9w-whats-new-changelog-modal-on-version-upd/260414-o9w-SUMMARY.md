---
phase: quick
plan: 260414-o9w
subsystem: ui/changelog
tags: [modal, changelog, version-tracking, localStorage]
dependency_graph:
  requires: []
  provides: [whats-new-modal, changelog-data]
  affects: [AppShell]
tech_stack:
  added: []
  patterns: [localStorage version tracking, self-managing modal]
key_files:
  created:
    - src/lib/changelog.ts
    - src/components/layout/WhatsNewModal.tsx
  modified:
    - src/components/layout/AppShell.tsx
decisions:
  - CHANGELOG array hardcoded in source (not fetched from API) for simplicity
  - Fresh installs skip the modal by immediately writing current version to localStorage
  - Modal always calls markChangelogSeen on any close action (button, backdrop, Escape)
metrics:
  duration_seconds: 89
  completed: "2026-04-14T15:32:27Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260414-o9w: What's New Changelog Modal Summary

What's New modal with localStorage version tracking that auto-displays changelog entries after app updates, following SettingsModal visual patterns.

## Completed Tasks

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Create changelog data module and version tracking | 65eabc0 | src/lib/changelog.ts |
| 2 | Create WhatsNewModal component and wire into AppShell | bd364d2 | src/components/layout/WhatsNewModal.tsx, src/components/layout/AppShell.tsx |

## What Was Built

### Changelog Data Module (`src/lib/changelog.ts`)
- `ChangelogEntry` interface with version, date, and typed items (feature/fix/improvement)
- `CHANGELOG` array with v0.2.0 entries covering workspaces, project reordering, keyboard shortcuts, bell sounds, and bug fixes
- `getUnseenChangelog()` — compares localStorage stored version against latest changelog; returns null for fresh installs and already-seen versions
- `markChangelogSeen()` — writes latest version to localStorage

### WhatsNewModal Component (`src/components/layout/WhatsNewModal.tsx`)
- Self-managing component: checks for unseen entries on mount, renders nothing if none
- Modal styled consistently with SettingsModal: fixed overlay, centered card, close button, 520px max-width
- Colored type badges: blue for features, green for fixes, amber for improvements
- Three dismissal methods: "Got it" button, backdrop click, Escape key — all call `markChangelogSeen()`
- Mounted in AppShell after UpdateToast

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with zero errors from project files
- Modal appears when `panescale-last-seen-version` in localStorage differs from latest changelog version
- Modal does not appear on fresh install (no stored version)
- Modal does not reappear after dismissal (version marked as seen)
