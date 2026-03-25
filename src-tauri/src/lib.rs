use tauri::{Manager, Emitter};
use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem, MenuItemBuilder};

mod fs;
mod git;
mod platform;
mod proxy;
mod pty;
mod ssh;
mod state;

struct ProxyPort(std::sync::Arc<std::sync::atomic::AtomicU16>);

#[tauri::command]
fn get_proxy_port(state: tauri::State<'_, ProxyPort>) -> u16 {
    state.0.load(std::sync::atomic::Ordering::Relaxed)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            // Start local proxy for iframe embedding
            let proxy_port = std::sync::Arc::new(std::sync::atomic::AtomicU16::new(0));
            let proxy_port_clone = proxy_port.clone();
            app.manage(ProxyPort(proxy_port.clone()));
            tauri::async_runtime::spawn(async move {
                let port = proxy::start_proxy().await;
                proxy_port_clone.store(port, std::sync::atomic::Ordering::Relaxed);
                eprintln!("[proxy] Listening on http://127.0.0.1:{}", port);
            });

            // Build native macOS menu bar
            let preferences = MenuItemBuilder::with_id("preferences", "Preferences…")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "Panescale")
                .item(&PredefinedMenuItem::about(app, Some("About Panescale"), None)?)
                .separator()
                .item(&preferences)
                .separator()
                .item(&PredefinedMenuItem::hide(app, Some("Hide Panescale"))?)
                .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
                .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
                .separator()
                .item(&PredefinedMenuItem::quit(app, Some("Quit Panescale"))?)
                .build()?;

            let new_terminal = MenuItemBuilder::with_id("new-terminal", "New Terminal")
                .accelerator("CmdOrCtrl+T")
                .build(app)?;
            let new_ssh = MenuItemBuilder::with_id("new-ssh", "New SSH Connection")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let new_note = MenuItemBuilder::with_id("new-note", "New Note")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_terminal)
                .item(&new_ssh)
                .item(&new_note)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let zoom_in = MenuItemBuilder::with_id("zoom-in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(app)?;
            let zoom_out = MenuItemBuilder::with_id("zoom-out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(app)?;
            let zoom_reset = MenuItemBuilder::with_id("zoom-reset", "Reset Zoom")
                .accelerator("CmdOrCtrl+0")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&zoom_in)
                .item(&zoom_out)
                .item(&zoom_reset)
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::fullscreen(app, None)?)
                .build()?;

            let website = MenuItemBuilder::with_id("help-website", "Panescale Website")
                .build(app)?;
            let report_issue = MenuItemBuilder::with_id("help-report-issue", "Report Issue")
                .build(app)?;
            let keyboard_shortcuts = MenuItemBuilder::with_id("help-shortcuts", "Keyboard Shortcuts")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&keyboard_shortcuts)
                .separator()
                .item(&website)
                .item(&report_issue)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(move |app_handle, event| {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let id = event.id().0.as_str();
                    match id {
                        "preferences" => { let _ = window.emit("open-settings", ()); }
                        "new-terminal" => { let _ = window.emit("menu-new-terminal", ()); }
                        "new-ssh" => { let _ = window.emit("menu-new-ssh", ()); }
                        "new-note" => { let _ = window.emit("menu-new-note", ()); }
                        "zoom-in" => { let _ = window.emit("menu-zoom-in", ()); }
                        "zoom-out" => { let _ = window.emit("menu-zoom-out", ()); }
                        "zoom-reset" => { let _ = window.emit("menu-zoom-reset", ()); }
                        "help-shortcuts" => { let _ = window.emit("menu-shortcuts", ()); }
                        "help-website" => { let _ = open::that("https://panescale.com"); }
                        "help-report-issue" => { let _ = open::that("https://github.com/panescale/panescale/issues"); }
                        _ => {}
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            pty::commands::pty_detach,
            pty::commands::pty_reattach,
            pty::commands::pty_tmux_available,
            pty::commands::pty_default_shell,
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
            ssh::commands::ssh_list_config_hosts,
            ssh::commands::ssh_read_remote_dir,
            ssh::commands::ssh_connect_for_browsing,
            ssh::commands::ssh_open_config_in_editor,
            get_proxy_port,
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
