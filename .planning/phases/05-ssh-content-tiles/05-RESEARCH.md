# Phase 5: SSH + Content Tiles - Research

**Researched:** 2026-03-18
**Domain:** SSH client integration (russh), content tile upgrading (markdown editing, syntax highlighting, image tiles)
**Confidence:** MEDIUM-HIGH

## Summary

This phase has two independent workstreams: (1) building an SSH connection manager with remote terminal tiles, and (2) upgrading the Phase 2 content tile stubs to functional components. The SSH workstream involves adding a Rust `ssh` module following the existing `pty/` pattern, using the `russh` crate (now at v0.58.0) for async SSH connections with PTY channel support, and bridging remote terminal I/O to the frontend via the same Tauri Channel pattern used for local PTY sessions. The content tile workstream involves upgrading NoteNode to a markdown editor, FilePreviewNode to use syntax highlighting, and ImageNode to accept filesystem drag-and-drop.

The SSH architecture mirrors the existing PtyManager almost exactly: an `SshManager` holds a `HashMap<String, SshSession>`, each session owns a `russh` client handle and channel, and data flows through Tauri Channels as `SshEvent` messages identical in shape to `PtyEvent`. Remote terminal tiles reuse `TerminalNode` with added SSH metadata (host badge, connection status). For content tiles, the stubs already exist and need upgrading -- NoteNode gets a markdown editor (textarea + preview toggle), FilePreviewNode gets shiki-based syntax highlighting, and ImageNode gets filesystem drop support.

**Primary recommendation:** Build the SSH module as a parallel to `pty/` (same manager/commands pattern), reuse TerminalNode for remote terminals with an SSH badge, and keep content tile upgrades lightweight (no heavy editor libraries).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All areas delegated to Claude's discretion. The following were Claude's chosen defaults:

- SSH panel lives as a section within the sidebar (new "SSH" tab in SidebarTabs)
- Connections stored as JSON in app data directory -- not encrypted, just file paths to SSH keys
- Connection form: host, port (default 22), username, key file path (file picker), optional password
- Connections organized in named groups/folders -- tree structure in sidebar
- Connect action spawns a remote terminal tile on canvas at center of viewport
- Remote terminal tiles use the same TerminalNode component with an "SSH" badge and remote host in title bar
- Disconnect closes the terminal tile and cleans up the SSH session
- russh crate for pure Rust async SSH
- Markdown note tiles: rich text editing using a lightweight markdown editor (contentEditable with basic formatting)
- No full WYSIWYG editor library (TipTap/BlockNote) -- keep it simple
- Image tiles: read-only display, add drag-from-filesystem support
- File preview tiles: read-only with syntax highlighting -- no editing
- SSH key file paths stored in plaintext JSON
- No password storage -- prompt for password on each connection if key auth fails
- No keychain integration in v1
- ~/.ssh/config is NOT read automatically (in-app management only)

### Claude's Discretion
- Exact SSH panel layout and tab placement
- Markdown editor implementation approach (contentEditable vs textarea + preview)
- SSH connection timeout and retry behavior
- Image tile zoom/pan within tile
- File preview syntax highlighting library choice
- SSH session keepalive interval

### Deferred Ideas (OUT OF SCOPE)
- SSH key generation and management in-app (SSH-V2-01)
- SFTP file browser for remote connections (SSH-V2-02)
- Keychain integration for SSH passwords
- Full rich text editor (TipTap/BlockNote) for notes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SSH-01 | User can save SSH connections with host, user, key file, and port | sshStore (Zustand) + JSON persistence via state module; connection form in SSH sidebar tab |
| SSH-02 | User can organize SSH connections into groups/folders | Tree data structure in sshStore; collapsible group UI in sidebar |
| SSH-03 | User can spawn a remote terminal tile on the canvas connected via SSH | SshManager Rust module with russh; Channel-based data streaming; TerminalNode reuse |
| SSH-04 | Remote terminal tiles function identically to local terminals (resize, drag, z-index) | TerminalNode already handles all this; add SSH-specific data props and badge |
| CONT-01 | User can create markdown note tiles on the canvas with rich text editing | Upgrade NoteNode stub to textarea + markdown preview toggle |
| CONT-02 | User can place image tiles on the canvas (drag from sidebar or filesystem) | Upgrade ImageNode stub with HTML5 drag-and-drop from filesystem (ondragover/ondrop) |
| CONT-03 | User can open files from sidebar as read-only syntax-highlighted preview tiles | Upgrade FilePreviewNode stub with shiki or react-shiki for highlighting |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| russh | 0.58.0 | Pure Rust async SSH2 client | Tokio-native (matches Tauri runtime), no C deps, maintained by Tabby creator. Built-in `keys` module for loading SSH keys. |
| ssh-key | (russh dep) | SSH key type definitions | Transitive via russh, used for public key verification in Handler trait |
| shiki | 4.0.2 | Syntax highlighting for file previews | TextMate grammar-based (VS Code quality), lazy-loads languages, WASM-powered. Smaller effective bundle than react-syntax-highlighter since languages load on demand. |
| react-shiki | 1.x | React wrapper for shiki | Provides `useShikiHighlighter` hook and `ShikiHighlighter` component for React integration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tauri-apps/plugin-dialog | 2.x (already installed) | File picker for SSH key selection | SSH connection form key file picker |
| @tauri-apps/plugin-fs | 2.x (already installed) | Read SSH connection config, file contents | Loading saved connections, note content |
| zustand | 5.x (already installed) | SSH connection state management | sshStore for connections, groups, active sessions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shiki | react-syntax-highlighter | RSH bundles Prism/hljs client-side, larger initial bundle, fewer languages. shiki is the modern standard. |
| textarea + preview | TipTap/BlockNote | Heavy dependency for simple notes. User explicitly deferred full rich text editors. |
| russh | ssh2-rs | C dependency (libssh2), requires OpenSSL, synchronous API. russh is pure Rust + async. |

**Installation:**
```bash
# Frontend (new)
npm install shiki react-shiki
```

```toml
# Cargo.toml additions
russh = { version = "0.58", features = ["aws-lc-rs"] }
```

**Version verification:**
| Package | Version | Verified | Date |
|---------|---------|----------|------|
| russh | 0.58.0 | cargo search | 2026-03-18 |
| shiki | 4.0.2 | npm view | 2026-03-18 |
| react-shiki | latest | npm registry | 2026-03-18 |

## Architecture Patterns

### Recommended Project Structure
```
src-tauri/src/
  ssh/
    mod.rs           # pub mod commands; pub mod manager; pub use manager::SshManager;
    manager.rs       # SshManager (parallel to PtyManager)
    commands.rs      # Tauri commands: ssh_connect, ssh_disconnect, ssh_write, ssh_resize
    config.rs        # SshConnection, SshGroup serialization structs

src/
  stores/
    sshStore.ts      # Connections, groups, active sessions
  hooks/
    useSsh.ts        # SSH session lifecycle hook (parallel to usePty)
  components/
    sidebar/
      SshPanel.tsx       # SSH connections tree with groups
      SshConnectionForm.tsx  # Add/edit connection form
    canvas/
      NoteNode.tsx       # Upgraded: markdown editor with preview
      ImageNode.tsx      # Upgraded: filesystem drag-drop
      FilePreviewNode.tsx # Upgraded: syntax highlighting
  lib/
    ipc.ts           # Add SSH IPC wrappers
```

### Pattern 1: SshManager (mirrors PtyManager)
**What:** Rust-side manager holding active SSH sessions with write/resize/disconnect operations
**When to use:** All SSH session lifecycle management
**Example:**
```rust
// Source: russh examples/client_exec_interactive.rs + PtyManager pattern
pub struct SshSession {
    handle: russh::client::Handle<SshHandler>,
    channel: russh::Channel<russh::client::Msg>,
    reader_task: Option<tokio::task::JoinHandle<()>>,
}

pub struct SshManager {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl SshManager {
    pub async fn connect(
        &self,
        id: String,
        host: String,
        port: u16,
        user: String,
        key_path: Option<String>,
        password: Option<String>,
        cols: u32,
        rows: u32,
        channel: Channel<SshEvent>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let config = Arc::new(russh::client::Config {
            inactivity_timeout: Some(Duration::from_secs(30)),
            ..Default::default()
        });

        let mut session = russh::client::connect(
            config,
            (host.as_str(), port),
            SshHandler {},
        ).await?;

        // Authenticate
        if let Some(key_path) = key_path {
            let key = russh::keys::load_secret_key(&key_path, password.as_deref())?;
            let auth = session.authenticate_publickey(
                &user,
                PrivateKeyWithHashAlg::new(
                    Arc::new(key),
                    session.best_supported_rsa_hash().await?.flatten(),
                ),
            ).await?;
            if !auth { return Err("Key auth failed".into()); }
        } else if let Some(password) = password {
            let auth = session.authenticate_password(&user, &password).await?;
            if !auth { return Err("Password auth failed".into()); }
        }

        // Open channel with PTY
        let mut ch = session.channel_open_session().await?;
        ch.request_pty(false, "xterm-256color", cols, rows, 0, 0, &[]).await?;
        ch.request_shell(true).await?;

        // Spawn reader task (tokio, not std::thread -- russh is async)
        let reader_task = tokio::spawn(async move {
            loop {
                match ch.wait().await {
                    Some(ChannelMsg::Data { data }) => {
                        let _ = channel.send(SshEvent::Data { bytes: data.to_vec() });
                    }
                    Some(ChannelMsg::ExitStatus { exit_status }) => {
                        let _ = channel.send(SshEvent::Exit { code: Some(exit_status) });
                        break;
                    }
                    Some(ChannelMsg::Eof) | None => {
                        let _ = channel.send(SshEvent::Exit { code: None });
                        break;
                    }
                    _ => {}
                }
            }
        });

        // Store session...
        Ok(())
    }
}
```

### Pattern 2: SSH Event Streaming (mirrors PtyEvent)
**What:** Use identical event shape as PtyEvent so the frontend can reuse the same Channel handler
**When to use:** All SSH terminal data flow
**Example:**
```rust
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum SshEvent {
    Data { bytes: Vec<u8> },
    Exit { code: Option<u32> },
}
```

### Pattern 3: TerminalNode Reuse for SSH
**What:** Extend TerminalNode data type with optional SSH metadata rather than creating a separate SshTerminalNode
**When to use:** SSH terminal tile rendering
**Example:**
```typescript
type TerminalNodeData = {
  cwd: string;
  shellType: string;
  restored?: boolean;
  customName?: string;
  badgeColor?: string;
  startupCommand?: string;
  // SSH extensions
  sshConnectionId?: string;  // If set, this is an SSH terminal
  sshHost?: string;          // Display in title bar
  sshUser?: string;
};
```

### Pattern 4: Markdown Note Editor (textarea + preview)
**What:** Simple textarea with markdown preview toggle, not contentEditable
**When to use:** NoteNode editing
**Rationale:** contentEditable is notoriously buggy across browsers. A textarea with preview toggle is more reliable, simpler to implement, and sufficient for note-taking. Users write markdown; they see rendered output in preview mode.

### Anti-Patterns to Avoid
- **Separate SSH terminal component:** Do NOT create a separate SshTerminalNode.tsx. Reuse TerminalNode with SSH-aware branching in usePty/useSsh hooks. This avoids duplicating all the resize, focus, search, bell, copy/paste logic.
- **Synchronous SSH key loading:** russh key loading can involve password prompting. Never block the main thread. Always use async Tauri commands.
- **Storing passwords:** Per locked decision, never store passwords. Prompt via frontend dialog on each connection.
- **Reading ~/.ssh/config:** Per locked decision, in-app management only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH protocol | Custom SSH implementation | russh 0.58 | SSH2 protocol is enormously complex (key exchange, encryption, channels, agent forwarding) |
| SSH key parsing | Manual PEM/OpenSSH parsers | russh::keys::load_secret_key | Handles PKCS#5, PKCS#8, OpenSSH formats, Ed25519, ECDSA, RSA, encrypted keys |
| Syntax highlighting | Regex-based highlighter | shiki (TextMate grammars) | Accurate tokenization requires grammar files; shiki uses VS Code grammars |
| Terminal emulation | Custom terminal renderer | xterm.js (already in project) | Reuse existing TerminalNode infrastructure |
| Markdown rendering | Custom parser | Built-in or lightweight library | Use browser-native or a tiny library like marked/markdown-it for preview |

**Key insight:** The SSH workstream's value is in the connection manager UI and session lifecycle -- the actual terminal rendering is already solved by Phase 1's TerminalNode. Focus effort on russh integration and the sidebar SSH panel, not on terminal features.

## Common Pitfalls

### Pitfall 1: russh Channel Ownership
**What goes wrong:** russh `Channel` is consumed when you split it for read/write, making it impossible to call `resize` later.
**Why it happens:** The channel's `wait()` method takes `&mut self`, so you cannot concurrently read and write without careful architecture.
**How to avoid:** Keep the `Handle<Client>` (session handle) alive. Use `handle.channel_write_data()` and `handle.window_change()` for writing and resizing instead of channel methods. The channel reader task consumes the channel for `wait()`.
**Warning signs:** "cannot borrow as mutable" errors when trying to resize while reader is active.

### Pitfall 2: SSH Connection Timeout and Error Handling
**What goes wrong:** SSH connections hang indefinitely on unreachable hosts.
**Why it happens:** Default TCP timeout is OS-dependent (can be 30-120 seconds).
**How to avoid:** Set `inactivity_timeout` in russh `Config` (e.g., 10 seconds). Wrap the connect call in `tokio::time::timeout`. Surface connection errors to the frontend as user-visible messages, not silent failures.
**Warning signs:** UI freezes when trying to connect to unavailable hosts.

### Pitfall 3: PTY Size Mismatch on SSH
**What goes wrong:** Remote shell output is garbled or wraps incorrectly.
**Why it happens:** The PTY dimensions requested during `request_pty` don't match the xterm.js terminal size.
**How to avoid:** Pass actual xterm.js cols/rows during connection. Send `window_change` on every resize event (same ResizeObserver pattern as local terminals).
**Warning signs:** `stty size` on remote shows different dimensions than the tile.

### Pitfall 4: Content Tile Persistence Schema
**What goes wrong:** Note content, image paths, and file preview paths are not saved/restored.
**Why it happens:** Current `SerializedNode.data` only has terminal-specific fields (cwd, shellType, etc.).
**How to avoid:** Extend `SerializedNode.data` to include content tile fields: `markdownContent`, `filePath`, `fileName`. Update both `serializeCanvas` and `deserializeCanvas` in persistence.ts.
**Warning signs:** Notes lose content after app restart; images show "file not found" on restore.

### Pitfall 5: SSH Password Prompting Flow
**What goes wrong:** Connection attempt blocks on password needed but no UI to provide it.
**Why it happens:** Key auth fails silently, password auth requires user input.
**How to avoid:** Implement a two-phase connect: (1) attempt key auth, (2) if fails, return error to frontend with "password_required" flag, (3) frontend shows password dialog, (4) retry with password. Use `tauri_plugin_dialog` or a custom modal.
**Warning signs:** Connection just hangs or fails without user feedback.

### Pitfall 6: russh aws-lc-rs vs ring Feature Flag
**What goes wrong:** Build fails on certain platforms due to cryptography backend.
**Why it happens:** russh supports two crypto backends: `aws-lc-rs` (default, AWS's fork of BoringSSL) and `ring`. The `aws-lc-rs` feature requires cmake on some systems.
**How to avoid:** Use `aws-lc-rs` feature (recommended by russh). If build issues arise on CI, try `ring` feature instead. Ensure cmake is available in the build environment.
**Warning signs:** Build errors mentioning `aws-lc-sys` or cmake not found.

## Code Examples

### SSH IPC Wrappers (frontend)
```typescript
// Source: project ipc.ts pattern
export type SshEvent =
  | { event: "data"; data: { bytes: number[] } }
  | { event: "exit"; data: { code: number | null } };

export interface SshConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  keyPath?: string;
  group?: string;
}

export async function sshConnect(
  connectionId: string,
  password: string | null,
  cols: number,
  rows: number,
  onEvent: Channel<SshEvent>,
): Promise<string> {
  return invoke<string>("ssh_connect", { connectionId, password, cols, rows, onEvent });
}

export async function sshWrite(sessionId: string, data: Uint8Array): Promise<void> {
  return invoke("ssh_write", { sessionId, data: Array.from(data) });
}

export async function sshResize(sessionId: string, cols: number, rows: number): Promise<void> {
  return invoke("ssh_resize", { sessionId, cols, rows });
}

export async function sshDisconnect(sessionId: string): Promise<void> {
  return invoke("ssh_disconnect", { sessionId });
}

export async function sshSaveConnections(connections: SshConnectionConfig[]): Promise<void> {
  return invoke("ssh_save_connections", { connections: JSON.stringify(connections) });
}

export async function sshLoadConnections(): Promise<SshConnectionConfig[]> {
  const raw = await invoke<string>("ssh_load_connections");
  return JSON.parse(raw);
}
```

### useSsh Hook (parallel to usePty)
```typescript
// Source: project usePty.ts pattern
export function useSsh(): UseSshReturn {
  const sessionIdRef = useRef<string | null>(null);
  const isAliveRef = useRef(false);

  const createChannel = useCallback((term: Terminal): Channel<SshEvent> => {
    const channel = new Channel<SshEvent>();
    channel.onmessage = (event: SshEvent) => {
      if (event.event === "data") {
        term.write(new Uint8Array(event.data.bytes));
      } else if (event.event === "exit") {
        isAliveRef.current = false;
      }
    };
    return channel;
  }, []);

  const connect = useCallback(async (
    connectionId: string,
    password: string | null,
    cols: number,
    rows: number,
    term: Terminal,
  ) => {
    const channel = createChannel(term);
    const id = await sshConnect(connectionId, password, cols, rows, channel);
    sessionIdRef.current = id;
    isAliveRef.current = true;
    // Wire input
    term.onData((data) => {
      if (sessionIdRef.current && isAliveRef.current) {
        sshWrite(sessionIdRef.current, new TextEncoder().encode(data));
      }
    });
    return id;
  }, [createChannel]);

  // ... write, resize, disconnect following same pattern as usePty
}
```

### Shiki Syntax Highlighting for FilePreviewNode
```typescript
// Source: shiki docs + react-shiki
import { useShikiHighlighter } from 'react-shiki';

function FilePreviewNodeInner({ data }: NodeProps) {
  const { filePath, fileName } = data as FilePreviewNodeData;
  const [content, setContent] = useState("");

  // Detect language from file extension
  const lang = fileName.split('.').pop() || 'text';

  const highlighter = useShikiHighlighter({
    theme: 'one-dark-pro', // or derive from app theme
    lang,
  });

  // ... load content from filePath ...

  return (
    <div>
      <TitleBar fileName={fileName} />
      <div className="nodrag nowheel nopan" style={{ overflow: 'auto' }}>
        {highlighter(content)}
      </div>
    </div>
  );
}
```

### SshManager Tauri Commands
```rust
// Source: project pty/commands.rs pattern
#[tauri::command]
pub async fn ssh_connect(
    connection_id: String,
    password: Option<String>,
    cols: u16,
    rows: u16,
    on_event: Channel<SshEvent>,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<String, String> {
    // Load connection config from saved connections
    let config = ssh_state.get_connection(&connection_id)
        .ok_or("Connection not found")?;

    let session_id = uuid::Uuid::new_v4().to_string();
    ssh_state
        .connect(session_id.clone(), config, password, cols as u32, rows as u32, on_event)
        .await
        .map_err(|e| e.to_string())?;
    Ok(session_id)
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| russh 0.54 (project research) | russh 0.58 (current) | 2025-2026 | New `keys` module built-in; no separate russh-keys crate needed |
| russh-keys separate crate | russh::keys integrated | ~0.55+ | Simpler dependency tree, single crate for SSH + key loading |
| react-syntax-highlighter | shiki / react-shiki | 2024-2025 | WASM-powered, VS Code grammar quality, lazy-loads languages |
| TipTap for notes (STACK.md) | textarea + preview | Phase 5 decision | User deferred heavy editors; simple approach sufficient |

**Deprecated/outdated:**
- `russh-keys 0.46` (from STACK.md): No longer needed. russh 0.58 includes `keys` module directly.
- `react-syntax-highlighter`: Still works but shiki is the modern replacement with better grammar quality.

## Open Questions

1. **russh `aws-lc-rs` build requirement**
   - What we know: russh defaults to aws-lc-rs crypto backend which may need cmake
   - What's unclear: Whether the project's CI/build environment has cmake available
   - Recommendation: Use `aws-lc-rs` (default). If build fails, switch to `features = ["ring"]` instead.

2. **SSH session keepalive**
   - What we know: russh supports `inactivity_timeout` in config
   - What's unclear: Whether we also need application-level keepalive pings for long-lived sessions
   - Recommendation: Set `inactivity_timeout: Some(Duration::from_secs(60))` and add a periodic keepalive channel request every 30 seconds via `handle.send_keepalive(true)`.

3. **Markdown rendering library for NoteNode preview**
   - What we know: Need to render markdown to HTML for preview mode
   - What's unclear: Which lightweight markdown library to use
   - Recommendation: Use `marked` (npm, ~40KB) or `markdown-it` (~100KB). Both are battle-tested. `marked` is simpler and sufficient for notes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SSH-01 | Save/load SSH connections | unit | `npx vitest run src/test/ssh.test.ts -t "save connections"` | Wave 0 |
| SSH-02 | Organize connections in groups | unit | `npx vitest run src/test/ssh.test.ts -t "groups"` | Wave 0 |
| SSH-03 | Spawn remote terminal via SSH | manual-only | Manual: connect to test SSH server | N/A (requires SSH server) |
| SSH-04 | Remote terminal resize/drag/z-index | manual-only | Manual: verify terminal behavior | N/A (UI interaction) |
| CONT-01 | Markdown note editing and persistence | unit | `npx vitest run src/test/content-tiles.test.ts -t "note"` | Wave 0 |
| CONT-02 | Image tile drag from filesystem | manual-only | Manual: drag image file onto canvas | N/A (DnD interaction) |
| CONT-03 | File preview with syntax highlighting | unit | `npx vitest run src/test/content-tiles.test.ts -t "file preview"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/test/ssh.test.ts` -- covers SSH-01, SSH-02 (sshStore CRUD, group management)
- [ ] `src/test/content-tiles.test.ts` -- covers CONT-01, CONT-03 (note persistence, file preview data)
- [ ] Rust tests in `src-tauri/src/ssh/manager.rs` -- SshManager unit tests (struct creation, config serialization)

## Sources

### Primary (HIGH confidence)
- [russh 0.58.0 docs.rs](https://docs.rs/russh/0.58.0/russh/) -- API modules, Handler trait, Channel operations, keys module
- [russh::keys module](https://docs.rs/russh/0.58.0/russh/keys/index.html) -- load_secret_key, key types, agent support
- [russh GitHub examples](https://github.com/Eugeny/russh/blob/main/russh/examples/client_exec_interactive.rs) -- Interactive PTY client pattern
- [russh GitHub simple example](https://github.com/Eugeny/russh/blob/main/russh/examples/client_exec_simple.rs) -- Connect, auth, exec pattern
- Existing codebase: `src-tauri/src/pty/manager.rs`, `src/hooks/usePty.ts`, `src/lib/ipc.ts` -- Patterns to mirror

### Secondary (MEDIUM confidence)
- [shiki documentation](https://shiki.style/) -- Syntax highlighting API, lazy loading, themes
- [react-shiki npm](https://www.npmjs.com/package/react-shiki) -- React integration for shiki
- [cargo search russh](https://crates.io/crates/russh) -- Version 0.58.0 verified via cargo search

### Tertiary (LOW confidence)
- SSH keepalive behavior -- based on general SSH knowledge; verify russh-specific API for `send_keepalive`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- russh 0.58 verified on crates.io, API confirmed via docs.rs, examples reviewed
- Architecture: HIGH -- mirrors existing PtyManager pattern which is proven in the codebase
- Pitfalls: MEDIUM -- russh Channel ownership and resize patterns based on API analysis, not production experience
- Content tiles: HIGH -- straightforward upgrades to existing stubs with well-known libraries

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable domain, russh and shiki are mature)
