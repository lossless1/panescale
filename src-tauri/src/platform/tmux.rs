use std::process::Command;
use tauri::ipc::Channel;

/// Progress events streamed during tmux auto-installation.
#[derive(Clone, serde::Serialize)]
pub struct InstallProgress {
    pub stage: String,
    pub message: String,
}

pub struct TmuxBridge;

const SESSION_PREFIX: &str = "exc-";

impl TmuxBridge {
    /// Get the path to the Panescale-dedicated tmux socket.
    /// Uses the app data directory for persistence across reboots.
    fn socket_path() -> Result<String, String> {
        let data_dir = dirs::data_dir()
            .ok_or("Could not determine data directory")?;
        let app_dir = data_dir.join("panescale");
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app dir: {}", e))?;
        Ok(app_dir.join("tmux.sock").to_string_lossy().to_string())
    }

    /// Build a tmux Command with the dedicated socket pre-injected.
    fn tmux_cmd() -> Result<Command, String> {
        let sock = Self::socket_path()?;
        let mut cmd = Command::new("tmux");
        cmd.arg("-S").arg(&sock);
        Ok(cmd)
    }

    /// Configure the tmux server to hide all UI artifacts.
    /// Runs every time a session is created to ensure options are applied
    /// even if the tmux server was restarted externally (e.g. kill-server).
    fn configure_server() -> Result<(), String> {
        let options: &[&[&str]] = &[
            &["set-option", "-g", "status", "off"],
            &["set-option", "-g", "prefix", "None"],
            &["set-option", "-g", "prefix2", "None"],
            &["set-option", "-g", "escape-time", "0"],
            &["set-option", "-g", "mouse", "off"],
            // Disable alternate screen so xterm.js keeps its own scrollback buffer.
            // Without this, tmux uses alternate screen mode which causes xterm.js
            // to convert scroll events into arrow keys (command history cycling).
            &["set-option", "-ga", "terminal-overrides", ",xterm*:smcup@:rmcup@"],
        ];

        for args in options {
            let _ = Self::tmux_cmd()?.args(*args).output();
        }

        Ok(())
    }

    /// Check if tmux is available on this system
    pub fn is_available() -> bool {
        Command::new("tmux")
            .arg("-V")
            .output()
            .map_or(false, |o| o.status.success())
    }

    /// Create a new detached tmux session running the user's shell.
    /// Session name format: "exc-{tile_id}"
    pub fn create_session(tile_id: &str, shell: &str, cwd: &str) -> Result<String, String> {
        let session_name = format!("{}{}", SESSION_PREFIX, tile_id);

        let output = Self::tmux_cmd()?
            .args([
                "new-session",
                "-d",
                "-s",
                &session_name,
                "-c",
                cwd,
                "-x",
                "80",
                "-y",
                "24",
                shell,
            ])
            .env_remove("TMUX") // Prevent nested session error
            .output()
            .map_err(|e| format!("Failed to create tmux session: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "tmux new-session failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        // Configure server AFTER creating the session (new-session starts the
        // server if it wasn't running).  Always run — the server may have been
        // restarted externally since our last configure.
        let _ = Self::configure_server();
        // Also apply per-session status off as a belt-and-suspenders measure
        let _ = Self::tmux_cmd()?
            .args(["set-option", "-t", &session_name, "status", "off"])
            .output();

        Ok(session_name)
    }

    /// Return the command args to attach to an existing session.
    /// The PTY should spawn this command instead of the shell directly.
    pub fn attach_args(session_name: &str) -> Result<Vec<String>, String> {
        let sock = Self::socket_path()?;
        Ok(vec![
            "tmux".into(),
            "-S".into(),
            sock,
            "attach-session".into(),
            "-t".into(),
            session_name.into(),
        ])
    }

    /// List all excalicode-managed tmux sessions (prefixed with "exc-")
    pub fn list_sessions() -> Result<Vec<String>, String> {
        let output = Self::tmux_cmd()?
            .args(["list-sessions", "-F", "#{session_name}"])
            .output()
            .map_err(|e| format!("Failed to list tmux sessions: {}", e))?;
        if !output.status.success() {
            // tmux returns error if no server is running (no sessions) -- this is normal
            return Ok(Vec::new());
        }
        Ok(String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|s| s.starts_with(SESSION_PREFIX))
            .map(|s| s.to_string())
            .collect())
    }

    /// Kill a tmux session
    pub fn kill_session(session_name: &str) -> Result<(), String> {
        Self::tmux_cmd()?
            .args(["kill-session", "-t", session_name])
            .output()
            .map_err(|e| format!("Failed to kill tmux session: {}", e))?;
        Ok(())
    }

    /// Check if a specific session exists
    pub fn session_exists(session_name: &str) -> bool {
        Self::tmux_cmd()
            .and_then(|mut cmd| {
                cmd.args(["has-session", "-t", session_name])
                    .output()
                    .map_err(|e| format!("{}", e))
            })
            .map_or(false, |o| o.status.success())
    }

    /// Capture the visible pane content for instant restore display
    #[allow(dead_code)]
    pub fn capture_pane(session_name: &str) -> Result<String, String> {
        let output = Self::tmux_cmd()?
            .args(["capture-pane", "-t", session_name, "-p", "-S", "-"])
            .output()
            .map_err(|e| format!("Failed to capture pane: {}", e))?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// Extract tile ID from session name
    pub fn tile_id_from_session(session_name: &str) -> Option<&str> {
        session_name.strip_prefix(SESSION_PREFIX)
    }

    /// Ensure tmux is installed, auto-installing if missing.
    /// Streams progress events to the provided Channel.
    /// Returns Ok(true) if tmux was already installed.
    /// Returns Ok(false) if tmux was just installed successfully.
    /// Returns Err if installation failed.
    pub fn ensure_installed(progress: &Channel<InstallProgress>) -> Result<bool, String> {
        if Self::is_available() {
            let _ = progress.send(InstallProgress {
                stage: "done".into(),
                message: "tmux is available".into(),
            });
            return Ok(true);
        }

        #[cfg(target_os = "macos")]
        {
            Self::install_via_brew(progress)
        }
        #[cfg(target_os = "linux")]
        {
            Self::install_via_linux(progress)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            let _ = progress;
            Err("Auto-install not supported on this platform".into())
        }
    }

    #[cfg(target_os = "macos")]
    fn install_via_brew(progress: &Channel<InstallProgress>) -> Result<bool, String> {
        if Command::new("brew").arg("--version").output().is_err() {
            return Err(
                "Homebrew not found. Install Homebrew first: https://brew.sh".into(),
            );
        }
        let _ = progress.send(InstallProgress {
            stage: "installing".into(),
            message: "Installing tmux via Homebrew...".into(),
        });
        let output = Command::new("brew")
            .args(["install", "tmux"])
            .output()
            .map_err(|e| format!("brew install failed: {}", e))?;
        if !output.status.success() {
            return Err(format!(
                "brew install tmux failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        let _ = progress.send(InstallProgress {
            stage: "done".into(),
            message: "tmux installed successfully".into(),
        });
        Ok(false)
    }

    #[cfg(target_os = "linux")]
    fn install_via_linux(progress: &Channel<InstallProgress>) -> Result<bool, String> {
        let (pkg_manager, args) =
            if Command::new("apt-get").arg("--version").output().is_ok() {
                ("apt-get", vec!["install", "-y", "tmux"])
            } else if Command::new("pacman").arg("--version").output().is_ok() {
                ("pacman", vec!["-S", "--noconfirm", "tmux"])
            } else {
                return Err(
                    "No supported package manager found (tried apt-get, pacman)".into(),
                );
            };
        let _ = progress.send(InstallProgress {
            stage: "installing".into(),
            message: format!("Installing tmux via {}...", pkg_manager),
        });
        let output = Command::new(pkg_manager)
            .args(&args)
            .output()
            .map_err(|e| format!("{} install failed: {}", pkg_manager, e))?;
        if !output.status.success() {
            return Err(format!(
                "{} install tmux failed: {}",
                pkg_manager,
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        let _ = progress.send(InstallProgress {
            stage: "done".into(),
            message: "tmux installed successfully".into(),
        });
        Ok(false)
    }

    /// Clean up orphaned sessions (sessions with no matching tile ID in the given set)
    pub fn cleanup_orphans(active_tile_ids: &[String]) -> Result<usize, String> {
        let sessions = Self::list_sessions()?;
        let mut cleaned = 0;
        for session in &sessions {
            if let Some(tile_id) = Self::tile_id_from_session(session) {
                if !active_tile_ids.contains(&tile_id.to_string()) {
                    Self::kill_session(session)?;
                    cleaned += 1;
                }
            }
        }
        Ok(cleaned)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_id_from_session_valid() {
        assert_eq!(
            TmuxBridge::tile_id_from_session("exc-abc123"),
            Some("abc123")
        );
    }

    #[test]
    fn test_tile_id_from_session_invalid() {
        assert_eq!(TmuxBridge::tile_id_from_session("other-session"), None);
    }

    #[test]
    fn test_session_name_format() {
        let tile_id = "test-tile-42";
        let expected = format!("exc-{}", tile_id);
        // Verify that attach_args produces the correct session name reference
        let args = TmuxBridge::attach_args(&expected).unwrap();
        assert_eq!(args[0], "tmux");
        assert_eq!(args[1], "-S");
        // args[2] is the socket path
        assert_eq!(args[3], "attach-session");
        assert_eq!(args[4], "-t");
        assert_eq!(args[5], expected);
    }

    #[test]
    fn test_attach_args_structure() {
        let args = TmuxBridge::attach_args("exc-my-tile").unwrap();
        assert_eq!(args.len(), 6);
        assert_eq!(args[0], "tmux");
        assert_eq!(args[1], "-S");
        assert_eq!(args[3], "attach-session");
    }

    #[test]
    fn test_socket_path_contains_panescale() {
        let path = TmuxBridge::socket_path().unwrap();
        assert!(path.contains("panescale"), "Socket path should contain 'panescale'");
        assert!(path.ends_with("tmux.sock"), "Socket path should end with 'tmux.sock'");
    }
}
