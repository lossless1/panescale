---
quick_id: 260410-f4u
slug: scope-projects-per-workspace-and-add-vis
date: 2026-04-10
status: complete
---

# Per-Workspace Projects + Visible Rename

## What was built

1. **Projects are now scoped per workspace.** Each workspace remembers its own list of open projects and the active selection. Switching workspaces swaps the Projects tab contents; creating a new workspace yields a clean, empty Projects tab where the user can open folders fresh.
2. **Visible rename button** — pencil icon added next to the delete x on every workspace row in the dropdown. Clicking it opens a prompt to rename. The existing dblclick shortcut still works as a power-user path.

## Files modified

- `src/lib/ipc.ts` — new `WorkspaceProject` type; added `projects` + `activeProjectIndex` fields to `Workspace`
- `src/stores/projectStore.ts`:
  - Exported `Project` type
  - Removed `projects`/`activeProjectIndex` from persist `partialize` (only `viewMode` persists globally now)
  - Added `schedulePersist()` helper that uses `queueMicrotask` + dynamic import to call `useWorkspacesStore.persistActiveSnapshot()` without creating a circular dep
  - Wired all mutating actions (open/close/reorder/setActive) to `schedulePersist()`
- `src/stores/workspacesStore.ts`:
  - New `restoreProjectsToStore()` helper
  - `hydrate`, `switchWorkspace`, `createWorkspace` populate projectStore from the target workspace
  - `persistActiveSnapshot` serializes current projects into the active workspace entry
- `src/components/layout/Sidebar.tsx` — added pencil SVG rename button in each workspace row

## Key decisions

- **Dynamic import + `queueMicrotask`** to break the projectStore ↔ workspacesStore cycle. The microtask delay is harmless — persistence is already debounced.
- **`viewMode` stays globally persisted** — it's a UI preference, not workspace state.
- **New workspaces start with `projects: []`** — the user opens whatever they want inside each workspace context.
- **Rename is now both discoverable (icon) and ergonomic (dblclick)**.

## Verification

- `npx tsc --noEmit` passes
