use tauri::ipc::Channel;

use super::manager::{PtyEvent, PtyManager};
use crate::platform::tmux::{InstallProgress, TmuxBridge};

/// Spawn a new PTY session. Returns the session ID.
///
/// The `on_event` channel receives `PtyEvent::Data` for output and `PtyEvent::Exit` on termination.
#[tauri::command]
pub async fn pty_spawn(
    node_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
    on_event: Channel<PtyEvent>,
    state: tauri::State<'_, PtyManager>,
) -> Result<String, String> {
    // Use the React Flow node ID so tmux session name (exc-{id}) matches on restore
    state
        .spawn(node_id.clone(), cwd, cols, rows, on_event)
        .map_err(|e| e.to_string())?;
    Ok(node_id)
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

/// Detach from a PTY session without killing the tmux session (for unmount/app close).
#[tauri::command]
pub async fn pty_detach(
    pty_id: String,
    state: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    state.detach(&pty_id).map_err(|e| e.to_string())
}

/// Reattach to an existing tmux session (used on app restart for session persistence).
#[tauri::command]
pub async fn pty_reattach(
    pty_id: String,
    session_name: String,
    cols: u16,
    rows: u16,
    on_event: Channel<PtyEvent>,
    state: tauri::State<'_, PtyManager>,
) -> Result<(), String> {
    state
        .reattach(pty_id, session_name, cols, rows, on_event)
        .map_err(|e| e.to_string())
}

/// Get the default shell name (e.g. "zsh", "bash").
#[tauri::command]
pub fn pty_default_shell() -> String {
    let shell = crate::platform::shell::detect_default_shell();
    std::path::Path::new(&shell)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "shell".to_string())
}

/// Check if tmux is available on this system.
#[tauri::command]
pub async fn pty_tmux_available(
    state: tauri::State<'_, PtyManager>,
) -> Result<bool, String> {
    Ok(state.is_tmux_available())
}

/// List all excalicode-managed tmux sessions.
#[tauri::command]
pub async fn pty_tmux_list_sessions() -> Result<Vec<String>, String> {
    TmuxBridge::list_sessions()
}

/// Clean up orphaned tmux sessions not in the given active tile ID list.
#[tauri::command]
pub async fn pty_tmux_cleanup(active_ids: Vec<String>) -> Result<usize, String> {
    TmuxBridge::cleanup_orphans(&active_ids)
}

/// Ensure tmux is installed, auto-installing via brew (macOS) or apt/pacman (Linux) if missing.
/// Streams progress events to the provided channel.
/// Returns true if tmux was already installed, false if it was just installed.
#[tauri::command]
pub async fn pty_ensure_tmux(on_progress: Channel<InstallProgress>) -> Result<bool, String> {
    TmuxBridge::ensure_installed(&on_progress)
}
