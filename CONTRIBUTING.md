# Contributing to Panescale

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- [Rust](https://rustup.rs) (latest stable)
- [Node.js 20+](https://nodejs.org)
- Platform-specific Tauri dependencies: [see Tauri docs](https://v2.tauri.app/start/prerequisites/)
- tmux (for terminal session persistence)

### Getting started

```bash
# Clone the repo
git clone https://github.com/lossless1/panescale.git
cd panescale

# Install dependencies
npm install

# Start development server
npm run tauri dev

# Run tests
npm run test                          # Frontend (vitest)
cd src-tauri && cargo test            # Backend (Rust)
```

### Project structure

```
panescale/
├── src/                          # React frontend
│   ├── components/
│   │   ├── canvas/               # Canvas, TerminalNode, RegionNode, content tiles
│   │   ├── layout/               # AppShell, TitleBar, Sidebar, StatusBar
│   │   └── sidebar/              # FileTree, GitPanel, SshPanel, TerminalList
│   ├── hooks/                    # usePty, useSsh, useFocusMode
│   ├── stores/                   # Zustand stores (canvas, theme, settings, git, ssh)
│   ├── lib/                      # IPC wrappers, persistence, utilities
│   └── styles/                   # Theme definitions, global CSS
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── pty/                  # PTY management (portable-pty)
│       ├── ssh/                  # SSH connections (russh)
│       ├── git/                  # Git operations (git2)
│       ├── fs/                   # File system commands
│       ├── state/                # Canvas state persistence
│       └── platform/             # Shell detection, tmux bridge
├── .github/workflows/            # CI/CD
└── .planning/                    # GSD planning artifacts
```

## How to Contribute

### Reporting bugs

1. Check [existing issues](https://github.com/lossless1/panescale/issues) to avoid duplicates
2. Open a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Platform and version
   - Screenshots if applicable

### Suggesting features

Open an issue with the `enhancement` label. Describe the use case, not just the solution.

### Submitting code

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Run tests: `npm run test && cd src-tauri && cargo test`
5. Ensure TypeScript compiles: `npx tsc --noEmit`
6. Commit with a descriptive message
7. Push and open a PR

### Commit conventions

We use conventional commits:

```
feat: add new feature
fix: fix a bug
chore: maintenance, dependencies
docs: documentation changes
refactor: code restructuring without behavior change
```

### Code style

- **TypeScript**: Follow existing patterns. Zustand for state, typed IPC wrappers.
- **Rust**: Standard `cargo fmt` formatting. Follow existing command patterns in `src-tauri/src/*/commands.rs`.
- **Components**: Functional React components. Prefer hooks over HOCs.
- **No unnecessary abstractions**: Three similar lines > premature helper function.

### Architecture notes

- **Tauri IPC**: Frontend calls Rust via `invoke()` wrappers in `src/lib/ipc.ts`. Terminal data streams via Tauri Channels (not events).
- **Canvas**: React Flow with custom node types. Each tile type is a custom node.
- **State**: Zustand stores. Canvas state persists to disk via atomic Rust writes.
- **Terminal**: xterm.js in the webview, portable-pty in Rust. tmux wraps sessions for persistence.
- **Focus system**: Two modes — canvas mode (pan/zoom) and terminal mode (typing). Click to switch, Escape to exit.

## Getting Help

- Open an issue for bugs or questions
- Check `.planning/` for architecture context and decision history
