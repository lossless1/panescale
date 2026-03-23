# Excalicode

## What This Is

Excalicode is a Tauri-based desktop application that combines an infinite spatial canvas with terminal emulation. Users open project folders in a sidebar (with full git integration), then spawn floating terminal windows, notes, images, and file previews onto a pannable/zoomable canvas — like Panescale meets a terminal multiplexer. It supports local terminals and remote SSH connections, with tmux-backed session persistence so the entire canvas layout and terminal state survives app restarts.

## Core Value

Users can visually organize and interact with multiple terminal sessions on an infinite canvas, with layout and session state persisting across restarts via tmux.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Infinite pannable/zoomable canvas for placing and arranging items
- [ ] Floating terminal windows on canvas using xterm.js
- [ ] Double-click on empty canvas space spawns a new terminal in the active project's directory
- [ ] Drag, resize, and reposition terminal windows freely on canvas
- [ ] Left sidebar with folder/project browser
- [ ] Full git UI in sidebar: status, stage/unstage, commit, branches, log, diff viewer, merge, stash
- [ ] SSH connection manager: save/edit connections (host, key, user), spawn remote terminals on canvas
- [ ] Automatic tmux session management (transparent to user) for terminal persistence
- [ ] Canvas layout persistence: one global canvas, terminals tagged by project, restored on reopen
- [ ] Notes/markdown cards on canvas
- [ ] Image placement on canvas
- [ ] File preview cards on canvas (open files from sidebar as read-only previews)
- [ ] Dark and light themes
- [ ] Cross-platform: macOS, Linux, Windows

### Out of Scope

- Code editor / IDE features — this is a terminal and canvas tool, not a code editor
- Mobile support — desktop only
- Cloud sync — local-only persistence for now
- Collaborative editing — single-user application

## Context

- Built with Tauri v2 (Rust backend, webview frontend)
- React frontend for the web layer
- xterm.js for terminal emulation in the browser/webview
- tmux manages terminal sessions on the backend — the user never interacts with tmux directly
- The screenshot reference shows a similar concept: file tree on left, spatial canvas on right with floating cards/windows
- All three major desktop platforms must be supported (macOS, Linux, Windows)
- SSH connections are managed in-app with a connection manager panel, not just reading ~/.ssh/config

## Constraints

- **Tech stack**: Tauri v2 + React + xterm.js — chosen for performance, small bundle size, and native feel
- **Terminal backend**: tmux required for session persistence — must handle tmux lifecycle silently
- **Cross-platform**: Must work on macOS, Linux, and Windows — tmux availability on Windows needs consideration (WSL or alternative)
- **Canvas performance**: Must handle 50+ terminal windows without degrading — canvas rendering must be efficient

## Key Decisions

| Decision                                   | Rationale                                                        | Outcome   |
| ------------------------------------------ | ---------------------------------------------------------------- | --------- |
| Tauri over Electron                        | Smaller bundle, lower memory, Rust backend for performance       | — Pending |
| React for frontend                         | Large ecosystem, user familiarity, strong canvas library options | — Pending |
| xterm.js for terminals                     | Industry standard terminal emulator for web, widely used         | — Pending |
| Automatic tmux (hidden from user)          | Seamless persistence without requiring user to know tmux         | — Pending |
| Global canvas (not per-project)            | Single workspace with project-tagged terminals                   | — Pending |
| SSH connection manager (not ~/.ssh/config) | More user-friendly, in-app management of connections             | — Pending |

---

_Last updated: 2026-03-17 after initialization_
