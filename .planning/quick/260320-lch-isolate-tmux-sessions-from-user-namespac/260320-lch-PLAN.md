---
phase: quick
plan: 260320-lch
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/platform/tmux.rs
  - src-tauri/src/pty/manager.rs
  - src/hooks/usePty.ts
  - src/components/canvas/TerminalNode.tsx
autonomous: true
requirements: [TMUX-ISOLATE, TMUX-HIDE-UI, TMUX-PERSIST]

must_haves:
  truths:
    - "Panescale tmux sessions are invisible to user's `tmux ls`"
    - "No tmux status bar or prefix key behavior visible in terminals"
    - "Running processes survive app close and reattach on reopen"
    - "Fresh terminals spawn inside tmux sessions transparently"
  artifacts:
    - path: "src-tauri/src/platform/tmux.rs"
      provides: "Socket-isolated TmuxBridge with UI-hiding config"
      contains: "socket_path"
    - path: "src-tauri/src/pty/manager.rs"
      provides: "Re-enabled tmux with reattach-on-restore flow"
      contains: "tmux_available = TmuxBridge::is_available()"
  key_links:
    - from: "src-tauri/src/platform/tmux.rs"
      to: "dirs::data_dir()/panescale/tmux.sock"
      via: "socket_path() helper injected into all tmux commands"
      pattern: "tmux_cmd.*-S"
    - from: "src-tauri/src/pty/manager.rs"
      to: "src-tauri/src/platform/tmux.rs"
      via: "TmuxBridge::attach_args() returns Result with socket path"
      pattern: "attach_args.*Result"
    - from: "src/components/canvas/TerminalNode.tsx"
      to: "src/hooks/usePty.ts"
      via: "reattach() called for restored terminals instead of spawn()"
      pattern: "pty\\.reattach"
---

<objective>
Isolate Panescale's tmux sessions from the user's tmux namespace using a dedicated socket, hide all tmux UI artifacts (status bar, prefix key), and re-enable tmux for full process persistence across app restarts.

Purpose: Terminals should transparently use tmux for session persistence while being completely invisible -- no leaking into user's `tmux ls`, no status bar, no prefix key interference.
Output: Modified tmux.rs with socket isolation + UI hiding, re-enabled tmux in manager.rs, frontend reattach flow for restored terminals.
</objective>

<execution_context>
@/Users/volodymyrsaakian/.claude/get-shit-done/workflows/execute-plan.md
@/Users/volodymyrsaakian/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260320-lch-isolate-tmux-sessions-from-user-namespac/260320-lch-CONTEXT.md
@.planning/quick/260320-lch-isolate-tmux-sessions-from-user-namespac/260320-lch-RESEARCH.md

@src-tauri/src/platform/tmux.rs
@src-tauri/src/pty/manager.rs
@src/hooks/usePty.ts
@src/components/canvas/TerminalNode.tsx
@src/lib/ipc.ts

<interfaces>
<!-- Key types and contracts the executor needs -->

From src-tauri/src/platform/tmux.rs:
```rust
pub struct TmuxBridge;
const SESSION_PREFIX: &str = "exc-";
// Methods: is_available, create_session, attach_args, list_sessions,
//          kill_session, session_exists, capture_pane, ensure_installed,
//          cleanup_orphans, tile_id_from_session
```

From src-tauri/src/pty/manager.rs:
```rust
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    tmux_available: bool,
    tmux_sessions: Arc<Mutex<HashMap<String, String>>>,
}
// Key: line 36 hardcodes `let tmux_available = false;`
// spawn() checks `cfg!(unix) && self.tmux_available` to decide tmux vs direct
// reattach() already exists and calls TmuxBridge::session_exists + attach_args
```

From src/hooks/usePty.ts:
```typescript
interface UsePtyReturn {
  spawn: (cwd: string, cols: number, rows: number, term: Terminal) => Promise<string>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  ptyId: string | null;
  isAlive: boolean;
}
// Missing: reattach method -- needs to be added
```

From src/lib/ipc.ts:
```typescript
export async function ptyReattach(ptyId, sessionName, cols, rows, onEvent): Promise<void>;
// Already exists but not wired into usePty hook
```

From src/components/canvas/TerminalNode.tsx:
```typescript
type TerminalNodeData = {
  cwd: string; shellType: string; restored?: boolean;
  customName?: string; badgeColor?: string; startupCommand?: string;
  savedBuffer?: string; sshConnectionId?: string; ...
};
// Line 184-192: Local PTY always calls pty.spawn(), even when restored
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add socket isolation and UI hiding to TmuxBridge</name>
  <files>src-tauri/src/platform/tmux.rs</files>
  <action>
Modify `TmuxBridge` in `src-tauri/src/platform/tmux.rs`:

1. **Add `socket_path()` helper** that returns the dedicated socket path:
   ```
   fn socket_path() -> Result<String, String>
   ```
   Use `dirs::data_dir().join("panescale").join("tmux.sock")`. Create the directory with `std::fs::create_dir_all` if needed. This is consistent with the existing pattern in `src-tauri/src/ssh/config.rs` line 39 which uses `data_dir.join("panescale")`.

2. **Add `tmux_cmd()` helper** that builds a `Command::new("tmux")` with `-S socket_path` pre-injected:
   ```
   fn tmux_cmd() -> Result<Command, String>
   ```

3. **Replace `Command::new("tmux")` with `Self::tmux_cmd()?`** in these 7 methods:
   - `create_session()` -- both the `new-session` command and the `set-option` command
   - `list_sessions()`
   - `kill_session()`
   - `session_exists()`
   - `capture_pane()`
   Do NOT change `is_available()` -- it just checks if the tmux binary exists.

4. **Change `attach_args()` signature** from `Vec<String>` to `Result<Vec<String>, String>` and inject `-S socket_path` after "tmux":
   ```rust
   pub fn attach_args(session_name: &str) -> Result<Vec<String>, String> {
       let sock = Self::socket_path()?;
       Ok(vec!["tmux".into(), "-S".into(), sock, "attach-session".into(), "-t".into(), session_name.into()])
   }
   ```

5. **Add `configure_server()` method** that sets global tmux options to hide all UI. Call this at the end of `create_session()` after the session is created:
   ```rust
   fn configure_server() -> Result<(), String>
   ```
   Options to set (all via separate `tmux_cmd()?.args([...]).output()` calls):
   - `set-option -g status off` -- hide status bar
   - `set-option -g prefix None` -- disable prefix key (Ctrl+B passes through)
   - `set-option -g prefix2 None` -- disable secondary prefix
   - `set-option -g escape-time 0` -- no escape delay
   - `set-option -g mouse off` -- let xterm.js handle mouse
   Use a `std::sync::Once` or `AtomicBool` to only configure once per process lifetime (the tmux server persists, so options only need setting once).

6. **Update existing tests** for `attach_args` -- it now returns `Result`, so tests need `.unwrap()`. The test `test_attach_args_structure` should check for 6 args (added `-S` and socket path) and `test_session_name_format` similarly.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && cargo test --manifest-path src-tauri/Cargo.toml -p excalicode -- tmux 2>&1 | tail -20</automated>
  </verify>
  <done>All 9 tmux command call sites (except is_available) use dedicated socket via -S flag. attach_args returns Result with socket path. configure_server sets status off, prefix None, escape-time 0. Existing tests updated and passing.</done>
</task>

<task type="auto">
  <name>Task 2: Re-enable tmux in PtyManager and wire frontend reattach</name>
  <files>src-tauri/src/pty/manager.rs, src/hooks/usePty.ts, src/components/canvas/TerminalNode.tsx</files>
  <action>
**Backend -- src-tauri/src/pty/manager.rs:**

1. **Re-enable tmux** on line 36: change `let tmux_available = false;` to `let tmux_available = TmuxBridge::is_available();`

2. **Update spawn()** to handle `attach_args` returning `Result`:
   Line 90: change `TmuxBridge::attach_args(&session_name)` to `TmuxBridge::attach_args(&session_name).map_err(|e| format!("tmux attach_args failed: {}", e))?`

3. **Update reattach()** similarly:
   Line 187: change `TmuxBridge::attach_args(&session_name)` to `TmuxBridge::attach_args(&session_name).map_err(|e| format!("tmux attach_args failed: {}", e))?`

**Frontend -- src/hooks/usePty.ts:**

4. **Add `reattach` method** to the hook that calls `ptyReattach` from ipc.ts. Import `ptyReattach` from `../lib/ipc`. The method signature:
   ```typescript
   reattach: (sessionName: string, cols: number, rows: number, term: Terminal) => Promise<void>;
   ```
   Implementation: create channel via `createChannel(term)`, call `ptyReattach(nodeId, sessionName, cols, rows, channel)` where nodeId is derived from sessionName (strip "exc-" prefix -- or just use sessionName as the ptyId since that's what reattach expects). Set `ptyIdRef`, `isAliveRef`, wire input. Use `spawnLock` to prevent double-reattach.

   Note: The `ptyReattach` IPC takes a `ptyId` (arbitrary string ID) and a `sessionName`. Use the node ID (from the sessionName by stripping "exc-") as the ptyId for consistency with spawn which uses the node ID.

5. **Add reattach to UsePtyReturn interface** and the return object.

**Frontend -- src/components/canvas/TerminalNode.tsx:**

6. **Wire reattach for restored local terminals** (around line 183-193). Change the local PTY branch:
   ```typescript
   } else {
     // Local PTY terminal
     if (nodeData.restored) {
       // Try to reattach to existing tmux session
       const sessionName = `exc-${id}`;
       pty.reattach(sessionName, term.cols, term.rows, term).catch(() => {
         // Session gone -- fall back to fresh spawn
         pty.spawn(cwd, term.cols, term.rows, term);
       });
     } else {
       pty.spawn(cwd, term.cols, term.rows, term).then(() => {
         const cmd = nodeData.startupCommand;
         if (cmd) {
           setTimeout(() => { pty.write(cmd + "\n"); }, 300);
         }
       });
     }
   }
   ```
   This tries reattach first for restored terminals, gracefully falling back to a fresh spawn if the tmux session no longer exists.

7. **Do NOT kill tmux session on unmount** -- the whole point is persistence. In the cleanup function (line 195-201), when tmux is enabled, the PTY attachment should be detached (pty.kill kills the PTY process running `tmux attach`, which detaches but does NOT kill the tmux session). The current `pty.kill()` in manager.rs calls `TmuxBridge::kill_session` -- this needs to change. In `PtyManager::kill()`, do NOT call `TmuxBridge::kill_session` when the terminal is being detached (unmounted). Add a `detach` method to PtyManager that kills the PTY process but leaves the tmux session alive. Expose this as a `pty_detach` IPC command.

   Actually, simpler approach: In `PtyManager::kill()`, only kill the tmux session if explicitly requested. Add a boolean parameter or a separate `detach()` method. The cleanest approach: rename existing behavior -- `kill()` always kills tmux session (for explicit terminal deletion), add `detach()` that only drops the PTY attachment (for unmount/app close).

   In manager.rs, add:
   ```rust
   pub fn detach(&self, id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
       // Same as kill() but does NOT kill the tmux session
       let mut session = self.sessions.lock()...remove(id)...;
       session.child.kill()?;
       drop(session.master);
       drop(session.writer);
       if let Some(handle) = session.reader_handle.take() { let _ = handle.join(); }
       // Do NOT call TmuxBridge::kill_session -- session persists for reattach
       Ok(())
   }
   ```

   In commands.rs, add `pty_detach` command (mirror `pty_kill` but calls `detach()`).

   In ipc.ts, add `ptyDetach(ptyId: string)` function.

   In usePty.ts, add `detach()` method that calls `ptyDetach`. Update the unmount cleanup to call `detach()` instead of `kill()`.

   In TerminalNode.tsx cleanup (line 195-201), call `pty.detach()` instead of `pty.kill()` for local terminals. Keep `pty.kill()` available for explicit terminal deletion (when user removes the node from canvas).

   **Important:** The explicit node deletion path (when user deletes a terminal node) should still call `pty.kill()` to clean up the tmux session. Check how node deletion works -- if it's via unmount, we need another signal. Look at whether there's a delete handler. For now, `detach()` on unmount is correct -- orphan cleanup via `pty_tmux_cleanup` (already exists) handles stale sessions.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && cargo test --manifest-path src-tauri/Cargo.toml -p excalicode 2>&1 | tail -20 && npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>Tmux re-enabled (tmux_available checks real binary). Restored terminals attempt reattach before falling back to fresh spawn. Terminal unmount detaches PTY without killing tmux session. TypeScript compiles clean. Rust tests pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Full tmux session isolation with dedicated socket, hidden UI, and process persistence across app restarts</what-built>
  <how-to-verify>
    1. Run `cargo tauri dev` to start the app
    2. Open a terminal on the canvas, run a long-running command like `sleep 9999` or `top`
    3. Verify: run `tmux ls` in a separate terminal outside the app -- should show "no server running" or only your personal sessions (NOT exc-* sessions)
    4. Verify: run `tmux -S ~/Library/Application\ Support/panescale/tmux.sock ls` -- should show the exc-* session
    5. Verify: no tmux status bar visible at bottom of terminal
    6. Verify: Ctrl+B does NOT trigger tmux prefix (should pass through to shell)
    7. Close the app completely (Cmd+Q)
    8. Reopen the app -- the terminal should reconnect to the running process (sleep/top should still be running, not a fresh shell)
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cargo test --manifest-path src-tauri/Cargo.toml -p excalicode` -- all Rust tests pass
- `npx tsc --noEmit` -- TypeScript compiles without errors
- `tmux ls` from user shell shows no exc-* sessions (isolation works)
- `tmux -S ~/Library/Application\ Support/panescale/tmux.sock ls` shows exc-* sessions
- Terminal has no status bar, no prefix key behavior
- Process survives app restart and reattaches
</verification>

<success_criteria>
- Panescale tmux sessions completely isolated on dedicated socket
- All tmux UI artifacts hidden (status bar, prefix, escape delay)
- tmux re-enabled in PtyManager
- Restored terminals reattach to surviving tmux sessions
- Terminal unmount detaches (not kills) tmux session
- Graceful fallback: if tmux session gone, spawns fresh shell
</success_criteria>

<output>
After completion, create `.planning/quick/260320-lch-isolate-tmux-sessions-from-user-namespac/260320-lch-SUMMARY.md`
</output>
