use tauri::Manager;

mod fs;
mod git;
mod platform;
mod pty;
mod ssh;
mod state;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        // .plugin(tauri_plugin_updater::Builder::new().build()) // Disabled until signing keys are configured
        .on_window_event(|window, event| {
            // macOS behavior: hide window on close instead of quitting the app
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                #[cfg(target_os = "macos")]
                {
                    window.hide().unwrap_or_default();
                    api.prevent_close();
                }
            }
        })
        .manage(pty::PtyManager::new())
        .manage(ssh::SshManager::new())
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
            fs::commands::fs_create_file,
            fs::commands::fs_create_dir,
            fs::commands::fs_rename,
            fs::commands::fs_delete,
            fs::commands::fs_move,
            git::commands::git_is_repo,
            git::commands::git_status,
            git::commands::git_stage_file,
            git::commands::git_unstage_file,
            git::commands::git_commit,
            git::commands::git_diff_file,
            git::commands::git_stage_hunk,
            git::commands::git_unstage_hunk,
            git::commands::git_branches,
            git::commands::git_create_branch,
            git::commands::git_switch_branch,
            git::commands::git_delete_branch,
            git::commands::git_log,
            git::commands::git_stash_save,
            git::commands::git_stash_list,
            git::commands::git_stash_apply,
            git::commands::git_stash_pop,
            git::commands::git_stash_drop,
            git::commands::git_conflicts,
            git::commands::git_resolve_conflict,
            ssh::commands::ssh_connect,
            ssh::commands::ssh_write,
            ssh::commands::ssh_resize,
            ssh::commands::ssh_disconnect,
            ssh::commands::ssh_save_connections,
            ssh::commands::ssh_load_connections,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS: re-show window when dock icon is clicked
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}
