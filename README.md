<div align="center">

# Panescale

**Terminals, files, and code — arranged on an infinite canvas.**

[![Release](https://img.shields.io/github/v/release/lossless1/panescale?style=flat-square&color=6366f1)](https://github.com/lossless1/panescale/releases/latest)
[![License](https://img.shields.io/github/license/lossless1/panescale?style=flat-square&color=6366f1)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/lossless1/panescale/release.yml?style=flat-square&label=build)](https://github.com/lossless1/panescale/actions)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-8b5cf6?style=flat-square)]()
[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)
[![Stars](https://img.shields.io/github/stars/lossless1/panescale?style=flat-square&color=6366f1)](https://github.com/lossless1/panescale/stargazers)

<br />

<img src="docs/screenshot.png" alt="Panescale Screenshot" width="800" />

<br />
<br />

[Download](https://github.com/lossless1/panescale/releases/latest) &nbsp;&bull;&nbsp; [Features](#features) &nbsp;&bull;&nbsp; [Install](#install) &nbsp;&bull;&nbsp; [Contributing](CONTRIBUTING.md)

</div>

---

## What is Panescale?

Panescale is a desktop app that gives you an infinite canvas for organizing terminal sessions, files, and notes — all in one place. No tab hunting. No context switching. Just your work, side by side.

- **Infinite canvas** — Pan, zoom, and arrange terminal windows freely on a spatial surface
- **Floating terminals** — Spawn, drag, resize, and layer terminal tiles anywhere on the canvas
- **Persistent sessions** — Close the app, reopen it, pick up exactly where you left off (tmux-backed)
- **Full git UI** — Stage, commit, diff, branch, stash, and resolve conflicts without leaving the app
- **SSH connections** — Connect to remote servers and open terminal tiles on the canvas
- **Content tiles** — Drop markdown notes, images, and file previews alongside your terminals
- **Containers** — Group tiles with colored containers, auto-group by directory

Built with [Tauri v2](https://tauri.app) (Rust) + [React](https://react.dev) + [xterm.js](https://xtermjs.org).

## Features

### Canvas

| Feature | Description |
|---------|-------------|
| **Infinite pan & zoom** | Scroll, Space+drag, middle-click, pinch — 10% to 200% range |
| **Dot grid** | Adaptive grid that scales with zoom level |
| **Magnetic snap** | Tiles snap to grid (~10px threshold), Cmd/Ctrl to override |
| **Alignment guides** | Smart edge/center guides when dragging tiles near each other |
| **Minimap** | Toggle with `M` key, click to navigate |
| **Containers** | Group tiles in named, colored containers — right-click header to rename, change color, or delete |
| **Auto-group** | One-click grouping of terminals by working directory |
| **Color picker** | 12 preset colors + custom color picker for containers |
| **Persistent layout** | Canvas state auto-saves and restores on relaunch |

### Terminals

| Feature | Description |
|---------|-------------|
| **Double-click to spawn** | Double-click empty canvas space to create a terminal |
| **Right-click menu** | Right-click canvas to spawn a terminal, browser, or container |
| **Drag & resize** | Title bar drag + 8-handle resize with live reflow |
| **Search** | Cmd+F to search terminal output |
| **Clickable URLs** | URLs in terminal output open in your browser |
| **Process title** | Title bar shows the currently running process |
| **Badges & rename** | Color-code and name your terminals |
| **Startup commands** | Auto-run commands when terminals restore |
| **Bell notifications** | Audio chime + sidebar pulse when a process completes |
| **tmux persistence** | Sessions survive app restarts (transparent, auto-installed) |

### Sidebar

| Feature | Description |
|---------|-------------|
| **File tree** | Hierarchical + chronological view modes |
| **File operations** | Create, rename, delete, move via right-click menu |
| **Fuzzy search** | Cmd+K to find files instantly |
| **Drag to canvas** | Drop files from sidebar to create content tiles |
| **Terminal list** | See all open terminals, click to navigate |
| **Group by directory** | Group terminals by cwd with colors synced to canvas containers |
| **Sort & reorder** | Sort A-Z or drag to reorder terminals |

### Git

| Feature | Description |
|---------|-------------|
| **Status panel** | Staged / Unstaged / Untracked file groups |
| **Hunk staging** | Stage individual code hunks, not just files |
| **Inline diff** | Unified diff viewer in sidebar |
| **Branches** | Create, switch, delete branches |
| **Commit graph** | SVG topology graph with lane assignment |
| **Stash** | Save, apply, pop, drop stashes |
| **Conflicts** | Accept ours/theirs per file |

### SSH

| Feature | Description |
|---------|-------------|
| **Connection manager** | Save host, port, user, key file |
| **Groups** | Organize connections in folders |
| **Remote terminals** | SSH terminals behave identically to local ones |
| **Remote file browser** | Browse and open files on remote servers |

### Theming

| Feature | Description |
|---------|-------------|
| **Dark & light** | Deep dark default, light theme available |
| **System detection** | Auto-follows OS dark/light preference |
| **Terminal schemes** | One Dark and Dracula presets |
| **Rounded corners** | Native-feeling window on macOS |

## Install

### Download

**[Download the latest release](https://github.com/lossless1/panescale/releases/latest)** for your platform:

| Platform | Format |
|----------|--------|
| macOS (Intel + Apple Silicon) | `.dmg` (universal) |
| Linux | `.AppImage`, `.deb` |
| Windows | `.msi`, `.exe` (NSIS) |

### Build from source

**Prerequisites:** [Rust](https://rustup.rs), [Node.js 20+](https://nodejs.org), platform-specific [Tauri dependencies](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/lossless1/panescale.git
cd panescale
npm install
npm run tauri dev
```

## Stack

| Technology | Purpose |
|------------|---------|
| [Tauri v2](https://tauri.app) | Desktop shell (Rust backend, webview frontend) |
| [React 19](https://react.dev) | UI framework |
| [React Flow](https://reactflow.dev) | Infinite canvas engine |
| [xterm.js](https://xtermjs.org) | Terminal emulation |
| [git2](https://github.com/rust-lang/git2-rs) | Git operations (Rust) |
| [russh](https://github.com/warp-tech/russh) | SSH client (Rust) |
| [Zustand](https://zustand-demo.pmnd.rs) | State management |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [shiki](https://shiki.style) | Syntax highlighting |
| [marked](https://marked.js.org) | Markdown rendering |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Fuzzy file search |
| `Cmd/Ctrl + F` | Search in focused terminal |
| `Cmd/Ctrl + =` / `-` | Zoom in / out |
| `Cmd/Ctrl + 0` | Fit all tiles |
| `M` | Toggle minimap |
| `Escape` | Exit terminal focus / close search |
| `Space + drag` | Pan canvas |
| `Shift + scroll` | Pan canvas (over terminal) |
| `Cmd/Ctrl + Enter` | Commit (in git panel) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)

---

<div align="center">

Built with Rust and TypeScript.

</div>
