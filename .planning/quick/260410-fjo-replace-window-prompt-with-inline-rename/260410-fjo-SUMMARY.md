---
quick_id: 260410-fjo
slug: replace-window-prompt-with-inline-rename
date: 2026-04-10
status: complete
---

# Fix: Inline Workspace Rename

## Root cause

`window.prompt()` is disabled in Tauri webviews (WKWebView on macOS, WebKitGTK on Linux). It silently returns `null`, so the previous rename handler was never actually writing a new name. Every prior "fix" around event propagation was chasing a ghost — the dialog call itself never worked.

## Fix

Inline rename input directly in the dropdown row:

- Click the pencil → the row's workspace name is replaced with an autofocused `<input>` seeded with the current name
- `Enter` commits (trimmed, no empty, no-op if unchanged)
- `Escape` cancels
- Blur also commits (matches the canvas tile rename UX)
- While renaming: row-click switch is disabled, delete button is hidden, pencil is hidden
- Clicking outside the dropdown closes rename mode along with the dropdown

## Files modified

- `src/components/layout/Sidebar.tsx` — added `renamingWorkspaceId` / `workspaceRenameValue` state, rewrote the row to conditionally render an input in place of the name, rewired the pencil click to enter rename mode instead of calling `window.prompt`

## Verification

- `npx tsc --noEmit` passes
