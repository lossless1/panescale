# Domain Pitfalls

**Domain:** Tauri desktop app with infinite canvas, terminal emulation, git integration, and SSH
**Researched:** 2026-03-17
**Confidence:** HIGH (corroborated by Collaborator project's real bug reports + ecosystem evidence)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or fundamental architecture problems.

### Pitfall 1: Terminal Output Saturates the IPC Bridge

**What goes wrong:** Each PTY streams output (potentially megabytes/sec during builds, log tails, or `find /`) through Tauri's IPC to xterm.js. With 10+ terminals active, the serialization overhead and main-thread contention cause visible lag, dropped frames, and frozen UI.

**Why it happens:** Tauri v2 improved IPC with custom protocols and raw payloads, but the event system is explicitly "not designed for low latency or high throughput situations" (Tauri docs). Developers default to `emit()` events for terminal output instead of Channels. Additionally, xterm.js is 100% main-thread-bound -- every `term.write()` call competes for the same thread.

**Consequences:** App becomes unusable when any terminal produces fast output. Users experience input lag across ALL terminals when one is busy. This was the #1 class of bug in similar Tauri terminal projects.

**Prevention:**
- Use `tauri::ipc::Channel` (not the event system) for PTY output streaming. Channels are specifically optimized for ordered, high-throughput data delivery.
- Implement backpressure/flow control: buffer PTY output on the Rust side and batch-send chunks (e.g., every 16ms or 4KB, whichever comes first). xterm.js documents this pattern in their [flow control guide](https://xtermjs.org/docs/guides/flowcontrol/).
- Use the WebGL renderer addon for xterm.js (up to 900% faster than canvas renderer). Fall back to canvas addon only when WebGL2 is unavailable.
- Consider throttling write rate for off-screen (not visible in viewport) terminals.

**Detection:** Profile with 5+ terminals running `yes` or `cat /dev/urandom | xxd` simultaneously. If frame rate drops below 30fps or input latency exceeds 100ms, the architecture is wrong.

**Phase:** Must be solved in Phase 1 (terminal foundation). Retrofitting flow control is painful.

**Confidence:** HIGH -- Tauri IPC docs explicitly warn about this; xterm.js benchmarks confirm main-thread bottleneck.

---

### Pitfall 2: Canvas Event Handling Conflicts with Terminal Input

**What goes wrong:** Pan/zoom gestures on the canvas conflict with terminal keyboard/mouse input. Scrolling inside a terminal accidentally pans the canvas. Clicking a terminal to type causes a canvas drag. Keyboard shortcuts (Ctrl+C) get intercepted by the canvas layer instead of reaching the terminal.

**Why it happens:** Both the canvas (pan/zoom) and xterm.js (terminal input) need to capture mouse events, scroll events, and keyboard events on the same DOM. Without explicit focus management, events propagate unpredictably.

**Consequences:** This is exactly Collaborator bug #13: "Pan/zoom doesn't work when focused on a tile." The inverse is equally bad -- terminals that can't receive input because the canvas swallows events.

**Prevention:**
- Implement a strict two-mode focus system: "canvas mode" (pan/zoom active, terminals non-interactive) and "terminal mode" (clicked terminal captures all input, canvas gestures disabled within tile bounds).
- Use `stopPropagation()` on terminal container mouse/keyboard events when a terminal is focused.
- xterm.js blur/focus: clicking a terminal should call `term.focus()`, clicking canvas background should call `term.blur()` on the active terminal.
- Reserve a dedicated key (Escape) to return from terminal focus to canvas mode.
- For scroll: inside a terminal tile, scroll events go to the terminal scrollback. Outside tiles, scroll events go to canvas zoom. Use event target detection, not bubbling.

**Detection:** Test scenario: focus a terminal, then try to pan the canvas by dragging on empty space. Then try typing in a terminal after panning. Both must work without mode-switching friction.

**Phase:** Phase 1 (canvas + terminal integration). This is foundational UX.

**Confidence:** HIGH -- Collaborator #13 proves this exact bug occurs. Every infinite-canvas-with-embedded-widgets project hits this.

---

### Pitfall 3: State Persistence Race Conditions Cause Data Loss

**What goes wrong:** Canvas layout (tile positions, sizes, which terminals exist) and terminal state (tmux session mapping) get out of sync. Closing a file/terminal updates the canvas state, but the save races with the close -- resulting in a corrupted or empty canvas on next load.

**Why it happens:** Multiple state sources (React canvas state, tmux sessions, filesystem persistence) update independently. Closing a terminal triggers: (1) React state update, (2) tmux session kill, (3) layout save to disk. If the app quits during this sequence, or if save fires before state update completes, the persisted state is inconsistent.

**Consequences:** Collaborator bugs #22 ("Close file, canvas disappears") and #18 ("Closing full-panel doc leaves blank UI") are exactly this pattern. Users lose their entire workspace layout.

**Prevention:**
- Single source of truth: Canvas layout state lives in one place (e.g., a Zustand store) and is the ONLY thing that gets persisted. Terminal sessions are derived from this state on restore.
- Debounced saves with write-ahead intent: on any state change, mark "dirty" immediately, then debounce the actual disk write by 500ms. On app quit, force a final save from the current in-memory state (Tauri's `on_window_event` with `CloseRequested`).
- Atomic file writes: write to a temp file, then rename. Never write directly to the state file (protects against corruption from crashes mid-write).
- On restore: if layout references a tmux session that no longer exists, gracefully recreate it rather than showing a blank tile.

**Detection:** Stress test: rapidly open/close terminals while simultaneously triggering saves. Kill the app process mid-operation and verify state restores correctly.

**Phase:** Phase 1 (persistence architecture). The state model must be designed correctly from day one.

**Confidence:** HIGH -- Collaborator #22 and #18 are direct evidence.

---

### Pitfall 4: Windows Has No tmux -- Cross-Platform Session Persistence Breaks

**What goes wrong:** The entire terminal persistence model depends on tmux, which does not exist on Windows natively. Telling Windows users to install WSL just for terminal persistence is a non-starter for a desktop app.

**Why it happens:** tmux is a Unix-only tool. There is no drop-in equivalent on Windows. psmux (Rust-based, reads .tmux.conf) exists but is young and unproven. ConPTY (Windows native PTY) has no session persistence equivalent.

**Consequences:** Either Windows is a second-class platform (no persistence), or the architecture must abstract session management away from tmux specifically.

**Prevention:**
- Design an abstraction layer from day one: `SessionManager` trait/interface with `TmuxSessionManager` (macOS/Linux) and a custom `WindowsSessionManager` implementations.
- On Windows, implement persistence differently: save terminal state (CWD, environment, scrollback buffer) to disk and respawn processes on restore. This gives "good enough" persistence without tmux.
- Consider whether tmux is truly needed even on macOS/Linux. If the app manages PTY lifecycle directly via portable-pty, persistence can be handled by saving/restoring state rather than delegating to tmux. This simplifies the architecture significantly.
- If tmux is kept: abstract it behind a trait so it can be swapped without rewriting the terminal layer.

**Detection:** Attempt to run the app on Windows early (Phase 1). If the terminal layer hardcodes tmux commands, it is already too late.

**Phase:** Phase 1 (architecture decision). This shapes the entire terminal backend.

**Confidence:** HIGH -- tmux's Unix-only nature is a fact. psmux is too immature (LOW confidence it will work reliably).

---

### Pitfall 5: xterm.js Memory Explosion with Many Instances

**What goes wrong:** Each xterm.js instance consumes significant memory. A 160x24 terminal with 5000-line scrollback uses ~34MB. With 50 terminals (the stated performance target), that is ~1.7GB just for terminal buffers, before accounting for WebGL contexts, DOM nodes, and the canvas itself.

**Why it happens:** xterm.js allocates typed arrays for the entire scrollback buffer upfront. Each instance also creates its own WebGL context (or canvas context), and browsers limit the number of active WebGL contexts (typically 8-16 depending on platform).

**Consequences:** App becomes sluggish or crashes with many terminals. WebGL context limit means only some terminals can use the fast renderer, with the rest falling back to slower canvas or DOM rendering.

**Prevention:**
- Virtualize terminal rendering: only mount xterm.js instances for terminals visible in the canvas viewport. Off-screen terminals should be unmounted (but keep their PTY/tmux session alive). Remount and reattach when scrolled into view.
- Reduce default scrollback to 1000 lines (saves ~75% memory per terminal). Let users increase per-terminal if needed.
- Share a single WebGL context via a custom renderer, or use the canvas addon as a fallback for terminals beyond the WebGL context limit.
- Lazy initialization: don't create xterm.js instances until the terminal tile is first scrolled into view.

**Detection:** Open 20+ terminals and monitor browser process memory in Task Manager / Activity Monitor. If memory exceeds 2GB, virtualization is needed.

**Phase:** Phase 2 (performance optimization), but the virtualization architecture should be planned in Phase 1.

**Confidence:** HIGH -- xterm.js maintainers document these memory characteristics. WebGL context limits are browser-enforced.

---

## Moderate Pitfalls

### Pitfall 6: Startup Initialization Deadlocks

**What goes wrong:** App hangs on "Initializing..." forever. The Tauri backend tries to restore state, connect to tmux, spawn PTYs, and verify SSH connections all during startup, and any failure in this chain blocks the UI from loading.

**Why it happens:** Sequential initialization where each step waits for the previous one. If tmux is not installed, or a saved SSH host is unreachable, or the saved CWD no longer exists, the startup blocks indefinitely.

**Consequences:** Collaborator bug #9: "Infinite hanging on Initializing..." -- users cannot even reach the app.

**Prevention:**
- Show the UI immediately with a skeleton/empty canvas. Initialize terminals and connections asynchronously after the UI is visible.
- Each restoration step must have a timeout (e.g., 5 seconds for tmux attach, 10 seconds for SSH reconnect). On timeout, show the tile in an error/retry state rather than blocking everything.
- Fail gracefully per-tile: if one terminal's tmux session is gone, show "Session expired -- click to create new" instead of blocking all terminals.
- Validate environment (tmux installed, SSH keys accessible) as a non-blocking background check after UI loads.

**Detection:** Uninstall tmux, then launch the app with saved state that references tmux sessions. If it hangs, the initialization is too coupled.

**Phase:** Phase 1 (startup architecture).

**Confidence:** HIGH -- Collaborator #9 is direct evidence.

---

### Pitfall 7: Navigation State Loss in Multi-Panel UI

**What goes wrong:** After opening a file preview, image, or note panel, the user cannot return to their previous view. The navigation stack is lost or was never tracked.

**Why it happens:** Canvas apps often implement panels as direct state replacements rather than maintaining a navigation stack. Opening a full-screen preview replaces the canvas state, and "close" doesn't know what to restore.

**Consequences:** Collaborator bugs #18 ("closing full-panel doc leaves blank UI") and #20 ("after clicking file preview, can't return to original interface").

**Prevention:**
- Never replace canvas state with panel content. Panels (file preview, full-screen docs) should be overlays on top of the canvas, with the canvas state preserved underneath.
- Maintain a simple navigation stack: `[canvas] -> [file preview overlay] -> [back to canvas]`. Close always pops the stack.
- If a panel must be "full screen," use a z-index overlay rather than unmounting the canvas component.

**Detection:** Open a file preview from the sidebar, then close it. The canvas and all terminals must be exactly as they were.

**Phase:** Phase 1 (UI architecture). Getting this wrong means rewriting the panel system later.

**Confidence:** HIGH -- Collaborator #18 and #20 are direct evidence.

---

### Pitfall 8: libgit2 Performance on Large Repositories

**What goes wrong:** Git status, diff, and log operations freeze the UI for seconds on large repos (100K+ files). The sidebar becomes unresponsive while git operations complete.

**Why it happens:** libgit2 (via git2-rs) is significantly slower than CLI git on large repos. `git_status_list` on a 100K-file repo takes ~0.6s vs git CLI's ~0.1s. Clone operations can be 2-3x slower. And libgit2's data structures are not thread-safe, making concurrent operations risky.

**Consequences:** Git sidebar feels sluggish. Users with monorepos or large projects abandon the built-in git UI for the CLI.

**Prevention:**
- Use git CLI (spawned as a Tauri sidecar or via `Command`) instead of libgit2 for all operations. Parse the output. Git CLI is faster, more compatible, and handles edge cases that libgit2 doesn't.
- Run ALL git operations on a background thread/task. Never block the IPC response on a git operation.
- Cache git status and invalidate via filesystem watcher (e.g., notify crate). Don't re-run `git status` on every sidebar render.
- For large diffs, stream chunks to the frontend rather than sending the entire diff at once.

**Detection:** Open a repo with 50K+ files and trigger `git status` from the sidebar. If the UI freezes for more than 200ms, the architecture is wrong.

**Phase:** Phase 2 (git integration), but the decision of CLI vs libgit2 should be made in Phase 1.

**Confidence:** HIGH -- libgit2 performance issues are extensively documented in their issue tracker.

---

### Pitfall 9: SSH Connection Lifecycle Mismanagement

**What goes wrong:** SSH connections drop silently (network change, laptop sleep, server timeout), leaving terminal tiles connected to dead sessions. Reconnection attempts fail or duplicate sessions. SSH key passphrases get stored insecurely.

**Why it happens:** SSH over long-lived connections is inherently fragile. Network interruptions don't always trigger TCP RST. The app must actively detect dead connections and manage reconnection.

**Consequences:** "Dead" terminal tiles that appear connected but don't respond. Users lose remote work because the reconnection created a new session instead of reattaching.

**Prevention:**
- Implement SSH keepalive (ServerAliveInterval equivalent) at the connection level to detect dead connections within 30 seconds.
- On disconnect, show a clear "Disconnected -- Reconnecting..." overlay on the terminal tile. Don't silently fail.
- On reconnect, attempt to reattach to the remote tmux session (if tmux is used remotely). This preserves the remote terminal state.
- For SSH key management: use the OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service) via Tauri's platform APIs. NEVER store private key passphrases in plaintext config files or app state.
- Clear key material from memory after use.

**Detection:** Connect to an SSH host, then disconnect the network for 60 seconds. Reconnect. The terminal should show a reconnection flow, not a frozen or duplicated session.

**Phase:** Phase 3 (SSH feature). But the connection abstraction (local vs remote terminal) should be designed in Phase 1.

**Confidence:** MEDIUM -- SSH lifecycle patterns are well-known, but the specific integration with Tauri + tmux + xterm.js is novel territory.

---

### Pitfall 10: PTY Blocking I/O and Resource Leaks

**What goes wrong:** PTY reads are blocking calls. If not handled correctly, a single hung terminal can block the async runtime, freezing all other terminals. Additionally, failing to clean up PTY file descriptors on terminal close leads to resource exhaustion over time.

**Why it happens:** portable-pty's read operations are synchronous/blocking. Developers wrap them in `tokio::spawn_blocking`, but if the blocking threadpool is exhausted (default 512 threads in tokio), new terminals can't spawn. Closed terminals that don't properly drop their PTY handles leak file descriptors.

**Consequences:** After opening and closing many terminals, the app becomes unable to spawn new ones. Or one frozen terminal (e.g., waiting for password input on a process) blocks the thread pool.

**Prevention:**
- Use dedicated OS threads (not tokio's blocking pool) for PTY I/O. One reader thread per PTY, communicating via channels to the async runtime.
- Implement proper Drop handlers for PTY resources: close the master FD, send SIGHUP to the child process, and wait for it to exit.
- Set a reasonable maximum concurrent terminals (e.g., 100) and enforce it in the UI.
- On terminal close: kill the child process, close the PTY pair, remove from the session manager, and verify the file descriptor is released.

**Detection:** Write a test that opens and closes 200 terminals in sequence, then verify file descriptor count hasn't grown (`lsof -p <pid> | wc -l` on macOS/Linux).

**Phase:** Phase 1 (terminal backend).

**Confidence:** HIGH -- portable-pty's blocking nature is documented; resource leak patterns are well-known in PTY implementations.

---

### Pitfall 11: Cross-Platform Webview Rendering Inconsistencies

**What goes wrong:** CSS, JavaScript APIs, and rendering behavior differ between WebView2 (Windows/Chromium), WKWebView (macOS/WebKit), and WebKitGTK (Linux/WebKit). A canvas that works perfectly on macOS renders incorrectly on Linux or has different scroll behavior on Windows.

**Why it happens:** Unlike Electron (which ships Chromium everywhere), Tauri uses the system webview. WebKitGTK versions vary by Linux distro. WKWebView's JavaScript engine differs from Chromium's. WebView2 has Chromium quirks that WebKit doesn't share.

**Consequences:** "Works on my machine" syndrome. Features tested on macOS break on Linux. CSS Grid or Flexbox behaves slightly differently. WebGL availability/performance varies.

**Prevention:**
- Test on all three platforms from Phase 1. Set up CI with macOS, Windows, and Ubuntu runners.
- Avoid bleeding-edge CSS/JS features. Check caniuse.com targeting Safari 16+ (WKWebView baseline) rather than Chrome latest.
- For WebGL (xterm.js renderer): test the fallback path (canvas addon) on every platform. WebKitGTK's WebGL support is the weakest link.
- Pin minimum WebKitGTK version in Linux packaging requirements.
- Use Tauri's `webview-versions` reference to understand what API surface is available.

**Detection:** Run the app's test suite on a Linux VM with an older WebKitGTK (e.g., Ubuntu 22.04's default). If xterm.js renders incorrectly or the canvas breaks, you've found the gap.

**Phase:** Phase 1 (CI setup), ongoing.

**Confidence:** HIGH -- Tauri docs explicitly warn about this. Community reports confirm cross-platform rendering issues.

---

### Pitfall 12: Symlink and Special Path Handling

**What goes wrong:** File tree sidebar shows incorrect entries, broken links, or infinite loops when the project contains symlinks. Paths with spaces, unicode characters, or deep nesting break on certain platforms.

**Why it happens:** Symlink resolution differs between OSes. Windows symlinks require elevated permissions in some configurations. Recursive directory traversal without cycle detection loops infinitely on circular symlinks.

**Consequences:** Collaborator bug #10: "Symlinks broken."

**Prevention:**
- Use Rust's `std::fs::canonicalize` for symlink resolution, but handle errors gracefully (broken symlinks should show as broken, not crash the tree).
- Implement cycle detection in directory traversal (track visited inodes).
- On Windows: detect whether symlink-following is available; if not, show symlinks as regular entries with an indicator.
- Always use Tauri's path API (platform-aware) rather than string manipulation for path joining.
- Test with: spaces in path, unicode characters, 260+ char paths (Windows MAX_PATH), circular symlinks, broken symlinks.

**Detection:** Create a project directory with a circular symlink and a symlink to a nonexistent target. Open it in the sidebar. It should render without hanging or crashing.

**Phase:** Phase 2 (file tree), but use Tauri's path API from Phase 1.

**Confidence:** HIGH -- Collaborator #10 is direct evidence.

---

## Minor Pitfalls

### Pitfall 13: tmux Configuration Conflicts

**What goes wrong:** User's existing `~/.tmux.conf` conflicts with the app's expected tmux behavior. Custom prefix keys, mouse settings, or status bar configurations cause unexpected behavior.

**Consequences:** Collaborator bug #3: "Bad key error -- tmux.conf sets empty prefix string."

**Prevention:**
- Always launch tmux with `-f /path/to/excalicode-tmux.conf` using a bundled, app-controlled config file. Never rely on the user's tmux.conf.
- Use a unique tmux socket (`-L excalicode`) to isolate app sessions from user's personal tmux sessions.
- Set `TMUX_TMPDIR` to an app-specific directory.

**Phase:** Phase 1 (tmux integration).

**Confidence:** HIGH -- Collaborator #3 is direct evidence.

---

### Pitfall 14: Tauri Command Window Flash on Windows

**What goes wrong:** On Windows, spawning PTY processes via portable-pty briefly flashes a cmd.exe window before the terminal appears in the webview.

**Why it happens:** Windows process creation defaults show a console window. The `CREATE_NO_WINDOW` flag must be explicitly set when spawning child processes.

**Prevention:**
- Set `creation_flags` to `CREATE_NO_WINDOW` (0x08000000) when spawning PTY processes on Windows.
- Test the production build on Windows (dev builds may not exhibit this behavior).

**Phase:** Phase 1 (terminal backend, Windows variant).

**Confidence:** HIGH -- documented in Tauri/wezterm issue trackers.

---

### Pitfall 15: TERM Environment Variable Misconfiguration

**What goes wrong:** Terminal programs don't render correctly -- colors are wrong, `clear` doesn't work, backspace misbehaves, ncurses apps display garbage.

**Why it happens:** The `TERM` environment variable isn't set to `xterm-256color` when spawning the PTY shell, so programs fall back to a dumb terminal mode.

**Prevention:**
- Explicitly set `TERM=xterm-256color` in the PTY spawn environment.
- Verify this works in both dev and release builds (release builds have been reported to behave differently).

**Phase:** Phase 1 (terminal backend).

**Confidence:** HIGH -- documented in tauri-plugin-pty and portable-pty docs.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Terminal foundation (Phase 1) | IPC throughput (#1), PTY blocking (#10), TERM var (#15) | Use Channels not events, dedicated I/O threads, set TERM env |
| Canvas + terminal integration (Phase 1) | Event conflicts (#2), state persistence (#3) | Two-mode focus system, atomic state saves |
| Session persistence (Phase 1) | Windows no tmux (#4), tmux config conflicts (#13) | Abstract session manager, bundled tmux config |
| Startup / restore (Phase 1) | Initialization deadlock (#6), navigation loss (#7) | Async init with timeouts, overlay-based panels |
| Performance scaling (Phase 2) | Memory explosion (#5), WebGL context limits (#5) | Virtualize off-screen terminals, reduce scrollback |
| File tree (Phase 2) | Symlinks (#12), path handling (#12) | Cycle detection, use Tauri path API |
| Git integration (Phase 2) | libgit2 performance (#8) | Use git CLI, background threads, cache with fs watcher |
| SSH (Phase 3) | Connection lifecycle (#9), key security (#9) | Keepalive, OS keychain, reconnection overlay |
| Cross-platform (ongoing) | Webview differences (#11), cmd flash (#14) | Multi-platform CI, test on all three OSes |

---

## Lessons from Collaborator's Bug Reports

| Collaborator Bug | Root Cause Category | Excalicode Pitfall | Prevention |
|---|---|---|---|
| #22: Close file, canvas disappears | State persistence race | Pitfall #3 | Atomic saves, single source of truth |
| #9: Infinite "Initializing..." | Blocking startup | Pitfall #6 | Async init, per-component timeouts |
| #3: Bad key error (tmux.conf) | Shared tmux config | Pitfall #13 | Bundled config, isolated socket |
| #10: Symlinks broken | Path handling | Pitfall #12 | canonicalize + cycle detection |
| #18: Closing panel leaves blank UI | Navigation state loss | Pitfall #7 | Overlay panels, navigation stack |
| #20: Can't return after file preview | Navigation state loss | Pitfall #7 | Same as above |
| #13: Pan/zoom broken when focused on tile | Event handling conflict | Pitfall #2 | Two-mode focus, stopPropagation |

---

## Sources

- [Tauri IPC Improvements Discussion #5690](https://github.com/tauri-apps/tauri/discussions/5690)
- [Tauri v2 IPC Documentation](https://v2.tauri.app/concept/inter-process-communication/)
- [Tauri Calling Frontend from Rust (Channels)](https://v2.tauri.app/develop/calling-frontend/)
- [Tauri Webview Versions Reference](https://v2.tauri.app/reference/webview-versions/)
- [xterm.js Flow Control Guide](https://xtermjs.org/docs/guides/flowcontrol/)
- [xterm.js Buffer Performance #791](https://github.com/xtermjs/xterm.js/issues/791)
- [xterm.js Parser Worker Isolation #3368](https://github.com/xtermjs/xterm.js/issues/3368)
- [xterm.js Canvas Renderer Addon](https://www.npmjs.com/package/@xterm/addon-canvas)
- [xterm.js WebGL Renderer PR #1790](https://github.com/xtermjs/xterm.js/pull/1790)
- [portable-pty Documentation](https://docs.rs/portable-pty)
- [tauri-plugin-pty](https://github.com/Tnze/tauri-plugin-pty)
- [Tauri + portable-pty cmd window Issue #6946](https://github.com/wezterm/wezterm/issues/6946)
- [libgit2 Status Performance #4230](https://github.com/libgit2/libgit2/issues/4230)
- [libgit2 Clone Performance #4674](https://github.com/libgit2/libgit2/issues/4674)
- [Git Concurrency in GitHub Desktop](https://github.blog/2015-10-20-git-concurrency-in-github-desktop/)
- [psmux - Windows Terminal Multiplexer](https://psmux.pages.dev/)
- [Tauri IPC High Rate Streaming Discussion #7146](https://github.com/tauri-apps/tauri/discussions/7146)
- [Tauri Path API](https://v2.tauri.app/reference/javascript/api/namespacepath/)
