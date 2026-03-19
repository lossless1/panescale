# Phase 8: Enhanced SSH Connection Integration - Research

**Researched:** 2026-03-19
**Domain:** SSH connection management, remote file browsing, sidebar UX
**Confidence:** HIGH

## Summary

This phase transforms the existing SSH workflow from a dedicated sidebar tab into an integrated connection experience similar to VS Code's Remote SSH extension. The current implementation already has a complete SSH backend (russh 0.58) with connection management, authentication (key + password), and terminal sessions. The work focuses on three areas: (1) moving SSH connection access from a tab to a button near the Plus icon in the sidebar header, (2) adding ~/.ssh/config host discovery and config file editing, (3) implementing remote folder browsing over SSH so users can select a remote directory to display in the Files sidebar tab.

The remote file browsing can be implemented via SSH exec commands (`ls -la`) rather than SFTP, avoiding the need for the russh-sftp crate (which is pinned to russh ^0.51 and incompatible with the project's russh 0.58). For SSH config parsing on the Rust side, the `ssh2-config` crate (v0.6.2) is the best maintained option. An alternative lightweight approach is to parse `~/.ssh/config` with a simple custom parser since only Host, HostName, User, Port, and IdentityFile fields are needed.

**Primary recommendation:** Use SSH exec-based directory listing (not SFTP) for remote file browsing, parse ~/.ssh/config with the ssh2-config crate, and restructure the sidebar to replace the SSH tab with an SSH connection button in the header area.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| russh | 0.58 | SSH client connections | Already used; supports exec channels for remote commands |
| zustand | (existing) | State management | sshStore already exists, needs extension |
| @tauri-apps/plugin-dialog | 2.x | File dialog for SSH config | Already used in SshConnectionForm |
| @tauri-apps/plugin-shell | 2.x | Open SSH config in editor | Already a dependency |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ssh2-config | 0.6.2 | Parse ~/.ssh/config | Backend: list SSH config hosts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ssh2-config | Custom parser | ssh2-config handles edge cases (Match, Include directives); custom parser is lighter but brittle |
| SSH exec for file listing | russh-sftp 2.1.1 | russh-sftp requires russh ^0.51, incompatible with project's russh 0.58; exec is simpler |
| ssh_cfg crate | ssh2-config | ssh_cfg is async but less maintained; ssh2-config has more downloads and active maintenance |

**Installation (Rust only):**
```toml
# In src-tauri/Cargo.toml
ssh2-config = "0.6"
```

No new frontend dependencies required.

## Architecture Patterns

### Recommended Changes to Project Structure
```
src-tauri/src/ssh/
  commands.rs       # ADD: ssh_list_config_hosts, ssh_read_remote_dir, ssh_open_config_in_editor
  config.rs         # EXTEND: SshConfigHost struct for parsed ~/.ssh/config entries
  manager.rs        # EXTEND: exec_command method for running remote commands
  mod.rs            # No change

src/components/
  layout/Sidebar.tsx           # MODIFY: Remove SSH tab, add SSH button in header
  sidebar/SidebarTabs.tsx      # MODIFY: Remove "ssh" tab option
  sidebar/SshPanel.tsx         # REPURPOSE: Becomes SshConnectionModal (popup/dropdown)
  sidebar/SshConnectionForm.tsx # KEEP: Reuse for manual connection entry
  sidebar/RemoteFileTree.tsx   # NEW: Remote file tree component
  sidebar/SshQuickConnect.tsx  # NEW: SSH config host picker dropdown

src/stores/
  sshStore.ts       # EXTEND: configHosts[], activeRemoteProject, remoteFileEntries
  projectStore.ts   # EXTEND: isRemote flag on Project interface
```

### Pattern 1: SSH Exec for Remote File Listing
**What:** Use `channel_open_session()` + `exec()` instead of SFTP to list remote directories.
**When to use:** For all remote file browsing operations.
**Example:**
```rust
// In manager.rs - new method on SshManager
pub async fn exec_command(
    &self,
    session_id: &str,
    command: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let sessions = self.sessions.lock().await;
    let session = sessions.get(session_id)
        .ok_or_else(|| format!("Session '{}' not found", session_id))?;

    // Open a new exec channel (separate from the PTY channel)
    let ch = session.handle.channel_open_session().await?;
    let (mut read_half, write_half) = ch.split();
    write_half.exec(true, command).await?;

    let mut output = Vec::new();
    loop {
        match read_half.wait().await {
            Some(russh::ChannelMsg::Data { ref data }) => output.extend_from_slice(data),
            Some(russh::ChannelMsg::Eof) | None => break,
            _ => {}
        }
    }
    Ok(String::from_utf8_lossy(&output).to_string())
}
```

### Pattern 2: SSH Config Parsing with ssh2-config
**What:** Parse `~/.ssh/config` to extract host definitions for quick-connect list.
**When to use:** When populating the SSH host picker dropdown.
**Example:**
```rust
// In commands.rs
use ssh2_config::{ParseRule, SshConfig};
use std::io::BufReader;

#[derive(serde::Serialize)]
pub struct SshConfigHost {
    pub host_alias: String,
    pub hostname: Option<String>,
    pub user: Option<String>,
    pub port: Option<u16>,
    pub identity_file: Option<String>,
}

#[tauri::command]
pub fn ssh_list_config_hosts() -> Result<Vec<SshConfigHost>, String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let config_path = home.join(".ssh").join("config");
    if !config_path.exists() {
        return Ok(vec![]);
    }
    let file = std::fs::File::open(&config_path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let config = SshConfig::default()
        .parse(&mut reader, ParseRule::STRICT)
        .map_err(|e| format!("Failed to parse SSH config: {}", e))?;

    // Extract host entries (query each known host alias)
    // Note: ssh2-config requires querying specific hosts, not enumerating
    // We need to parse the file ourselves for host aliases, then query each
    // ... (see implementation note below)
    Ok(vec![])
}
```

### Pattern 3: Remote Project in Sidebar
**What:** Extend projectStore to support remote projects that use SSH exec for file listing instead of local fs_read_dir.
**When to use:** After user selects a remote folder from the SSH file browser.
**Example:**
```typescript
// Extended Project interface
interface Project {
  path: string;
  name: string;
  isRemote?: boolean;
  sshSessionId?: string;  // Links to active SSH session
  sshHost?: string;       // Display name
}
```

### Pattern 4: SSH Button in Sidebar Header
**What:** Replace the SSH tab with a button (SSH icon) next to the Plus icon in the sidebar header. Clicking opens a dropdown/modal with: connect to new host, choose from ~/.ssh/config hosts, edit SSH config.
**When to use:** Primary SSH entry point.

### Anti-Patterns to Avoid
- **Do not use SFTP (russh-sftp):** Version incompatibility with russh 0.58. Exec-based listing is simpler and sufficient for directory browsing.
- **Do not enumerate ssh2-config hosts directly:** The ssh2-config crate's API requires querying by hostname. Parse host aliases from the raw file first, then query each for resolved config.
- **Do not make remote projects use the same fsReadDir IPC:** Create separate `sshReadRemoteDir` IPC to keep local/remote paths cleanly separated.
- **Do not auto-connect SSH on app restore:** Per existing decision (Phase 05), restored SSH terminals prompt for reconnect.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH config parsing | Custom regex parser | ssh2-config crate | Handles Include directives, Match blocks, algorithm append/exclude syntax |
| Remote dir listing output parsing | Regex-based ls parser | JSON output via `ls` command or structured format | `ls -la` output varies by OS; use `stat` or `find -printf` for structured output |
| SSH host key verification | Custom known_hosts file | Keep existing TOFU model | Already implemented, appropriate for personal dev tool |

**Key insight:** The remote directory listing is the trickiest part. Parsing `ls -la` output is fragile across different Linux/macOS/BSD systems. Use `find <path> -maxdepth 1 -printf '%y\t%s\t%f\n'` on Linux or a JSON-producing command. Alternatively, use a simple approach: `ls -1aF <path>` where `/` suffix indicates directories, then strip suffixes. This is good enough for a file picker.

## Common Pitfalls

### Pitfall 1: SSH Session Reuse for Exec
**What goes wrong:** Opening an exec channel on an existing SSH session that already has a PTY channel active. The exec channel must be a NEW channel on the same connection handle.
**Why it happens:** Confusion between SSH channels and SSH sessions. One SSH connection (Handle) supports multiple channels.
**How to avoid:** Call `handle.channel_open_session()` for each exec command. Keep the PTY channel separate.
**Warning signs:** "Channel already in use" errors or exec output appearing in the terminal.

### Pitfall 2: russh Handle Borrow in Locked Mutex
**What goes wrong:** Holding a lock on `sessions` HashMap while awaiting an exec command causes deadlock.
**Why it happens:** The exec operation is async and needs the Handle, but Handle is inside the locked HashMap.
**How to avoid:** Clone the Handle before releasing the lock, or restructure to store Handle in an Arc.
**Warning signs:** App freezes when browsing remote files while terminal is active.

### Pitfall 3: ssh2-config Host Enumeration
**What goes wrong:** The ssh2-config crate does not provide an iterator over all defined hosts. It only supports querying by host alias.
**Why it happens:** SSH config resolution is host-specific (first-match wins with wildcard patterns).
**How to avoid:** Read the raw ~/.ssh/config file to extract `Host` lines, filter out wildcards (`*`), then query each through ssh2-config for resolved params.
**Warning signs:** Empty host list despite having a valid ~/.ssh/config.

### Pitfall 4: Remote Path Handling
**What goes wrong:** Using Windows-style paths or local path logic for remote POSIX paths.
**Why it happens:** Project currently uses local OS paths throughout.
**How to avoid:** Remote paths are always POSIX (`/`-separated). Never join remote paths with `std::path::Path` in Rust. Use string concatenation or a dedicated remote path type.
**Warning signs:** Broken file tree on remote Linux hosts when developing on macOS.

### Pitfall 5: SSH Connection State vs. Session State
**What goes wrong:** Mixing up "connection config" (saved credentials) with "active session" (live SSH connection) when browsing files.
**Why it happens:** File browsing needs a live session, but the connection flow currently goes straight to PTY.
**How to avoid:** Add a "connect without PTY" flow that establishes an SSH session for file browsing before/without spawning a terminal.
**Warning signs:** User must open a terminal before they can browse remote files.

## Code Examples

### Remote Directory Listing via Exec
```rust
// Recommended: structured output format for cross-platform compatibility
// Use this command on the remote server:
const REMOTE_LS_CMD: &str = r#"
    for f in "$1"/*; do
        if [ -d "$f" ]; then
            echo "d $(basename "$f")"
        elif [ -f "$f" ]; then
            echo "f $(basename "$f")"
        fi
    done
"#;

// Simpler alternative that works on most POSIX systems:
// "ls -1pA <path>" -- directories end with /, everything else is a file
```

### Opening SSH Config in System Editor
```rust
#[tauri::command]
pub fn ssh_open_config_in_editor() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let config_path = home.join(".ssh").join("config");

    // Ensure the file exists (create empty if not)
    if !config_path.exists() {
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&config_path, "# SSH Config\n").map_err(|e| e.to_string())?;
    }

    // Use tauri-plugin-shell's open() or std::process::Command
    open::that(&config_path).map_err(|e| e.to_string())
}
```

### SSH Connection Modal Component Structure
```tsx
// SshQuickConnect dropdown near the Plus button
function SshQuickConnect({ onClose }: { onClose: () => void }) {
  const configHosts = useSshStore(s => s.configHosts);
  const savedConnections = useSshStore(s => s.connections);

  return (
    <div className="ssh-dropdown">
      <section>
        <h4>SSH Config Hosts</h4>
        {configHosts.map(host => (
          <button key={host.host_alias} onClick={() => connectToHost(host)}>
            {host.host_alias} ({host.hostname || host.host_alias})
          </button>
        ))}
      </section>
      <section>
        <h4>Saved Connections</h4>
        {savedConnections.map(conn => (
          <button key={conn.id} onClick={() => connectToSaved(conn)}>
            {conn.name} ({conn.user}@{conn.host})
          </button>
        ))}
      </section>
      <hr />
      <button onClick={openNewConnectionForm}>+ New Connection...</button>
      <button onClick={openSshConfig}>Edit SSH Config</button>
    </div>
  );
}
```

### Remote Project Indicator in FileTree
```tsx
// In FileTree or a new RemoteFileTree component
function RemoteFileTree({ sessionId, remotePath }: Props) {
  const [entries, setEntries] = useState<RemoteFileEntry[]>([]);

  useEffect(() => {
    sshReadRemoteDir(sessionId, remotePath).then(setEntries);
  }, [sessionId, remotePath]);

  // Render with remote indicator icon
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dedicated SSH tab in sidebar | SSH button in header (VS Code model) | This phase | Cleaner UX, SSH is an access method not a category |
| Manual-only SSH connections | ~/.ssh/config auto-discovery | This phase | Faster workflow for users with many servers |
| SSH = terminal only | SSH = terminal + file browsing | This phase | Enables remote development workflow |

## Open Questions

1. **Remote file tree: separate component or extend FileTree?**
   - What we know: FileTree uses local fsReadDir. Remote needs sshReadRemoteDir with different error handling (network errors, disconnection).
   - What's unclear: Whether to create RemoteFileTree or add isRemote branch to FileTree.
   - Recommendation: Create separate RemoteFileTree component. The data fetching, error states, and interaction model differ enough to warrant separation. Share styling via shared CSS variables.

2. **SSH session lifecycle for file browsing**
   - What we know: Current SSH connects directly into a PTY shell. File browsing needs exec channels.
   - What's unclear: Should file browsing reuse the same SSH Handle as an existing terminal, or establish a separate connection?
   - Recommendation: Reuse the existing SSH Handle (connection). Open exec channels on the same connection for file listing. This avoids double authentication and is how SSH multiplexing works.

3. **How to mark remote folders distinctly**
   - What we know: Phase description says "mark remote folders distinctly from local ones."
   - What's unclear: Visual indicator style.
   - Recommendation: Add a small "SSH" badge/icon next to the project name in the dropdown, and use a subtle color tint (e.g., blue-ish border) on the file tree when showing remote files. Show `user@host:path` format in the project dropdown.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) + cargo test (Rust) |
| Config file | vitest.config.ts, Cargo.toml |
| Quick run command | `npm run test` / `cargo test -p panescale` |
| Full suite command | `npm run test && cargo test -p panescale` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SSH-ENH-01 | SSH button appears in sidebar header (not as tab) | e2e | `npx playwright test e2e/ssh-sidebar.spec.ts` | No - Wave 0 |
| SSH-ENH-02 | Parse ~/.ssh/config and list hosts | unit (Rust) | `cargo test -p panescale ssh::config::tests` | Partially (config.rs has tests) |
| SSH-ENH-03 | Connect to config host and browse remote dirs | integration | Manual - requires SSH server | Manual-only |
| SSH-ENH-04 | Remote folder shown in Files tab with distinct indicator | e2e | `npx playwright test e2e/ssh-remote-files.spec.ts` | No - Wave 0 |
| SSH-ENH-05 | Open SSH config file in system editor | unit (Rust) | `cargo test -p panescale ssh::commands::tests` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test -p panescale` + `npm run test`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/ssh/config.rs` -- extend existing tests for SSH config parsing
- [ ] `src/test/ssh-store.test.ts` -- covers sshStore extensions for configHosts and remote projects
- [ ] SSH integration tests are manual-only (require real SSH server) -- acceptable for this domain

## Sources

### Primary (HIGH confidence)
- Codebase analysis: src-tauri/src/ssh/ (commands.rs, config.rs, manager.rs) -- full existing SSH implementation
- Codebase analysis: src/components/sidebar/ (SshPanel.tsx, SshConnectionForm.tsx, SidebarTabs.tsx, Sidebar.tsx) -- current sidebar layout
- Codebase analysis: src/stores/sshStore.ts, src/hooks/useSsh.ts -- frontend SSH state and hook
- Cargo.toml: russh 0.58 with aws-lc-rs feature confirmed

### Secondary (MEDIUM confidence)
- [ssh2-config crate](https://crates.io/crates/ssh2-config) -- v0.6.2, parses SSH config with query-by-host API
- [russh-sftp](https://crates.io/crates/russh-sftp) -- v2.1.1 depends on russh ^0.51 (incompatible with 0.58)
- [deps.rs/crate/russh-sftp/2.1.1](https://deps.rs/crate/russh-sftp/2.1.1) -- confirmed russh ^0.51 dependency

### Tertiary (LOW confidence)
- SSH exec-based file listing patterns -- based on general SSH knowledge, not library-specific docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- builds entirely on existing codebase, one small new Rust dependency
- Architecture: HIGH -- sidebar restructure is straightforward; SSH exec channels are well-understood
- Pitfalls: HIGH -- identified from actual codebase analysis (russh-sftp incompatibility, Handle borrow patterns, ssh2-config enumeration gap)
- Remote file browsing: MEDIUM -- exec-based approach is simple but cross-platform output parsing needs care

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
