---
quick_id: 260410-fg0
slug: fix-workspace-rename-broken-by-dblclick-
date: 2026-04-10
status: complete
---

# Fix: Workspace Rename

## Root cause

Three overlapping bugs in the workspaces dropdown rows:

1. **Nested interactive elements.** Rows were `<button>` with a pencil `<span>` nested inside — invalid HTML and flaky event propagation. Clicking the pencil could still fire the parent's `switchWorkspace + setShowWorkspaces(false)` and close the dropdown before `window.prompt` opened.

2. **Broken dblclick rename shortcut.** Double-click still fires two single-click events first. The first click closed the dropdown, unmounting the row, so the dblclick never landed.

3. **Missing `onMouseDown` stopPropagation.** The outside-click detector listens to `mousedown`, and without stopping propagation, it could race with the rename click.

## Fix

- Workspace row is now a `<div role="button">` instead of `<button>`. Valid HTML, clean event handling.
- Dblclick rename shortcut removed — the pencil button is the single rename path.
- Pencil and delete icons stop both `mousedown` and `click` propagation.
- Prompt result is trimmed + empty-checked before calling `renameWorkspace`.
- `renameWorkspace` in `workspacesStore.ts` now calls `persistActiveSnapshot()` instead of writing the file directly. This merges the rename atomically with current canvas/projects state and closes a TOCTOU race window where an in-flight save could overwrite the rename.

## Files modified

- `src/components/layout/Sidebar.tsx`
- `src/stores/workspacesStore.ts`

## Verification

- `npx tsc --noEmit` passes
