mod fs;
mod platform;
mod pty;
mod state;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(pty::PtyManager::new())
        .invoke_handler(tauri::generate_handler![
            pty::commands::pty_spawn,
            pty::commands::pty_write,
            pty::commands::pty_resize,
            pty::commands::pty_kill,
            pty::commands::pty_reattach,
            pty::commands::pty_tmux_available,
            pty::commands::pty_tmux_list_sessions,
            pty::commands::pty_tmux_cleanup,
            pty::commands::pty_ensure_tmux,
            state::state_save,
            state::state_load,
            fs::commands::fs_read_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
