# Phase 5: SSH + Content Tiles - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Add SSH connection manager with saved connections organized in groups, spawn remote terminal tiles on the canvas via SSH that behave identically to local terminals. Upgrade content tile stubs (from Phase 2) to functional tiles: markdown notes with rich text editing, image tiles with drag-from-filesystem, and file preview tiles with syntax highlighting. Git UI enhancements and terminal polish are out of scope.

</domain>

<decisions>
## Implementation Decisions

### All Areas — Claude's Discretion

User delegated all gray area decisions to Claude. The following are Claude's chosen defaults based on prior patterns, project research, and established codebase conventions:

### SSH Connection Manager
- SSH panel lives as a section within the sidebar (new "SSH" tab in SidebarTabs, or collapsible section in an existing tab — Claude decides)
- Connections stored as JSON in app data directory (alongside canvas state) — not encrypted, just file paths to SSH keys
- Connection form: host, port (default 22), username, key file path (file picker), optional password
- Connections organized in named groups/folders — tree structure in sidebar
- Connect action spawns a remote terminal tile on canvas at center of viewport
- Remote terminal tiles use the same TerminalNode component with an "SSH" badge and remote host in title bar
- Disconnect closes the terminal tile and cleans up the SSH session
- russh crate for pure Rust async SSH (from project research)

### Content Tiles (Upgrading Phase 2 Stubs)
- Markdown note tiles: rich text editing using a lightweight markdown editor (contentEditable with basic formatting — bold, italic, headers, lists, code blocks)
- No full WYSIWYG editor library (TipTap/BlockNote) — keep it simple with a custom minimal editor or enhanced textarea with markdown preview toggle
- Image tiles: read-only display (already working from Phase 2 stub), add drag-from-filesystem support (not just sidebar)
- File preview tiles: read-only with syntax highlighting (already working from Phase 2 stub) — no editing capability
- Content tiles persist their content in canvas state (markdown text, file paths)

### Credential Storage
- SSH key file paths stored in plaintext JSON (user selects key file via file picker)
- No password storage — prompt for password on each connection if key auth fails
- No keychain integration in v1 (deferred to v2)
- Reference: ~/.ssh/config is NOT read automatically (per project init decision — in-app management only)

### Claude's Discretion
- Exact SSH panel layout and tab placement
- Markdown editor implementation approach (contentEditable vs textarea + preview)
- SSH connection timeout and retry behavior
- Image tile zoom/pan within tile
- File preview syntax highlighting library choice
- SSH session keepalive interval

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Codebase
- `src/components/canvas/TerminalNode.tsx` — Terminal tile to extend for SSH terminals (add SSH badge, remote host display)
- `src/components/canvas/Canvas.tsx` — Canvas with nodeTypes registration (NoteNode, ImageNode, FilePreviewNode already registered from Phase 2)
- `src/stores/canvasStore.ts` — Canvas state with add/remove nodes, persistence hooks
- `src/lib/persistence.ts` — Serialization/deserialization with type-aware nodes
- `src/lib/ipc.ts` — IPC wrapper pattern for new SSH commands
- `src-tauri/src/pty/manager.rs` — PtyManager pattern to follow for SSH session management
- `src-tauri/src/platform/tmux.rs` — TmuxBridge pattern for session lifecycle
- `src/components/sidebar/SidebarTabs.tsx` — Tab system to extend with SSH tab
- `src/hooks/usePty.ts` — PTY hook pattern to follow/extend for SSH connections

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TerminalNode.tsx`: Full terminal tile — extend for SSH (same xterm.js, same resize/drag, add SSH metadata)
- `NoteNode.tsx`, `ImageNode.tsx`, `FilePreviewNode.tsx`: Phase 2 read-only stubs — upgrade to functional
- `usePty.ts`: PTY lifecycle hook — extend or create parallel `useSsh.ts` for SSH sessions
- `canvasStore.ts`: Node management + persistence — already handles multiple node types
- `SidebarTabs.tsx`: Tab system — add SSH tab

### Established Patterns
- Rust commands in `src-tauri/src/*/commands.rs` with Tauri IPC
- Zustand stores with persist middleware
- Channel API for streaming data (PTY output pattern)
- Badge colors on terminal tiles (from Phase 3)

### Integration Points
- New `src-tauri/src/ssh/` module following `pty/` and `git/` patterns
- SSH store in `src/stores/sshStore.ts`
- SSH commands registered in `src-tauri/src/lib.rs`
- Content tile upgrades modify existing Phase 2 stub files

</code_context>

<specifics>
## Specific Ideas

- Remote terminals should feel identical to local ones — same drag/resize/focus/search/badges
- SSH badge should be visually distinct (different color from local terminal badges)
- Markdown notes should be simple and fast — not a full document editor
- Keep file previews read-only — editing code files is explicitly out of scope (users have VS Code)

</specifics>

<deferred>
## Deferred Ideas

- SSH key generation and management in-app — tracked as SSH-V2-01
- SFTP file browser for remote connections — tracked as SSH-V2-02
- Keychain integration for SSH passwords — future enhancement
- Full rich text editor (TipTap/BlockNote) for notes — consider if simple editor proves insufficient

</deferred>

---

*Phase: 05-ssh-content-tiles*
*Context gathered: 2026-03-18*
