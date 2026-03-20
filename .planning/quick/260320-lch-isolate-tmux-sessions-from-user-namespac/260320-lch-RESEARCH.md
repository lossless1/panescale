# Quick Task 260320-lch: Isolate tmux Sessions - Research

**Researched:** 2026-03-20
**Domain:** tmux socket isolation, UI hiding, Rust process spawning
**Confidence:** HIGH

## Summary

Panescale already has a complete tmux integration layer (`src-tauri/src/platform/tmux.rs`) with session create/attach/kill/list/reattach/cleanup, but it is **currently disabled** -- `PtyManager::new()` hardcodes `tmux_available = false`. The task is to (1) re-enable tmux with a separate socket for isolation, (2) hide all tmux UI artifacts, and (3) ensure sessions persist across app restarts.

Every tmux command in `TmuxBridge` (9 call sites) uses `Command::new("tmux")` without a `-S` flag, meaning they hit the default server socket. Switching to a dedicated socket requires adding `-S /path/to/socket` as the first args to every tmux invocation, plus passing `-S` in the `attach_args()` that get spawned as PTY commands.

**Primary recommendation:** Add a `socket_path()` helper to `TmuxBridge` that returns a stable path, then inject `-S` into every `Command::new("tmux")` call. Use the app data directory (`dirs::data_dir()/panescale/tmux.sock`) for the socket. Apply a tmux config block via `-f` or `set-option` commands to hide all UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use a **separate tmux socket** (`tmux -S /path/to/panescale-tmux.sock`) for all Panescale tmux operations
- Sessions will be completely invisible to `tmux ls` (which uses the default server)
- Panescale gets its own tmux server process, isolated from the user's
- **Full process persistence**: running processes continue in tmux and are reattached on app reopen
- No tmux status bar visible
- No tmux prefix key behavior (Ctrl+B should pass through to the shell)
- Terminal should look identical to a regular non-tmux terminal

### Claude's Discretion
- Socket file location (e.g. `/tmp/panescale-tmux-{uid}.sock` or app data dir)
- Tmux config options to hide all UI (set -g status off, set -g prefix None, etc.)
- Session naming convention for matching tiles to tmux sessions

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

## Current Codebase Analysis

### Files to Modify

| File | What Changes | Scope |
|------|-------------|-------|
| `src-tauri/src/platform/tmux.rs` | Add `-S socket` to all 9 tmux Command invocations, add tmux config for UI hiding | Primary |
| `src-tauri/src/pty/manager.rs` | Re-enable tmux (`tmux_available = true` via `TmuxBridge::is_available()`), ensure socket path used in attach_args | Secondary |
| `src-tauri/src/pty/commands.rs` | No changes needed (already has reattach/list/cleanup commands) | None |
| `src/components/canvas/TerminalNode.tsx` | May need to call reattach for restored terminals | Check |

### Current tmux Command Call Sites in `TmuxBridge`

1. `is_available()` -- `tmux -V` (no socket needed, just checks binary)
2. `create_session()` -- `tmux new-session -d -s ...` **needs -S**
3. `create_session()` -- `tmux set-option -t ...` **needs -S**
4. `attach_args()` -- returns `["tmux", "attach-session", "-t", ...]` **needs -S**
5. `list_sessions()` -- `tmux list-sessions -F ...` **needs -S**
6. `kill_session()` -- `tmux kill-session -t ...` **needs -S**
7. `session_exists()` -- `tmux has-session -t ...` **needs -S**
8. `capture_pane()` -- `tmux capture-pane -t ...` **needs -S**
9. `ensure_installed()` -- calls `is_available()` (no socket needed)

### Current Session Naming
Already uses `exc-{tile_id}` prefix -- this is good and should be kept.

## Socket Location Decision

**Recommendation: App data directory** (`dirs::data_dir()/panescale/tmux.sock`)

| Option | Pros | Cons |
|--------|------|------|
| `/tmp/panescale-tmux-{uid}.sock` | Simple, auto-cleaned on reboot | **Breaks persistence across reboots** -- tmux server dies when /tmp is cleaned |
| `dirs::data_dir()/panescale/tmux.sock` | Survives reboots, consistent with existing app data usage | Socket file stays around (harmless) |
| `$XDG_RUNTIME_DIR/panescale-tmux.sock` | Standard for runtime files on Linux | Not available on macOS, needs fallback |

The app already uses `dirs::data_dir()` for state persistence (`src-tauri/src/state/persistence.rs` line 8-9) and SSH config (`src-tauri/src/ssh/config.rs` line 39). Using the same base directory is consistent.

**On macOS:** `~/Library/Application Support/panescale/tmux.sock`
**On Linux:** `~/.local/share/panescale/tmux.sock`

**Important:** tmux socket paths have a Unix limit of ~104 characters. The paths above are well within that limit.

**Note:** The existing code uses `data_dir.join("excalicode")` in persistence.rs but `data_dir.join("panescale")` in ssh/config.rs. The app was renamed to Panescale (per quick task 260318-gro). Use `panescale` for consistency with the SSH config path.

## tmux Config for Hiding All UI

These options must be applied to the Panescale tmux server. Two approaches:

### Approach A: Set options after server start (recommended)
After `create_session` (which starts the server if not running), set global options:

```rust
// Hide status bar
tmux -S {sock} set-option -g status off
// Disable prefix key (pass Ctrl+B through to shell)
tmux -S {sock} set-option -g prefix None
// Unbind all default keys to prevent accidental tmux commands
tmux -S {sock} set-option -g prefix2 None
// Minimize escape delay (prevents lag on Esc key)
tmux -S {sock} set-option -g escape-time 0
// Disable mouse handling (let xterm.js handle it)
tmux -S {sock} set-option -g mouse off
```

### Approach B: Use a config file with `-f`
Write a minimal config file and pass `-f /path/to/panescale-tmux.conf` to every tmux command. This is cleaner but requires managing an additional file.

**Recommendation:** Approach A is simpler -- set options once after the first session is created. Use a `configure_server_once` flag or check. The existing `create_session` already does `set-option` calls, so this pattern is established.

### Complete tmux Config Options

```
set -g status off           # No status bar
set -g prefix None          # No prefix key
set -g prefix2 None         # No secondary prefix
set -g escape-time 0        # No escape delay
set -g mouse off            # Let xterm.js handle mouse
set -g default-terminal "xterm-256color"  # Match TERM env
set -g allow-passthrough on # Allow escape sequences through (if tmux 3.3+)
```

## Reattach Flow on App Restart

The reattach infrastructure already exists:

1. **Frontend:** `TerminalNode.tsx` checks `data.restored === true` on mount
2. **IPC:** `pty_reattach(ptyId, sessionName, cols, rows, onEvent)` command exists
3. **Backend:** `PtyManager::reattach()` calls `TmuxBridge::session_exists()` then `TmuxBridge::attach_args()`

**Current gap:** When tmux is disabled, restored terminals just spawn a fresh shell. To enable reattach:
1. Re-enable tmux in `PtyManager::new()`: `let tmux_available = TmuxBridge::is_available();`
2. The frontend needs to know the tmux session name for each terminal tile. This could be stored in node data or derived from tile ID (`exc-{tile_id}`).
3. On restore, `TerminalNode` should call `pty_reattach` with `exc-{node.id}` as the session name.

**Key insight:** The session name is deterministic (`exc-{tile_id}`), so no additional storage is needed. The frontend can derive it.

## Common Pitfalls

### Pitfall 1: Socket path too long
**What goes wrong:** Unix domain sockets have a ~104 byte path limit. Long usernames or deep directories can exceed this.
**How to avoid:** Validate path length at startup. The `~/Library/Application Support/panescale/tmux.sock` path is ~55 chars, well within limits.

### Pitfall 2: Stale socket file
**What goes wrong:** If the tmux server crashes, the socket file remains but is unusable. `tmux -S sock` commands will fail with "no server running".
**How to avoid:** `is_available()` already handles this. `list_sessions()` returns empty on server not running. `create_session` starts a new server automatically.

### Pitfall 3: Multiple app instances
**What goes wrong:** Two Panescale instances share the same tmux server socket, causing session name collisions.
**How to avoid:** Session names include tile IDs (UUIDs), so collisions are virtually impossible. The shared server is actually fine.

### Pitfall 4: Forgetting `-S` on attach_args
**What goes wrong:** `attach_args()` returns command args that get spawned as a PTY process. If `-S` is missing here, the PTY tries to attach to the default tmux server where the session doesn't exist.
**How to avoid:** `attach_args()` MUST include `-S socket_path` before any other args.

### Pitfall 5: Server options not applied for reattach
**What goes wrong:** On app restart, the tmux server is already running. If config was only applied at first creation, it's fine. But if the server was started by something else (unlikely with separate socket), options might not be set.
**How to avoid:** Apply options in `create_session` AND check/apply in the reattach path.

## Implementation Pattern

### Helper for socket-aware tmux commands

```rust
impl TmuxBridge {
    /// Get the path to the Panescale-dedicated tmux socket
    fn socket_path() -> Result<String, String> {
        let data_dir = dirs::data_dir()
            .ok_or("Could not determine data directory")?;
        let app_dir = data_dir.join("panescale");
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app dir: {}", e))?;
        Ok(app_dir.join("tmux.sock").to_string_lossy().to_string())
    }

    /// Build a tmux Command with the dedicated socket
    fn tmux_cmd() -> Result<Command, String> {
        let sock = Self::socket_path()?;
        let mut cmd = Command::new("tmux");
        cmd.arg("-S").arg(&sock);
        Ok(cmd)
    }
}
```

Then replace every `Command::new("tmux")` (except `is_available`) with `Self::tmux_cmd()?`.

### Updated attach_args

```rust
pub fn attach_args(session_name: &str) -> Result<Vec<String>, String> {
    let sock = Self::socket_path()?;
    Ok(vec![
        "tmux".into(),
        "-S".into(),
        sock,
        "attach-session".into(),
        "-t".into(),
        session_name.into(),
    ])
}
```

Note: `attach_args` return type changes from `Vec<String>` to `Result<Vec<String>, String>` -- callers need updating.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src-tauri/src/platform/tmux.rs` (224 lines)
- Direct codebase analysis of `src-tauri/src/pty/manager.rs` (370 lines)
- Direct codebase analysis of `src-tauri/src/pty/commands.rs` (98 lines)
- Direct codebase analysis of `src-tauri/src/state/persistence.rs` (data_dir pattern)
- tmux man page: `-S socket-path` is the standard mechanism for separate servers

### Confidence
- Socket isolation approach: **HIGH** -- `-S` is the documented tmux mechanism for this exact purpose
- UI hiding options: **HIGH** -- `status off`, `prefix None`, `escape-time 0` are well-established tmux options
- Reattach flow: **HIGH** -- infrastructure already exists in codebase, just needs enabling
- Socket location: **HIGH** -- follows existing `dirs::data_dir()` pattern in the codebase
