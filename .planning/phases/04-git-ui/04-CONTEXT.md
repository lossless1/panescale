# Phase 4: Git UI - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a full git workflow UI in the sidebar: status panel showing staged/unstaged/untracked files, stage/unstage with hunk-level granularity, commit with message, inline unified diff viewer, branch management (create/switch/delete), commit log with graphical topology, stash management, and merge conflict resolution. SSH, content tiles, and terminal features are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Git Panel Layout
- Git UI lives as a third sidebar tab alongside Files and Terminals (in SidebarTabs)
- Status panel organizes files in three grouped sections: Staged, Unstaged, Untracked (VS Code style)
- Stage/unstage via hover +/- icon click on each file (VS Code pattern)

### Diff Viewer
- Inline (unified) diff format — single column with red/green lines
- Diff expands in-place within the sidebar when clicking a changed file
- Hunk-level staging supported — users can stage/unstage individual changed sections within a file

### Commit Log Graph
- Graphical lines + dots for branch topology — colored SVG lines connecting commits (GitKraken/GitLens style)
- Commit log lives in the git sidebar tab as a scrollable section below status panel
- Click a commit to expand inline — shows message, author, date, and list of changed files

### Merge Conflicts (Claude's Discretion)
- GIT-09 not discussed — Claude handles the UX for merge conflict resolution
- Suggestion: start with "accept theirs / accept ours / open in editor" per-file approach
- Full three-way merge editor is a v2 feature

### Claude's Discretion
- Merge conflict resolution UI design
- Commit message input placement and multiline support
- Branch list UI (dropdown, list, or panel)
- Stash list UI and management flow
- Exact SVG graph rendering approach
- Auto-refresh interval for git status polling
- Keyboard shortcuts for git operations

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above. Reference existing codebase for integration patterns.

### Existing Codebase
- `src/components/sidebar/SidebarTabs.tsx` — Tab system to extend with Git tab
- `src/components/sidebar/TerminalList.tsx` — Reference for sidebar list pattern with icons and click actions
- `src/components/sidebar/ContextMenu.tsx` — Context menu pattern to reuse for git file operations
- `src/stores/canvasStore.ts` — Zustand store pattern to follow for git store
- `src/lib/ipc.ts` — IPC wrapper pattern to follow for git commands
- `src-tauri/src/fs/commands.rs` — Rust command pattern to follow for git commands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SidebarTabs.tsx`: Tab system — add "Git" tab with icon
- `ContextMenu.tsx`: Right-click menu — reuse for git file context actions (stage, unstage, discard, diff)
- `TerminalList.tsx`: Sidebar list pattern with click actions — reference for file change list
- `FuzzySearch.tsx`: Cmd+K overlay — could extend for branch search
- Zustand persist pattern from `settingsStore.ts` — for git preferences

### Established Patterns
- Tauri IPC: typed wrappers in `src/lib/ipc.ts` → Rust commands in `src-tauri/src/*/commands.rs`
- Sidebar content lives in `src/components/sidebar/`
- Stores in `src/stores/` with Zustand
- git2 crate already planned in project research (STACK.md) for Rust git operations

### Integration Points
- `SidebarTabs.tsx`: Add "Git" tab — icon + panel component
- `src-tauri/src/lib.rs`: Register new git commands
- `src-tauri/Cargo.toml`: Add git2 dependency
- `projectStore.ts`: Active project path feeds into git repo detection

</code_context>

<specifics>
## Specific Ideas

- VS Code Source Control as the primary reference for status panel UX
- GitKraken for the graphical commit log topology
- Inline diff in sidebar should feel compact but readable — syntax highlighting on diff hunks
- Hunk-level staging is a key differentiator — not just file-level

</specifics>

<deferred>
## Deferred Ideas

- Full three-way merge editor — v2 feature (GIT-V2 territory)
- Interactive rebase UI — already tracked as GIT-V2-01
- Cherry-pick with visual selection — already tracked as GIT-V2-02
- Blame view for files — already tracked as GIT-V2-03

</deferred>

---

*Phase: 04-git-ui*
*Context gathered: 2026-03-18*
