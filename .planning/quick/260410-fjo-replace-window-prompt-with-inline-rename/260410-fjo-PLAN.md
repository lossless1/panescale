---
phase: quick-260410-fjo
plan: 01
files_modified:
  - src/components/layout/Sidebar.tsx
autonomous: true
---

<objective>
Fix workspace rename — clicking the pencil button still does nothing because `window.prompt` is disabled in Tauri webviews and silently returns null. Replace it with an inline rename input that appears in place of the workspace name.
</objective>

<root-cause>
`window.prompt()` is blocked by default in WKWebView (macOS) and in Tauri's WebKitGTK runtime. The call returns `null` immediately without showing any UI, so `renameWorkspace` is never invoked. The previous fix only addressed event propagation — the actual dialog API was never working.
</root-cause>

<tasks>
- Add `renamingWorkspaceId` + `workspaceRenameValue` state in `Sidebar`
- Pencil button click → set the rename state with the current name pre-filled (no prompt)
- Workspace row renders an autofocused `<input>` in place of the name when its id matches `renamingWorkspaceId`
- Input commits on `Enter` or blur (only if non-empty and different), cancels on `Escape`
- Outside-click closes rename mode too
- Hide delete button + disable row-click switching while that row is in rename mode
</tasks>

<verification>
- `npx tsc --noEmit` passes
- Manual: click pencil → row shows an input with the current name selected → type new name → press Enter → new name persists and the row reverts to display mode
- Manual: click pencil → press Escape → no change
- Manual: click pencil → click outside → dropdown closes, no change
</verification>
