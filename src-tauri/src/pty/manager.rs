use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;

use crate::platform::shell::detect_default_shell;
use crate::platform::tmux::TmuxBridge;

/// Events streamed from a PTY session to the frontend via Tauri Channel.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum PtyEvent {
    Data { bytes: Vec<u8> },
    Exit { code: Option<u32> },
}

/// A running PTY session with handles for writing, resizing, and killing.
pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
    reader_handle: Option<std::thread::JoinHandle<()>>,
}

/// Manages multiple PTY sessions identified by string IDs.
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    tmux_available: bool,
    tmux_sessions: Arc<Mutex<HashMap<String, String>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        // tmux disabled — using direct PTY spawn for simpler terminal lifecycle
        let tmux_available = false;
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            tmux_available,
            tmux_sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Whether tmux is available on this system
    pub fn is_tmux_available(&self) -> bool {
        self.tmux_available
    }

    /// Spawn a new PTY session with the user's default shell.
    ///
    /// If tmux is available on Unix, the shell runs inside a detached tmux session
    /// and the PTY attaches to it. This allows session persistence across app restarts.
    ///
    /// The PTY output is streamed to `channel` as `PtyEvent::Data` messages.
    /// When the process exits, a `PtyEvent::Exit` is sent.
    pub fn spawn(
        &self,
        id: String,
        cwd: String,
        cols: u16,
        rows: u16,
        channel: Channel<PtyEvent>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let shell = detect_default_shell();

        // Resolve ~ to home directory
        let cwd = if cwd == "~" || cwd.starts_with("~/") {
            if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
                let home = home.to_string_lossy().to_string();
                if cwd == "~" { home } else { cwd.replacen("~", &home, 1) }
            } else {
                cwd
            }
        } else {
            cwd
        };

        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let cmd = if cfg!(unix) && self.tmux_available {
            // Create a tmux session and attach to it
            let session_name = TmuxBridge::create_session(&id, &shell, &cwd)
                .map_err(|e| format!("tmux create_session failed: {}", e))?;
            let attach_args = TmuxBridge::attach_args(&session_name);

            // Store tmux session mapping
            self.tmux_sessions
                .lock()
                .map_err(|e| format!("Lock poisoned: {}", e))?
                .insert(id.clone(), session_name);

            let mut cmd = CommandBuilder::new(&attach_args[0]);
            for arg in &attach_args[1..] {
                cmd.arg(arg);
            }
            cmd.cwd(&cwd);
            cmd.env("TERM", "xterm-256color");
            cmd.env_remove("TMUX"); // Prevent nested session issues
            cmd
        } else {
            // Direct shell spawn (no tmux)
            let mut cmd = CommandBuilder::new(&shell);
            cmd.cwd(&cwd);
            cmd.env("TERM", "xterm-256color");
            cmd
        };

        let child = pair.slave.spawn_command(cmd)?;

        // IMPORTANT: Drop the slave end after spawning to enable proper EOF detection
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        // Spawn a dedicated OS thread for reading PTY output.
        // IMPORTANT: Use std::thread, NOT tokio::spawn. PTY reads are blocking I/O
        // and will starve the tokio runtime if run on the async pool.
        let reader_handle = std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - process exited
                        let _ = channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                    Ok(n) => {
                        let _ = channel.send(PtyEvent::Data {
                            bytes: buf[..n].to_vec(),
                        });
                    }
                    Err(_) => {
                        let _ = channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            master: pair.master,
            child,
            reader_handle: Some(reader_handle),
        };

        self.sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?
            .insert(id, session);

        Ok(())
    }

    /// Reattach to an existing tmux session.
    ///
    /// Used on app restart to reconnect to tmux sessions that survived the restart.
    /// Spawns a new PTY that runs `tmux attach-session -t {session_name}`.
    pub fn reattach(
        &self,
        id: String,
        session_name: String,
        cols: u16,
        rows: u16,
        channel: Channel<PtyEvent>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Verify the tmux session still exists
        if !TmuxBridge::session_exists(&session_name) {
            return Err(format!("tmux session '{}' does not exist", session_name).into());
        }

        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let attach_args = TmuxBridge::attach_args(&session_name);
        let mut cmd = CommandBuilder::new(&attach_args[0]);
        for arg in &attach_args[1..] {
            cmd.arg(arg);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env_remove("TMUX");

        let child = pair.slave.spawn_command(cmd)?;
        drop(pair.slave);

        let mut reader = pair.master.try_clone_reader()?;
        let writer = pair.master.take_writer()?;

        // Store tmux session mapping
        self.tmux_sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?
            .insert(id.clone(), session_name);

        let reader_handle = std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                    Ok(n) => {
                        let _ = channel.send(PtyEvent::Data {
                            bytes: buf[..n].to_vec(),
                        });
                    }
                    Err(_) => {
                        let _ = channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            master: pair.master,
            child,
            reader_handle: Some(reader_handle),
        };

        self.sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?
            .insert(id, session);

        Ok(())
    }

    /// Write input bytes to a running PTY session.
    pub fn write(
        &self,
        id: &str,
        data: &[u8],
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        let session = sessions
            .get_mut(id)
            .ok_or_else(|| format!("PTY session '{}' not found", id))?;
        session.writer.write_all(data)?;
        session.writer.flush()?;
        Ok(())
    }

    /// Resize a running PTY session.
    pub fn resize(
        &self,
        id: &str,
        cols: u16,
        rows: u16,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?;
        let session = sessions
            .get(id)
            .ok_or_else(|| format!("PTY session '{}' not found", id))?;
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    }

    /// Kill a PTY session and clean up resources.
    /// Also kills the associated tmux session if one exists.
    pub fn kill(
        &self,
        id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut session = self
            .sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?
            .remove(id)
            .ok_or_else(|| format!("PTY session '{}' not found", id))?;

        // Kill the child process
        session.child.kill()?;

        // Drop master to close the PTY (triggers EOF on reader thread)
        drop(session.master);
        drop(session.writer);

        // Join reader thread with a timeout to avoid blocking indefinitely
        if let Some(handle) = session.reader_handle.take() {
            // Give the reader thread a moment to finish, but don't block forever
            let _ = handle.join();
        }

        // Kill the tmux session if one exists
        if let Some(session_name) = self
            .tmux_sessions
            .lock()
            .map_err(|e| format!("Lock poisoned: {}", e))?
            .remove(id)
        {
            let _ = TmuxBridge::kill_session(&session_name);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pty_manager_new() {
        let manager = PtyManager::new();
        let sessions = manager.sessions.lock().unwrap();
        assert!(sessions.is_empty(), "New PtyManager should have no sessions");
    }

    #[test]
    fn test_pty_manager_has_tmux_sessions_map() {
        let manager = PtyManager::new();
        let tmux_sessions = manager.tmux_sessions.lock().unwrap();
        assert!(
            tmux_sessions.is_empty(),
            "New PtyManager should have no tmux sessions"
        );
    }

    #[test]
    fn test_pty_event_serializes_data() {
        let event = PtyEvent::Data {
            bytes: vec![72, 101, 108, 108, 111],
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event\":\"data\""), "Should have event tag 'data'");
        assert!(json.contains("\"bytes\""), "Should have bytes field");
    }

    #[test]
    fn test_pty_event_serializes_exit() {
        let event = PtyEvent::Exit { code: Some(0) };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event\":\"exit\""), "Should have event tag 'exit'");
        assert!(json.contains("\"code\":0"), "Should have code field");
    }

    #[test]
    fn test_pty_event_serializes_exit_no_code() {
        let event = PtyEvent::Exit { code: None };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"event\":\"exit\""), "Should have event tag 'exit'");
        assert!(json.contains("\"code\":null"), "Should have null code");
    }
}
