use tauri::ipc::Channel;

use super::config::SshConfigHost;
use super::manager::{SshEvent, SshManager};

/// Connect to an SSH server. Returns the session ID.
///
/// The `on_event` channel receives `SshEvent::Data` for output and `SshEvent::Exit` on termination.
#[tauri::command]
pub async fn ssh_connect(
    connection_id: String,
    password: Option<String>,
    cols: u16,
    rows: u16,
    // Optional direct connection params — used when connection isn't in the config store
    host: Option<String>,
    port: Option<u16>,
    user: Option<String>,
    key_path: Option<String>,
    on_event: Channel<SshEvent>,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<String, String> {
    // Try to load from saved connections first, fall back to direct params
    let (conn_host, conn_port, conn_user, conn_key) = {
        let store = ssh_state.get_config_store().await;
        if let Some(config) = store.get_connection(&connection_id) {
            (config.host.clone(), config.port, config.user.clone(), config.key_path.clone())
        } else if let (Some(h), Some(u)) = (&host, &user) {
            (h.clone(), port.unwrap_or(22), u.clone(), key_path.clone())
        } else {
            return Err(format!("Connection '{}' not found and no direct params provided", connection_id));
        }
    };

    let session_id = uuid::Uuid::new_v4().to_string();
    ssh_state
        .connect(
            session_id.clone(),
            conn_host,
            conn_port,
            conn_user,
            conn_key,
            password,
            cols as u32,
            rows as u32,
            on_event,
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(session_id)
}

/// Write input bytes to an active SSH session.
#[tauri::command]
pub async fn ssh_write(
    session_id: String,
    data: Vec<u8>,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<(), String> {
    ssh_state
        .write(&session_id, &data)
        .await
        .map_err(|e| e.to_string())
}

/// Resize the remote PTY of an SSH session.
#[tauri::command]
pub async fn ssh_resize(
    session_id: String,
    cols: u16,
    rows: u16,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<(), String> {
    ssh_state
        .resize(&session_id, cols as u32, rows as u32)
        .await
        .map_err(|e| e.to_string())
}

/// Disconnect an SSH session and clean up.
#[tauri::command]
pub async fn ssh_disconnect(
    session_id: String,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<(), String> {
    ssh_state
        .disconnect(&session_id)
        .await
        .map_err(|e| e.to_string())
}

/// Save SSH connections to persistent storage.
#[tauri::command]
pub async fn ssh_save_connections(
    connections_json: String,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<(), String> {
    let parsed: super::config::SshConnectionStore =
        serde_json::from_str(&connections_json).map_err(|e| format!("Invalid JSON: {}", e))?;
    let mut store = ssh_state.get_config_store().await;
    store.connections = parsed.connections;
    store.groups = parsed.groups;
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

/// Load SSH connections from persistent storage.
#[tauri::command]
pub async fn ssh_load_connections(
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<String, String> {
    let store = ssh_state.get_config_store().await;
    serde_json::to_string(&*store).map_err(|e| e.to_string())
}

/// List hosts from ~/.ssh/config.
#[tauri::command]
pub fn ssh_list_config_hosts() -> Result<Vec<SshConfigHost>, String> {
    use ssh2_config::{ParseRule, SshConfig};
    use std::io::BufReader;

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

/// Remote directory listing via SSH exec channel.
#[derive(serde::Serialize)]
pub struct RemoteFileEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
}

#[tauri::command]
pub async fn ssh_read_remote_dir(
    session_id: String,
    remote_path: String,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<Vec<RemoteFileEntry>, String> {
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

/// Connect for file browsing only (no PTY).
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

/// Open ~/.ssh/config in system default editor. Creates file if missing.
#[tauri::command]
pub fn ssh_open_config_in_editor() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("No home directory")?;
    let config_path = home.join(".ssh").join("config");

    if !config_path.exists() {
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&config_path, "# SSH Config\n").map_err(|e| e.to_string())?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&config_path,
                std::fs::Permissions::from_mode(0o600)).ok();
        }
    }

    open::that(&config_path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ssh_list_config_hosts_returns_ok_when_no_config() {
        // If ~/.ssh/config does not exist, should return Ok(empty vec)
        // This test works on any machine -- the command handles missing file gracefully
        let result = ssh_list_config_hosts();
        assert!(result.is_ok());
    }

    #[test]
    fn test_shell_escape_basic() {
        assert_eq!(shell_escape("/home/user"), "'/home/user'");
    }

    #[test]
    fn test_shell_escape_single_quotes() {
        assert_eq!(shell_escape("it's"), "'it'\\''s'");
    }

    #[test]
    fn test_remote_file_entry_serialization() {
        let entry = RemoteFileEntry {
            name: "src".to_string(),
            is_dir: true,
            path: "/home/user/src".to_string(),
        };
        let json = serde_json::to_string(&entry).unwrap();
        assert!(json.contains("\"is_dir\":true"));
        assert!(json.contains("\"name\":\"src\""));
    }
}
