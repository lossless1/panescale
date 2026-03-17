use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;

use crate::platform::shell::detect_default_shell;

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
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawn a new PTY session with the user's default shell.
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

        let pty_system = native_pty_system();
        let pair = pty_system.openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&cwd);
        cmd.env("TERM", "xterm-256color");

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
