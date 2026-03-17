use tauri::ipc::Channel;

use super::manager::{PtyEvent, PtyManager};

/// Spawn a new PTY session. Returns the session ID.
///
/// The `on_event` channel receives `PtyEvent::Data` for output and `PtyEvent::Exit` on termination.
#[tauri::command]
pub async fn pty_spawn(
    cwd: String,
    cols: u16,
    rows: u16,
    on_event: Channel<PtyEvent>,
    state: tauri::State<'_, PtyManager>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    state
        .spawn(id.clone(), cwd, cols, rows, on_event)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

/// Write input bytes to a running PTY session.
#[tauri::command]
pub async fn pty_write(
    pty_id: String,
    data: Vec<u8>,
    state: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    state.write(&pty_id, &data).map_err(|e| e.to_string())
}

/// Resize a running PTY session.
#[tauri::command]
pub async fn pty_resize(
    pty_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    state
        .resize(&pty_id, cols, rows)
        .map_err(|e| e.to_string())
}

/// Kill a PTY session and clean up all resources.
#[tauri::command]
pub async fn pty_kill(
    pty_id: String,
    state: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    state.kill(&pty_id).map_err(|e| e.to_string())
}
