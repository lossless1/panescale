use tauri::ipc::Channel;

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
    on_event: Channel<SshEvent>,
    ssh_state: tauri::State<'_, SshManager>,
) -> Result<String, String> {
    // Load connection config from saved connections
    let config = {
        let store = ssh_state.get_config_store().await;
        store
            .get_connection(&connection_id)
            .cloned()
            .ok_or_else(|| format!("Connection '{}' not found", connection_id))?
    };

    let session_id = uuid::Uuid::new_v4().to_string();
    ssh_state
        .connect(
            session_id.clone(),
            config.host,
            config.port,
            config.user,
            config.key_path,
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
