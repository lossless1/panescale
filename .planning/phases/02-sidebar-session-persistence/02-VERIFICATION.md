---
phase: 02-sidebar-session-persistence
verified: 2026-03-18T00:00:00Z
status: gaps_found
score: 13/15 must-haves verified
gaps:
  - truth: "Tile sizes snap to grid (edges align to grid points) during resize"
    status: failed
    reason: "magneticSnapSize is defined in gridSnap.ts but Canvas.tsx has no onNodeResize or onNodeResizeEnd handler. Resize snap is entirely absent."
    artifacts:
      - path: "src/components/canvas/Canvas.tsx"
        issue: "No onNodeResize, onNodeResizeEnd, or magneticSnapSize usage. Only drag snap is implemented."
      - path: "src/lib/gridSnap.ts"
        issue: "magneticSnapSize is defined but never imported by Canvas.tsx"
    missing:
      - "Add handleNodeResize callback using magneticSnapSize in Canvas.tsx"
      - "Add onNodeResize={handleNodeResize} and onNodeResizeEnd={handleNodeResizeEnd} to ReactFlow props"
      - "Import magneticSnapSize from gridSnap.ts in Canvas.tsx"

  - truth: "Snap lines disappear when drag or resize ends or snapping is overridden"
    status: partial
    reason: "Snap lines clear on drag end (onNodeDragStop implemented), but there is no resize end handler to clear snap lines on resize end."
    artifacts:
      - path: "src/components/canvas/Canvas.tsx"
        issue: "handleNodeResizeEnd to call setSnapLines(null) is absent; snap lines will persist after resize ends if any were shown during resize."
    missing:
      - "Add onNodeResizeEnd handler that calls setSnapLines(null)"
---

# Phase 2: Sidebar + Session Persistence Verification Report

**Phase Goal:** Users can browse project files in a sidebar, manage multiple projects, and have terminal sessions (not just layout) survive restarts via transparent tmux integration
**Verified:** 2026-03-18
**Status:** gaps_found — 2 gaps blocking full CANV-04 goal achievement
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can open a folder and see its file tree in the left sidebar | VERIFIED | FileTree.tsx mounts on activeProject, calls fsReadDir, renders FileTreeItem list |
| 2 | User can expand and collapse folders in the file tree | VERIFIED | toggleDir in FileTree.tsx; FileTreeItem receives expanded + onToggle props |
| 3 | User can open a folder to set it as the active project | VERIFIED | handleOpenFolder uses tauri-apps/plugin-dialog open({directory:true}) → openProject |
| 4 | User can switch between multiple open projects | VERIFIED | projectStore.setActiveProject; FileTree shows select when projects.length > 1 |
| 5 | User can toggle between hierarchical tree view and chronological feed sorted by date | VERIFIED | Sidebar.tsx renders FileTree when viewMode==='tree', ChronologicalFeed when viewMode==='feed'; toggle button in header |
| 6 | App detects system dark/light preference and applies it on launch without flicker | VERIFIED | themeStore.ts reads localStorage on module init, resolves synchronously before first render |
| 7 | User can choose System/Dark/Light theme preference (3 options) | VERIFIED | ThemePreference type + setPreference in themeStore.ts |
| 8 | Terminal tiles render with One Dark color scheme by default | VERIFIED | settingsStore defaults colorScheme to 'one-dark'; TerminalNode applies terminalSchemes[colorScheme] |
| 9 | Tile positions snap magnetically to grid when within ~10px of a grid line | VERIFIED | handleNodeDrag in Canvas.tsx applies magneticSnapPosition; Cmd/Ctrl bypasses snap |
| 10 | Tile sizes snap to grid (edges align to grid points) during resize | FAILED | onNodeResize handler absent in Canvas.tsx; magneticSnapSize defined but never called |
| 11 | Snap lines disappear when drag or resize ends or snapping is overridden | PARTIAL | drag end clears snap lines (onNodeDragStop); resize end handler absent |
| 12 | Terminal sessions persist via tmux and reconnect on app restart | VERIFIED | PtyManager.reattach + usePty.reattach + ptyReattach IPC fully implemented |
| 13 | Tmux is completely invisible to the user | VERIFIED | Shell runs inside detached tmux session, PTY attaches to it; no tmux UI exposed |
| 14 | If tmux is not installed, app auto-installs via brew/apt/pacman with progress indicator | VERIFIED | TmuxBridge.ensure_installed + install_via_brew/install_via_linux; ptyEnsureTmux IPC wired in usePty |
| 15 | Closing a terminal tile explicitly kills the tmux session | VERIFIED | PtyManager.kill() removes from tmux_sessions map and calls TmuxBridge::kill_session |

**Score:** 13/15 truths verified (2 failed/partial — both from CANV-04 resize snap)

---

### Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `src-tauri/src/fs/commands.rs` | 01 | VERIFIED | 131 lines; fs_read_dir, fs_create_file, fs_create_dir, fs_rename, fs_delete, fs_move all present |
| `src/stores/projectStore.ts` | 01 | VERIFIED | useProjectStore with openProject, closeProject, setActiveProject, setViewMode, persist middleware |
| `src/components/sidebar/FileTree.tsx` | 01 | VERIFIED | 211 lines; fsReadDir, useProjectStore, expand/collapse, context menu wired |
| `src/components/sidebar/FileTreeItem.tsx` | 01 | VERIFIED | draggable, onRightClick, onToggle, excalicode-file dataTransfer |
| `src/components/sidebar/ChronologicalFeed.tsx` | 01 | VERIFIED | 251 lines; breadth-first recursive collection, Today/Yesterday/This Week/Older grouping |
| `src/stores/themeStore.ts` | 02 | VERIFIED | ThemePreference, resolveTheme, matchMedia listener, localStorage persistence |
| `src/lib/terminalSchemes.ts` | 02 | VERIFIED | One Dark (#282C34) and Dracula (#282A36) ITheme presets |
| `src/stores/settingsStore.ts` | 02 | VERIFIED | colorScheme: TerminalSchemeName field, persist middleware |
| `src/lib/gridSnap.ts` | 03 | VERIFIED | magneticSnap, magneticSnapPosition, magneticSnapSize, GRID_SIZE=20, SNAP_THRESHOLD=10 |
| `src/components/canvas/SnapLines.tsx` | 03 | VERIFIED | Renders dashed var(--accent) lines, pointer-events:none, converts flow→screen coords |
| `src/components/canvas/Canvas.tsx` | 03 | PARTIAL | magneticSnapPosition + onNodeDrag wired; magneticSnapSize / onNodeResize ABSENT |
| `src/components/sidebar/ContextMenu.tsx` | 04 | VERIFIED | create/rename/delete/move IPC calls, click-outside close, inline input |
| `src/lib/fuzzyMatch.ts` | 04 | VERIFIED | fuzzyMatch and fuzzyFilter exported |
| `src/components/sidebar/FuzzySearch.tsx` | 04 | VERIFIED | fuzzyFilter used, fsReadDir for file collection, Cmd+K trigger |
| `src/components/sidebar/TerminalList.tsx` | 04 | VERIFIED | useCanvasStore, filters terminal nodes, setPanToNode on click |
| `src-tauri/src/platform/tmux.rs` | 06 | VERIFIED | 257 lines; TmuxBridge with create_session, attach_args, list_sessions, kill_session, capture_pane, cleanup_orphans, ensure_installed, unit tests |
| `src-tauri/src/pty/manager.rs` | 06 | VERIFIED | tmux_available, tmux_sessions, spawn-in-tmux, reattach, kill-with-cleanup |
| `src/hooks/usePty.ts` | 06 | VERIFIED | reattach method, tmuxAvailableCache, ensureTmuxOnce before first spawn |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| FileTree.tsx | ipc.ts | fsReadDir IPC call | WIRED | Direct import and call on mount + toggleDir |
| FileTree.tsx | projectStore.ts | useProjectStore hook | WIRED | activeProject, openProject, setActiveProject |
| ChronologicalFeed.tsx | ipc.ts | fsReadDir IPC call | WIRED | Breadth-first collectFiles loop |
| Sidebar.tsx | FileTree.tsx | rendered when viewMode === 'tree' | WIRED | Line 156 conditional render |
| Sidebar.tsx | ChronologicalFeed.tsx | rendered when viewMode === 'feed' | WIRED | Line 157 conditional render |
| src-tauri/fs/commands.rs | src-tauri/lib.rs | invoke_handler registration | WIRED | All 6 fs commands in generate_handler! |
| themeStore.ts | window.matchMedia | prefers-color-scheme listener | WIRED | mediaQuery.addEventListener in module scope |
| terminalSchemes.ts | TerminalNode.tsx | ITheme applied to xterm instance | WIRED | terminalSchemes[colorScheme] applied on init and colorScheme change |
| ContextMenu.tsx | ipc.ts | fsCreate/fsRename/fsDelete/fsMove | WIRED | All 5 IPC functions imported and called |
| FuzzySearch.tsx | fuzzyMatch.ts | fuzzyFilter call | WIRED | fuzzyFilter imported and applied on query change |
| TerminalList.tsx | canvasStore.ts | useCanvasStore | WIRED | nodes, setPanToNode, bringToFront |
| Canvas.tsx | gridSnap.ts | magneticSnap in onNodeDrag | WIRED | magneticSnapPosition imported and called |
| Canvas.tsx | gridSnap.ts | magneticSnapSize in onNodeResize | NOT_WIRED | magneticSnapSize defined but never imported/called in Canvas.tsx |
| Canvas.tsx | SnapLines.tsx | SnapLines rendered as overlay | WIRED | <SnapLines snapLines={snapLines} /> inside ReactFlow |
| pty/manager.rs | platform/tmux.rs | TmuxBridge for session lifecycle | WIRED | TmuxBridge imported; spawn uses create_session + attach_args |
| pty/commands.rs | pty/manager.rs | spawn_with_tmux and reattach commands | WIRED | pty_reattach calls manager.reattach |
| usePty.ts | ipc.ts | ptyEnsureTmux called before first spawn | WIRED | ensureTmuxOnce() called in spawn() |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SIDE-01 | 02-01 | Left sidebar shows a file tree for the active project folder | SATISFIED | FileTree.tsx renders file entries from fsReadDir |
| SIDE-02 | 02-01 | User can expand/collapse folders in the file tree | SATISFIED | toggleDir in FileTree; FileTreeItem chevron rotation |
| SIDE-03 | 02-01 | User can open a folder to set it as the active project | SATISFIED | native dialog open({directory:true}) → openProject |
| SIDE-04 | 02-01 | User can switch between multiple open projects/workspaces | SATISFIED | projectStore.setActiveProject; project dropdown in FileTree |
| SIDE-05 | 02-04 | User can create, rename, and delete files/folders from the sidebar | SATISFIED | ContextMenu.tsx calls fsCreateFile, fsCreateDir, fsRename, fsDelete |
| SIDE-06 | 02-04 | User can search/filter files with a fuzzy finder (Cmd+K) | SATISFIED | FuzzySearch.tsx with Cmd+K binding and fuzzyFilter |
| SIDE-07 | 02-05 | User can drag files from the sidebar onto the canvas to create content tiles | SATISFIED | FileTreeItem draggable + Canvas.tsx onDrop + addContentNode |
| SIDE-08 | 02-04 | Sidebar shows a list of all open terminal tiles with name and working directory | SATISFIED | TerminalList.tsx filters terminal nodes, shows name + truncated cwd |
| SIDE-09 | 02-04 | Clicking a terminal entry in the sidebar pans the canvas to that terminal | SATISFIED | setPanToNode in TerminalList; Canvas.tsx watches panToNodeId → setCenter |
| PERS-02 | 02-06 | Terminal sessions persist via tmux and reconnect on app restart | SATISFIED | TmuxBridge + PtyManager reattach + usePty reattach flow |
| THEM-02 | 02-02 | App detects system theme preference and applies it by default | SATISFIED | themeStore reads matchMedia synchronously on init |
| THEM-03 | 02-02 | Terminal color schemes available (Dracula, Solarized, One Dark, etc.) | SATISFIED | terminalSchemes.ts has One Dark + Dracula; wired to TerminalNode |
| THEM-04 | 02-02 | App window has rounded corners on macOS | SATISFIED | tauri.conf.json transparent:true; AppShell.tsx borderRadius:10 + boxShadow |
| CANV-04 | 02-03 | All tile positions and sizes snap to the grid | PARTIAL | Position snap VERIFIED; **size snap during resize NOT IMPLEMENTED** |

**Orphaned requirements check:** No requirements assigned to Phase 2 in REQUIREMENTS.md that are unaccounted for in plan frontmatter.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/canvas/Canvas.tsx` | `magneticSnapSize` imported in gridSnap.ts plan but not imported in Canvas.tsx | Blocker | CANV-04 resize snap not functional |
| `src/hooks/usePty.ts` | ensureTmuxOnce only logs to console; no user-visible progress toast when tmux is being installed | Warning | User sees no feedback during auto-install; plan specified a visible progress indicator |

---

### Human Verification Required

#### 1. Rounded corners visual appearance

**Test:** Launch the app on macOS. Look at the app window.
**Expected:** The window has visibly rounded corners with a shadow (no sharp rectangle).
**Why human:** Requires running the Tauri app; CSS border-radius only takes effect visually with transparent: true in tauri.conf.json.

#### 2. Tmux session persistence end-to-end

**Test:** Open app, spawn a terminal, run a long-running command (e.g., `top`), quit the app, reopen it. The restored terminal should reconnect to the running tmux session showing the same output.
**Expected:** Terminal tile reappears and `top` is still running in it.
**Why human:** Requires running the actual Tauri app with tmux installed; can't verify reattach behavior via static analysis.

#### 3. Cmd+K fuzzy search UI

**Test:** Open a project folder. Press Cmd+K. Type partial file name.
**Expected:** Modal overlay appears, results filter live, Enter navigates to the file.
**Why human:** UX flow and keyboard handling require interactive testing.

#### 4. Drag-to-canvas tile creation

**Test:** Open a project, drag a .md file to the canvas, drag a .png to the canvas.
**Expected:** Note tile and image tile appear at drop positions with file content visible.
**Why human:** HTML5 DnD and tile rendering require interactive testing.

---

### Gaps Summary

Two gaps block full phase goal achievement, both in plan 02-03 (CANV-04 magnetic grid snap):

**Gap 1 — Resize snap not implemented:** `magneticSnapSize` is defined in `gridSnap.ts` but Canvas.tsx has no `onNodeResize` or `onNodeResizeEnd` handlers. The plan required resize snap to make tile edges align to the 20px grid during resize operations. Only drag snap is wired. The CANV-04 requirement states "all tile positions AND sizes snap to the grid."

**Gap 2 — Snap lines not cleared on resize end:** Since no resize handler exists, snap lines shown during drag are the only lines that clear correctly (via `onNodeDragStop`). If resize snap were added, the clearing handler must also be added. This is a corollary of gap 1.

All other phase goals are fully achieved:
- Sidebar file tree with expand/collapse, multi-project switching, chronological feed: complete
- File operations (create/rename/delete/move), fuzzy search (Cmd+K), terminal list with pan-to: complete
- System theme detection, One Dark/Dracula color schemes, transparent rounded window: complete
- Tmux session persistence with auto-install, reattach, orphan cleanup: complete
- Drag-to-canvas for .md/image/code files creating typed tiles: complete

---

*Verified: 2026-03-18*
*Verifier: Claude (gsd-verifier)*
