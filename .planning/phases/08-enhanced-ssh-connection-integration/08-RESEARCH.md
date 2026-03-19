# Phase 8: Enhanced SSH Connection Integration - Research

**Researched:** 2026-03-19 (re-research)
**Domain:** SSH connection management, remote file browsing, sidebar UX restructure
**Confidence:** HIGH

## Summary

This phase transforms the SSH connection workflow from a dedicated sidebar tab into an integrated quick-connect experience. The existing implementation already has a fully working SSH backend (russh 0.58 with aws-lc-rs) with connection CRUD, key + password auth cascade, PTY channel sessions, and terminal tiles on canvas. The work involves three areas: (1) removing the SSH tab and adding a globe/terminal icon button in the sidebar header that opens a quick-connect dropdown, (2) parsing ~/.ssh/config on the Rust side to discover hosts and presenting them alongside saved connections, (3) implementing remote directory browsing via SSH exec channels so users can view remote file trees in the Files tab.

Remote file browsing uses SSH exec channels (not SFTP), because russh-sftp 2.1.1 requires russh ^0.51 and is incompatible with the project's russh 0.58. For SSH config parsing, the `ssh2-config` crate v0.7.0 provides `get_hosts()` for host enumeration and `query()` for resolved parameter lookup. The UI spec is fully defined in 08-UI-SPEC.md with exact colors, spacing, copywriting, and component contracts.

**Primary recommendation:** Use ssh2-config 0.7.0 for ~/.ssh/config parsing (it provides `get_hosts()` to enumerate all defined hosts), implement remote directory listing via SSH exec (`ls -1pA`), and restructure the sidebar header to add an SSH quick-connect button between the view-mode toggle and the Plus (open folder) button.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SSH-ENH-01 | SSH tab removed from sidebar; SSH globe button in header opens quick-connect dropdown | Sidebar.tsx activeTab union type drops "ssh"; SidebarTabs.tsx tabs array drops SSH entry; new SshQuickConnect dropdown anchored to new header button. UI-SPEC defines exact placement, icon, hover/active states. |
| SSH-ENH-02 | Dropdown lists ~/.ssh/config hosts and saved connections for one-click terminal spawning | ssh2-config 0.7.0 `get_hosts()` enumerates Host entries; `query()` resolves HostName/User/Port/IdentityFile. New Rust command `ssh_list_config_hosts`. Saved connections already in sshStore. |
| SSH-ENH-03 | Users can browse remote directories in Files tab after connecting via SSH | SSH exec channel via `handle.channel_open_session()` + `exec()` runs `ls -1pA <path>` on remote. New Rust command `ssh_read_remote_dir`. New RemoteFileTree component. |
| SSH-ENH-04 | Remote projects visually distinct (SSH badge, accent left border) | UI-SPEC defines: "SSH" pill badge (9px, var(--accent) bg, #fff text, 8px border-radius) in project dropdown; 3px left border var(--accent) at 40% opacity on file tree; "Remote: user@host:path" header bar. |
| SSH-ENH-05 | "Edit SSH Config" action opens ~/.ssh/config in system editor | New Rust command `ssh_open_config_in_editor` using `open::that()` or `tauri-plugin-shell` opener. Creates file if missing. |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| russh | 0.58 | SSH client (connections, auth, channels, exec) | Already used; supports multiple channels per connection for exec + PTY |
| zustand | 5.0.12 | State management (sshStore, projectStore, canvasStore) | All stores use zustand; extend existing sshStore and projectStore |
| @tauri-apps/api | 2.x | IPC invoke for Rust commands | All frontend-backend communication uses invoke() |
| @tauri-apps/plugin-shell | 2.x | Open SSH config in system editor | Already a dependency |
| dirs | 5 | Cross-platform home/data directory resolution | Already used for app data paths |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ssh2-config | 0.7.0 | Parse ~/.ssh/config files | Backend: enumerate host aliases, resolve HostName/User/Port/IdentityFile per host |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ssh2-config 0.7.0 | Custom regex parser | ssh2-config handles Include directives, Match blocks, wildcards, negated patterns; custom parser would miss edge cases |
| SSH exec for file listing | russh-sftp | russh-sftp 2.1.1 depends on russh ^0.51, incompatible with project's russh 0.58; exec is simpler and sufficient |
| open crate for editor launch | tauri-plugin-shell open | Either works; open crate is more direct, tauri-plugin-shell is already a dependency |

**Installation (Rust only):**
```toml
# In src-tauri/Cargo.toml
ssh2-config = "0.7"
```

No new frontend dependencies required.

## Architecture Patterns

### Recommended Changes to Project Structure
```
src-tauri/src/ssh/
  commands.rs       # ADD: ssh_list_config_hosts, ssh_read_remote_dir, ssh_connect_for_browsing
  config.rs         # EXTEND: SshConfigHost struct for parsed config entries
  manager.rs        # EXTEND: exec_command method, connect_without_pty method
  mod.rs            # No change

src/components/
  layout/Sidebar.tsx           # MODIFY: Remove SSH tab rendering, add SSH button in header
  sidebar/SidebarTabs.tsx      # MODIFY: Remove "ssh" from tabs array (3 tabs: Files, Piles, Git)
  sidebar/SshPanel.tsx         # REPURPOSE: Content extracted into SshQuickConnect dropdown
  sidebar/SshConnectionForm.tsx # KEEP: Reuse as modal overlay for manual connection entry
  sidebar/RemoteFileTree.tsx   # NEW: Remote file tree using sshReadRemoteDir IPC
  sidebar/SshQuickConnect.tsx  # NEW: Dropdown menu with config hosts + saved connections

src/stores/
  sshStore.ts       # EXTEND: configHosts[], activeRemoteProject, loadConfigHosts()
  projectStore.ts   # EXTEND: isRemote, sshSessionId, sshHost on Project interface

src/lib/
  ipc.ts            # ADD: sshListConfigHosts, sshReadRemoteDir, sshConnectForBrowsing, sshOpenConfigInEditor
```

### Pattern 1: SSH Config Parsing with ssh2-config 0.7.0
**What:** Parse ~/.ssh/config using the ssh2-config crate's `get_hosts()` method to enumerate all Host entries, then `query()` each for resolved parameters.
**When to use:** When loading the SSH quick-connect dropdown.
**Example:**
```rust
use ssh2_config::{ParseRule, SshConfig};
use std::io::BufReader;

#[derive(Debug, Clone, serde::Serialize)]
pub struct SshConfigHost {
    pub host_alias: String,       // The Host pattern (e.g., "myserver")
    pub hostname: Option<String>, // Resolved HostName
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

    let mut hosts = Vec::new();
    for host in config.get_hosts() {
        // Skip wildcard-only patterns (the default Host * block)
        let aliases: Vec<&str> = host.pattern.iter()
            .filter(|c| !c.negated && c.pattern != "*")
            .map(|c| c.pattern.as_str())
            .collect();

        for alias in aliases {
            let params = config.query(alias);
            hosts.push(SshConfigHost {
                host_alias: alias.to_string(),
                hostname: params.host_name.clone(),
                user: params.user.clone(),
                port: params.port,
                identity_file: params.identity_file.as_ref()
                    .and_then(|files| files.first())
                    .map(|p| p.to_string_lossy().to_string()),
            });
        }
    }
    Ok(hosts)
}
```

### Pattern 2: SSH Exec for Remote Directory Listing
**What:** Use `handle.channel_open_session()` + `exec()` to run a command on the remote server for listing directories.
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

    // Clone the handle so we can release the lock before awaiting
    let handle = session.handle.clone();
    drop(sessions); // Release lock before async operations

    // Open a new exec channel (separate from the PTY channel)
    let ch = handle.channel_open_session().await?;
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

### Pattern 3: Browsing-Only SSH Connection
**What:** Establish an SSH connection for file browsing only (no PTY, no terminal tile). The session is tracked by ID and used for exec commands.
**When to use:** When user wants to browse remote files without opening a terminal first.
**Example:**
```rust
// New command: connect for browsing (authenticate, but don't open PTY)
#[tauri::command]
pub async fn ssh_connect_for_browsing(
    host: String,
    port: u16,
    user: String,
    key_path: Option<String>,
    password: Option<String>,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    ssh_state
        .connect_browsing(session_id.clone(), host, port, user, key_path, password)
        .await
        .map_err(|e| e.to_string())?;
    Ok(session_id)
}
```

### Pattern 4: Remote Project State Extension
**What:** Extend projectStore's Project interface to support remote projects alongside local ones.
**When to use:** When a user connects via SSH and selects a remote directory to browse.
```typescript
// Extended Project interface in projectStore.ts
interface Project {
  path: string;           // For remote: "user@host:/remote/path"
  name: string;           // For remote: "/remote/path" or basename
  isRemote?: boolean;     // true for SSH-connected projects
  sshSessionId?: string;  // Links to active SSH session for exec commands
  sshHost?: string;       // Display: "user@host"
}
```

### Pattern 5: SshQuickConnect Dropdown
**What:** Dropdown anchored to SSH button in sidebar header, containing config hosts, saved connections, and action links.
**When to use:** Primary SSH entry point replacing the SSH tab.
**Structure:** As specified in 08-UI-SPEC.md -- absolute positioned, z-index 9999, sections for Config Hosts / Saved Connections / divider / Actions.

### Anti-Patterns to Avoid
- **Do not use SFTP (russh-sftp):** russh-sftp 2.1.1 depends on russh ^0.51, incompatible with project's russh 0.58. Exec-based listing is sufficient.
- **Do not parse `ls -la` output:** Column-based output varies across Linux/macOS/BSD. Use `ls -1pA` where `/` suffix indicates directories.
- **Do not use `std::path::Path` for remote paths:** Remote paths are always POSIX. Use string operations only.
- **Do not hold the sessions Mutex lock across await points:** Clone the Handle, drop the lock, then await exec. Prevents deadlocks.
- **Do not auto-connect SSH on restore:** Per Phase 05 decision, restored SSH terminals prompt for reconnect.
- **Do not make remote projects use fsReadDir IPC:** Create separate `sshReadRemoteDir` IPC to keep local/remote paths cleanly separated.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH config parsing | Custom regex parser for ~/.ssh/config | ssh2-config 0.7.0 | Handles Include directives, Match blocks, algorithm specs, wildcard patterns, negated hosts |
| Remote dir listing output parsing | Regex parser for `ls -la` columns | `ls -1pA` with `/` suffix check | Cross-platform output varies; -1pA gives one-entry-per-line with type indicator |
| SSH host key verification | Custom known_hosts file | Keep existing TOFU model (SshHandler) | Already implemented, appropriate for personal dev tool |
| Dropdown dismiss behavior | Custom focus trap | mousedown listener on document (matches existing project dropdown pattern) | Same pattern already used in Sidebar.tsx for projectDropdown |

**Key insight:** The `ssh2-config` 0.7.0 crate now provides `get_hosts()` for host enumeration (the old research noted this was missing). Each `Host` has a `pattern: Vec<HostClause>` where `HostClause` has `pattern: String` and `negated: bool`. Filter out wildcard-only hosts (`*`), then call `config.query(alias)` to get resolved `HostParams` with `host_name`, `user`, `port`, `identity_file`.

## Common Pitfalls

### Pitfall 1: SSH Session Reuse for Exec Channels
**What goes wrong:** Attempting to reuse the PTY channel for exec commands, or confusing channels with sessions.
**Why it happens:** One SSH connection (Handle) supports multiple channels simultaneously. The PTY channel is separate from exec channels.
**How to avoid:** Call `handle.channel_open_session()` for each exec command. This opens a NEW channel on the same authenticated connection. The PTY channel continues running independently.
**Warning signs:** "Channel already in use" errors or exec output appearing in the terminal.

### Pitfall 2: Mutex Deadlock on Async Exec
**What goes wrong:** Holding the `sessions` HashMap Mutex lock while awaiting the exec channel operations causes deadlock.
**Why it happens:** The exec operation is async and needs the Handle, but Handle is inside the locked HashMap.
**How to avoid:** Clone the `Handle` (it's `Clone`-able in russh), drop the lock, then perform async operations with the cloned handle.
**Warning signs:** App freezes when browsing remote files while a terminal session is active on the same connection.

### Pitfall 3: ssh2-config Host Enumeration API
**What goes wrong:** Trying to iterate hosts without knowing the API surface.
**Why it happens:** The ssh2-config API has evolved -- v0.7.0 now has `get_hosts()` returning `&Vec<Host>`.
**How to avoid:** Use `config.get_hosts()` to enumerate, filter out wildcard-only patterns (`Host *`), then `config.query(alias)` for resolved params. Each Host has `pattern: Vec<HostClause>` where `HostClause.pattern` is the alias string.
**Warning signs:** Empty host list despite valid ~/.ssh/config.

### Pitfall 4: Remote Path Handling
**What goes wrong:** Using OS-native path logic for remote POSIX paths, or confusing local and remote path separators.
**Why it happens:** Rust's `std::path::Path` uses the host OS separator. Remote hosts are (almost) always POSIX.
**How to avoid:** Use string concatenation with `/` for remote paths. Never use `Path::join()` for remote paths. Consider a simple `fn remote_path_join(base: &str, child: &str) -> String` helper.
**Warning signs:** Broken file tree on remote Linux hosts when developing on Windows (not macOS, since macOS also uses `/`).

### Pitfall 5: Connection Without PTY for File Browsing
**What goes wrong:** User must open a terminal tile before they can browse remote files.
**Why it happens:** Current SSH flow goes connection -> PTY -> terminal tile. File browsing needs a connection without a PTY.
**How to avoid:** Add a `connect_browsing()` method to SshManager that authenticates and stores the session Handle without opening a PTY channel. Exec channels can then be opened on demand.
**Warning signs:** No way to browse files until a terminal is spawned.

### Pitfall 6: SshConnectionForm Pre-fill for Config Hosts
**What goes wrong:** When a config host requires a password (no key file or key is passphrase-protected), the form doesn't know to ask.
**Why it happens:** Config hosts provide most fields but not passwords.
**How to avoid:** When connecting to a config host, attempt key auth first. If it fails, show SshConnectionForm pre-filled with host/user/port from the config, with only the password field empty.
**Warning signs:** Config host connections silently fail for password-only hosts.

## Code Examples

### Remote Directory Listing Command
```rust
// In commands.rs
#[derive(serde::Serialize)]
pub struct RemoteFileEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,  // Full remote path
}

#[tauri::command]
pub async fn ssh_read_remote_dir(
    session_id: String,
    remote_path: String,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<Vec<RemoteFileEntry>, String> {
    // ls -1pA: one per line, / suffix for dirs, shows hidden files, omits . and ..
    let cmd = format!("ls -1pA {}", shell_escape(&remote_path));
    let output = ssh_state
        .exec_command(&session_id, &cmd)
        .await
        .map_err(|e| e.to_string())?;

    let entries: Vec<RemoteFileEntry> = output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let is_dir = line.ends_with('/');
            let name = if is_dir {
                line.trim_end_matches('/').to_string()
            } else {
                line.to_string()
            };
            let path = if remote_path.ends_with('/') {
                format!("{}{}", remote_path, &name)
            } else {
                format!("{}/{}", remote_path, &name)
            };
            RemoteFileEntry { name, is_dir, path }
        })
        .collect();

    Ok(entries)
}

fn shell_escape(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\\''"))
}
```

### Opening SSH Config in System Editor
```rust
#[tauri::command]
pub fn ssh_open_config_in_editor() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let config_path = home.join(".ssh").join("config");

    // Create the file if it doesn't exist
    if !config_path.exists() {
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&config_path, "# SSH Config\n").map_err(|e| e.to_string())?;
        // Set permissions to 600 (SSH config convention)
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&config_path,
                std::fs::Permissions::from_mode(0o600)).ok();
        }
    }

    open::that(&config_path).map_err(|e| e.to_string())
}
```

### sshStore Extensions (Frontend)
```typescript
// Added to SshState interface in sshStore.ts
interface SshConfigHost {
  host_alias: string;
  hostname: string | null;
  user: string | null;
  port: number | null;
  identity_file: string | null;
}

interface ActiveRemoteProject {
  sessionId: string;
  host: string;
  user: string;
  remotePath: string;
}

// New state fields and actions
configHosts: SshConfigHost[];
activeRemoteProject: ActiveRemoteProject | null;
loadConfigHosts: () => Promise<void>;
setActiveRemoteProject: (project: ActiveRemoteProject | null) => void;
```

### Frontend IPC Additions
```typescript
// In ipc.ts
export interface SshConfigHost {
  host_alias: string;
  hostname: string | null;
  user: string | null;
  port: number | null;
  identity_file: string | null;
}

export interface RemoteFileEntry {
  name: string;
  is_dir: boolean;
  path: string;
}

export async function sshListConfigHosts(): Promise<SshConfigHost[]> {
  return invoke<SshConfigHost[]>("ssh_list_config_hosts");
}

export async function sshReadRemoteDir(
  sessionId: string,
  remotePath: string,
): Promise<RemoteFileEntry[]> {
  return invoke<RemoteFileEntry[]>("ssh_read_remote_dir", { sessionId, remotePath });
}

export async function sshConnectForBrowsing(
  host: string,
  port: number,
  user: string,
  keyPath: string | null,
  password: string | null,
): Promise<string> {
  return invoke<string>("ssh_connect_for_browsing", { host, port, user, keyPath, password });
}

export async function sshOpenConfigInEditor(): Promise<void> {
  return invoke("ssh_open_config_in_editor");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dedicated SSH tab in sidebar | SSH button in header with dropdown | This phase | Cleaner UX; SSH is an access method, not a content category |
| Manual-only SSH connections | ~/.ssh/config auto-discovery + manual | This phase | Faster workflow for users with existing SSH config |
| SSH = terminal only | SSH = terminal + remote file browsing | This phase | Enables remote development workflow |
| russh-sftp for file listing | SSH exec channels for file listing | N/A | Avoids russh version incompatibility; simpler implementation |

## Open Questions

1. **Browsing session lifecycle**
   - What we know: File browsing needs a live SSH session. Users may also have terminal sessions.
   - What's unclear: Should the browsing session be the same as an existing terminal session (reuse Handle) or a separate connection?
   - Recommendation: If a terminal session exists for the same host, reuse its Handle for exec channels. If no terminal exists, create a browsing-only session. Track both types in SshManager's sessions map.

2. **Config host connection flow when password is needed**
   - What we know: ~/.ssh/config hosts may use key auth (works automatically) or need a password.
   - What's unclear: Exact UX when key auth fails for a config host.
   - Recommendation: Attempt key auth first. On failure, open SshConnectionForm pre-filled with config host details, password field empty. This matches the UI-SPEC's note: "If auth is needed (password), opens SshConnectionForm pre-filled with config host details."

3. **open crate vs tauri-plugin-shell for editor launch**
   - What we know: Both can open files in the system default editor.
   - What's unclear: Whether to add the `open` crate or use existing tauri-plugin-shell.
   - Recommendation: Use tauri-plugin-shell's `open()` API since it's already a dependency. Avoids adding another crate. Alternatively, use `std::process::Command::new("open")` on macOS / `xdg-open` on Linux.

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
| SSH-ENH-01 | SSH tab removed; SSH button in header opens dropdown | manual (UI) | Visual verification | N/A |
| SSH-ENH-02 | Parse ~/.ssh/config and list hosts | unit (Rust) | `cargo test -p panescale ssh` | Partially -- config.rs has basic tests |
| SSH-ENH-03 | Connect to config host and browse remote dirs | manual | Requires real SSH server | Manual-only |
| SSH-ENH-04 | Remote project visually distinct with badge and border | manual (UI) | Visual verification | N/A |
| SSH-ENH-05 | "Edit SSH Config" opens config in system editor | unit (Rust) | `cargo test -p panescale ssh` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cargo test -p panescale` + `npm run test`
- **Per wave merge:** Full suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src-tauri/src/ssh/config.rs` -- extend tests for SshConfigHost parsing, host enumeration, wildcard filtering
- [ ] `src-tauri/src/ssh/commands.rs` -- test ssh_list_config_hosts returns correctly shaped data, ssh_read_remote_dir parses ls output
- [ ] SSH integration tests are manual-only (require real SSH server) -- acceptable for this domain

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src-tauri/src/ssh/` (commands.rs, config.rs, manager.rs, mod.rs) -- full existing SSH implementation with russh 0.58
- Codebase analysis: `src/components/sidebar/` (SshPanel.tsx, SshConnectionForm.tsx, SidebarTabs.tsx), `src/components/layout/Sidebar.tsx` -- current sidebar layout and SSH tab
- Codebase analysis: `src/stores/sshStore.ts`, `src/hooks/useSsh.ts`, `src/stores/projectStore.ts`, `src/stores/canvasStore.ts` -- frontend state and patterns
- Cargo.toml: russh 0.58 with aws-lc-rs confirmed
- 08-UI-SPEC.md: Complete design contract with component inventory, interaction contracts, state contracts, copywriting

### Secondary (MEDIUM confidence)
- [ssh2-config 0.7.0 docs](https://docs.rs/ssh2-config/0.7.0/ssh2_config/) -- verified `get_hosts()` returns `&Vec<Host>`, `Host` has `pattern: Vec<HostClause>`, `HostClause` has `pattern: String` and `negated: bool`, `HostParams` has `host_name`, `user`, `port`, `identity_file`
- [ssh2-config on crates.io](https://crates.io/crates/ssh2-config) -- v0.7.0 confirmed current, updated 24 days ago
- [russh-sftp](https://crates.io/crates/russh-sftp) -- v2.1.1 still latest, depends on russh ^0.51 (incompatible with 0.58)

### Tertiary (LOW confidence)
- `ls -1pA` cross-platform behavior -- based on POSIX knowledge; tested on Linux/macOS but not all BSD variants

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- builds on existing codebase, one small new Rust dependency (ssh2-config 0.7.0 verified)
- Architecture: HIGH -- sidebar restructure follows existing dropdown patterns; SSH exec channels are well-understood in russh
- Pitfalls: HIGH -- identified from codebase analysis (russh-sftp incompatibility, Handle clone for deadlock avoidance, ssh2-config API verified)
- Remote file browsing: MEDIUM -- exec-based approach is simple but `ls -1pA` output parsing across all POSIX systems has edge cases (filenames with newlines, special characters)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
