---
quick_id: 260410-dzc
slug: add-workspaces-dropdown-with-new-workspa
date: 2026-04-10
status: complete
---

# Workspaces Dropdown

## What was built

A workspaces feature that lets users maintain multiple independent Panescale canvas layouts and switch between them via a dropdown in the sidebar header.

Each workspace owns its own `nodes`, `viewport`, `maxZIndex`, and `pileOrder`. Creating a new workspace yields an empty canvas. Switching workspaces saves the current canvas snapshot, then loads the target snapshot. All workspaces and the active workspace id persist across app restarts via the existing `canvas-state.json` file, now wrapped in a `WorkspacesFile { version: 2, activeWorkspaceId, workspaces[] }` structure.

Legacy single-canvas `canvas-state.json` files auto-migrate into a default "Workspace 1" on first load — no data loss.

## Files modified

- `src/lib/ipc.ts` — added `Workspace`, `WorkspacesFile` types + `workspacesFileSave`/`workspacesFileLoad` helpers
- `src/stores/workspacesStore.ts` (new) — Zustand store with `hydrate`, `createWorkspace`, `switchWorkspace`, `renameWorkspace`, `deleteWorkspace`, `persistActiveSnapshot`
- `src/lib/persistence.ts` — `forceSave` and debounced subscriber route through `useWorkspacesStore.persistActiveSnapshot()`
- `src/stores/canvasStore.ts` — `loadFromDisk` delegates to workspaces hydrate
- `src/components/layout/Sidebar.tsx` — workspaces dropdown UI rendered as first header element

## Key decisions

- **Wrapper file format (option b from the plan):** a single top-level `WorkspacesFile` containing all workspaces, stored in the same `canvas-state.json` path. No Rust changes required — backend stays format-agnostic.
- **No circular imports:** `persistence.ts` does a dynamic `import()` of `workspacesStore` inside `forceSave`/debounced save. `canvasStore.loadFromDisk` also uses dynamic import since canvasStore would otherwise cycle through persistence → workspacesStore → canvasStore.
- **`bellActiveNodes` explicitly reset** on workspace switch so notifications from one workspace don't bleed into another.
- **UI:** mirrors the existing project selector dropdown exactly for visual consistency — same colors, radius, padding, active-dot indicator, and "+ New" action row.

## Verification

- `npx tsc --noEmit` passes
- Task 3 (manual verification) pending human approval
