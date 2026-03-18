use std::process::Command;

pub struct TmuxBridge;

const SESSION_PREFIX: &str = "exc-";

impl TmuxBridge {
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
        let output = Command::new("tmux")
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
        Ok(session_name)
    }

    /// Return the command args to attach to an existing session.
    /// The PTY should spawn this command instead of the shell directly.
    pub fn attach_args(session_name: &str) -> Vec<String> {
        vec![
            "tmux".into(),
            "attach-session".into(),
            "-t".into(),
            session_name.into(),
        ]
    }

    /// List all excalicode-managed tmux sessions (prefixed with "exc-")
    pub fn list_sessions() -> Result<Vec<String>, String> {
        let output = Command::new("tmux")
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
        Command::new("tmux")
            .args(["kill-session", "-t", session_name])
            .output()
            .map_err(|e| format!("Failed to kill tmux session: {}", e))?;
        Ok(())
    }

    /// Check if a specific session exists
    pub fn session_exists(session_name: &str) -> bool {
        Command::new("tmux")
            .args(["has-session", "-t", session_name])
            .output()
            .map_or(false, |o| o.status.success())
    }

    /// Capture the visible pane content for instant restore display
    pub fn capture_pane(session_name: &str) -> Result<String, String> {
        let output = Command::new("tmux")
            .args(["capture-pane", "-t", session_name, "-p", "-S", "-"])
            .output()
            .map_err(|e| format!("Failed to capture pane: {}", e))?;
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    /// Extract tile ID from session name
    pub fn tile_id_from_session(session_name: &str) -> Option<&str> {
        session_name.strip_prefix(SESSION_PREFIX)
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
        let args = TmuxBridge::attach_args(&expected);
        assert_eq!(args[0], "tmux");
        assert_eq!(args[1], "attach-session");
        assert_eq!(args[2], "-t");
        assert_eq!(args[3], expected);
    }

    #[test]
    fn test_attach_args_structure() {
        let args = TmuxBridge::attach_args("exc-my-tile");
        assert_eq!(args.len(), 4);
        assert_eq!(args[0], "tmux");
        assert_eq!(args[1], "attach-session");
    }
}
